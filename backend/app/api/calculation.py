from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..db import session
from ..schemas import calculation as calculation_schemas
from ..services.atar_engine import ATARCalculator

router = APIRouter(
    prefix="/calculate-atar",
    tags=["ATAR Calculation"]
)


def get_db():
    db = session.SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("/", response_model=calculation_schemas.ATARCalculationResponse)
async def calculate_atar_endpoint(
        request: calculation_schemas.ATARCalculationRequest,
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
    if not request.standards:
        raise HTTPException(status_code=400, detail="No standards provided")

    # Instantiate the calculator with the user's data
    calculator = ATARCalculator(db, request.standards)

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