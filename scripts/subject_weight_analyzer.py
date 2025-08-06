import pandas as pd

def calculate_subject_score(subject_df):
    subject_df = subject_df.sort_values(by='weight_excellence', ascending=False)
    
    credits_mapped = 0
    total_weighted_score = 0
    
    for _, row in subject_df.iterrows():
        credits_to_take = min(row['credits'], 24 - credits_mapped)
        
        total_weighted_score += credits_to_take * row['weight_excellence']
        credits_mapped += credits_to_take
        
        if credits_mapped >= 24:
            break
            
    return total_weighted_score / 24

def main():
    standards_df = pd.read_csv('data/standard_details_2025-07-01.csv')
    weightings_df = pd.read_csv('data/standard_weightings_2024-03-27.csv')
    
    weightings_df = weightings_df.rename(columns={'Standard': 'standard_number', 'Academic Year': 'academic_year', 'Adjusted Excellence Percentile': 'weight_excellence'})
    standards_df = standards_df.rename(columns={'standard': 'standard_number'})
    
    merged_df = pd.merge(standards_df, weightings_df, on='standard_number')
    
    achievement_standards_df = merged_df[~merged_df['assessment_type'].isin(['Unit', 'US'])].copy()
    
    subject_scores = achievement_standards_df.groupby(['academic_year', 'subject']).apply(calculate_subject_score).reset_index(name='score')
    
    ranked_subjects = subject_scores.sort_values(by=['academic_year', 'score'], ascending=[True, False])
    
    print("Ranked Subjects by Year:")
    print(ranked_subjects.to_string())

if __name__ == "__main__":
    main() 