from sqlalchemy import Column, Integer, String, DECIMAL, ForeignKey, Boolean
from sqlalchemy.orm import declarative_base, relationship
from sqlalchemy.dialects.postgresql import JSONB

# Create a Base class that models will inherit from
Base = declarative_base()


class Standard(Base):
    __tablename__ = "standards"

    standard_number = Column(Integer, primary_key=True)
    title = Column(String(255), nullable=False)
    credits = Column(Integer, nullable=False)
    assessment_type = Column(String(50))
    standards_type = Column(String(50))
    is_ue = Column(Boolean, default=False)
    subject = Column(String(100))
    search_keywords = Column(JSONB)

    weightings = relationship("StandardWeighting", back_populates="standard")


class StandardWeighting(Base):
    __tablename__ = "standard_weightings"

    standard_number = Column(Integer, ForeignKey("standards.standard_number"),
                             primary_key=True)
    academic_year = Column(Integer, primary_key=True)
    standard_version = Column(Integer, primary_key=True)

    weight_not_achieved = Column(DECIMAL(20, 15))
    weight_achieved = Column(DECIMAL(20, 15))
    weight_merit = Column(DECIMAL(20, 15))
    weight_excellence = Column(DECIMAL(20, 15))

    standard = relationship("Standard", back_populates="weightings")


class ATARDistribution(Base):
    __tablename__ = "atar_distributions"
    academic_year = Column(Integer, primary_key=True)
    statistical_value = Column(DECIMAL(20, 15), primary_key=True)
    frequency = Column(Integer, nullable=False)


class ParticipationRate(Base):
    __tablename__ = "participation_rates"
    academic_year = Column(Integer, primary_key=True)
    # FIX: Changed data type from Integer to DECIMAL
    weighted_statnz_population = Column(DECIMAL(20, 10), nullable=False)