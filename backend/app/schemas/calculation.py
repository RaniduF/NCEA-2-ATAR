from pydantic import BaseModel, Field
from typing import List, Optional

class UserStandardInput(BaseModel):
    """
    Represents a single standard and grade inputted by the user.
    For cross-year calculations, year_achieved specifies when the student
    took the standard to use the correct historical weights.
    """
    standard_number: int
    grade: str = Field(..., pattern="^(Excellence|Merit|Achieved|Not Achieved)$")
    year_achieved: Optional[int] = Field(None, description="Year the standard was achieved (for historical weight lookup)")
    standard_version: Optional[int] = Field(None, description="Version of the standard (defaults to latest available for the year)")

class ATARCalculationRequest(BaseModel):
    """
    The request model the front end will send.
    """
    standards: List[UserStandardInput]

class EstimatedATARResult(BaseModel):
    """
    Represents the estimated ATAR for a single year.
    """
    year: int
    estimated_atar: float
    statistical_value: float

class ATARCalculationResponse(BaseModel):
    """
    The final response model the API will send back.
    """
    results: List[EstimatedATARResult]
