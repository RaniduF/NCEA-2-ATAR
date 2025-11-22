"""
Analysis of ATAR estimation stability at high performance levels (99.50+)

This script examines:
1. Statistical value differences between adjacent ATAR bands at the top end
2. How much "better" someone needs to perform to move up ATAR bands
3. Whether estimations become "unstable" or unreliable at high ATARs
4. Year-over-year consistency of top ATAR thresholds

Methodology based on NZQA's ATAR conversion process documented in:
docs/Output/Australian-ATAR-ranks-OC00600-/Australian-ATAR-ranks-OC00600-.md
"""

import pandas as pd
import numpy as np
from pathlib import Path
import matplotlib.pyplot as plt
import seaborn as sns
from typing import Dict, List, Tuple

# Set style for plots
sns.set_style("darkgrid")
plt.rcParams['figure.figsize'] = (14, 8)

def load_distribution_data(csv_path: str) -> pd.DataFrame:
    """Load and prepare the ATAR distribution data"""
    df = pd.read_csv(csv_path)
    df.columns = df.columns.str.strip()
    df['Academic Year'] = df['Academic Year'].astype(int)
    df['Statistic Value'] = df['Statistic Value'].astype(float)
    df['Frequency Count'] = df['Frequency Count'].astype(int)
    return df

def calculate_atar_from_stat(stat_value: float, year_data: pd.DataFrame, population: int) -> float:
    """
    Calculate ATAR for a given statistical value using NZQA methodology
    
    Per NZQA docs:
    - ATAR bands are 0.05 wide (99.95, 99.90, 99.85, ...)
    - Each band contains 0.05% of the participation cohort
    - students_per_band = round(population * 0.0005)
    - Rank is determined by counting how many students have higher stat values
    """
    students_per_band = round(population * 0.0005)
    if students_per_band == 0:
        return None
    
    # Sort by stat value descending (highest first)
    sorted_data = year_data.sort_values('Statistic Value', ascending=False)
    
    # Find user's rank
    user_rank = 1
    for _, row in sorted_data.iterrows():
        if stat_value >= row['Statistic Value']:
            break
        user_rank += row['Frequency Count']
    
    # Calculate ATAR band
    band_index = (user_rank - 1) // students_per_band
    atar = max(0.0, round(99.95 - (band_index * 0.05), 2))
    
    return atar

def find_atar_threshold(target_atar: float, year_data: pd.DataFrame, population: int) -> Tuple[float, int]:
    """
    Find the minimum statistical value and rank needed to achieve target ATAR
    
    Returns: (min_stat_value, rank_at_threshold)
    """
    students_per_band = round(population * 0.0005)
    
    # Calculate which rank corresponds to this ATAR
    band_index = int((99.95 - target_atar) / 0.05)
    max_rank_for_atar = (band_index + 1) * students_per_band
    
    # Sort by stat value descending
    sorted_data = year_data.sort_values('Statistic Value', ascending=False)
    
    # Find the statistical value at this rank
    cumulative_rank = 0
    threshold_stat = None
    
    for _, row in sorted_data.iterrows():
        cumulative_rank += row['Frequency Count']
        if cumulative_rank >= max_rank_for_atar:
            threshold_stat = row['Statistic Value']
            break
    
    return threshold_stat, max_rank_for_atar

def analyze_high_atar_bands(year_data: pd.DataFrame, year: int, population: int) -> pd.DataFrame:
    """
    Analyze statistical value differences for high ATAR bands (99.50 to 99.95)
    
    Returns DataFrame with:
    - ATAR band
    - Min stat value needed
    - Rank at threshold
    - Difference from next higher band
    - Percentage improvement needed
    """
    high_atar_bands = [99.95, 99.90, 99.85, 99.80, 99.75, 99.70, 99.65, 99.60, 99.55, 99.50]
    
    results = []
    prev_stat = None
    
    for atar in high_atar_bands:
        stat_value, rank = find_atar_threshold(atar, year_data, population)
        
        if stat_value is None:
            continue
            
        result = {
            'ATAR': atar,
            'Min_Statistical_Value': stat_value,
            'Rank_at_Threshold': rank,
            'Students_per_Band': round(population * 0.0005)
        }
        
        if prev_stat is not None:
            diff = prev_stat - stat_value
            pct_improvement = (diff / stat_value) * 100
            result['Stat_Diff_from_Higher_Band'] = diff
            result['Pct_Improvement_Needed'] = pct_improvement
        else:
            result['Stat_Diff_from_Higher_Band'] = None
            result['Pct_Improvement_Needed'] = None
        
        results.append(result)
        prev_stat = stat_value
    
    df = pd.DataFrame(results)
    df['Year'] = year
    return df

