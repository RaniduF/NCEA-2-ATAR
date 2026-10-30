import pandas as pd
import argparse


def sanitize_weight(weight_value: float, cap: float = 0.99, apply_shrink: bool = True,
                    prior: float = 0.95, r_high: float = 0.6,
                    one_threshold: float = 1.0, one_replacement: float = 0.5) -> float:
    """
                    Sanitize and optionally shrink a raw weight into a stable value within [0.0, 1.0].
                    
                    If `weight_value` is None this returns 0.0. The input is clamped to [0.0, 1.0]. If the clamped value is greater than or equal to `one_threshold`, the function returns `one_replacement`. Otherwise the value is capped at `cap`. If `apply_shrink` is True the capped value is moved toward `prior` using a shrink factor `r` (uses `r_high` when the value is very close to `cap`, otherwise `r` is 1.0). The result is clamped to [0.0, 1.0] before returning.
                    
                    Parameters:
                        weight_value (float | None): Raw input weight to sanitize.
                        cap (float): Upper cap applied before shrink (default 0.99).
                        apply_shrink (bool): If False returns the capped value directly; if True applies shrink toward `prior` (default True).
                        prior (float): Baseline value the weight is shrunk toward (default 0.95).
                        r_high (float): Shrink multiplier used when the value is very close to `cap` (default 0.6).
                        one_threshold (float): Threshold at or above which the weight is replaced by `one_replacement` (default 1.0).
                        one_replacement (float): Replacement value used when `weight_value` >= `one_threshold` (default 0.5).
                    
                    Returns:
                        float: Sanitized weight in the range [0.0, 1.0].
                    """
                    if weight_value is None:
        return 0.0
    w = float(weight_value)
    w = max(0.0, min(1.0, w))
    # Strict 1.0 penalty
    if w >= one_threshold:
        return float(one_replacement)
    w_capped = min(w, cap)
    if not apply_shrink:
        return w_capped
    if w >= cap * 0.995:
        r = r_high
    else:
        r = 1.0
    w_shrunk = prior + r * (w_capped - prior)
    return max(0.0, min(1.0, w_shrunk))


def calculate_subject_score(subject_df, breakdown_rows, subject_name=None, academic_year=None,
                            normalization_mode: str = 'fixed', target_credits: int = 24,
                            max_standards: int | None = None, cap: float = 0.99,
                            apply_shrink: bool = True, prior: float = 0.95,
                            r_high: float = 0.6, r_zero_e: float = 0.4,
                            one_threshold: float = 1.0, one_replacement: float = 0.5):
    # Prepare sanitized weight
    """
                            Compute a normalized subject score by selecting standards (optionally capped) and aggregating their sanitized excellence weights.
                            
                            Parameters:
                                subject_df (pandas.DataFrame): Rows for a single subject/year. Must contain columns:
                                    - 'credits' (numeric): credit value for the standard
                                    - 'weight_excellence' (numeric): raw excellence weight to be sanitized
                                    - 'standard_number' (str|int): identifier included in the breakdown
                                    - 'standard_version' (optional): version included in the breakdown if present
                                breakdown_rows (list): Mutable list that will be appended with a dict per selected standard containing
                                    subject, academic_year, standard identifiers, raw/sanitized weights, penalized_one flag, and effective_credits.
                                subject_name (str|None): Subject label recorded in breakdown entries.
                                academic_year (str|int|None): Academic year recorded in breakdown entries.
                                normalization_mode (str): One of 'fixed', 'dynamic_credits', or 'unweighted'.
                                    - 'fixed': normalize by target_credits (or 24 when target_credits is not positive)
                                    - 'dynamic_credits': normalize by total credits mapped (at least 1)
                                    - 'unweighted': normalize by count of selected standards (at least 1)
                                target_credits (int): Desired credit target used when selecting standards and for 'fixed' normalization.
                                max_standards (int|None): Maximum number of standards to select; None means no limit.
                                cap (float): Upper clamp applied to raw weights before optional shrinkage.
                                apply_shrink (bool): Whether to apply shrinkage towards the prior when sanitizing weights.
                                prior (float): Shrinkage prior value used when apply_shrink is True.
                                r_high (float): Higher shrinkage factor applied when a weight is very close to `cap`.
                                r_zero_e (float): (Unused here) present for API compatibility with sanitize_weight.
                                one_threshold (float): Raw weight value at or above which the standard is considered a penalized one.
                                one_replacement (float): Replacement value used by sanitize_weight when raw weight >= one_threshold.
                            
                            Returns:
                                float: The normalized subject score computed as sum of contributions divided by the selected denominator.
                            """
                            subject_df = subject_df.copy()
    subject_df['sanitized_weight_excellence'] = subject_df['weight_excellence'].apply(
        lambda v: sanitize_weight(v, cap, apply_shrink, prior, r_high, one_threshold, one_replacement)
    )
    subject_df = subject_df.sort_values(by='sanitized_weight_excellence', ascending=False)
    
    credits_mapped = 0
    total_weighted_score = 0.0
    selected_count = 0
    
    for _, row in subject_df.iterrows():
        if max_standards is not None and selected_count >= max_standards:
            break
        if target_credits and target_credits > 0 and credits_mapped >= target_credits:
            break
        
        available_credits = row['credits']
        if target_credits and target_credits > 0:
            credits_to_take = min(available_credits, max(0, target_credits - credits_mapped))
        else:
            credits_to_take = available_credits
        
        if credits_to_take <= 0:
            continue
        
        w_raw = float(row['weight_excellence'])
        w_san = row['sanitized_weight_excellence']
        penalized_one = w_raw >= one_threshold
        
        if normalization_mode == 'unweighted':
            contribution = w_san
        else:
            contribution = credits_to_take * w_san
        
        total_weighted_score += contribution
        credits_mapped += credits_to_take
        selected_count += 1
        
        # Capture breakdown record
        breakdown_rows.append({
            'subject': subject_name,
            'academic_year': academic_year,
            'standard_number': row['standard_number'],
            'standard_version': row.get('standard_version', None),
            'weight_excellence_raw': w_raw,
            'weight_excellence_sanitized': w_san,
            'penalized_one': penalized_one,
            'effective_credits': credits_to_take
        })
            
    # Denominator
    if normalization_mode == 'unweighted':
        denom = max(1, selected_count)
    elif normalization_mode == 'dynamic_credits':
        denom = max(1, int(credits_mapped))
    else:
        denom = target_credits if (target_credits and target_credits > 0) else 24
    
    return total_weighted_score / denom


