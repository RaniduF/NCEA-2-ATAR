import pandas as pd


def calculate_subject_score(subject_df, breakdown_rows, subject_name=None, academic_year=None):
    subject_df = subject_df.sort_values(by='weight_excellence', ascending=False)
    
    credits_mapped = 0
    total_weighted_score = 0
    
    for _, row in subject_df.iterrows():
        if credits_mapped >= 24:
            break
        
        available_credits = row['credits']
        credits_to_take = min(row['credits'], 24 - credits_mapped)
        
        total_weighted_score += credits_to_take * row['weight_excellence']
        credits_mapped += credits_to_take
        
        # Capture breakdown record
        breakdown_rows.append({
            'subject': subject_name,
            'academic_year': academic_year,
            'standard_number': row['standard_number'],
            'standard_version': row.get('standard_version', None),
            'weight_excellence': row['weight_excellence'],
            'effective_credits': credits_to_take
        })
            
    return total_weighted_score / 24


def main():
    standards_df = pd.read_csv('data/standard_details_2025-07-01.csv')
    weightings_df = pd.read_csv('data/standard_weightings_2024-03-27.csv')
    
    weightings_df = weightings_df.rename(columns={'Standard': 'standard_number', 'Academic Year': 'academic_year', 'Adjusted Excellence Percentile': 'weight_excellence', 'Version': 'standard_version'})
    standards_df = standards_df.rename(columns={'standard': 'standard_number'})
    
    merged_df = pd.merge(standards_df, weightings_df, on='standard_number')
    
    achievement_standards_df = merged_df[~merged_df['assessment_type'].isin(['Unit', 'US'])].copy()
    
    # Prepare breakdown collector
    credits_breakdown_rows = []
    
    def scorer(group):
        year = group['academic_year'].iloc[0]
        subject = group['subject'].iloc[0]
        return calculate_subject_score(group, credits_breakdown_rows, subject, year)
    
    subject_scores = achievement_standards_df.groupby(['academic_year', 'subject']).apply(scorer).reset_index(name='score')
    
    ranked_subjects = subject_scores.sort_values(by=['academic_year', 'score'], ascending=[True, False])
    
    print("Ranked Subjects by Year:")
    print(ranked_subjects.to_string())
    
    # Export credits breakdown
    breakdown_df = pd.DataFrame(credits_breakdown_rows)
    # Ensure column order
    breakdown_df = breakdown_df[['subject', 'academic_year', 'standard_number', 'standard_version', 'weight_excellence', 'effective_credits']]
    breakdown_df.to_csv('credits_breakdown.csv', index=False)
    print("🔎 Credits breakdown exported to: credits_breakdown.csv")

if __name__ == "__main__":
    main() 