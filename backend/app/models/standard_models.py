from sqlalchemy import Column, Integer, String, DECIMAL, ForeignKey
from sqlalchemy.orm import declarative_base, relationship
from sqlalchemy.dialects.mysql import JSON, YEAR

# Create a Base class that models will inherit from
Base = declarative_base()


class Standard(Base):
    __tablename__ = "standards"

    standard_number = Column(Integer, primary_key=True)
    title = Column(String(255), nullable=False)
    credits = Column(Integer, nullable=False)
    assessment_type = Column(String(50))
    standards_type = Column(String(50))
    subject = Column(String(100))
    search_keywords = Column(JSON)

    weightings = relationship("StandardWeighting", back_populates="standard")


class StandardWeighting(Base):
    __tablename__ = "standard_weightings"

    standard_number = Column(Integer, ForeignKey("standards.standard_number"),
                             primary_key=True)
    academic_year = Column(YEAR, primary_key=True)
    standard_version = Column(Integer, primary_key=True)

    weight_not_achieved = Column(DECIMAL(20, 15))
    weight_achieved = Column(DECIMAL(20, 15))
    weight_merit = Column(DECIMAL(20, 15))
    weight_excellence = Column(DECIMAL(20, 15))

    standard = relationship("Standard", back_populates="weightings")
