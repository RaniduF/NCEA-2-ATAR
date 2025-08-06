# NCEA Subject Analysis Feature

## Overview

The NCEA Subject Analysis feature is a comprehensive tool designed to help Year 12 students make strategic decisions about their subject choices for optimal ATAR conversion. This feature addresses the highly competitive nature of Australian university admissions, particularly for medicine and engineering programs where students need ATARs of 99.90+ to be competitive.

## Problem Statement

With the modular nature of NCEA allowing different schools to offer different standards, and the critical importance of maximizing the "best 24 credits" for ATAR conversion, students need data-driven insights to optimize their subject selections. The difference between strategic and suboptimal subject choices can be the deciding factor for competitive university programs.

## Key Features

### 1. Subject Rankings by Year
- **Optimal Score Calculation**: Uses the actual NCEA to ATAR conversion methodology
- **Best 24 Credits Rule**: Automatically calculates the highest possible score using only the best-weighted 24 credits from each subject
- **Pro-rata Calculations**: Properly handles subjects that don't divide evenly into 24 credits
- **Year-by-Year Analysis**: Shows how subject rankings change over time

### 2. Comprehensive Metrics
For each subject, the system calculates:
- **Optimal Score**: Normalized score using best 24 credits (primary ranking metric)
- **Credits Efficiency**: Percentage of the 24-credit maximum the subject can provide
- **Average Excellence Weight**: Mean weight across all standards in the subject
- **High-Weight Standards Count**: Number of standards with excellence weight > 0.9
- **UE Approval Status**: Whether the subject meets University Entrance requirements
- **Weighted Average Excellence**: Credit-weighted average of excellence weights

### 3. Trend Analysis
- **Year-over-Year Performance**: Track how subjects improve or decline over time
- **Trend Categorization**: Automatic classification as "Improving", "Declining", or "Stable"
- **Performance Trajectory**: Identify subjects on upward or downward trends

### 4. Detailed Subject Breakdowns
- **Standard-Level Analysis**: See exactly which standards contribute to the optimal score
- **Weight Distribution**: Understand the distribution of excellence weights within a subject
- **Credit Allocation**: See how the 24-credit limit is optimally allocated

### 5. Statistical Insights
- **Distribution Analysis**: Understand the spread of subject performance
- **Quartile Analysis**: Identify top-performing subjects (75th percentile and above)
- **Comparative Statistics**: Mean, median, standard deviation across all subjects

## Methodology

### Score Calculation Algorithm

```python
def calculate_optimal_score(subject_standards):
    1. Sort all standards by excellence weight (descending)
    2. Iterate through standards, accumulating credits until 24 total
    3. If a standard would exceed 24 credits, take partial credits (pro-rata)
    4. Calculate weighted sum: Σ(credits_used × excellence_weight)
    5. Normalize by dividing by 24: optimal_score = weighted_sum / 24
```

### Data Sources
- **Standards Database**: Core information about each NCEA standard
- **Weightings Database**: Year-specific excellence weights based on cohort performance
- **Achievement Standards Only**: Unit standards are excluded as they cannot achieve Excellence

### Filtering Rules
- Only Achievement Standards are included (Unit Standards excluded)
- Only standards with non-null excellence weights
- Excellence weights are based on actual statistical performance data

## Usage

### Command Line Tools

#### 1. Enhanced Subject Analyzer
```bash
# Full analysis with database connection
python scripts/enhanced_subject_analyzer.py

# Specific subject analysis
python scripts/enhanced_subject_analyzer.py --subject "Statistics" --year 2024

# Export to file
python scripts/enhanced_subject_analyzer.py --output file --filename my_analysis.txt

# Connect to different database
python scripts/enhanced_subject_analyzer.py --host localhost --port 3307 --database ncea_atar
```

#### 2. Visualization Generator
```bash
# Generate all visualizations
python scripts/subject_visualizer.py

# Custom data files
python scripts/subject_visualizer.py --data my_data.csv --trends my_trends.csv

# Custom output directory
python scripts/subject_visualizer.py --output-dir my_charts
```

### API Endpoints

Base URL: `/api/v1/subject-analysis`

#### Get Subject Rankings
```http
GET /rankings/{year}?top_n=15&min_score=0.9&ue_only=false
```

**Response:**
```json
{
  "year": 2024,
  "total_subjects": 57,
  "rankings": [
    {
      "rank": 1,
      "subject": "Statistics",
      "optimal_score": 0.9947,
      "total_standards": 11,
      "total_credits_available": 44,
      "avg_weight_excellence": 0.931,
      "max_weight_excellence": 1.0,
      "credits_efficiency": 1.0,
      "high_weight_standards": 8,
      "ue_approved": true,
      "weighted_avg_excellence": 0.933
    }
  ],
  "statistics": {
    "mean_score": 0.8403,
    "median_score": 0.8950,
    "max_score": 0.9947,
    "min_score": 0.1667,
    "std_dev": 0.1638
  }
}
```

