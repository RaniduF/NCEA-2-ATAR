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


# --- New: SSP (18-credit rule) models ---
class SSPSubjectRanking(BaseModel):
    rank: int
    subject: str
    ssp_score: float
    eligible: bool
    total_credits_available: int
    ue_present: bool

class SSPRankingResponse(BaseModel):
    year: int
    total_subjects: int
    rankings: List[SSPSubjectRanking]

def calculate_subject_score(standards_data: List[Dict]) -> float:
    """
    Compute a subject's optimal normalized excellence score by selecting up to 24 credits with the highest `weight_excellence`.
    
    Parameters:
        standards_data (List[Dict]): List of standards where each dict includes at least:
            - 'credits' (int or float): credit value of the standard
            - 'weight_excellence' (float): excellence weight for the standard
    
    Returns:
        float: Normalized score equal to (sum of selected credits * weight_excellence) / 24.
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
    Analyze year-over-year subject performance and classify per-subject trends.
    
    For each subject with at least `min_years` of score data, computes the change between the first and last available year,
    assigns a TrendDirection (IMPROVING if change > 0.01, DECLINING if change < -0.01, STABLE otherwise), and records the
    latest score and rank. Returns a TrendAnalysisResponse containing the list of SubjectTrend entries and counts of each
    trend direction.
    
    Parameters:
        min_years (Optional[int]): Minimum number of years of data required for a subject to be included in the analysis.
    
    Returns:
        TrendAnalysisResponse: Contains `trends` (list of SubjectTrend) and `improving_count`, `declining_count`, `stable_count`.
    
    Raises:
        HTTPException: 404 if there are fewer than two years of data available for analysis.
        HTTPException: 500 for other errors encountered during processing.
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


@router.get("/ssp/{year}", response_model=SSPRankingResponse)
async def get_ssp_rankings(
    year: int,
    db: Session = Depends(get_db)
):
    """
    Compute SSP subject rankings for a given academic year using the official 18-credit rule with pro-rating and priority tiers.
    
    Priority order: UE Achievement > UE Unit > Non-UE Achievement > Non-UE Unit. Subjects are scored by mapping up to 18 credits in priority order, pro-rating partial credits and capping `weight_excellence` to the [0.0, 1.0] range. A subject is marked eligible only if it has at least 18 total available credits; ineligible subjects receive an `ssp_score` of 0.0.
    
    Parameters:
        year (int): Academic year to compute SSP rankings for.
    
    Returns:
        SSPRankingResponse: Envelope containing the requested `year`, `total_subjects`, and a ranked `rankings` list of `SSPSubjectRanking` items. Each item includes:
            - `rank`: 1-based rank position,
            - `subject`: subject name,
            - `ssp_score`: pro-rated SSP score (0.0 for ineligible subjects),
            - `eligible`: `true` if the subject has >= 18 available credits,
            - `total_credits_available`: total credits found for the subject,
            - `ue_present`: whether any UE-approved standards exist for the subject.
    """
    try:
        query = text("""
            SELECT 
                s.subject,
                s.standard_number,
                s.title,
                s.credits,
                s.assessment_type,
                s.standards_type,
                s.is_ue,
                sw.weight_excellence
            FROM standards s
            JOIN standard_weightings sw ON s.standard_number = sw.standard_number
            WHERE sw.academic_year = :year
              AND sw.weight_excellence IS NOT NULL
            ORDER BY s.subject
        """)
        rows = db.execute(query, {"year": year}).fetchall()
        if not rows:
            raise HTTPException(status_code=404, detail=f"No data found for year {year}")

        # Group rows by subject
        subjects: dict[str, list[dict]] = {}
        for r in rows:
            subj = r.subject or "Unknown"
            subjects.setdefault(subj, []).append({
                'standard_number': r.standard_number,
                'title': r.title,
                'credits': int(r.credits),
                'assessment_type': r.assessment_type,
                'standards_type': r.standards_type,
                'is_ue': bool(r.is_ue),
                'weight_excellence': float(r.weight_excellence)
            })

        def tier(item: dict) -> int:
            """
            Map a standards item to a priority tier for SSP selection.
            
            Parameters:
                item (dict): A mapping containing at least 'standards_type' (string) and 'is_ue' (bool).
            
            Returns:
                int: Priority tier:
                    1 — UE Achievement,
                    2 — UE Unit,
                    3 — non-UE Achievement,
                    4 — all other cases.
            """
            stype = (item['standards_type'] or '').lower()
            is_ach = stype.startswith('achievement')
            is_unit = stype.startswith('unit')
            if item['is_ue'] and is_ach:
                return 1
            if item['is_ue'] and is_unit:
                return 2
            if (not item['is_ue']) and is_ach:
                return 3
            return 4

        rankings: list[dict] = []
        for subject, items in subjects.items():
            # Sort by priority tier then weight desc
            items.sort(key=lambda x: (tier(x), -x['weight_excellence']))

            credits_mapped = 0.0
            total_contrib = 0.0
            ue_present = any(i['is_ue'] for i in items)
            total_available = sum(int(i['credits']) for i in items)
            eligible = total_available >= 18

            if eligible:
                for it in items:
                    if credits_mapped >= 18.0:
                        break
                    avail = float(it['credits'])
                    remaining = max(0.0, 18.0 - credits_mapped)
                    take = min(avail, remaining)
                    if take <= 0:
                        continue
                    total_contrib += take * float(min(max(it['weight_excellence'], 0.0), 1.0))
                    credits_mapped += take

                ssp_score = total_contrib / 18.0 if credits_mapped > 0 else 0.0
            else:
                ssp_score = 0.0

            rankings.append({
                'subject': subject,
                'ssp_score': ssp_score,
                'eligible': eligible,
                'total_credits_available': total_available,
                'ue_present': ue_present
            })

        # Sort eligible first, then by ssp_score desc, then by subject
        rankings.sort(key=lambda x: (not x['eligible'], -x['ssp_score'], x['subject']))
        # Add ranks
        output: list[SSPSubjectRanking] = []
        for i, r in enumerate(rankings, 1):
            output.append(SSPSubjectRanking(
                rank=i,
                subject=r['subject'],
                ssp_score=float(r['ssp_score']),
                eligible=bool(r['eligible']),
                total_credits_available=int(r['total_credits_available']),
                ue_present=bool(r['ue_present'])
            ))

        return SSPRankingResponse(year=year, total_subjects=len(output), rankings=output)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error calculating SSP rankings: {e}") from e

@router.get("/subject/{subject_name}/{year}", response_model=DetailedSubjectAnalysis)
async def get_detailed_subject_analysis(
    subject_name: str,
    year: int,
    db: Session = Depends(get_db)
):
    """
    Return a detailed analysis for a specific subject and academic year, including per-standard breakdown and the subject's optimal 24-credit score.
    
    Returns:
        DetailedSubjectAnalysis: Analysis object containing subject, year, optimal_score, total_standards_available, total_credits_available, optional rank (None if unavailable), and standards_breakdown.
    
    Raises:
        HTTPException 404: If no standards data exists for the given subject and year.
        HTTPException 500: On unexpected errors during analysis.
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