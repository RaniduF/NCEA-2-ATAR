-- ============================================
-- ATAR MAP: Precalculated Harrison-Hyndman cubic spline band allocations
-- ============================================
-- This table stores 2000 ATAR bands (0.00 to 99.95) per academic year,
-- with the non-linear band places and cumulative limits derived from
-- the Harrison-Hyndman one-parameter participation model.

CREATE TABLE IF NOT EXISTS atar_map (
    academic_year   INTEGER          NOT NULL,
    atar_band       DECIMAL(5,2)     NOT NULL,
    x               DOUBLE PRECISION NOT NULL,   -- proportion rank (atar_band / 100)
    band_places     DOUBLE PRECISION NOT NULL,   -- A*_b = f_PR(x) * h
    cumulative_limit DOUBLE PRECISION NOT NULL,  -- running sum of band_places from 99.95 down
    PRIMARY KEY (academic_year, atar_band)
);

-- Populate the atar_map for every year in participation_rates
DO $$
DECLARE
    rec         RECORD;
    v_y         DOUBLE PRECISION;   -- Total Potential Population (weighted StatNZ population)
    v_e         DOUBLE PRECISION;   -- Eligible Cohort (NZ total candidature)
    v_pr        DOUBLE PRECISION;   -- Overall Participation Rate = E / Y
    v_h         DOUBLE PRECISION;   -- Band constraint = Y / 2000
    v_alpha     DOUBLE PRECISION;   -- Spline knot = 1.5 - 2*PR (mid-range only)
    v_band      NUMERIC(5,2);       -- ATAR band value (0.00 to 99.95)
    v_x         DOUBLE PRECISION;   -- Proportion rank = band / 100
    v_f         DOUBLE PRECISION;   -- f_PR(x) point estimate
    v_places    DOUBLE PRECISION;   -- A*_b = f_PR(x) * h
    v_cum       DOUBLE PRECISION;   -- Cumulative limit (running sum from top)
    v_i         INTEGER;
BEGIN
    FOR rec IN SELECT academic_year, weighted_statnz_population, nz_total_candidature
               FROM participation_rates
               ORDER BY academic_year
    LOOP
        v_y  := rec.weighted_statnz_population::DOUBLE PRECISION;
        v_e  := rec.nz_total_candidature::DOUBLE PRECISION;
        v_pr := v_e / v_y;
        v_h  := v_y / 2000.0;
        v_cum := 0.0;

        -- Iterate from band 99.95 (i=1999) down to 0.00 (i=0)
        FOR v_i IN REVERSE 1999..0 LOOP
            v_band := ROUND(v_i * 0.05, 2);
            v_x    := v_i * 0.05 / 100.0;   -- use float for precision in POWER()

            -- Harrison-Hyndman f_PR(x) evaluation
            IF v_pr < 0.25 THEN
                -- Low participation rate: power function
                IF v_x <= 0.0 THEN
                    v_f := 0.0;
                ELSE
                    v_f := POWER(v_x, (1.0 - v_pr) / v_pr);
                END IF;

            ELSIF v_pr > 0.75 THEN
                -- High participation rate: power function
                IF v_x >= 1.0 THEN
                    v_f := 1.0;
                ELSE
                    v_f := 1.0 - POWER(1.0 - v_x, v_pr / (1.0 - v_pr));
                END IF;

            ELSE
                -- Mid-range participation rate (25% - 75%): cubic spline
                v_alpha := 1.5 - 2.0 * v_pr;

                IF v_x <= v_alpha THEN
                    -- Lower piece of spline
                    IF v_alpha <= 0.0 THEN
                        v_f := 0.0;
                    ELSE
                        v_f := POWER(v_x, 3) / POWER(v_alpha, 2);
                    END IF;
                ELSE
                    -- Upper piece of spline
                    IF v_alpha >= 1.0 THEN
                        v_f := 1.0;
                    ELSE
                        v_f := 1.0 - POWER(1.0 - v_x, 3) / POWER(1.0 - v_alpha, 2);
                    END IF;
                END IF;
            END IF;

            v_places := v_f * v_h;
            v_cum    := v_cum + v_places;

            INSERT INTO atar_map (academic_year, atar_band, x, band_places, cumulative_limit)
            VALUES (rec.academic_year, v_band, v_x, v_places, v_cum);
        END LOOP;

        RAISE NOTICE 'atar_map populated for year %, PR=%.4f, alpha=%.4f, h=%.2f, total_cum=%.2f',
            rec.academic_year, v_pr, 1.5 - 2.0 * v_pr, v_h, v_cum;
    END LOOP;
END $$;
