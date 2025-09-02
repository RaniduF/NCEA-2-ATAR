from sqlalchemy.orm import Session
from ..models import standard_models
from ..schemas.calculation import UserStandardInput
from typing import List, Dict
import math


class ATARCalculator:
    def __init__(self, db: Session, user_standards: List[UserStandardInput]):
        self.db = db
        self.user_standards = user_standards
        self.all_standards_info = self._get_all_standards_info()
        self.all_weightings = self._get_all_weightings()
        self.all_distributions = self._get_all_distributions()
        # --- NEW: Load participation rate data ---
        self.participation_rates = self._get_participation_rates()

    def _get_all_standards_info(self):
        standards = self.db.query(standard_models.Standard).all()
        return {s.standard_number: s for s in standards}

    def _get_all_weightings(self):
        weightings = self.db.query(standard_models.StandardWeighting).all()
        lookup = {}
        for w in weightings:
            if w.standard_number not in lookup: lookup[w.standard_number] = []
            lookup[w.standard_number].append(w)
        return lookup

    def _get_weight_for_grade(self, w, g):
        m = {"Excellence": w.weight_excellence, "Merit": w.weight_merit,
             "Achieved": w.weight_achieved,
             "Not Achieved": w.weight_not_achieved}
        weight_value = m.get(g)
        
        # Return None if weight is null, let caller handle exclusion
        if weight_value is None:
            return None
            
        return float(weight_value)

    def _get_all_distributions(self) -> Dict[int, List[Dict]]:
        distributions = self.db.query(
            standard_models.ATARDistribution).order_by(
            standard_models.ATARDistribution.academic_year,
            standard_models.ATARDistribution.statistical_value.desc()
        ).all()
        lookup = {}
        for d in distributions:
            year = d.academic_year
            if year not in lookup: lookup[year] = {"distribution": []}
            lookup[year]["distribution"].append(
                {"value": float(d.statistical_value), "count": d.frequency})
        return lookup

    def _get_participation_rates(self) -> Dict[int, int]:
        """Fetches the weighted population for each year."""
        rates = self.db.query(standard_models.ParticipationRate).all()
        return {r.academic_year: r.weighted_statnz_population for r in rates}

    def calculate_for_all_years(self) -> List[Dict]:
        """The main public method with dynamic ATAR band calculation."""
        all_year_results = []
        available_years = sorted(list(self.all_distributions.keys()),
                                 reverse=True)

        for year in available_years:
            user_stat_value = self._calculate_statistical_value_for_year(year)
            if user_stat_value is None: continue

            year_dist_data = self.all_distributions.get(year)
            year_pop_data = self.participation_rates.get(year)
            if not year_dist_data or not year_pop_data: continue

            students_per_band = round(float(year_pop_data) * 0.0005) # 0.05%
            if students_per_band == 0: continue

            # --- Rank Calculation ---
            user_rank = 1
            for entry in year_dist_data["distribution"]:
                if user_stat_value >= entry["value"]:
                    break
                user_rank += entry["count"]

            # --- Final ATAR Conversion (Corrected Logic) ---
            # The ATAR scale has 2000 bands from 99.95 down to 0.00 in 0.05 increments.
            # We calculate the user's position on this full scale.
            band_index = (user_rank - 1) // students_per_band

            estimated_atar = 99.95 - (band_index * 0.05)

            all_year_results.append({
                "year": year,
                "estimated_atar": max(0.0, round(estimated_atar, 2)),
                # Ensure ATAR is not negative
                "statistical_value": user_stat_value
            })

        return all_year_results

    def _calculate_statistical_value_for_year(self, year: int) -> float | None:
        # Process standards using cross-year logic - use historical weights from the year each standard was taken
        processed_standards = []
        
        # Group standards by standard_number to handle duplicates
        standards_by_number = {}
        for user_std in self.user_standards:
            std_num = user_std.standard_number
            if std_num not in standards_by_number:
                standards_by_number[std_num] = []
            standards_by_number[std_num].append(user_std)
        
        # For each standard, select the best result according to NCEA rules
        for std_num, std_results in standards_by_number.items():
            std_info = self.all_standards_info.get(std_num)
            if not std_info: 
                continue
                
            best_result = self._select_best_standard_result(std_results, std_num)
            if not best_result:
                continue
                
            # Use historical weights from the year achieved, or iterative mode (current year) if not specified
            weight_year = best_result.year_achieved if best_result.year_achieved else year
            weight_version = best_result.standard_version
            
            # Get weightings for specific year and version
            year_weightings = [w for w in self.all_weightings.get(std_num, []) 
                             if w.academic_year == weight_year]
            
            # Filter by version if specified
            if weight_version is not None:
                version_weightings = [w for w in year_weightings if w.standard_version == weight_version]
                if version_weightings:
                    year_weightings = version_weightings
                # If specified version not found, fall back to any version for that year
            
            # If no version specified, use latest version for that year
            if weight_version is None and year_weightings:
                # Use the latest version for that year
                latest_version = max(year_weightings, key=lambda w: w.standard_version)
                year_weightings = [latest_version]
            
            # Fallback to current year if historical year not available
            if not year_weightings:
                current_year_weightings = [w for w in self.all_weightings.get(std_num, []) 
                                         if w.academic_year == year]
                if current_year_weightings:
                    # Use latest version for current year
                    latest_version = max(current_year_weightings, key=lambda w: w.standard_version)
                    year_weightings = [latest_version]
            
            if not year_weightings: 
                continue
                
            weighting = self._get_weight_for_grade(year_weightings[0], best_result.grade)
            
            # Exclude standards with null, zero, or very low weights (indicates no valid data for that year)
            if weighting is None or weighting <= 0.001:
                continue
                
            hierarchy = self._get_standard_hierarchy(std_info)
            
            processed_standards.append({
                "credits": std_info.credits, 
                "weight": weighting,
                "hierarchy": hierarchy,
                "standard_number": std_num,
                "grade": best_result.grade,
                "year_achieved": weight_year
            })

        sorted_standards = sorted(processed_standards,
                                  key=lambda x: (x['hierarchy'], -x['weight']))

        best_standards_for_calc = []
        credits_counted = 0
        for std in sorted_standards:
            if credits_counted >= 90: break
            credits_to_add = std['credits']
            if credits_counted + credits_to_add > 90:
                credits_to_add = 90 - credits_counted
            best_standards_for_calc.append(
                {"credits": credits_to_add, "weight": std['weight']})
            credits_counted += credits_to_add

        if credits_counted == 0: return 0.0

        total_weighted_score = sum(
            s['credits'] * s['weight'] for s in best_standards_for_calc)
        return total_weighted_score / 90
    
    def _select_best_standard_result(self, std_results, std_num):
        """
        Select the best result for a standard according to NCEA rules:
        1. Highest grade (Excellence > Merit > Achieved > Not Achieved)
        2. If same grade, use highest weight from the year achieved
        """
        if not std_results:
            return None
            
        grade_priority = {"Excellence": 4, "Merit": 3, "Achieved": 2, "Not Achieved": 1}
        
        # Sort by grade priority first, then by weight
        def get_sort_key(user_std):
            weight_year = user_std.year_achieved if user_std.year_achieved else 2024  # Default to iterative mode (latest year)
            weight_version = user_std.standard_version
            
            year_weightings = [w for w in self.all_weightings.get(std_num, []) 
                             if w.academic_year == weight_year]
            
            # Filter by version if specified, otherwise use latest version
            if weight_version is not None:
                version_weightings = [w for w in year_weightings if w.standard_version == weight_version]
                if version_weightings:
                    year_weightings = version_weightings
            elif year_weightings:
                # Use latest version for that year
                latest_version = max(year_weightings, key=lambda w: w.standard_version)
                year_weightings = [latest_version]
            
            weight = 0.0
            if year_weightings:
                weight_value = self._get_weight_for_grade(year_weightings[0], user_std.grade)
                # Use weight if valid, otherwise 0.0 for sorting purposes
                if weight_value is not None and weight_value > 0.001:
                    weight = weight_value
            
            return (grade_priority.get(user_std.grade, 0), weight)
        
        return max(std_results, key=get_sort_key)
    
    def _get_standard_hierarchy(self, std_info):
        """Extract hierarchy calculation into separate method for clarity"""
        if std_info.is_ue:
            return 1 if std_info.standards_type == 'Achievement Standard' else 2
        elif std_info.standards_type == 'Achievement Standard':
            return 3
        return 4