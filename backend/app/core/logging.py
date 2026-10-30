import logging
import sys


def setup_logging() -> logging.Logger:
    """
    Configure application-wide structured logging.

    Sets up a logger named 'ncea_atar' with INFO-level console output using
    a structured format including timestamp, level, logger name, and message.

    Returns:
        logging.Logger: The configured root application logger.
    """
    logger = logging.getLogger("ncea_atar")

    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(
            logging.Formatter(
                "%(asctime)s [%(levelname)s] %(name)s: %(message)s",
                datefmt="%Y-%m-%d %H:%M:%S",
            )
        )
        logger.addHandler(handler)
        logger.setLevel(logging.INFO)

    return logger


logger = setup_logging()
