-- Table to store the core, timeless information about each NCEA standard.
CREATE TABLE standards (
    standard_number INT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    credits INT NOT NULL,
    assessment_type VARCHAR(50),
    standards_type VARCHAR(50),
    is_ue BOOLEAN DEFAULT FALSE,
    subject VARCHAR(100),
    search_keywords JSON
);

-- Table to store the difficulty weightings for each standard, which can change
-- each year and by version.
CREATE TABLE standard_weightings (
    standard_number INT NOT NULL,
    academic_year YEAR NOT NULL,
    standard_version INT NOT NULL,
    weight_not_achieved DECIMAL(20, 15),
    weight_achieved DECIMAL(20, 15),
    weight_merit DECIMAL(20, 15),
    weight_excellence DECIMAL(20, 15),
    PRIMARY KEY (standard_number, academic_year, standard_version),
    FOREIGN KEY (standard_number) REFERENCES standards(standard_number)
);

-- Table to store the historical frequency distribution of statistical values for each year.
CREATE TABLE atar_distributions (
    academic_year YEAR NOT NULL,
    statistical_value DECIMAL(20, 15) NOT NULL,
    frequency INT NOT NULL,
    PRIMARY KEY (academic_year, statistical_value)
);

-- Table to store the historical participation rate data needed to calculate
-- the number of students per ATAR band for a given year.
CREATE TABLE participation_rates (
    academic_year YEAR PRIMARY KEY,
    weighted_statnz_population DECIMAL(20, 10) NOT NULL
);
