-- Table to store the core, timeless information about each NCEA standard.
CREATE TABLE standards (
    standard_number INT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    credits INT NOT NULL,
    assessment_type VARCHAR(50),
    subject VARCHAR(100)
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