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
        return float(m.get(g, 0.0) or 0.0)

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
        # This function remains unchanged.
        processed_standards = []
        for user_std in self.user_standards:
            std_info = self.all_standards_info.get(user_std.standard_number)
            if not std_info: continue
            year_weightings = [w for w in self.all_weightings.get(
                user_std.standard_number, []) if w.academic_year == year]
            if not year_weightings: continue
            weighting = self._get_weight_for_grade(year_weightings[0],
                                                   user_std.grade)
            hierarchy = 4
            if std_info.is_ue:
                hierarchy = 1 if std_info.standards_type == 'Achievement Standard' else 2
            elif std_info.standards_type == 'Achievement Standard':
                hierarchy = 3
            processed_standards.append(
                {"credits": std_info.credits, "weight": weighting,
                 "hierarchy": hierarchy})

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