-- 2025 participation rate data
-- weighted_statnz_population = 72,054.4  |  nz_total_candidature = 46,017
INSERT INTO participation_rates (academic_year, weighted_statnz_population, nz_total_candidature)
VALUES (2025,72054.4,46017)
ON CONFLICT (academic_year) DO NOTHING;
