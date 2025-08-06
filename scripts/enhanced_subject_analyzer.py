#!/usr/bin/env python3
"""
Enhanced NCEA Subject Weight Analyzer

This script provides comprehensive analysis of NCEA subjects based on their 
excellence weightings, helping students identify the most strategically 
valuable subjects for ATAR conversion.

Features:
- Database connectivity for accurate data
- Multiple ranking metrics
- Year-over-year trend analysis
- Detailed subject breakdowns
- Exportable reports
- Filtering and search capabilities
"""

import pandas as pd
import mysql.connector
from mysql.connector import Error
import json
import argparse
from datetime import datetime
import numpy as np
from typing import Dict, List, Optional, Tuple
import sys
import os

class SubjectAnalyzer:
    def __init__(self, db_config: Dict[str, str]):
        """Initialize the analyzer with database configuration."""
        self.db_config = db_config
        self.connection = None
        self.standards_df = None
        self.weightings_df = None
        self.merged_df = None
        
    def connect_to_database(self) -> bool:
        """Establish connection to the MySQL database."""
        try:
            self.connection = mysql.connector.connect(
                host=self.db_config.get('host', 'localhost'),
                port=self.db_config.get('port', 3307),
                database=self.db_config.get('database', 'ncea_atar'),
                user=self.db_config.get('user', 'ncea_user'),
                password=self.db_config.get('password', 'ncea_password')
            )
            
            if self.connection.is_connected():
                print(f"✅ Successfully connected to database: {self.db_config['database']}")
                return True
        except Error as e:
            print(f"❌ Error connecting to database: {e}")
            return False
    
    def load_data(self) -> bool:
        """Load standards and weightings data from the database."""
        if not self.connection or not self.connection.is_connected():
            print("❌ No database connection available")
            return False
            
        try:
            # Load standards data
            standards_query = """
            SELECT standard_number, title, credits, assessment_type, 
                   standards_type, is_ue, subject, search_keywords
            FROM standards
            WHERE standards_type = 'Achievement'
            """
            self.standards_df = pd.read_sql(standards_query, self.connection)
            
            # Load weightings data
            weightings_query = """
            SELECT sw.standard_number, sw.academic_year, sw.standard_version,
                   sw.weight_excellence, sw.weight_merit, sw.weight_achieved
            FROM standard_weightings sw
            JOIN standards s ON sw.standard_number = s.standard_number
            WHERE s.standards_type = 'Achievement'
            AND sw.weight_excellence IS NOT NULL
            ORDER BY sw.academic_year DESC, sw.weight_excellence DESC
            """
            self.weightings_df = pd.read_sql(weightings_query, self.connection)
            
            # Merge the data
            self.merged_df = pd.merge(
                self.standards_df, 
                self.weightings_df, 
                on='standard_number',
                how='inner'
            )
            
            print(f"✅ Loaded {len(self.standards_df)} standards and {len(self.weightings_df)} weightings")
            return True
            
        except Error as e:
            print(f"❌ Error loading data: {e}")
            return False
    
    def calculate_subject_score(self, subject_df: pd.DataFrame) -> float:
        """
        Calculate the optimal score for a subject using the best 24 credits.
        
        Args:
            subject_df: DataFrame containing standards for a specific subject and year
            
        Returns:
            Normalized score (sum of weighted credits / 24)
        """
        # Sort by excellence weight descending
        subject_df = subject_df.sort_values(by='weight_excellence', ascending=False)
        
        credits_mapped = 0
        total_weighted_score = 0
        used_standards = []
        
        for _, row in subject_df.iterrows():
            if credits_mapped >= 24:
                break
                
            credits_to_take = min(row['credits'], 24 - credits_mapped)
            weighted_contribution = credits_to_take * row['weight_excellence']
            
            total_weighted_score += weighted_contribution
            credits_mapped += credits_to_take
            
            used_standards.append({
                'standard': row['standard_number'],
                'title': row['title'],
                'credits_used': credits_to_take,
                'weight': row['weight_excellence'],
                'contribution': weighted_contribution
            })
        
        # Store detailed breakdown for later analysis
        subject_df._used_standards = used_standards
        subject_df._total_credits_available = subject_df['credits'].sum()
        
        return total_weighted_score / 24
    
    def calculate_comprehensive_metrics(self) -> pd.DataFrame:
        """Calculate multiple metrics for each subject by year."""
        if self.merged_df is None:
            print("❌ No data loaded")
            return pd.DataFrame()
        
        results = []
        
        for year in sorted(self.merged_df['academic_year'].unique()):
            year_data = self.merged_df[self.merged_df['academic_year'] == year]
            
            for subject in year_data['subject'].unique():
                subject_data = year_data[year_data['subject'] == subject]
                
                # Calculate main score
                score = self.calculate_subject_score(subject_data.copy())
                
                # Calculate additional metrics
                metrics = {
                    'academic_year': year,
                    'subject': subject,
                    'optimal_score': score,
                    'total_standards': len(subject_data),
                    'total_credits_available': subject_data['credits'].sum(),
                    'avg_weight_excellence': subject_data['weight_excellence'].mean(),
                    'max_weight_excellence': subject_data['weight_excellence'].max(),
                    'min_weight_excellence': subject_data['weight_excellence'].min(),
                    'weight_std_dev': subject_data['weight_excellence'].std(),
                    'credits_efficiency': min(24, subject_data['credits'].sum()) / 24,
                    'high_weight_standards': len(subject_data[subject_data['weight_excellence'] > 0.9]),
                    'ue_approved': subject_data['is_ue'].any()
                }
                
                # Calculate weighted average considering credit distribution
                weighted_avg = (subject_data['weight_excellence'] * subject_data['credits']).sum() / subject_data['credits'].sum()
                metrics['weighted_avg_excellence'] = weighted_avg
                
                results.append(metrics)
        
        return pd.DataFrame(results)
    
    def analyze_year_over_year_trends(self, metrics_df: pd.DataFrame) -> pd.DataFrame:
        """Analyze trends in subject performance over years."""
        trends = []
        
        for subject in metrics_df['subject'].unique():
            subject_data = metrics_df[metrics_df['subject'] == subject].sort_values('academic_year')
            
            if len(subject_data) > 1:
                # Calculate year-over-year changes
                score_change = subject_data['optimal_score'].iloc[-1] - subject_data['optimal_score'].iloc[0]
                avg_weight_change = subject_data['avg_weight_excellence'].iloc[-1] - subject_data['avg_weight_excellence'].iloc[0]
                
                trends.append({
                    'subject': subject,
                    'years_available': len(subject_data),
                    'first_year': subject_data['academic_year'].iloc[0],
                    'last_year': subject_data['academic_year'].iloc[-1],
                    'score_change': score_change,
                    'avg_weight_change': avg_weight_change,
                    'trend_direction': 'Improving' if score_change > 0.01 else 'Declining' if score_change < -0.01 else 'Stable',
                    'latest_score': subject_data['optimal_score'].iloc[-1],
                    'latest_rank': None  # Will be filled later
                })
        
        trends_df = pd.DataFrame(trends)
        
        # Add latest rankings
        if not trends_df.empty:
            latest_year = metrics_df['academic_year'].max()
            latest_rankings = metrics_df[metrics_df['academic_year'] == latest_year].sort_values('optimal_score', ascending=False)
            rank_map = {subject: rank + 1 for rank, subject in enumerate(latest_rankings['subject'])}
            trends_df['latest_rank'] = trends_df['subject'].map(rank_map)
        
        return trends_df.sort_values('latest_score', ascending=False)
    
    def get_detailed_subject_breakdown(self, subject: str, year: int) -> Dict:
        """Get detailed breakdown for a specific subject and year."""
        if self.merged_df is None:
            return {}
        
        subject_data = self.merged_df[
            (self.merged_df['subject'] == subject) & 
            (self.merged_df['academic_year'] == year)
        ].copy()
        
        if subject_data.empty:
            return {}
        
        # Calculate the optimal combination
        score = self.calculate_subject_score(subject_data)
        
        # Get the breakdown from the calculation
        breakdown = {
            'subject': subject,
            'year': year,
            'optimal_score': score,
            'total_standards_available': len(subject_data),
            'total_credits_available': subject_data['credits'].sum(),
            'standards_breakdown': []
        }
        
        # Add all standards sorted by weight
        for _, row in subject_data.sort_values('weight_excellence', ascending=False).iterrows():
            standard_info = {
                'standard_number': row['standard_number'],
                'title': row['title'],
                'credits': row['credits'],
                'weight_excellence': row['weight_excellence'],
                'assessment_type': row['assessment_type'],
                'is_ue': row['is_ue']
            }
            breakdown['standards_breakdown'].append(standard_info)
        
        return breakdown
    
    def generate_report(self, output_format: str = 'console', filename: Optional[str] = None) -> None:
        """Generate comprehensive analysis report."""
        if self.merged_df is None:
            print("❌ No data available for report generation")
            return
        
        # Calculate comprehensive metrics
        print("📊 Calculating comprehensive metrics...")
        metrics_df = self.calculate_comprehensive_metrics()
        
        if metrics_df.empty:
            print("❌ No metrics calculated")
            return
        
        # Analyze trends
        print("📈 Analyzing year-over-year trends...")
        trends_df = self.analyze_year_over_year_trends(metrics_df)
        
        # Generate report content
        report_content = self._format_report(metrics_df, trends_df)
        
        if output_format == 'console':
            print(report_content)
        elif output_format == 'file':
            if not filename:
                filename = f"subject_analysis_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
            
            with open(filename, 'w', encoding='utf-8') as f:
                f.write(report_content)
            print(f"📄 Report saved to: {filename}")
        
        # Export data to CSV
        csv_filename = filename.replace('.txt', '_data.csv') if filename else "subject_analysis_data.csv"
        metrics_df.to_csv(csv_filename, index=False)
        print(f"📊 Data exported to: {csv_filename}")
        
        # Export trends data
        trends_filename = filename.replace('.txt', '_trends.csv') if filename else "subject_trends_data.csv"
        trends_df.to_csv(trends_filename, index=False)
        print(f"📈 Trends data exported to: {trends_filename}")
    
    def _format_report(self, metrics_df: pd.DataFrame, trends_df: pd.DataFrame) -> str:
        """Format the comprehensive analysis report."""
        report_lines = []
        
        # Header
        report_lines.append("=" * 80)
        report_lines.append("🎓 NCEA TO ATAR SUBJECT ANALYSIS REPORT")
        report_lines.append("=" * 80)
        report_lines.append(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        report_lines.append(f"Total Subjects Analyzed: {len(metrics_df['subject'].unique())}")
        report_lines.append(f"Years Covered: {metrics_df['academic_year'].min()} - {metrics_df['academic_year'].max()}")
        report_lines.append("")
        
        # Executive Summary
        report_lines.append("📋 EXECUTIVE SUMMARY")
        report_lines.append("-" * 40)
        
        # Get latest year rankings
        latest_year = metrics_df['academic_year'].max()
        latest_data = metrics_df[metrics_df['academic_year'] == latest_year].sort_values('optimal_score', ascending=False)
        
        report_lines.append(f"🏆 TOP 10 SUBJECTS FOR {latest_year}:")
        for i, (_, row) in enumerate(latest_data.head(10).iterrows(), 1):
            report_lines.append(f"{i:2d}. {row['subject']:<25} Score: {row['optimal_score']:.4f}")
        
        report_lines.append("")
        
        # Year-by-year rankings
        report_lines.append("📊 YEAR-BY-YEAR SUBJECT RANKINGS")
        report_lines.append("-" * 50)
        
        for year in sorted(metrics_df['academic_year'].unique(), reverse=True):
            year_data = metrics_df[metrics_df['academic_year'] == year].sort_values('optimal_score', ascending=False)
            report_lines.append(f"\n📅 {year} Rankings:")
            
            for i, (_, row) in enumerate(year_data.head(15).iterrows(), 1):
                efficiency = f"({row['credits_efficiency']*100:.0f}% efficiency)" if row['credits_efficiency'] < 1.0 else ""
                report_lines.append(
                    f"{i:2d}. {row['subject']:<25} Score: {row['optimal_score']:.4f} "
                    f"Avg Weight: {row['avg_weight_excellence']:.3f} {efficiency}"
                )
        
        # Trend Analysis
        report_lines.append("\n\n📈 TREND ANALYSIS")
        report_lines.append("-" * 30)
        
        improving = trends_df[trends_df['trend_direction'] == 'Improving'].head(5)
        declining = trends_df[trends_df['trend_direction'] == 'Declining'].head(5)
        
        if not improving.empty:
            report_lines.append("\n🚀 Top Improving Subjects:")
            for _, row in improving.iterrows():
                report_lines.append(
                    f"   {row['subject']:<25} Score Change: +{row['score_change']:.4f} "
                    f"(Rank #{row['latest_rank']})"
                )
        
        if not declining.empty:
            report_lines.append("\n📉 Declining Subjects:")
            for _, row in declining.iterrows():
                report_lines.append(
                    f"   {row['subject']:<25} Score Change: {row['score_change']:.4f} "
                    f"(Rank #{row['latest_rank']})"
                )
        
        # Statistical Insights
        report_lines.append("\n\n📊 STATISTICAL INSIGHTS")
        report_lines.append("-" * 35)
        
        latest_stats = latest_data.describe()
        report_lines.append(f"Average Subject Score: {latest_stats.loc['mean', 'optimal_score']:.4f}")
        report_lines.append(f"Median Subject Score: {latest_stats.loc['50%', 'optimal_score']:.4f}")
        report_lines.append(f"Score Standard Deviation: {latest_stats.loc['std', 'optimal_score']:.4f}")
        report_lines.append(f"Best Subject Score: {latest_stats.loc['max', 'optimal_score']:.4f}")
        report_lines.append(f"Lowest Subject Score: {latest_stats.loc['min', 'optimal_score']:.4f}")
        
        # High-performing subjects (top quartile)
        top_quartile_threshold = latest_stats.loc['75%', 'optimal_score']
        high_performers = latest_data[latest_data['optimal_score'] >= top_quartile_threshold]
        
        report_lines.append(f"\n🎯 HIGH-PERFORMING SUBJECTS (Top 25%):")
        report_lines.append(f"Threshold Score: {top_quartile_threshold:.4f}")
        for _, row in high_performers.iterrows():
            report_lines.append(f"   • {row['subject']}")
        
        # Footer
        report_lines.append("\n\n" + "=" * 80)
        report_lines.append("📝 METHODOLOGY NOTE:")
        report_lines.append("Scores calculated using best 24 credits per subject rule.")
        report_lines.append("Only Achievement Standards included (Unit Standards excluded).")
        report_lines.append("Pro-rata calculations applied for partial credit usage.")
        report_lines.append("=" * 80)
        
        return "\n".join(report_lines)
    
    def close_connection(self):
        """Close the database connection."""
        if self.connection and self.connection.is_connected():
            self.connection.close()
            print("🔌 Database connection closed")

def main():
    """Main function to run the enhanced subject analyzer."""
    parser = argparse.ArgumentParser(description='Enhanced NCEA Subject Weight Analyzer')
    parser.add_argument('--host', default='localhost', help='Database host')
    parser.add_argument('--port', default=3307, type=int, help='Database port')
    parser.add_argument('--database', default='ncea_atar', help='Database name')
    parser.add_argument('--user', default='ncea_user', help='Database user')
    parser.add_argument('--password', default='ncea_password', help='Database password')
    parser.add_argument('--output', choices=['console', 'file'], default='console', help='Output format')
    parser.add_argument('--filename', help='Output filename (for file output)')
    parser.add_argument('--subject', help='Analyze specific subject')
    parser.add_argument('--year', type=int, help='Analyze specific year')
    
    args = parser.parse_args()
    
    # Database configuration
    db_config = {
        'host': args.host,
        'port': args.port,
        'database': args.database,
        'user': args.user,
        'password': args.password
    }
    
    # Initialize analyzer
    analyzer = SubjectAnalyzer(db_config)
    
    try:
        # Connect and load data
        if not analyzer.connect_to_database():
            sys.exit(1)
        
        if not analyzer.load_data():
            sys.exit(1)
        
        # Generate report or specific analysis
        if args.subject and args.year:
            # Detailed subject analysis
            breakdown = analyzer.get_detailed_subject_breakdown(args.subject, args.year)
            if breakdown:
                print(f"\n🔍 DETAILED ANALYSIS: {args.subject} ({args.year})")
                print("=" * 60)
                print(f"Optimal Score: {breakdown['optimal_score']:.4f}")
                print(f"Total Standards: {breakdown['total_standards_available']}")
                print(f"Total Credits Available: {breakdown['total_credits_available']}")
                print("\nStandards Breakdown (by excellence weight):")
                for i, std in enumerate(breakdown['standards_breakdown'], 1):
                    ue_status = "UE" if std['is_ue'] else ""
                    print(f"{i:2d}. {std['standard_number']} ({std['credits']} credits) - {std['weight_excellence']:.4f} {ue_status}")
                    print(f"    {std['title']}")
            else:
                print(f"❌ No data found for {args.subject} in {args.year}")
        else:
            # Full comprehensive report
            analyzer.generate_report(args.output, args.filename)
    
    except KeyboardInterrupt:
        print("\n⚠️  Analysis interrupted by user")
    except Exception as e:
        print(f"❌ Error during analysis: {e}")
        sys.exit(1)
    finally:
        analyzer.close_connection()

if __name__ == "__main__":
    main() 