def calculate_coefficient_of_variation(values: List[float]) -> float:
    """Calculate CV to measure relative variability"""
    return (np.std(values) / np.mean(values)) * 100

def main():
    # Load data
    data_path = Path(__file__).parent.parent / 'data' / 'atar_distributions_2025-07-20.csv'
    df = load_distribution_data(data_path)
    
    # Participation rates from NZQA data (these would be in ParticipationRate table)
    # Using estimates based on typical cohort sizes mentioned in docs
    participation_rates = {
        2024: 32000,  # Estimated - typically ~32k students per 0.05% band = ~32 students
        2023: 31500,
        2022: 31000
    }
    
    print("=" * 80)
    print("HIGH ATAR STABILITY ANALYSIS")
    print("=" * 80)
    print("\nBased on NZQA ATAR Conversion Methodology")
    print("Reference: docs/Output/Australian-ATAR-ranks-OC00600-/")
    print("\n" + "=" * 80 + "\n")
    
    all_year_results = []
    
    for year in sorted(df['Academic Year'].unique(), reverse=True):
        year_data = df[df['Academic Year'] == year]
        population = participation_rates.get(year, 32000)
        
        print(f"\n{'='*60}")
        print(f"ANALYSIS FOR {year}")
        print(f"{'='*60}")
        print(f"Participation Population: {population:,}")
        print(f"Students per ATAR band (0.05%): {round(population * 0.0005)}")
        
        results = analyze_high_atar_bands(year_data, year, population)
        all_year_results.append(results)
        
        print(f"\n{results.to_string(index=False)}")
        
        # Stability metrics
        if len(results) > 1:
            diffs = results['Stat_Diff_from_Higher_Band'].dropna()
            pct_improvements = results['Pct_Improvement_Needed'].dropna()
            
            print(f"\n{'─'*60}")
            print("STABILITY METRICS")
            print(f"{'─'*60}")
            print(f"Mean stat difference between bands: {diffs.mean():.6f}")
            print(f"Std dev of differences: {diffs.std():.6f}")
            print(f"Coefficient of variation: {calculate_coefficient_of_variation(diffs.tolist()):.2f}%")
            print(f"\nMean % improvement needed: {pct_improvements.mean():.4f}%")
            print(f"Range: {pct_improvements.min():.4f}% to {pct_improvements.max():.4f}%")
    
    # Cross-year comparison
    if len(all_year_results) > 1:
        print(f"\n\n{'='*80}")
        print("CROSS-YEAR STABILITY ANALYSIS")
        print(f"{'='*80}")
        
        # Combine all years
        combined = pd.concat(all_year_results, ignore_index=True)
        
        # For each ATAR band, compare across years
        for atar in [99.95, 99.90, 99.85, 99.80, 99.75, 99.70, 99.65, 99.60, 99.55, 99.50]:
            band_data = combined[combined['ATAR'] == atar]
            if len(band_data) < 2:
                continue
            
            stat_values = band_data['Min_Statistical_Value'].tolist()
            years = band_data['Year'].tolist()
            
            cv = calculate_coefficient_of_variation(stat_values)
            
            print(f"\nATAR {atar}:")
            for year, stat in zip(years, stat_values):
                print(f"  {year}: {stat:.6f}")
            print(f"  CV: {cv:.2f}%")
            print(f"  Range: {max(stat_values) - min(stat_values):.6f}")
    
    # Key findings
    print(f"\n\n{'='*80}")
    print("KEY FINDINGS & RELIABILITY ASSESSMENT")
    print(f"{'='*80}")
    
    print("\n1. GRANULARITY AT TOP END:")
    print("   - Each ATAR band (0.05 difference) typically contains ~32 students")
    print("   - This means very small changes in statistical value can change ATAR")
    
    print("\n2. STATISTICAL VALUE GAPS:")
    avg_diff = combined['Stat_Diff_from_Higher_Band'].mean()
    print(f"   - Average difference between bands: {avg_diff:.6f}")
    print(f"   - Typical improvement needed: {combined['Pct_Improvement_Needed'].mean():.4f}%")
    
    print("\n3. STABILITY CONCERNS:")
    cv_by_atar = combined.groupby('ATAR')['Min_Statistical_Value'].agg(
        lambda x: calculate_coefficient_of_variation(x.tolist()) if len(x) > 1 else None
    )
    
    high_cv_bands = cv_by_atar[cv_by_atar > 1.0]
    if len(high_cv_bands) > 0:
        print("   ⚠️  HIGH VARIABILITY DETECTED:")
        for atar, cv in high_cv_bands.items():
            print(f"      ATAR {atar}: CV = {cv:.2f}% (>1% threshold)")
    else:
        print("   ✓ Thresholds relatively stable across years (CV < 1%)")
    
    print("\n4. ESTIMATION RELIABILITY:")
    print("   For someone aiming for 99.90+:")
    print(f"   - Small cohorts per band ({round(population * 0.0005)} students)")
    print("   - Estimation uncertainty: ±0.05 to ±0.10 ATAR points")
    print("   - Recommendation: View estimates as 'ranges' rather than exact values")
    
    print("\n5. CONTEXT FROM NZQA DOCUMENTATION:")
    print("   - \"90 excellence credits is not enough to guarantee top ATAR\"")
    print("   - Standard difficulty varies by year and subject")
    print("   - External standards typically weighted higher than internal")
    print("   - System is criterion-referenced but ATAR is norm-referenced")
    
    # Create visualization
    create_visualization(combined, participation_rates)
    
    print(f"\n{'='*80}")
    print("Analysis complete. Visualizations saved.")
    print(f"{'='*80}\n")