def main():
    """
    Run the CLI-driven subject weight analysis pipeline: load CSVs, compute sanitized subject scores, print ranked subjects, and export a per-standard credits breakdown CSV.
    
    Reads standard details and weightings from fixed CSV paths, merges and filters them to form the set of achievement standards, then groups by academic year and subject to compute a normalized score per subject using configurable normalization and shrinkage parameters supplied via command-line flags. Results are printed to stdout and a breakdown of selected standards is written to credits_breakdown.csv.
    """
    parser = argparse.ArgumentParser(description='CSV-based Subject Weight Analyzer')
    parser.add_argument('--norm', choices=['fixed', 'dynamic_credits', 'unweighted'], default='fixed')
    parser.add_argument('--target-credits', type=int, default=24)
    parser.add_argument('--max-standards', type=int)
    parser.add_argument('--cap-excellence', type=float, default=0.99)
    parser.add_argument('--no-shrink', action='store_true')
    parser.add_argument('--shrink-prior-ex', type=float, default=0.95)
    parser.add_argument('--shrink-r-high', type=float, default=0.6)
    parser.add_argument('--shrink-r-zero-e', type=float, default=0.4)
    parser.add_argument('--one-weight-threshold', type=float, default=1.0)
    parser.add_argument('--one-weight-replacement', type=float, default=0.5)
    
    args = parser.parse_args()
    
    standards_df = pd.read_csv('data/standard_details_2025-07-01.csv')
    weightings_df = pd.read_csv('data/standard_weightings_2024-03-27.csv')
    
    weightings_df = weightings_df.rename(columns={'Standard': 'standard_number', 'Academic Year': 'academic_year', 'Adjusted Excellence Percentile': 'weight_excellence', 'Version': 'standard_version'})
    standards_df = standards_df.rename(columns={'standard': 'standard_number'})
    
    merged_df = pd.merge(standards_df, weightings_df, on='standard_number')
    
    achievement_standards_df = merged_df[~merged_df['assessment_type'].isin(['Unit', 'US'])].copy()
    
    # Prepare breakdown collector
    credits_breakdown_rows = []
    
    def scorer(group):
        """
        Compute the normalized subject score for a grouped standards DataFrame for a single subject and academic year.
        
        Parameters:
            group (pandas.DataFrame): Rows for a single (academic_year, subject) group; must include 'academic_year' and 'subject' columns and the standard-level fields used by the scoring pipeline.
        
        Returns:
            float: The subject's normalized score.
        
        Notes:
            This function also appends per-standard breakdown entries to the enclosing `credits_breakdown_rows` list as a side effect.
        """
        year = group['academic_year'].iloc[0]
        subject = group['subject'].iloc[0]
        return calculate_subject_score(
            group, credits_breakdown_rows, subject, year,
            normalization_mode=args.norm,
            target_credits=args.target_credits,
            max_standards=args.max_standards,
            cap=args.cap_excellence,
            apply_shrink=not args.no_shrink,
            prior=args.shrink_prior_ex,
            r_high=args.shrink_r_high,
            r_zero_e=args.shrink_r_zero_e,
            one_threshold=args.one_weight_threshold,
            one_replacement=args.one_weight_replacement,
        )
    
    subject_scores = achievement_standards_df.groupby(['academic_year', 'subject']).apply(scorer).reset_index(name='score')
    
    ranked_subjects = subject_scores.sort_values(by=['academic_year', 'score'], ascending=[True, False])
    
    print("Ranked Subjects by Year:")
    print(ranked_subjects.to_string())
    
    # Export credits breakdown
    breakdown_df = pd.DataFrame(credits_breakdown_rows)
    breakdown_df = breakdown_df[['subject', 'academic_year', 'standard_number', 'standard_version', 'weight_excellence_raw', 'weight_excellence_sanitized', 'penalized_one', 'effective_credits']]
    breakdown_df.to_csv('credits_breakdown.csv', index=False)
    print("🔎 Credits breakdown exported to: credits_breakdown.csv")

if __name__ == "__main__":
    main() 