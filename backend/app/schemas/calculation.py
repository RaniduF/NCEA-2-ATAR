from pydantic import BaseModel, Field
from typing import List, Optional, Dict

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


# --- New: Detailed breakdown schemas ---

class StandardContribution(BaseModel):
    """
    A single standard's contribution to a selection (best-90 or subject SSP).
    """
    selection_rank: int
    standard_number: int
    title: Optional[str] = None
    subject: Optional[str] = None
    is_ue: Optional[bool] = None
    standards_type: Optional[str] = None
    assessment_type: Optional[str] = None  # Internal or External
    grade: str
    year_achieved: Optional[int] = None
    weight_applied: float
    weight_at_max_grade: Optional[float] = None  # Weight if standard was at Excellence (or Achieved for Unit Standards)
    credits_available: int
    credits_used: float
    pro_rated: bool = False
    contribution: float
    subject_credits_used_to_date: float
    subject_capped: bool = False
    priority_tier: int


class ExcludedItem(BaseModel):
    standard_number: int
    reason: str


class BreakdownTotals(BaseModel):
    total_contribution: float
    denominator_credits: int
    total_credits_used: float
    subject_caps: Dict[str, float] = Field(default_factory=dict)
    prorated_count: int = 0


class YearlyBreakdown(BaseModel):
    year: int
    estimated_atar: float
    statistical_value: float
    best90: List[StandardContribution]
    totals: BreakdownTotals
    excluded: List[ExcludedItem] = Field(default_factory=list)


class SubjectSSPBreakdown(BaseModel):
    subject: str
    year: int
    eligible: bool
    ssp_score: Optional[float] = None
    denominator_credits: int = 18
    items: List[StandardContribution] = Field(default_factory=list)


class CalculationBreakdownResponse(BaseModel):
    years: List[YearlyBreakdown]
    subjects: List[SubjectSSPBreakdown]
