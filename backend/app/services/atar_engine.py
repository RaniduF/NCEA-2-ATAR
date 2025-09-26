from sqlalchemy.orm import Session
from sqlalchemy import func
from ..models import standard_models
from ..schemas.calculation import UserStandardInput
from ..schemas import calculation as calc_schemas
from typing import List, Dict, Tuple
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

    def _get_latest_weight_year(self) -> int:
        """Get the latest available academic year from standard weightings.
        
        Returns:
            int: The latest academic year available in the database, 
                 or 2024 as fallback if no data is found.
        """
        try:
            latest_year = self.db.query(func.max(standard_models.StandardWeighting.academic_year)).scalar()
            return latest_year if latest_year is not None else 2024
        except Exception:
            # Fallback to safe default if query fails
            return 2024

    def _estimate_atar_from_stat(self, stat_value: float, year: int) -> float | None:
        dist = self.all_distributions.get(year)
        pop = self.participation_rates.get(year)
        if not dist or not pop:
            return None
        students_per_band = round(float(pop) * 0.0005)
        if students_per_band == 0:
            return None
        user_rank = 1
        for entry in dist["distribution"]:
            if stat_value >= entry["value"]:
                break
            user_rank += entry["count"]
        band_index = (user_rank - 1) // students_per_band
        return max(0.0, round(99.95 - (band_index * 0.05), 2))

    def calculate_for_all_years(self) -> List[Dict]:
        """The main public method with dynamic ATAR band calculation."""
        all_year_results = []
        available_years = sorted(list(self.all_distributions.keys()),
                                 reverse=True)

        for year in available_years:
            user_stat_value = self._calculate_statistical_value_for_year(year)
            if user_stat_value is None: continue

            estimated_atar = self._estimate_atar_from_stat(user_stat_value, year)
            if estimated_atar is None:
                continue

            all_year_results.append({
                "year": year,
                "estimated_atar": estimated_atar,
                "statistical_value": user_stat_value
            })

        return all_year_results

    # --- New: Public breakdown method ---
    def calculate_breakdown(self) -> calc_schemas.CalculationBreakdownResponse:
        years_breakdown: List[calc_schemas.YearlyBreakdown] = []
        subjects_breakdowns: List[calc_schemas.SubjectSSPBreakdown] = []

        available_years = sorted(list(self.all_distributions.keys()), reverse=True)
        for year in available_years:
            # Build best-90 breakdown and compute statistical value
            best90, totals, excluded, stat_value = self._build_best90_breakdown(year)
            if stat_value is None:
                continue

            # Convert stat value to estimated ATAR using distribution and participation rate
            estimated_atar = self._estimate_atar_from_stat(stat_value, year)
            if estimated_atar is None:
                continue

            years_breakdown.append(calc_schemas.YearlyBreakdown(
                year=year,
                estimated_atar=estimated_atar,
                statistical_value=stat_value,
                best90=best90,
                totals=totals,
                excluded=excluded
            ))

            # Also compute SSP per-subject breakdown for the user's subjects
            subjects_breakdowns.extend(self._build_subject_ssp_breakdowns(year))

        return calc_schemas.CalculationBreakdownResponse(
            years=years_breakdown,
            subjects=subjects_breakdowns
        )

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
                latest_version = max(year_weightings, key=lambda w: w.standard_version or 0)
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
            weight_year = user_std.year_achieved if user_std.year_achieved else self._get_latest_weight_year()  # Default to latest available year
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
                latest_version = max(year_weightings, key=lambda w: w.standard_version or 0)
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
            return 1 if (std_info.standards_type or '').lower().startswith('achievement') else 2
        elif (std_info.standards_type or '').lower().startswith('achievement'):
            return 3
        return 4

    # --- New: Helpers for breakdown selection ---
    def _priority_tier(self, std_info: standard_models.Standard) -> int:
        is_achievement = (std_info.standards_type or '').lower().startswith('achievement')
        is_unit = (std_info.standards_type or '').lower().startswith('unit')
        if std_info.is_ue and is_achievement:
            return 1
        if std_info.is_ue and is_unit:
            return 2
        if (not std_info.is_ue) and is_achievement:
            return 3
        return 4

    def _get_weight_for(self, std_num: int, grade: str, year: int, version: int | None) -> float | None:
        year_weightings = [w for w in self.all_weightings.get(std_num, []) if w.academic_year == year]
        if version is not None:
            filtered = [w for w in year_weightings if w.standard_version == version]
            if filtered:
                year_weightings = filtered
        elif year_weightings:
            latest = max(year_weightings, key=lambda w: w.standard_version or 0)
            year_weightings = [latest]
        if not year_weightings:
            return None
        return self._get_weight_for_grade(year_weightings[0], grade)

    def _build_best90_breakdown(self, year: int) -> Tuple[List[calc_schemas.StandardContribution], calc_schemas.BreakdownTotals, List[calc_schemas.ExcludedItem], float | None]:
        # Step 1: best result per standard
        by_number: Dict[int, List[UserStandardInput]] = {}
        for us in self.user_standards:
            by_number.setdefault(us.standard_number, []).append(us)

        candidates = []
        for std_num, results in by_number.items():
            std_info = self.all_standards_info.get(std_num)
            if not std_info:
                continue
            best = self._select_best_standard_result(results, std_num)
            if not best:
                continue
            weight_year = best.year_achieved if best.year_achieved else year
            weight = self._get_weight_for(std_num, best.grade, weight_year, best.standard_version)
            if weight is None or weight <= 0.001:
                continue
            tier = self._priority_tier(std_info)
            candidates.append({
                'std_info': std_info,
                'std_num': std_num,
                'grade': best.grade,
                'year_achieved': weight_year,
                'version': best.standard_version,
                'credits': std_info.credits,
                'weight': float(min(max(weight, 0.0), 1.0)),
                'tier': tier
            })

        # Sort by tier then weight desc
        candidates.sort(key=lambda x: (x['tier'], -x['weight']))

        best90: List[calc_schemas.StandardContribution] = []
        excluded: List[calc_schemas.ExcludedItem] = []
        subject_used: Dict[str, float] = {}
        total_used = 0.0
        prorated_count = 0
        rank = 0

        for c in candidates:
            if total_used >= 90:
                excluded.append(calc_schemas.ExcludedItem(standard_number=c['std_num'], reason="not in top 90"))
                continue
            subject = c['std_info'].subject or "Unknown"
            subj_used = subject_used.get(subject, 0.0)
            subj_remaining = max(0.0, 24.0 - subj_used)
            if subj_remaining <= 0.0:
                excluded.append(calc_schemas.ExcludedItem(standard_number=c['std_num'], reason="subject cap 24 reached"))
                continue

            global_remaining = max(0.0, 90.0 - total_used)
            if global_remaining <= 0.0:
                excluded.append(calc_schemas.ExcludedItem(standard_number=c['std_num'], reason="not in top 90"))
                continue

            credits_avail = float(c['credits'])
            credits_to_take = min(credits_avail, subj_remaining, global_remaining)
            if credits_to_take <= 0.0:
                excluded.append(calc_schemas.ExcludedItem(standard_number=c['std_num'], reason="no remaining capacity"))
                continue

            rank += 1
            pro_rated = credits_to_take < credits_avail
            if pro_rated:
                prorated_count += 1

            contribution = credits_to_take * c['weight']
            new_subj_used = subj_used + credits_to_take
            subject_used[subject] = new_subj_used
            total_used += credits_to_take

            best90.append(calc_schemas.StandardContribution(
                selection_rank=rank,
                standard_number=c['std_num'],
                title=c['std_info'].title,
                subject=subject,
                is_ue=bool(c['std_info'].is_ue),
                standards_type=c['std_info'].standards_type,
                grade=c['grade'],
                year_achieved=c['year_achieved'],
                weight_applied=c['weight'],
                credits_available=int(credits_avail),
                credits_used=float(credits_to_take),
                pro_rated=pro_rated,
                contribution=float(contribution),
                subject_credits_used_to_date=float(new_subj_used),
                subject_capped=new_subj_used >= 24.0,
                priority_tier=int(c['tier'])
            ))

        total_contribution = sum(x.contribution for x in best90)
        totals = calc_schemas.BreakdownTotals(
            total_contribution=float(total_contribution),
            denominator_credits=90,
            total_credits_used=float(total_used),
            subject_caps={k: float(v) for k, v in subject_used.items()},
            prorated_count=int(prorated_count)
        )

        if total_used <= 0.0:
            return best90, totals, excluded, None

        stat_value = float(total_contribution) / 90.0
        return best90, totals, excluded, stat_value

    def _build_subject_ssp_breakdowns(self, year: int) -> List[calc_schemas.SubjectSSPBreakdown]:
        # Organize user's best result per standard by subject
        by_number: Dict[int, List[UserStandardInput]] = {}
        for us in self.user_standards:
            by_number.setdefault(us.standard_number, []).append(us)

        by_subject: Dict[str, List[Dict]] = {}
        for std_num, results in by_number.items():
            std_info = self.all_standards_info.get(std_num)
            if not std_info:
                continue
            subject = std_info.subject or "Unknown"
            best = self._select_best_standard_result(results, std_num)
            if not best:
                continue
            weight_year = best.year_achieved if best.year_achieved else year
            weight = self._get_weight_for(std_num, best.grade, weight_year, best.standard_version)
            if weight is None or weight <= 0.001:
                continue
            tier = self._priority_tier(std_info)
            by_subject.setdefault(subject, []).append({
                'std_info': std_info,
                'std_num': std_num,
                'grade': best.grade,
                'year_achieved': weight_year,
                'credits': std_info.credits,
                'weight': float(min(max(weight, 0.0), 1.0)),
                'tier': tier
            })

        outputs: List[calc_schemas.SubjectSSPBreakdown] = []
        for subject, items in by_subject.items():
            # Sort by priority and weight
            items.sort(key=lambda x: (x['tier'], -x['weight']))
            used: List[calc_schemas.StandardContribution] = []
            credits_mapped = 0.0
            rank = 0
            for c in items:
                if credits_mapped >= 18.0:
                    break
                avail = float(c['credits'])
                remain = max(0.0, 18.0 - credits_mapped)
                take = min(avail, remain)
                if take <= 0.0:
                    continue
                rank += 1
                is_pr = take < avail
                contrib = take * c['weight']
                credits_mapped += take
                used.append(calc_schemas.StandardContribution(
                    selection_rank=rank,
                    standard_number=c['std_num'],
                    title=c['std_info'].title,
                    subject=subject,
                    is_ue=bool(c['std_info'].is_ue),
                    standards_type=c['std_info'].standards_type,
                    grade=c['grade'],
                    year_achieved=c['year_achieved'],
                    weight_applied=c['weight'],
                    credits_available=int(avail),
                    credits_used=float(take),
                    pro_rated=is_pr,
                    contribution=float(contrib),
                    subject_credits_used_to_date=float(credits_mapped),
                    subject_capped=False,
                    priority_tier=int(c['tier'])
                ))

            total_credits_available = sum(float(x['credits']) for x in items)
            eligible = total_credits_available >= 18.0
            ssp_score = (sum(u.contribution for u in used) / 18.0) if eligible else None
            outputs.append(calc_schemas.SubjectSSPBreakdown(
                subject=subject,
                year=year,
                eligible=eligible,
                ssp_score=float(ssp_score) if ssp_score is not None else None,
                denominator_credits=18,
                items=used
            ))

        return outputs