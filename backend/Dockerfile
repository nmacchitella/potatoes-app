FROM python:3.11-slim

WORKDIR /app

# Install system dependencies (including curl for healthcheck)
RUN apt-get update && apt-get install -y \
    gcc \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Make startup script executable
RUN chmod +x start.sh

# Create directory for SQLite database
RUN mkdir -p /data

# Create a non-root user and grant ownership of app and data directories
RUN addgroup --system appgroup && adduser --system --ingroup appgroup appuser \
    && chown -R appuser:appgroup /app /data

# NOTE: We don't set USER here because the entrypoint needs root to fix
# volume ownership, then drops to appuser via su.

# Expose port
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Entrypoint: fix volume ownership (runs as root), then drop to appuser
ENTRYPOINT ["bash", "-c", "chown -R appuser:appgroup /data 2>/dev/null; exec su -s /bin/bash appuser -c './start.sh'"]
