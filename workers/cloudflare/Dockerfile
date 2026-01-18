FROM python:3.11-slim

# Install system dependencies with cleanup in same layer
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libsm6 \
    libxext6 \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

WORKDIR /app

# Use optimized requirements for Cloudflare (excludes sentence-transformers/PyTorch)
COPY requirements-cf.txt .
RUN pip install --no-cache-dir -r requirements-cf.txt \
    && rm -rf ~/.cache/pip

COPY src/ ./src/

EXPOSE 8080

CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8080"]
