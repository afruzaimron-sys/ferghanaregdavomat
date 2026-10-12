FROM node:20-bullseye-slim

# Install system dependencies for canvas and image tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package info
COPY package*.json ./

# Install npm dependencies
RUN npm install

# Copy application source code
COPY . .

# Hugging Face Spaces port is 7860
ENV PORT=7860
EXPOSE 7860

# Start app
CMD ["node", "index.js"]
