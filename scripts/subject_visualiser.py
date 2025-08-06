#!/usr/bin/env python3
"""
NCEA Subject Analysis Visualizer

This script creates visualizations from the subject analysis data to help
students better understand subject rankings, trends, and patterns.
"""

import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
import numpy as np
from pathlib import Path
import argparse
from datetime import datetime

class SubjectVisualizer:
    def __init__(self, data_file: str, trends_file: str):
        """Initialize the visualizer with data files."""
        self.data_file = data_file
        self.trends_file = trends_file
        self.metrics_df = None
        self.trends_df = None
        self.output_dir = Path("visualizations")
        
        # Set up matplotlib and seaborn
        plt.style.use('seaborn-v0_8')
        sns.set_palette("husl")
        
    def load_data(self) -> bool:
        """Load the analysis data."""
        try:
            self.metrics_df = pd.read_csv(self.data_file)
            self.trends_df = pd.read_csv(self.trends_file)
            
            # Create output directory
            self.output_dir.mkdir(exist_ok=True)
            
            print(f"✅ Loaded data: {len(self.metrics_df)} subject-year combinations")
            print(f"✅ Loaded trends: {len(self.trends_df)} subjects")
            return True
        except Exception as e:
            print(f"❌ Error loading data: {e}")
            return False
    
    def create_top_subjects_ranking(self, year: int = None, top_n: int = 15):
        """Create a horizontal bar chart of top subjects for a specific year."""
        if year is None:
            year = self.metrics_df['academic_year'].max()
        
        year_data = self.metrics_df[self.metrics_df['academic_year'] == year]
        top_subjects = year_data.nlargest(top_n, 'optimal_score')
        
        plt.figure(figsize=(12, 8))
        bars = plt.barh(range(len(top_subjects)), top_subjects['optimal_score'], 
                       color=plt.cm.viridis(np.linspace(0, 1, len(top_subjects))))
        
        plt.yticks(range(len(top_subjects)), top_subjects['subject'])
        plt.xlabel('Optimal Score (Best 24 Credits)')
        plt.title(f'Top {top_n} NCEA Subjects for ATAR Conversion - {year}', 
                 fontsize=16, fontweight='bold')
        plt.grid(axis='x', alpha=0.3)
        
        # Add score labels on bars
        for i, (idx, row) in enumerate(top_subjects.iterrows()):
            plt.text(row['optimal_score'] + 0.005, i, f"{row['optimal_score']:.3f}", 
                    va='center', fontsize=9)
        
        plt.tight_layout()
        filename = self.output_dir / f"top_subjects_{year}.png"
        plt.savefig(filename, dpi=300, bbox_inches='tight')
        plt.close()
        print(f"📊 Saved: {filename}")
    
    def create_year_over_year_trends(self, subjects: list = None):
        """Create line plots showing subject performance over years."""
        if subjects is None:
            # Get top 10 subjects from latest year
            latest_year = self.metrics_df['academic_year'].max()
            latest_data = self.metrics_df[self.metrics_df['academic_year'] == latest_year]
            subjects = latest_data.nlargest(10, 'optimal_score')['subject'].tolist()
        
        plt.figure(figsize=(14, 8))
        
        for subject in subjects:
            subject_data = self.metrics_df[self.metrics_df['subject'] == subject]
            subject_data = subject_data.sort_values('academic_year')
            
            if len(subject_data) > 1:  # Only plot if multiple years available
                plt.plot(subject_data['academic_year'], subject_data['optimal_score'], 
                        marker='o', linewidth=2, label=subject, alpha=0.8)
        
        plt.xlabel('Academic Year')
        plt.ylabel('Optimal Score')
        plt.title('Subject Performance Trends Over Years', fontsize=16, fontweight='bold')
        plt.legend(bbox_to_anchor=(1.05, 1), loc='upper left')
        plt.grid(True, alpha=0.3)
        plt.xticks(rotation=45)
        
        plt.tight_layout()
        filename = self.output_dir / "subject_trends.png"
        plt.savefig(filename, dpi=300, bbox_inches='tight')
        plt.close()
        print(f"📈 Saved: {filename}")
    
    def create_score_distribution(self, year: int = None):
        """Create a histogram of score distributions."""
        if year is None:
            year = self.metrics_df['academic_year'].max()
        
        year_data = self.metrics_df[self.metrics_df['academic_year'] == year]
        
        plt.figure(figsize=(10, 6))
        plt.hist(year_data['optimal_score'], bins=20, edgecolor='black', alpha=0.7)
        plt.axvline(year_data['optimal_score'].mean(), color='red', linestyle='--', 
                   label=f'Mean: {year_data["optimal_score"].mean():.3f}')
        plt.axvline(year_data['optimal_score'].median(), color='orange', linestyle='--', 
                   label=f'Median: {year_data["optimal_score"].median():.3f}')
        
        plt.xlabel('Optimal Score')
        plt.ylabel('Number of Subjects')
        plt.title(f'Distribution of Subject Scores - {year}', fontsize=14, fontweight='bold')
        plt.legend()
        plt.grid(True, alpha=0.3)
        
        plt.tight_layout()
        filename = self.output_dir / f"score_distribution_{year}.png"
        plt.savefig(filename, dpi=300, bbox_inches='tight')
        plt.close()
        print(f"📊 Saved: {filename}")
    
    def create_credits_efficiency_analysis(self):
        """Analyze the relationship between credits efficiency and scores."""
        latest_year = self.metrics_df['academic_year'].max()
        year_data = self.metrics_df[self.metrics_df['academic_year'] == latest_year]
        
        plt.figure(figsize=(10, 8))
        scatter = plt.scatter(year_data['credits_efficiency'], year_data['optimal_score'], 
                            c=year_data['avg_weight_excellence'], s=60, alpha=0.7, cmap='viridis')
        
        plt.colorbar(scatter, label='Average Excellence Weight')
        plt.xlabel('Credits Efficiency (Available Credits / 24)')
        plt.ylabel('Optimal Score')
        plt.title(f'Credits Efficiency vs Performance - {latest_year}', 
                 fontsize=14, fontweight='bold')
        
        # Add trend line
        z = np.polyfit(year_data['credits_efficiency'], year_data['optimal_score'], 1)
        p = np.poly1d(z)
        plt.plot(year_data['credits_efficiency'], p(year_data['credits_efficiency']), 
                "r--", alpha=0.8, label=f'Trend Line')
        
        plt.legend()
        plt.grid(True, alpha=0.3)
        
        plt.tight_layout()
        filename = self.output_dir / f"credits_efficiency_{latest_year}.png"
        plt.savefig(filename, dpi=300, bbox_inches='tight')
        plt.close()
        print(f"📊 Saved: {filename}")
    
    def create_improvement_decline_chart(self):
        """Create a chart showing improving and declining subjects."""
        improving = self.trends_df[self.trends_df['trend_direction'] == 'Improving'].head(10)
        declining = self.trends_df[self.trends_df['trend_direction'] == 'Declining'].head(10)
        
        fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(16, 8))
        
        # Improving subjects
        if not improving.empty:
            bars1 = ax1.barh(range(len(improving)), improving['score_change'], 
                           color='green', alpha=0.7)
            ax1.set_yticks(range(len(improving)))
            ax1.set_yticklabels(improving['subject'])
            ax1.set_xlabel('Score Change')
            ax1.set_title('Most Improving Subjects', fontweight='bold')
            ax1.grid(axis='x', alpha=0.3)
            
            for i, change in enumerate(improving['score_change']):
                ax1.text(change + 0.001, i, f"+{change:.3f}", va='center', fontsize=9)
        
        # Declining subjects
        if not declining.empty:
            bars2 = ax2.barh(range(len(declining)), declining['score_change'], 
                           color='red', alpha=0.7)
            ax2.set_yticks(range(len(declining)))
            ax2.set_yticklabels(declining['subject'])
            ax2.set_xlabel('Score Change')
            ax2.set_title('Most Declining Subjects', fontweight='bold')
            ax2.grid(axis='x', alpha=0.3)
            
            for i, change in enumerate(declining['score_change']):
                ax2.text(change - 0.001, i, f"{change:.3f}", va='center', ha='right', fontsize=9)
        
        plt.tight_layout()
        filename = self.output_dir / "trends_improvement_decline.png"
        plt.savefig(filename, dpi=300, bbox_inches='tight')
        plt.close()
        print(f"📈 Saved: {filename}")
    
    def create_comprehensive_heatmap(self):
        """Create a heatmap showing all subjects across all years."""
        # Pivot the data to create a matrix
        pivot_data = self.metrics_df.pivot(index='subject', columns='academic_year', values='optimal_score')
        
        plt.figure(figsize=(12, 20))
        sns.heatmap(pivot_data, annot=True, fmt='.3f', cmap='RdYlGn', 
                   center=0.9, cbar_kws={'label': 'Optimal Score'})
        
        plt.title('Subject Performance Heatmap Across Years', fontsize=16, fontweight='bold')
        plt.xlabel('Academic Year')
        plt.ylabel('Subject')
        plt.xticks(rotation=45)
        plt.yticks(rotation=0)
        
        plt.tight_layout()
        filename = self.output_dir / "comprehensive_heatmap.png"
        plt.savefig(filename, dpi=300, bbox_inches='tight')
        plt.close()
        print(f"🔥 Saved: {filename}")
    
    def create_ue_approved_analysis(self):
        """Analyze UE-approved vs non-UE subjects."""
        latest_year = self.metrics_df['academic_year'].max()
        year_data = self.metrics_df[self.metrics_df['academic_year'] == latest_year]
        
        plt.figure(figsize=(10, 6))
        
        ue_approved = year_data[year_data['ue_approved'] == True]['optimal_score']
        non_ue = year_data[year_data['ue_approved'] == False]['optimal_score']
        
        plt.hist([ue_approved, non_ue], bins=15, alpha=0.7, 
                label=['UE Approved', 'Non-UE'], edgecolor='black')
        
        plt.xlabel('Optimal Score')
        plt.ylabel('Number of Subjects')
        plt.title(f'Score Distribution: UE Approved vs Non-UE Subjects - {latest_year}', 
                 fontsize=14, fontweight='bold')
        plt.legend()
        plt.grid(True, alpha=0.3)
        
        # Add statistics
        plt.text(0.02, 0.98, f'UE Approved Mean: {ue_approved.mean():.3f}\n'
                             f'Non-UE Mean: {non_ue.mean():.3f}', 
                transform=plt.gca().transAxes, verticalalignment='top',
                bbox=dict(boxstyle='round', facecolor='white', alpha=0.8))
        
        plt.tight_layout()
        filename = self.output_dir / f"ue_analysis_{latest_year}.png"
        plt.savefig(filename, dpi=300, bbox_inches='tight')
        plt.close()
        print(f"🎓 Saved: {filename}")
    
    def generate_all_visualizations(self):
        """Generate the complete set of visualizations."""
        print("🎨 Generating comprehensive visualizations...")
        
        latest_year = self.metrics_df['academic_year'].max()
        
        # Core visualizations
        self.create_top_subjects_ranking(latest_year)
        self.create_year_over_year_trends()
        self.create_score_distribution(latest_year)
        self.create_credits_efficiency_analysis()
        self.create_improvement_decline_chart()
        self.create_comprehensive_heatmap()
        self.create_ue_approved_analysis()
        
        # Additional year rankings
        for year in sorted(self.metrics_df['academic_year'].unique(), reverse=True)[:3]:
            if year != latest_year:
                self.create_top_subjects_ranking(year)
                self.create_score_distribution(year)
        
        print(f"\n✅ All visualizations saved to: {self.output_dir}")
        print(f"📁 Total files created: {len(list(self.output_dir.glob('*.png')))} PNG files")

def main():
    """Main function to run the visualizer."""
    parser = argparse.ArgumentParser(description='NCEA Subject Analysis Visualizer')
    parser.add_argument('--data', default='subject_analysis_data.csv', 
                       help='Path to subject analysis data CSV file')
    parser.add_argument('--trends', default='subject_trends_data.csv', 
                       help='Path to trends data CSV file')
    parser.add_argument('--output-dir', default='visualizations', 
                       help='Output directory for visualizations')
    
    args = parser.parse_args()
    
    # Initialize visualizer
    visualizer = SubjectVisualizer(args.data, args.trends)
    visualizer.output_dir = Path(args.output_dir)
    
    try:
        if not visualizer.load_data():
            return 1
        
        visualizer.generate_all_visualizations()
        
    except Exception as e:
        print(f"❌ Error during visualization: {e}")
        return 1
    
    return 0

if __name__ == "__main__":
    exit(main()) 