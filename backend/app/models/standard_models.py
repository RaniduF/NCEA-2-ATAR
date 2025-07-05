from sqlalchemy import Column, Integer, String, DECIMAL, ForeignKey
from sqlalchemy.orm import declarative_base, relationship

#Import the MySQL-specific YEAR data type
from sqlalchemy.dialects.mysql import YEAR

# Create a Base class that our models will inherit from
Base = declarative_base()


class Standard(Base):
    __tablename__ = "standards"

    # Define the columns for the standard table
    standard_number = Column(Integer, primary_key=True)
    title = Column(String(255), nullable=False)
    credits = Column(Integer, nullable=False)
    assessment_type = Column(String(50))
    subject = Column(String(100))

    # One Standard can have many StandardWeighting records.
    weightings = relationship("StandardWeighting", back_populates="standard")


class StandardWeighting(Base):
    __tablename__ = "standard_weightings"

    # Define the columns for the composite primary key
    standard_number = Column(Integer, ForeignKey("standards.standard_number"),
                             primary_key=True)
    # The YEAR type will now be correctly recognized
    academic_year = Column(YEAR, primary_key=True)
    standard_version = Column(Integer, primary_key=True)

    # Define the weighting value columns
    weight_not_achieved = Column(DECIMAL(20, 15))
    weight_achieved = Column(DECIMAL(20, 15))
    weight_merit = Column(DECIMAL(20, 15))
    weight_excellence = Column(DECIMAL(20, 15))

    # This links back to the parent Standard record
    standard = relationship("Standard", back_populates="weightings")