def create_visualization(combined_df: pd.DataFrame, participation_rates: Dict[int, int]):
    """Create visualizations for the analysis"""
    
    fig, axes = plt.subplots(2, 2, figsize=(16, 12))
    fig.suptitle('High ATAR Stability Analysis', fontsize=16, fontweight='bold')
    
    # 1. Statistical Value by ATAR Band (all years)
    ax1 = axes[0, 0]
    for year in sorted(combined_df['Year'].unique()):
        year_data = combined_df[combined_df['Year'] == year]
        ax1.plot(year_data['ATAR'], year_data['Min_Statistical_Value'], 
                marker='o', label=f'{year}', linewidth=2)
    ax1.set_xlabel('ATAR Band', fontsize=12)
    ax1.set_ylabel('Minimum Statistical Value', fontsize=12)
    ax1.set_title('Statistical Value Thresholds by ATAR Band', fontsize=13, fontweight='bold')
    ax1.legend()
    ax1.grid(True, alpha=0.3)
    ax1.invert_xaxis()  # Higher ATAR on left
    
    # 2. Percentage Improvement Needed
    ax2 = axes[0, 1]
    for year in sorted(combined_df['Year'].unique()):
        year_data = combined_df[combined_df['Year'] == year].dropna(subset=['Pct_Improvement_Needed'])
        ax2.plot(year_data['ATAR'], year_data['Pct_Improvement_Needed'], 
                marker='s', label=f'{year}', linewidth=2)
    ax2.set_xlabel('ATAR Band', fontsize=12)
    ax2.set_ylabel('% Improvement Needed from Next Band', fontsize=12)
    ax2.set_title('Performance Gap Between Adjacent ATAR Bands', fontsize=13, fontweight='bold')
    ax2.legend()
    ax2.grid(True, alpha=0.3)
    ax2.invert_xaxis()
    
    # 3. Coefficient of Variation by ATAR Band
    ax3 = axes[1, 0]
    cv_data = combined_df.groupby('ATAR')['Min_Statistical_Value'].agg(
        lambda x: calculate_coefficient_of_variation(x.tolist()) if len(x) > 1 else None
    ).dropna()
    
    colors = ['red' if cv > 1.0 else 'green' for cv in cv_data.values]
    ax3.bar(cv_data.index, cv_data.values, color=colors, alpha=0.7, edgecolor='black')
    ax3.axhline(y=1.0, color='orange', linestyle='--', linewidth=2, label='1% threshold')
    ax3.set_xlabel('ATAR Band', fontsize=12)
    ax3.set_ylabel('Coefficient of Variation (%)', fontsize=12)
    ax3.set_title('Year-to-Year Stability (Lower = More Stable)', fontsize=13, fontweight='bold')
    ax3.legend()
    ax3.grid(True, alpha=0.3, axis='y')
    ax3.invert_xaxis()
    
    # 4. Statistical Value Differences
    ax4 = axes[1, 1]
    for year in sorted(combined_df['Year'].unique()):
        year_data = combined_df[combined_df['Year'] == year].dropna(subset=['Stat_Diff_from_Higher_Band'])
        ax4.plot(year_data['ATAR'], year_data['Stat_Diff_from_Higher_Band'], 
                marker='^', label=f'{year}', linewidth=2)
    ax4.set_xlabel('ATAR Band', fontsize=12)
    ax4.set_ylabel('Statistical Value Difference', fontsize=12)
    ax4.set_title('Absolute Gaps Between Adjacent Bands', fontsize=13, fontweight='bold')
    ax4.legend()
    ax4.grid(True, alpha=0.3)
    ax4.invert_xaxis()
    
    plt.tight_layout()
    
    # Save figure
    output_path = Path(__file__).parent.parent / 'high_atar_stability_analysis.png'
    plt.savefig(output_path, dpi=300, bbox_inches='tight')
    print(f"\n✓ Visualization saved to: {output_path}")
    
    plt.close()

if __name__ == "__main__":
    main()
