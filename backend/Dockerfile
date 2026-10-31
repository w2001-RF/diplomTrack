FROM python:3.13.7-slim

# Fallback note:
# If 3.13.7 does not exist in your Docker registry,
# change to: python:3.13-slim

# Prevents Python from writing pyc files
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# System deps
RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    curl \
    netcat-openbsd \
    && rm -rf /var/lib/apt/lists/*

# Install dependencies
COPY requirements.txt .
RUN pip install --upgrade pip
RUN pip install --no-cache-dir -r requirements.txt

# Copy project
COPY . .

# Create folders if not exist
RUN mkdir -p logs uploads data

# Make entrypoint executable
RUN chmod +x entrypoint.sh

EXPOSE 5000

ENTRYPOINT [ "./entrypoint.sh" ]
