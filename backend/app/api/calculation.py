from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from ..db.session import get_db
from ..schemas import calculation as calculation_schemas
from ..services.atar_engine import ATARCalculator
from ..core.limiter import limiter

router = APIRouter(
    prefix="/calculate-atar",
    tags=["ATAR Calculation"]
)


@router.post("/", response_model=calculation_schemas.ATARCalculationResponse)
@limiter.limit("10/minute")
async def calculate_atar_endpoint(
        request: Request,
        body: calculation_schemas.ATARCalculationRequest,
        db: Session = Depends(get_db)
):
    """
        Estimate ATARs for all available years from the provided user standards.
        
        Parameters:
            request (calculation_schemas.ATARCalculationRequest): Request object containing user-selected standards. `request.standards` must be a non-empty list.
        
        Returns:
            response (dict): A dictionary with the key "results" mapped to the calculated ATAR results for each year.
        
        Raises:
            HTTPException: 400 if no standards are provided.
            HTTPException: 404 if ATARs could not be calculated for any year with the provided standards.
        """
    if not body.standards:
        raise HTTPException(status_code=400, detail="No standards provided")

    # Instantiate the calculator with the user's data
    calculator = ATARCalculator(db, body.standards)

    # Perform the calculation
    results = calculator.calculate_for_all_years()

    if not results:
        raise HTTPException(status_code=404,
                            detail="Could not calculate ATAR for any year with the provided standards.")

    return {"results": results}


@router.post("/breakdown", response_model=calculation_schemas.CalculationBreakdownResponse)  # noqa: B008
async def calculate_atar_breakdown_endpoint(
        request: calculation_schemas.ATARCalculationRequest,
        db: Session = Depends(get_db)
):
    """
        Compute the best-90 credit breakdown and subject SSP breakdowns for all available years based on the provided standards.
        
        Parameters:
            request (calculation_schemas.ATARCalculationRequest): Request containing the standards to use for calculation.
            db (Session): Database session provided by dependency injection.
        
        Returns:
            CalculationBreakdownResponse: Breakdown containing per-year best-90 and subject SSP details.
        
        Raises:
            HTTPException: 400 if `request.standards` is empty; 404 if no years could be calculated in the breakdown.
        """
    if not request.standards:
        raise HTTPException(status_code=400, detail="No standards provided")

    calculator = ATARCalculator(db, request.standards)
    breakdown = calculator.calculate_breakdown()
    if not breakdown.years:
        raise HTTPException(status_code=404,
                            detail="Could not calculate ATAR breakdown for any year with the provided standards.")
    return breakdown


@router.get("/distributions/{year}")
async def get_distributions_endpoint(
        year: int,
        db: Session = Depends(get_db)
):
    """
    Fetch the ATAR distribution data for a specific academic year.
    
    Parameters:
        year (int): The academic year to fetch distribution data for.
    
    Returns:
        dict: A dictionary containing:
            - year (int): The academic year
            - distribution (list): List of dicts with 'statistical_value' and 'frequency'
            - weighted_statnz_population (float): The weighted StatNZ population for that year
            - nz_total_candidature (int): The NZ total candidature count for that year
            - participation_rate (float): Derived as nz_total_candidature / weighted_statnz_population
    
    Raises:
        HTTPException: 404 if no distribution data exists for the specified year.
    """
    from ..models import standard_models
    
    # Fetch distribution data
    distributions = db.query(standard_models.ATARDistribution).filter(
        standard_models.ATARDistribution.academic_year == year
    ).order_by(
        standard_models.ATARDistribution.statistical_value.asc()
    ).all()
    
    if not distributions:
        raise HTTPException(status_code=404, detail=f"No distribution data found for year {year}")
    
    # Fetch participation rate
    participation = db.query(standard_models.ParticipationRate).filter(
        standard_models.ParticipationRate.academic_year == year
    ).first()
    
    weighted_population = float(participation.weighted_statnz_population) if participation else None
    nz_total_candidature = int(participation.nz_total_candidature) if participation else None
    
    # Derive participation rate: NZ Total Candidature / Weighted StatNZ Population
    participation_rate = None
    if weighted_population and nz_total_candidature and weighted_population > 0:
        participation_rate = nz_total_candidature / weighted_population
    
    # Format response
    distribution_data = [
        {
            "statistical_value": float(d.statistical_value),
            "frequency": d.frequency
        }
        for d in distributions
    ]
    
    return {
        "year": year,
        "distribution": distribution_data,
        "weighted_statnz_population": weighted_population,
        "nz_total_candidature": nz_total_candidature,
        "participation_rate": participation_rate
    }