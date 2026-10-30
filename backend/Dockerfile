# =============================================================================
# Stage 1: Builder — install system deps + Python deps into a virtualenv
# =============================================================================
FROM python:3.12-slim AS builder

WORKDIR /build

# System dependencies for psycopg2 (compiled from source via psycopg2-binary)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Create a virtualenv and install dependencies there
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# =============================================================================
# Stage 2: Runtime — minimal image with just the venv and app code
# =============================================================================
FROM python:3.12-slim AS production

WORKDIR /app

# Runtime-only system dependency for psycopg2
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    && rm -rf /var/lib/apt/lists/*

# Copy the virtualenv from the builder stage
COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Copy application code
COPY . .

# Create non-root user
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

# Single Uvicorn process — exec form ensures SIGTERM propagates to the Python process.
# No --workers flag: 256 CPU units (0.25 vCPU) supports one process.
# Horizontal scaling is handled by ECS autoscaling (1–4 tasks).
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]