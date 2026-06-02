from sqlalchemy.orm import Session
from sqlalchemy import func
from ..models import standard_models
from ..schemas.calculation import UserStandardInput
from ..schemas import calculation as calc_schemas
from ..core import data_cache
from typing import List, Dict, Tuple
import math


class ATARCalculator:
    def __init__(self, db: Session, user_standards: List[UserStandardInput]):
        self.db = db
        self.user_standards = user_standards
        self._standard_numbers = {us.standard_number for us in user_standards}
        self.all_standards_info = self._get_all_standards_info()
        self.all_weightings = self._get_all_weightings()

        cached_dist = data_cache.get_distributions()
        self.all_distributions = cached_dist if cached_dist is not None else self._get_all_distributions()

        cached_rates = data_cache.get_participation_rates()
        self.participation_rates = cached_rates if cached_rates is not None else self._get_participation_rates()

        cached_map = data_cache.get_atar_map()
        self.atar_map = cached_map if cached_map is not None else {}

        cached_year = data_cache.get_latest_weight_year()
        self._latest_weight_year = cached_year if cached_year is not None else self._get_latest_weight_year()

    def _get_all_standards_info(self):
        standards = self.db.query(standard_models.Standard).filter(
            standard_models.Standard.standard_number.in_(self._standard_numbers)
        ).all()
        return {s.standard_number: s for s in standards}

    def _get_all_weightings(self):
        weightings = self.db.query(standard_models.StandardWeighting).filter(
            standard_models.StandardWeighting.standard_number.in_(self._standard_numbers)
        ).all()
        lookup = {}
        for w in weightings:
            if w.standard_number not in lookup: lookup[w.standard_number] = []
            lookup[w.standard_number].append(w)
        return lookup

    def _get_weight_for_grade(self, w, g):
        """
        Map a StandardWeighting to the numeric weight for a given grade.
        
        Parameters:
            w: StandardWeighting-like object with attributes `weight_excellence`, `weight_merit`, `weight_achieved`, and `weight_not_achieved`.
            g (str): Grade name, expected one of "Excellence", "Merit", "Achieved", or "Not Achieved".
        
        Returns:
            float: The numeric weight for the given grade.
            None: If the weighting for the specified grade is null or the grade is unrecognized.
        """
        m = {"Excellence": w.weight_excellence, "Merit": w.weight_merit,
             "Achieved": w.weight_achieved,
             "Not Achieved": w.weight_not_achieved}
        weight_value = m.get(g)
        
        # Return None if weight is null, let caller handle exclusion
        if weight_value is None:
            return None
            
        return float(weight_value)

    def _get_all_distributions(self) -> Dict[int, List[Dict]]:
        """
        Builds a lookup of ATAR distributions indexed by academic year.
        
        Each year maps to a dictionary with a "distribution" key containing an ordered list of buckets. Each bucket is a dict with:
        - "value": the statistical value as a float
        - "count": the frequency/count as an integer
        
        Returns:
            distributions_by_year (Dict[int, Dict[str, List[Dict]]]): Mapping from academic year to distribution data.
        """
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

    def _get_participation_rates(self) -> Dict[int, Dict]:
        """
        Return a mapping from academic year to participation rate data.
        
        Each entry contains the weighted StatNZ population and the NZ total candidature,
        which are used to derive the participation rate for ATAR band calculation.
        
        Returns:
            dict[int, dict]: Mapping where keys are academic years and values are dicts
            with 'population' (weighted StatNZ population) and 'candidature' (NZ total candidature).
        """
        rates = self.db.query(standard_models.ParticipationRate).all()
        return {
            r.academic_year: {
                'population': float(r.weighted_statnz_population),
                'candidature': int(r.nz_total_candidature)
            }
            for r in rates
        }

    def _get_latest_weight_year(self) -> int | None:
        try:
            return self.db.query(func.max(standard_models.StandardWeighting.academic_year)).scalar()
        except Exception:
            return None

    @staticmethod
    def _f_pr(x: float, pr: float) -> float:
        """
        Harrison-Hyndman one-parameter participation model point estimate.

        Returns the participation-adjusted allocation factor at proportion rank x.
        This is a density/point-estimate function, NOT a cumulative distribution.

        Three regimes:
          - Low participation  (PR < 0.25):  f(x) = x^((1-PR)/PR)
          - Mid-range          (0.25 ≤ PR ≤ 0.75): piecewise cubic spline
          - High participation (PR > 0.75):  f(x) = 1 - (1-x)^(PR/(1-PR))

        Parameters:
            x (float): Proportion rank, in [0, 1] (i.e. ATAR / 100).
            pr (float): Overall participation rate E / Y, as a fraction.

        Returns:
            float: The f_PR(x) value in [0, 1].
        """
        if pr < 0.25:
            # Low participation rate: power function
            if x <= 0.0:
                return 0.0
            return x ** ((1.0 - pr) / pr)
        elif pr > 0.75:
            # High participation rate: power function
            if x >= 1.0:
                return 1.0
            return 1.0 - (1.0 - x) ** (pr / (1.0 - pr))
        else:
            # Mid-range participation rate: cubic spline
            alpha = 1.5 - 2.0 * pr
            if x <= alpha:
                if alpha <= 0.0:
                    return 0.0
                return (x ** 3) / (alpha ** 2)
            else:
                if alpha >= 1.0:
                    return 1.0
                return 1.0 - ((1.0 - x) ** 3) / ((1.0 - alpha) ** 2)

    def _build_atar_map_for_year(self, year: int) -> list | None:
        """
        Compute the ATAR band map on-the-fly for a given year using the
        Harrison-Hyndman spline, as a fallback when no precalculated atar_map
        table exists in the database.

        Returns a list of (atar_band, cumulative_limit) tuples sorted descending
        by atar_band (99.95 first), or None if participation data is unavailable.
        """
        rate_data = self.participation_rates.get(year)
        if not rate_data:
            return None

        population = rate_data['population']
        candidature = rate_data['candidature']
        if population <= 0 or candidature <= 0:
            return None

        pr = candidature / population
        h = population / 2000.0

        result = []
        cum = 0.0
        for i in range(1999, -1, -1):  # 99.95 down to 0.00
            band = round(i * 0.05, 2)
            x = i * 0.05 / 100.0
            f_val = self._f_pr(x, pr)
            places = f_val * h
            cum += places
            result.append((band, cum))
        return result

    def _estimate_atar_from_stat(self, stat_value: float, year: int) -> float | None:
        dist = self.all_distributions.get(year)
        rate_data = self.participation_rates.get(year)
        if not dist or not rate_data:
            return None
            
        distribution_list = dist.get("distribution", [])
        if not distribution_list:
            return None
            
        min_stat_value = distribution_list[-1]["value"]
        if stat_value < min_stat_value:
            return 0.0
        
        population = rate_data['population']
        candidature = rate_data['candidature']
        
        if population <= 0 or candidature <= 0:
            return None
            
        # FIX 1: The Epsilon tie-breaker
        # Guarantees microscopic floating-point errors don't inflate your rank
        epsilon = 1e-12
        user_rank = 1
        for entry in distribution_list:
            if stat_value >= entry["value"] - epsilon:
                break
            user_rank += entry["count"]
            
        # FIX 2: The ACTAC Continuous Integral limit
        p = (candidature / population) * 100.0  # Formula requires a percentage (e.g., 63.86)
        N = candidature
        
        def get_cumulative_limit(atar_x: float) -> float:
            """Calculates the exact upper bound capacity for ATARs >= x"""
            if 0 <= atar_x <= 150 - (2 * p):
                return N * (1 - (math.pow(atar_x, 4) / (400 * p * math.pow(150 - 2*p, 2))))
            else:
                return (N / p) * (100 - atar_x - (math.pow(100 - atar_x, 4) / (400 * math.pow(50 - 2*p, 2))))

        # Find the highest ATAR band where the user's rank fits within the cumulative limit
        for band_step in range(2000):
            atar = round(99.95 - (band_step * 0.05), 2)
            limit = get_cumulative_limit(atar)
            
            if user_rank <= limit:
                return atar
                
        return 0.0

    def calculate_for_all_years(self) -> List[Dict]:
        """
        Compute estimated ATAR and the corresponding statistical value for each available academic year.
        
        For each year with sufficient data, produces one result containing the academic year, the estimated ATAR, and the computed statistical value. Years lacking the required distribution or user-statistic data are skipped.
        
        Returns:
            results (List[Dict]): A list of dictionaries, each with keys:
                - "year" (int): Academic year.
                - "estimated_atar" (float): Estimated ATAR for that year.
                - "statistical_value" (float): The computed statistical value used to estimate the ATAR.
        """
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
        """
        Compute yearly ATAR-like breakdowns and per-subject SSP breakdowns for each available distribution year.
        
        For each academic year with distribution data, builds a Best-90 contribution breakdown and a statistical value; if a valid statistical value is produced, converts it to an estimated ATAR using the year's distribution and participation rate. Years with missing or non-convertible data are skipped. Also assembles per-subject SSP breakdowns for each processed year.
        
        Returns:
            calc_schemas.CalculationBreakdownResponse: Contains `years`, a list of YearlyBreakdown entries (year, estimated_atar, statistical_value, best90, totals, excluded), and `subjects`, a list of SubjectSSPBreakdown entries for per-subject SSP results.
        """
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
        """
        Compute the year-specific weighted statistical value using each standard's historical weight and a best-90 credits selection.
        
        This aggregates the user's standards by standard number, selects the best result per standard, resolves an appropriate weight (preferring the year achieved and specified version, falling back to the requested year), excludes standards with missing or negligible weights, then selects up to 90 credits by hierarchy and weight (prorating the final standard if needed). The returned value is the total weighted contribution divided by 90.
        
        Parameters:
            year (int): Academic year used to resolve weight fallbacks when a standard's historical weight is unavailable.
        
        Returns:
            float: The computed statistical value (total weighted score / 90). Returns 0.0 when no credits contribute.
        """
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
                
            hierarchy = self._priority_tier(std_info)
            
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
        Choose the single best UserStandardInput for a given standard according to NCEA priorities.
        
        Selects the result with the highest grade (Excellence > Merit > Achieved > Not Achieved) and, among equal grades, the one with the highest applicable weighting for the year/version associated with the result. If a result has no year_achieved, the latest available weighting year is used as a fallback.
        
        Parameters:
            std_results (Iterable[UserStandardInput]): Candidate user standard results for the same standard number.
            std_num (int): The standard number used to look up applicable weightings.
        
        Returns:
            UserStandardInput | None: The chosen best result, or `None` if `std_results` is empty.
        """
        if not std_results:
            return None
            
        grade_priority = {"Excellence": 4, "Merit": 3, "Achieved": 2, "Not Achieved": 1}
        
        # Sort by grade priority first, then by weight
        def get_sort_key(user_std):
            """
            Compute a sort key for a user's standard result used to choose the best result.
            
            Looks up the applicable weighting for the user's grade (respecting year and optional version), maps invalid or missing weights to 0.0, and pairs that weight with a grade-priority integer to form the sort key.
            
            Parameters:
                user_std: The user's standard result to evaluate.
            
            Returns:
                tuple: (grade_priority, weight) where `grade_priority` is an integer ranking the grade (higher is better) and `weight` is the numeric weight applied for sorting (0.0 if no valid weight).
            """
            weight_year = user_std.year_achieved if user_std.year_achieved else self._latest_weight_year
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
    
    def _priority_tier(self, std_info: standard_models.Standard) -> int:
        """
        Determine the numeric priority tier for a standard based on its UE status and standards_type.
        
        Parameters:
            std_info (standard_models.Standard): Standard record whose `is_ue` flag and `standards_type` are evaluated.
        
        Returns:
            int: Priority tier where 1 = UE achievement, 2 = UE unit, 3 = non-UE achievement, 4 = all other cases.
        """
        is_achievement = (std_info.standards_type or '').lower().startswith('achievement')
        is_unit = (std_info.standards_type or '').lower().startswith('unit')
        if std_info.is_ue and is_achievement:
            return 1
        if std_info.is_ue and is_unit:
            return 2
        if (not std_info.is_ue) and is_achievement:
            return 3
        return 4

    def _get_weight_info(self, std_num: int, grade: str, year: int, version: int | None, fallback_year: int | None = None) -> Tuple[float | None, int | None, int | None]:
        """
        Retrieve the numeric weighting applied, along with the actual year and version used.
        If no weighting exists in `year`, it falls back to `fallback_year` if provided.
        """
        year_weightings = [w for w in self.all_weightings.get(std_num, []) if w.academic_year == year]
        used_year = year

        if not year_weightings and fallback_year is not None:
            year_weightings = [w for w in self.all_weightings.get(std_num, []) if w.academic_year == fallback_year]
            used_year = fallback_year

        if version is not None:
            filtered = [w for w in year_weightings if w.standard_version == version]
            if filtered:
                year_weightings = filtered
            elif year_weightings:
                latest = max(year_weightings, key=lambda w: w.standard_version or 0)
                year_weightings = [latest]
        elif year_weightings:
            latest = max(year_weightings, key=lambda w: w.standard_version or 0)
            year_weightings = [latest]

        if not year_weightings:
            return None, None, None

        used_version = year_weightings[0].standard_version
        return self._get_weight_for_grade(year_weightings[0], grade), used_year, used_version

    def _get_weight_for(self, std_num: int, grade: str, year: int, version: int | None) -> float | None:
        """
        Legacy helper for retrieving numeric weighting without fallback or version info.
        """
        weight, _, _ = self._get_weight_info(std_num, grade, year, version)
        return weight

    def _get_max_grade_weight(self, std_num: int, year: int, version: int | None, standards_type: str | None) -> float | None:
        """
        Retrieve the maximum possible grade weight for a standard (Excellence for Achievement Standards, Achieved for Unit Standards).
        
        Parameters:
            std_num (int): Standard identifier number.
            year (int): Academic year to search weightings in.
            version (int | None): Optional standard version to prefer.
            standards_type (str | None): The type of standard (to determine max grade).
        
        Returns:
            float | None: The weight value for the max grade if found, `None` otherwise.
        """
        # Determine max grade based on standards type
        is_unit_standard = (standards_type or '').lower().startswith('unit')
        max_grade = 'Achieved' if is_unit_standard else 'Excellence'
        
        # Use existing helper to get weight for max grade
        return self._get_weight_for(std_num, max_grade, year, version)

    def _build_best90_breakdown(self, year: int) -> Tuple[List[calc_schemas.StandardContribution], calc_schemas.BreakdownTotals, List[calc_schemas.ExcludedItem], float | None]:
        # Step 1: best result per standard
        """
        Builds the "best 90 credits" contribution breakdown for a given academic year.
        
        Returns the ordered list of selected standard contributions (up to 90 credits, respecting per-subject caps and prorating), aggregated totals for the breakdown, the list of standards excluded with reasons, and the computed statistical value for the year.
        
        Parameters:
        	year (int): Academic year used to resolve weightings when selecting and scoring standards.
        
        Returns:
        	tuple:
        		- best90 (List[calc_schemas.StandardContribution]): Selected contributions in selection order (each entry includes credits used, weight applied, contribution, prorated flag, and subject running totals).
        		- totals (calc_schemas.BreakdownTotals): Aggregated totals including total contribution, denominator credits (90), total credits used, per-subject caps used, and prorated count.
        		- excluded (List[calc_schemas.ExcludedItem]): Standards not included with a short reason (e.g., subject cap reached, not in top 90).
        		- statistical_value (float | None): Total contribution divided by 90 when any credits were used, otherwise `None`.
        """
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
            weight, used_y, used_v = self._get_weight_info(std_num, best.grade, weight_year, best.standard_version, fallback_year=year)
            if weight is None or weight <= 0.001:
                continue

            fallback_reasons = []
            if best.year_achieved and used_y != best.year_achieved:
                fallback_reasons.append(f"No {best.year_achieved} weight available, used {used_y}")
            elif used_y != year:
                fallback_reasons.append(f"Using {used_y} weight in {year} calculation")
                
            if best.standard_version is not None and used_v != best.standard_version:
                fallback_reasons.append(f"Version {best.standard_version} unattainable, defaulted to v{used_v}")

            fallback_reason_str = " & ".join(fallback_reasons) if fallback_reasons else None

            tier = self._priority_tier(std_info)
            candidates.append({
                'std_info': std_info,
                'std_num': std_num,
                'grade': best.grade,
                'year_achieved': weight_year,
                'version': best.standard_version,
                'credits': std_info.credits,
                'weight': float(min(max(weight, 0.0), 1.0)),
                'tier': tier,
                'fallback_reason': fallback_reason_str
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
                _excl_max_w = self._get_max_grade_weight(c['std_num'], c['year_achieved'], c['version'], c['std_info'].standards_type)
                excluded.append(calc_schemas.ExcludedItem(
                    standard_number=c['std_num'],
                    reason="not in top 90",
                    title=c['std_info'].title,
                    subject=c['std_info'].subject,
                    grade=c['grade'],
                    weight_applied=c['weight'],
                    weight_at_max_grade=float(_excl_max_w) if _excl_max_w is not None else None,
                    standards_type=c['std_info'].standards_type,
                    assessment_type=c['std_info'].assessment_type,
                    credits_available=int(c['credits'])
                ))
                continue
            subject = c['std_info'].subject or "Unknown"
            subj_used = subject_used.get(subject, 0.0)
            subj_remaining = max(0.0, 24.0 - subj_used)
            if subj_remaining <= 0.0:
                _excl_max_w = self._get_max_grade_weight(c['std_num'], c['year_achieved'], c['version'], c['std_info'].standards_type)
                excluded.append(calc_schemas.ExcludedItem(
                    standard_number=c['std_num'],
                    reason="subject cap 24 reached",
                    title=c['std_info'].title,
                    subject=c['std_info'].subject,
                    grade=c['grade'],
                    weight_applied=c['weight'],
                    weight_at_max_grade=float(_excl_max_w) if _excl_max_w is not None else None,
                    standards_type=c['std_info'].standards_type,
                    assessment_type=c['std_info'].assessment_type,
                    credits_available=int(c['credits'])
                ))
                continue

            global_remaining = max(0.0, 90.0 - total_used)
            if global_remaining <= 0.0:
                _excl_max_w = self._get_max_grade_weight(c['std_num'], c['year_achieved'], c['version'], c['std_info'].standards_type)
                excluded.append(calc_schemas.ExcludedItem(
                    standard_number=c['std_num'],
                    reason="not in top 90",
                    title=c['std_info'].title,
                    subject=c['std_info'].subject,
                    grade=c['grade'],
                    weight_applied=c['weight'],
                    weight_at_max_grade=float(_excl_max_w) if _excl_max_w is not None else None,
                    standards_type=c['std_info'].standards_type,
                    assessment_type=c['std_info'].assessment_type,
                    credits_available=int(c['credits'])
                ))
                continue

            credits_avail = float(c['credits'])
            credits_to_take = min(credits_avail, subj_remaining, global_remaining)
            if credits_to_take <= 0.0:
                _excl_max_w = self._get_max_grade_weight(c['std_num'], c['year_achieved'], c['version'], c['std_info'].standards_type)
                excluded.append(calc_schemas.ExcludedItem(
                    standard_number=c['std_num'],
                    reason="no remaining capacity",
                    title=c['std_info'].title,
                    subject=c['std_info'].subject,
                    grade=c['grade'],
                    weight_applied=c['weight'],
                    weight_at_max_grade=float(_excl_max_w) if _excl_max_w is not None else None,
                    standards_type=c['std_info'].standards_type,
                    assessment_type=c['std_info'].assessment_type,
                    credits_available=int(c['credits'])
                ))
                continue

            rank += 1
            pro_rated = credits_to_take < credits_avail
            if pro_rated:
                prorated_count += 1

            contribution = credits_to_take * c['weight']
            new_subj_used = subj_used + credits_to_take
            subject_used[subject] = new_subj_used
            total_used += credits_to_take

            # Get max grade weight for this standard
            max_weight = self._get_max_grade_weight(c['std_num'], c['year_achieved'], c['version'], c['std_info'].standards_type)

            best90.append(calc_schemas.StandardContribution(
                selection_rank=rank,
                standard_number=c['std_num'],
                title=c['std_info'].title,
                subject=subject,
                is_ue=bool(c['std_info'].is_ue),
                standards_type=c['std_info'].standards_type,
                assessment_type=c['std_info'].assessment_type,
                grade=c['grade'],
                year_achieved=c['year_achieved'],
                weight_applied=c['weight'],
                weight_at_max_grade=float(max_weight) if max_weight is not None else None,
                credits_available=int(credits_avail),
                credits_used=float(credits_to_take),
                pro_rated=pro_rated,
                contribution=float(contribution),
                subject_credits_used_to_date=float(new_subj_used),
                subject_capped=new_subj_used >= 24.0,
                priority_tier=int(c['tier']),
                fallback_reason=c.get('fallback_reason')
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
        """
        Builds per-subject SSP (subject standard package) breakdowns for a given academic year.
        
        For each subject represented in the user's standards, selects the best eligible standard results, orders them by priority and applied weight, and accumulates up to 18 credits per subject (with prorating when a standard would exceed the remaining subject cap). Produces a SubjectSSPBreakdown per subject that indicates eligibility, the computed SSP score (when at least 18 credits are available), the 18-credit denominator, and the list of StandardContribution entries used to form the score.
        
        Parameters:
        	year (int): Academic year to use when resolving year-aware weightings for standards.
        
        Returns:
        	List[calc_schemas.SubjectSSPBreakdown]: A list of per-subject SSP breakdowns for the given year. Each entry contains subject metadata, whether the subject is eligible (>= 18 available credits), the computed `ssp_score` when eligible (otherwise `None`), the denominator (18), and the detailed `items` used to compute the score.
        """
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
            weight, used_y, used_v = self._get_weight_info(std_num, best.grade, weight_year, best.standard_version, fallback_year=year)
            if weight is None or weight <= 0.001:
                continue
                
            fallback_reasons = []
            if best.year_achieved and used_y != best.year_achieved:
                fallback_reasons.append(f"No {best.year_achieved} weight available, used {used_y}")
            elif used_y != year:
                fallback_reasons.append(f"Using {used_y} weight in {year} calculation")
                
            if best.standard_version is not None and used_v != best.standard_version:
                fallback_reasons.append(f"Version {best.standard_version} unattainable, defaulted to v{used_v}")

            fallback_reason_str = " & ".join(fallback_reasons) if fallback_reasons else None

            tier = self._priority_tier(std_info)
            by_subject.setdefault(subject, []).append({
                'std_info': std_info,
                'std_num': std_num,
                'grade': best.grade,
                'year_achieved': weight_year,
                'credits': std_info.credits,
                'weight': float(min(max(weight, 0.0), 1.0)),
                'tier': tier,
                'fallback_reason': fallback_reason_str
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
                
                # Get max grade weight for this standard
                max_weight = self._get_max_grade_weight(c['std_num'], c['year_achieved'], None, c['std_info'].standards_type)
                
                used.append(calc_schemas.StandardContribution(
                    selection_rank=rank,
                    standard_number=c['std_num'],
                    title=c['std_info'].title,
                    subject=subject,
                    is_ue=bool(c['std_info'].is_ue),
                    standards_type=c['std_info'].standards_type,
                    assessment_type=c['std_info'].assessment_type,
                    grade=c['grade'],
                    year_achieved=c['year_achieved'],
                    weight_applied=c['weight'],
                    weight_at_max_grade=float(max_weight) if max_weight is not None else None,
                    credits_available=int(avail),
                    credits_used=float(take),
                    pro_rated=is_pr,
                    contribution=float(contrib),
                    subject_credits_used_to_date=float(credits_mapped),
                    subject_capped=False,
                    priority_tier=int(c['tier']),
                    fallback_reason=c.get('fallback_reason')
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