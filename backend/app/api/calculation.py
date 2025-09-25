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
    Receives a list of user standards and returns estimated ATARs for all available years.
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


@router.post("/breakdown", response_model=calculation_schemas.CalculationBreakdownResponse)
async def calculate_atar_breakdown_endpoint(
        request: calculation_schemas.ATARCalculationRequest,
        db: Session = Depends(get_db)
):
    """
    Returns the best-90 credit breakdown and subject SSP breakdowns across all available years.
    """
    if not request.standards:
        raise HTTPException(status_code=400, detail="No standards provided")

    calculator = ATARCalculator(db, request.standards)
    breakdown = calculator.calculate_breakdown()
    if not breakdown.years:
        raise HTTPException(status_code=404,
                            detail="Could not calculate ATAR breakdown for any year with the provided standards.")
    return breakdown