-- NCEA ATAR Database Initialization Script
-- This script creates the database schema and loads all data
-- Created for Docker container initialization

-- ============================================
-- SCHEMA CREATION
-- ============================================

-- Table to store the core, timeless information about each NCEA standard.
CREATE TABLE IF NOT EXISTS standards (
    standard_number INT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    credits INT NOT NULL,
    assessment_type VARCHAR(50),
    standards_type VARCHAR(50),
    is_ue INTEGER DEFAULT 0,
    subject VARCHAR(100),
    search_keywords JSONB
);

-- Table to store the difficulty weightings for each standard, which can change
-- each year and by version.
CREATE TABLE IF NOT EXISTS standard_weightings (
    standard_number INT NOT NULL,
    academic_year INTEGER NOT NULL,
    standard_version INT NOT NULL,
    weight_not_achieved DECIMAL(20, 15),
    weight_achieved DECIMAL(20, 15),
    weight_merit DECIMAL(20, 15),
    weight_excellence DECIMAL(20, 15),
    PRIMARY KEY (standard_number, academic_year, standard_version),
    FOREIGN KEY (standard_number) REFERENCES standards(standard_number)
);

-- Table to store the historical frequency distribution of statistical values for each year.
CREATE TABLE IF NOT EXISTS atar_distributions (
    academic_year INTEGER NOT NULL,
    statistical_value DECIMAL(20, 15) NOT NULL,
    frequency INT NOT NULL,
    PRIMARY KEY (academic_year, statistical_value)
);

-- Table to store the historical participation rate data needed to calculate
-- the number of students per ATAR band for a given year.
CREATE TABLE IF NOT EXISTS participation_rates (
    academic_year INTEGER PRIMARY KEY,
    weighted_statnz_population DECIMAL(20, 10) NOT NULL
);

-- ============================================
-- DATA LOADING NOTICE
-- ============================================

-- The actual data will be loaded by separate SQL files:
-- - 02-standards-data.sql
-- - 03-standard-weightings-data.sql 
-- - 04-atar-distributions-data.sql
-- - 05-participation-rates-data.sql

-- This ensures proper order of execution and easier maintenance 