#### Get Trend Analysis
```http
GET /trends?min_years=2
```

#### Get Detailed Subject Analysis
```http
GET /subject/{subject_name}/{year}
```

#### Get Available Years and Subjects
```http
GET /years
GET /subjects?year=2024
```

## Key Insights from Analysis

### Top Performing Subjects (2024)
1. **Statistics** (0.9947) - Consistently high-weighted standards, full 24-credit efficiency
2. **Health Education** (0.9806) - Strong performance across multiple assessment types
3. **History** (0.9782) - Improving trend, excellent essay-based assessments
4. **Technology/Hangarau** (0.9749) - Practical assessments with high weights
5. **Physics** (0.9742) - STEM subject with consistently high performance

### Notable Trends
- **Statistics**: Shows consistent top performance across multiple years
- **STEM Subjects**: Physics, Chemistry, and Calculus all rank highly
- **Practical Arts**: Sculpture and Design show strong performance
- **Language Subjects**: Te Reo Māori ranks highly, indicating strong cohort performance

### Strategic Recommendations
1. **For Medicine Aspirants**: Focus on Statistics, Physics, Chemistry, Biology
2. **For Engineering**: Statistics, Physics, Calculus, Technology essential
3. **Balanced Portfolio**: Consider mixing high-performing academic subjects with practical arts
4. **UE Requirements**: Ensure selection includes sufficient UE-approved subjects

## Technical Implementation

### Database Schema
```sql
-- Core tables used
standards (standard_number, title, credits, subject, standards_type, is_ue)
standard_weightings (standard_number, academic_year, weight_excellence)
```

### Dependencies
- **Python 3.8+**
- **pandas**: Data manipulation and analysis
- **mysql-connector-python**: Database connectivity
- **matplotlib/seaborn**: Visualization generation
- **FastAPI**: REST API endpoints
- **pydantic**: Data validation and serialization

### Performance Considerations
- Database queries are optimized with proper indexing
- Results are cacheable for repeated requests
- Calculations are performed in-memory for speed
- API responses include pagination support

## Visualization Outputs

The system generates multiple types of visualizations:

1. **Top Subjects Rankings**: Horizontal bar charts showing the highest-performing subjects
2. **Year-over-Year Trends**: Line graphs tracking subject performance over time
3. **Score Distributions**: Histograms showing the spread of subject scores
4. **Credits Efficiency Analysis**: Scatter plots relating efficiency to performance
5. **Improvement/Decline Charts**: Side-by-side comparison of trending subjects
6. **Comprehensive Heatmap**: Matrix view of all subjects across all years
7. **UE Analysis**: Comparison between UE-approved and non-UE subjects

## File Outputs

### Generated Files
- `subject_analysis_data.csv`: Complete dataset with all calculated metrics
- `subject_trends_data.csv`: Trend analysis results
- `subject_analysis_report_YYYYMMDD_HHMMSS.txt`: Comprehensive text report
- `visualizations/*.png`: Multiple chart files

### Report Structure
1. Executive Summary with top subjects
2. Year-by-year rankings (last 7 years)
3. Trend analysis (improving/declining subjects)
4. Statistical insights and quartile analysis
5. Methodology notes

## Future Enhancements

### Planned Features
1. **Machine Learning Predictions**: Predict future subject weights based on historical trends
2. **Personalized Recommendations**: AI-driven subject selection based on student interests and capabilities
3. **School-Specific Analysis**: Compare subject offerings across different schools
4. **Pathway Analysis**: Map subject choices to specific university programs
5. **Interactive Dashboard**: Web-based interface for real-time exploration
6. **Mobile App**: Student-friendly mobile interface
7. **Integration with School Systems**: Direct integration with student management systems

### Technical Improvements
1. **Caching Layer**: Redis-based caching for improved performance
2. **Real-time Updates**: Automatic updates when new weight data is available
3. **Advanced Analytics**: More sophisticated statistical modeling
4. **Export Options**: PDF, Excel, and PowerPoint export capabilities
5. **API Rate Limiting**: Proper rate limiting for production use
6. **Authentication**: User accounts and personalized tracking

## Support and Documentation

### Getting Help
- **GitHub Issues**: Report bugs and feature requests
- **Documentation**: Comprehensive API documentation available at `/docs`
- **Examples**: Sample code and usage examples in the repository

### Contributing
1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Submit a pull request with clear description

## License and Attribution

This feature is part of the NCEA to ATAR conversion project. Please ensure proper attribution when using the analysis methodology or data insights.

---

*Last updated: August 2025*
*Version: 1.0.0* 