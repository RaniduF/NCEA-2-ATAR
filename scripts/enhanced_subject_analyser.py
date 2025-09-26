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
import argparse
from datetime import datetime
from typing import Dict, List, Optional, Tuple
import sys

class SubjectAnalyzer:
    def __init__(self, db_config: Dict[str, str]):
        """Initialize the analyzer with database configuration."""
        self.db_config = db_config
        self.connection = None
        self.standards_df = None
        self.weightings_df = None
        self.merged_df = None
        # Capture detailed credits usage for each subject-year and standard
        self.credits_breakdown_rows: List[Dict] = []
        # Scoring configuration (defaults preserve previous behavior)
        self.max_standards: Optional[int] = None  # None = unlimited
        self.target_credits: Optional[int] = 24   # 24-credit target for fixed normalization
        # normalization_mode: 'fixed' | 'dynamic_credits' | 'unweighted'
        self.normalization_mode: str = 'fixed'
        # Weight sanitation config
        self.cap_excellence: float = 0.99
        self.cap_merit: float = 0.99
        self.apply_shrink: bool = True
        self.shrink_prior_excellence: float = 0.95
        self.shrink_prior_merit: float = 0.90
        # When weights are near cap or equal to 1.0, shrink factor r in [0,1]
        self.shrink_r_high: float = 0.6
        # Extra shrink if suspected zero-E (weight exactly 1.0)
        self.shrink_r_zero_e: float = 0.4
        # One-weight strict penalty
        self.one_weight_threshold: float = 1.0
        self.one_weight_replacement: float = 0.5
        # Store used standards per (subject, year) to avoid setting DataFrame attributes
        self.used_standards_by_key: Dict[Tuple[str, int], List[Dict]] = {}
        self.total_credits_available_by_key: Dict[Tuple[str, int], int] = {}
        
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
    
    def _sanitize_weight(self, weight_value: float, grade: str = 'Excellence') -> float:
        """Apply capping and shrinkage to mitigate over-weighted niche standards.
        Enforce strict penalty for raw==1.0 by mapping to self.one_weight_replacement.
        """
        if weight_value is None:
            return 0.0
        w = float(weight_value)
        w = max(0.0, min(1.0, w))
        # Strict 1.0 penalty
        if w >= self.one_weight_threshold:
            return float(self.one_weight_replacement)
        if grade == 'Excellence':
            cap = self.cap_excellence
            prior = self.shrink_prior_excellence
        elif grade == 'Merit':
            cap = self.cap_merit
            prior = self.shrink_prior_merit
        else:
            return w
        # Winsorize then shrink heuristically
        w_capped = min(w, cap)
        if not self.apply_shrink:
            return w_capped
        if w >= cap * 0.995:
            r = self.shrink_r_high
        else:
            r = 1.0
        w_shrunk = prior + r * (w_capped - prior)
        return max(0.0, min(1.0, w_shrunk))
    
    def calculate_subject_score(self, subject_df: pd.DataFrame) -> float:
        """
        Calculate the optimal score for a subject using configured rules.
        - Sort by sanitized excellence weight descending
        - Optionally cap by number of standards (self.max_standards)
        - Optionally cap by target credits (self.target_credits > 0)
        - Normalization per self.normalization_mode
        """
        # Use sanitized weights for ordering and contribution
        subject_df = subject_df.copy()
        subject_df['sanitized_weight_excellence'] = subject_df['weight_excellence'].apply(
            lambda v: self._sanitize_weight(v, 'Excellence')
        )
        subject_df = subject_df.sort_values(by='sanitized_weight_excellence', ascending=False)
        
        credits_mapped = 0
        total_contribution = 0.0
        used_standards = []
        selected_count = 0
        
        # Try to infer grouping info for breakdown rows
        subject_name = None
        academic_year = None
        if 'subject' in subject_df.columns and not subject_df['subject'].empty:
            try:
                subject_name = subject_df['subject'].iloc[0]
            except (IndexError, KeyError, ValueError, TypeError):
                subject_name = None
        if 'academic_year' in subject_df.columns and not subject_df['academic_year'].empty:
            try:
                academic_year = int(subject_df['academic_year'].iloc[0])
            except (IndexError, KeyError, ValueError, TypeError):
                academic_year = None
        
        for _, row in subject_df.iterrows():
            if self.max_standards is not None and selected_count >= self.max_standards:
                break
            if self.target_credits and self.target_credits > 0 and credits_mapped >= self.target_credits:
                break
            
            available_credits = row['credits']
            if self.target_credits and self.target_credits > 0:
                credits_to_take = min(available_credits, max(0, self.target_credits - credits_mapped))
            else:
                credits_to_take = available_credits
            
            if credits_to_take <= 0:
                continue
            
            w_raw = float(row['weight_excellence'])
            sanitized_w = row['sanitized_weight_excellence']
            penalized_one = w_raw >= self.one_weight_threshold
            
            if self.normalization_mode == 'unweighted':
                contribution = sanitized_w
            else:
                contribution = credits_to_take * sanitized_w
            
            total_contribution += contribution
            credits_mapped += credits_to_take
            selected_count += 1
            
            used_entry = {
                'standard': row['standard_number'],
                'title': row.get('title', None),
                'credits_available': available_credits,
                'credits_used': credits_to_take,
                'weight_raw': w_raw,
                'weight_sanitized': float(sanitized_w),
                'penalized_one': penalized_one,
                'contribution': contribution,
                'subject': subject_name,
                'academic_year': academic_year,
                'standard_version': row.get('standard_version', None)
            }
            used_standards.append(used_entry)
            
        # Store detailed breakdown for later analysis without touching DataFrame attributes
        if subject_name is not None and academic_year is not None:
            key = (subject_name, academic_year)
            self.used_standards_by_key[key] = used_standards
            self.total_credits_available_by_key[key] = int(subject_df['credits'].sum())
        
        # Accumulate exportable credits breakdown rows
        for item in used_standards:
            self.credits_breakdown_rows.append({
                'subject': item.get('subject'),
                'academic_year': item.get('academic_year'),
                'standard_number': item['standard'],
                'standard_version': item.get('standard_version'),
                'weight_excellence_raw': item['weight_raw'],
                'weight_excellence_sanitized': item['weight_sanitized'],
                'penalized_one': item['penalized_one'],
                'effective_credits': item['credits_used']
            })
        
        # Determine denominator
        if self.normalization_mode == 'unweighted':
            denom = max(1, selected_count)
        elif self.normalization_mode == 'dynamic_credits':
            denom = max(1, int(sum(item['credits_used'] for item in used_standards)))
        else:  # 'fixed'
            denom = self.target_credits if (self.target_credits and self.target_credits > 0) else 24
        
        return total_contribution / denom if denom else 0.0
    
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
                # Use credit-weighted average to better reflect meaningful change
                if 'weighted_avg_excellence' in subject_data.columns:
                    avg_weight_change = subject_data['weighted_avg_excellence'].iloc[-1] - subject_data['weighted_avg_excellence'].iloc[0]
                else:
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
        
        # Calculate the optimal combination (also populates used standards map)
        score = self.calculate_subject_score(subject_data)
        
        # Map effective credits and sanitized weights used for this subject-year
        used_map: Dict[int, float] = {}
        used_weight_map: Dict[int, float] = {}
        key = (subject, year)
        used_list = self.used_standards_by_key.get(key)
        if used_list is None:
            # If not present (e.g., if called directly), compute and fetch
            self.calculate_subject_score(subject_data.copy())
            used_list = self.used_standards_by_key.get(key, [])
        for item in used_list or []:
            used_map[item['standard']] = item['credits_used']
            used_weight_map[item['standard']] = item['weight_sanitized']
        
        # Get the breakdown from the calculation
        breakdown = {
            'subject': subject,
            'year': year,
            'optimal_score': score,
            'total_standards_available': len(subject_data),
            'total_credits_available': subject_data['credits'].sum(),
            'standards_breakdown': []
        }
        
        # Add all standards sorted by sanitized weight
        subject_data['sanitized_weight_excellence'] = subject_data['weight_excellence'].apply(
            lambda v: self._sanitize_weight(v, 'Excellence')
        )
        for _, row in subject_data.sort_values('sanitized_weight_excellence', ascending=False).iterrows():
            w_raw = row['weight_excellence']
            w_san = used_weight_map.get(row['standard_number'], self._sanitize_weight(w_raw, 'Excellence'))
            standard_info = {
                'standard_number': row['standard_number'],
                'title': row['title'],
                'credits': row['credits'],
                'weight_excellence_raw': w_raw,
                'weight_excellence_sanitized': w_san,
                'assessment_type': row['assessment_type'],
                'is_ue': row['is_ue'],
                'standard_version': row.get('standard_version', None),
                'effective_credits': used_map.get(row['standard_number'], 0)
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
        
        # Export credits breakdown data for debugging ranking behavior
        breakdown_filename = filename.replace('.txt', '_credits_breakdown.csv') if filename else "credits_breakdown.csv"
        self.export_credits_breakdown(breakdown_filename)
        print(f"🔎 Credits breakdown exported to: {breakdown_filename}")
    
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

    def export_credits_breakdown(self, filename: str = "credits_breakdown.csv") -> None:
        """Export the captured credits breakdown rows to CSV for debugging ranking behavior."""
        if not self.credits_breakdown_rows:
            # No rows captured; create empty file with headers
            pd.DataFrame(columns=[
                'subject', 'academic_year', 'standard_number', 'standard_version',
                'weight_excellence_raw', 'weight_excellence_sanitized', 'penalized_one', 'effective_credits'
            ]).to_csv(filename, index=False)
            return
        df = pd.DataFrame(self.credits_breakdown_rows)
        # Order
        df = df[['subject', 'academic_year', 'standard_number', 'standard_version', 'weight_excellence_raw', 'weight_excellence_sanitized', 'penalized_one', 'effective_credits']]
        df.to_csv(filename, index=False)

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
    # New configuration options
    parser.add_argument('--max-standards', type=int, help='Maximum number of standards to select per subject')
    parser.add_argument('--norm', choices=['fixed', 'dynamic_credits', 'unweighted'], help='Normalization mode: fixed=divide by 24 or target credits, dynamic_credits=divide by credits used, unweighted=divide by number of standards')
    parser.add_argument('--target-credits', type=int, default=24, help='Target credits for selection and fixed normalization (set 0 to disable credit cap)')
    # Weight sanitation options
    parser.add_argument('--cap-excellence', type=float, default=0.99, help='Winsorization cap for Excellence weights')
    parser.add_argument('--cap-merit', type=float, default=0.99, help='Winsorization cap for Merit weights (not used unless ranking by Merit)')
    parser.add_argument('--no-shrink', action='store_true', help='Disable shrinkage after capping')
    parser.add_argument('--shrink-prior-ex', type=float, default=0.95, help='Shrinkage prior for Excellence')
    parser.add_argument('--shrink-prior-m', type=float, default=0.90, help='Shrinkage prior for Merit')
    parser.add_argument('--shrink-r-high', type=float, default=0.6, help='Shrink factor near cap (0..1)')
    parser.add_argument('--shrink-r-zero-e', type=float, default=0.4, help='Extra shrink when weight is exactly 1.0')
    parser.add_argument('--one-weight-threshold', type=float, default=1.0, help='Threshold at/above which to apply strict 1.0 penalty')
    parser.add_argument('--one-weight-replacement', type=float, default=0.5, help='Replacement value when applying strict 1.0 penalty')
    
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
    
    # Configure scoring with prompt fallbacks
    analyzer.max_standards = args.max_standards
    analyzer.target_credits = args.target_credits if args.target_credits is not None else 24
    analyzer.normalization_mode = args.norm or 'fixed'
    
    # Configure sanitation
    analyzer.cap_excellence = args.cap_excellence
    analyzer.cap_merit = args.cap_merit
    analyzer.apply_shrink = not args.no_shrink
    analyzer.shrink_prior_excellence = args.shrink_prior_ex
    analyzer.shrink_prior_merit = args.shrink_prior_m
    analyzer.shrink_r_high = args.shrink_r_high
    analyzer.shrink_r_zero_e = args.shrink_r_zero_e
    analyzer.one_weight_threshold = args.one_weight_threshold
    analyzer.one_weight_replacement = args.one_weight_replacement
    
    if sys.stdin and sys.stdin.isatty():
        try:
            if analyzer.max_standards is None:
                try:
                    user_input = input("Enter max standards per subject (e.g., 4/5/6, blank for no limit): ").strip()
                    analyzer.max_standards = int(user_input) if user_input else None
                except (ValueError, TypeError):
                    analyzer.max_standards = None
            if args.norm is None:
                try:
                    prompt = "Choose normalization [fixed | dynamic_credits | unweighted] (default: fixed): "
                    user_input = input(prompt).strip().lower()
                    analyzer.normalization_mode = user_input if user_input in {'fixed','dynamic_credits','unweighted'} else 'fixed'
                except (ValueError, TypeError):
                    analyzer.normalization_mode = 'fixed'
        except EOFError:
            # Non-interactive environment; keep defaults
            pass
    
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
                    eff = std.get('effective_credits', 0)
                    ver = std.get('standard_version', '')
                    w_raw = std.get('weight_excellence_raw', None)
                    w_san = std.get('weight_excellence_sanitized', None)
                    if w_raw is None:
                        # compute sanitized on the fly if missing
                        w_raw = std.get('weight_excellence', None)
                        w_san = analyzer._sanitize_weight(w_raw, 'Excellence') if w_raw is not None else None
                    print(f"{i:2d}. {std['standard_number']} v{ver} ({std['credits']} cr, eff {eff}) - raw {w_raw:.4f} → used {w_san:.4f} {ue_status}")
                    print(f"    {std['title']}")
                # Also export the credits breakdown captured so far
                analyzer.export_credits_breakdown("credits_breakdown.csv")
                print("\n🔎 Credits breakdown exported to: credits_breakdown.csv")
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