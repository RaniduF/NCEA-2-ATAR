from pydantic import BaseModel, Field
from typing import List

class UserStandardInput(BaseModel):
    """
    Represents a single standard and grade inputted by the user.
    """
    standard_number: int
    grade: str = Field(..., pattern="^(Excellence|Merit|Achieved|Not Achieved)$")

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
