FROM node:20-bookworm-slim
# Install system dependencies for canvas
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg62-turbo-dev \
    libgif-dev \
    librsvg2-dev \
    python3 \
    pkg-config \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
# Copy package info
COPY package*.json ./
# Install dependencies
RUN npm install --omit=dev
# Copy application files
COPY . .
# Start application (Render assigns PORT automatically)
CMD ["node", "index.js"]
