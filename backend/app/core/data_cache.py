from sqlalchemy.orm import Session
from sqlalchemy import text
from ..core.logging import logger

_distributions: dict | None = None
_participation_rates: dict | None = None
_latest_weight_year: int | None = None
_atar_map: dict | None = None


def prime(db: Session) -> None:
    global _distributions, _participation_rates, _latest_weight_year, _atar_map

    # Raw SQL avoids instantiating 113K ORM objects on every request.
    rows = db.execute(text(
        "SELECT academic_year, statistical_value, frequency "
        "FROM atar_distributions ORDER BY academic_year, statistical_value DESC"
    )).fetchall()

    dist: dict = {}
    for row in rows:
        year = row[0]
        if year not in dist:
            dist[year] = {"distribution": []}
        dist[year]["distribution"].append({"value": float(row[1]), "count": row[2]})
    _distributions = dist

    rows = db.execute(text(
        "SELECT academic_year, weighted_statnz_population, nz_total_candidature "
        "FROM participation_rates"
    )).fetchall()
    _participation_rates = {
        row[0]: {"population": float(row[1]), "candidature": int(row[2])}
        for row in rows
    }

    result = db.execute(text("SELECT MAX(academic_year) FROM standard_weightings")).scalar()
    _latest_weight_year = int(result) if result is not None else None

    # Prime the ATAR map — precalculated Harrison-Hyndman band allocations.
    # Only atar_band and cumulative_limit are needed for rank→ATAR lookup.
    # Stored as {year: [(atar_band, cumulative_limit), ...]} sorted desc by band.
    rows = db.execute(text(
        "SELECT academic_year, atar_band, cumulative_limit "
        "FROM atar_map ORDER BY academic_year, atar_band DESC"
    )).fetchall()

    atar_map: dict = {}
    for row in rows:
        year = int(row[0])
        if year not in atar_map:
            atar_map[year] = []
        atar_map[year].append((float(row[1]), float(row[2])))
    _atar_map = atar_map

    logger.info(
        "Data cache primed: %d distribution years, %d participation years, "
        "%d atar_map years, latest weight year=%s",
        len(_distributions),
        len(_participation_rates),
        len(_atar_map),
        _latest_weight_year,
    )


def get_distributions() -> dict | None:
    return _distributions


def get_participation_rates() -> dict | None:
    return _participation_rates


def get_latest_weight_year() -> int | None:
    return _latest_weight_year


def get_atar_map() -> dict | None:
    return _atar_map
