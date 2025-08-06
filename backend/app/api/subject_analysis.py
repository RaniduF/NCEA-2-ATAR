"""
NCEA Subject Analysis API Endpoints

This module provides REST API endpoints for subject analysis and ranking
to help students make informed decisions about subject choices for ATAR conversion.
"""

from fastapi import APIRouter, HTTPException, Query, Depends
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from ..db import session
from sqlalchemy import text
import pandas as pd
from datetime import datetime
from enum import Enum

router = APIRouter()

def get_db():
    """Database dependency for the subject analysis endpoints."""
    db = session.SessionLocal()
    try:
        yield db
    finally:
        db.close()

class TrendDirection(str, Enum):
    IMPROVING = "Improving"
    DECLINING = "Declining"
    STABLE = "Stable"

class SubjectRanking(BaseModel):
    """Model for subject ranking information."""
    rank: int
    subject: str
    optimal_score: float = Field(..., description="Normalized score based on best 24 credits")
    total_standards: int
    total_credits_available: int
    avg_weight_excellence: float
    max_weight_excellence: float
    credits_efficiency: float = Field(..., description="Percentage of 24 credits this subject can provide")
    high_weight_standards: int = Field(..., description="Number of standards with excellence weight > 0.9")
    ue_approved: bool
    weighted_avg_excellence: float

class SubjectTrend(BaseModel):
    """Model for subject trend analysis."""
    subject: str
    years_available: int
    first_year: int
    last_year: int
    score_change: float
    trend_direction: TrendDirection
    latest_score: float
    latest_rank: int

class StandardBreakdown(BaseModel):
    """Model for individual standard information."""
    standard_number: int
    title: str
    credits: int
    weight_excellence: float
    assessment_type: str
    is_ue: bool

class DetailedSubjectAnalysis(BaseModel):
    """Model for detailed subject analysis."""
    subject: str
    year: int
    optimal_score: float
    total_standards_available: int
    total_credits_available: int
    rank: Optional[int] = None
    standards_breakdown: List[StandardBreakdown]

class SubjectAnalysisResponse(BaseModel):
    """Response model for subject analysis."""
    year: int
    total_subjects: int
    rankings: List[SubjectRanking]
    statistics: Dict[str, float]

class TrendAnalysisResponse(BaseModel):
    """Response model for trend analysis."""
    trends: List[SubjectTrend]
    improving_count: int
    declining_count: int
    stable_count: int

def calculate_subject_score(standards_data: List[Dict]) -> float:
    """
    Calculate the optimal score for a subject using the best 24 credits.
    
    Args:
        standards_data: List of dictionaries containing standard information
        
    Returns:
        Normalized score (sum of weighted credits / 24)
    """
    # Sort by excellence weight descending
    sorted_standards = sorted(standards_data, key=lambda x: x['weight_excellence'], reverse=True)
    
    credits_mapped = 0
    total_weighted_score = 0
    
    for standard in sorted_standards:
        if credits_mapped >= 24:
            break
            
        credits_to_take = min(standard['credits'], 24 - credits_mapped)
        total_weighted_score += credits_to_take * standard['weight_excellence']
        credits_mapped += credits_to_take
    
    return total_weighted_score / 24

@router.get("/rankings/{year}", response_model=SubjectAnalysisResponse)
async def get_subject_rankings(
    year: int,
    top_n: Optional[int] = Query(None, description="Number of top subjects to return"),
    min_score: Optional[float] = Query(None, description="Minimum score threshold"),
    ue_only: Optional[bool] = Query(False, description="Show only UE-approved subjects"),
    db: Session = Depends(get_db)
):
    """
    Get subject rankings for a specific year.
    
    This endpoint calculates and returns subject rankings based on the optimal
    24-credit combination for ATAR conversion.
    """
    try:
        # Query to get standards and weightings for the specified year
        query = text("""
            SELECT 
                s.subject,
                s.standard_number,
                s.title,
                s.credits,
                s.assessment_type,
                s.is_ue,
                sw.weight_excellence
            FROM standards s
            JOIN standard_weightings sw ON s.standard_number = sw.standard_number
            WHERE s.standards_type = 'Achievement'
            AND sw.academic_year = :year
            AND sw.weight_excellence IS NOT NULL
            ORDER BY s.subject, sw.weight_excellence DESC
        """)
        
        result = db.execute(query, {"year": year}).fetchall()
        
        if not result:
            raise HTTPException(status_code=404, detail=f"No data found for year {year}")
        
        # Group standards by subject
        subjects_data = {}
        for row in result:
            subject = row.subject
            if subject not in subjects_data:
                subjects_data[subject] = []
            
            subjects_data[subject].append({
                'standard_number': row.standard_number,
                'title': row.title,
                'credits': row.credits,
                'assessment_type': row.assessment_type,
                'is_ue': bool(row.is_ue),
                'weight_excellence': float(row.weight_excellence)
            })
        
        # Calculate metrics for each subject
        rankings = []
        for subject, standards in subjects_data.items():
            # Calculate optimal score
            optimal_score = calculate_subject_score(standards)
            
            # Calculate additional metrics
            weights = [s['weight_excellence'] for s in standards]
            credits = [s['credits'] for s in standards]
            
            total_credits = sum(credits)
            avg_weight = sum(weights) / len(weights)
            max_weight = max(weights)
            high_weight_count = sum(1 for w in weights if w > 0.9)
            ue_approved = any(s['is_ue'] for s in standards)
            credits_efficiency = min(total_credits, 24) / 24
            
            # Weighted average considering credit distribution
            weighted_avg = sum(w * c for w, c in zip(weights, credits)) / total_credits
            
            # Apply filters
            if ue_only and not ue_approved:
                continue
            if min_score is not None and optimal_score < min_score:
                continue
            
            rankings.append({
                'subject': subject,
                'optimal_score': optimal_score,
                'total_standards': len(standards),
                'total_credits_available': total_credits,
                'avg_weight_excellence': avg_weight,
                'max_weight_excellence': max_weight,
                'credits_efficiency': credits_efficiency,
                'high_weight_standards': high_weight_count,
                'ue_approved': ue_approved,
                'weighted_avg_excellence': weighted_avg
            })
        
        # Sort by optimal score descending
        rankings.sort(key=lambda x: x['optimal_score'], reverse=True)
        
        # Add ranks and apply top_n limit
        for i, ranking in enumerate(rankings, 1):
            ranking['rank'] = i
        
        if top_n:
            rankings = rankings[:top_n]
        
        # Calculate statistics
        scores = [r['optimal_score'] for r in rankings]
        statistics = {
            'mean_score': sum(scores) / len(scores) if scores else 0,
            'median_score': sorted(scores)[len(scores)//2] if scores else 0,
            'max_score': max(scores) if scores else 0,
            'min_score': min(scores) if scores else 0,
            'std_dev': pd.Series(scores).std() if scores else 0
        }
        
        return SubjectAnalysisResponse(
            year=year,
            total_subjects=len(rankings),
            rankings=[SubjectRanking(**r) for r in rankings],
            statistics=statistics
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error calculating rankings: {str(e)}")

@router.get("/trends", response_model=TrendAnalysisResponse)
async def get_subject_trends(
    min_years: Optional[int] = Query(2, description="Minimum number of years required for trend analysis"),
    db: Session = Depends(get_db)
):
    """
    Get year-over-year trend analysis for subjects.
    
    This endpoint analyzes how subject performance has changed over time.
    """
    try:
        # Get all available years
        years_query = text("SELECT DISTINCT academic_year FROM standard_weightings ORDER BY academic_year")
        available_years = [row[0] for row in db.execute(years_query).fetchall()]
        
        if len(available_years) < 2:
            raise HTTPException(status_code=404, detail="Insufficient data for trend analysis")
        
        # Get data for all years
        trends = []
        for subject in await _get_all_subjects(db):
            subject_scores = []
            
            for year in available_years:
                try:
                    # Get subject ranking for this year
                    response = await get_subject_rankings(year=year, db=db)
                    subject_ranking = next((r for r in response.rankings if r.subject == subject), None)
                    
                    if subject_ranking:
                        subject_scores.append({
                            'year': year,
                            'score': subject_ranking.optimal_score,
                            'rank': subject_ranking.rank
                        })
                except:
                    continue
            
            if len(subject_scores) >= min_years:
                # Calculate trend
                first_score = subject_scores[0]['score']
                last_score = subject_scores[-1]['score']
                score_change = last_score - first_score
                
                # Determine trend direction
                if score_change > 0.01:
                    trend_direction = TrendDirection.IMPROVING
                elif score_change < -0.01:
                    trend_direction = TrendDirection.DECLINING
                else:
                    trend_direction = TrendDirection.STABLE
                
                trends.append(SubjectTrend(
                    subject=subject,
                    years_available=len(subject_scores),
                    first_year=subject_scores[0]['year'],
                    last_year=subject_scores[-1]['year'],
                    score_change=score_change,
                    trend_direction=trend_direction,
                    latest_score=last_score,
                    latest_rank=subject_scores[-1]['rank']
                ))
        
        # Sort by latest score descending
        trends.sort(key=lambda x: x.latest_score, reverse=True)
        
        # Count trends by direction
        improving_count = sum(1 for t in trends if t.trend_direction == TrendDirection.IMPROVING)
        declining_count = sum(1 for t in trends if t.trend_direction == TrendDirection.DECLINING)
        stable_count = sum(1 for t in trends if t.trend_direction == TrendDirection.STABLE)
        
        return TrendAnalysisResponse(
            trends=trends,
            improving_count=improving_count,
            declining_count=declining_count,
            stable_count=stable_count
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error analyzing trends: {str(e)}")

@router.get("/subject/{subject_name}/{year}", response_model=DetailedSubjectAnalysis)
async def get_detailed_subject_analysis(
    subject_name: str,
    year: int,
    db: Session = Depends(get_db)
):
    """
    Get detailed analysis for a specific subject and year.
    
    This endpoint provides a comprehensive breakdown of all standards
    within a subject, showing which ones contribute to the optimal score.
    """
    try:
        query = text("""
            SELECT 
                s.standard_number,
                s.title,
                s.credits,
                s.assessment_type,
                s.is_ue,
                sw.weight_excellence
            FROM standards s
            JOIN standard_weightings sw ON s.standard_number = sw.standard_number
            WHERE s.standards_type = 'Achievement'
            AND s.subject = :subject
            AND sw.academic_year = :year
            AND sw.weight_excellence IS NOT NULL
            ORDER BY sw.weight_excellence DESC
        """)
        
        result = db.execute(query, {"subject": subject_name, "year": year}).fetchall()
        
        if not result:
            raise HTTPException(
                status_code=404, 
                detail=f"No data found for {subject_name} in {year}"
            )
        
        # Convert to standards breakdown
        standards_breakdown = []
        standards_data = []
        
        for row in result:
            standard_data = {
                'standard_number': row.standard_number,
                'title': row.title,
                'credits': row.credits,
                'weight_excellence': float(row.weight_excellence),
                'assessment_type': row.assessment_type,
                'is_ue': bool(row.is_ue)
            }
            
            standards_breakdown.append(StandardBreakdown(**standard_data))
            standards_data.append(standard_data)
        
        # Calculate optimal score
        optimal_score = calculate_subject_score(standards_data)
        
        # Get rank for this subject in this year
        try:
            rankings_response = await get_subject_rankings(year=year, db=db)
            subject_rank = next((r.rank for r in rankings_response.rankings if r.subject == subject_name), None)
        except:
            subject_rank = None
        
        return DetailedSubjectAnalysis(
            subject=subject_name,
            year=year,
            optimal_score=optimal_score,
            total_standards_available=len(standards_breakdown),
            total_credits_available=sum(s.credits for s in standards_breakdown),
            rank=subject_rank,
            standards_breakdown=standards_breakdown
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error analyzing subject: {str(e)}")

@router.get("/years")
async def get_available_years(db: Session = Depends(get_db)):
    """Get all available years in the dataset."""
    try:
        query = text("SELECT DISTINCT academic_year FROM standard_weightings ORDER BY academic_year DESC")
        years = [row[0] for row in db.execute(query).fetchall()]
        return {"years": years}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching years: {str(e)}")

@router.get("/subjects")
async def get_available_subjects(
    year: Optional[int] = Query(None, description="Filter by specific year"),
    db: Session = Depends(get_db)
):
    """Get all available subjects, optionally filtered by year."""
    try:
        if year:
            query = text("""
                SELECT DISTINCT s.subject 
                FROM standards s
                JOIN standard_weightings sw ON s.standard_number = sw.standard_number
                WHERE s.standards_type = 'Achievement'
                AND sw.academic_year = :year
                ORDER BY s.subject
            """)
            result = db.execute(query, {"year": year}).fetchall()
        else:
            query = text("""
                SELECT DISTINCT subject 
                FROM standards 
                WHERE standards_type = 'Achievement'
                ORDER BY subject
            """)
            result = db.execute(query).fetchall()
        
        subjects = [row[0] for row in result]
        return {"subjects": subjects}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching subjects: {str(e)}")

async def _get_all_subjects(db: Session) -> List[str]:
    """Helper function to get all subjects."""
    query = text("SELECT DISTINCT subject FROM standards WHERE standards_type = 'Achievement'")
    return [row[0] for row in db.execute(query).fetchall()]

# Health check endpoint
@router.get("/health")
async def health_check():
    """Health check endpoint for the subject analysis API."""
    return {
        "status": "healthy",
        "service": "subject_analysis",
        "timestamp": datetime.now().isoformat()
    } 