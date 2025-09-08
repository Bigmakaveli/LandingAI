# Use Node.js base image
FROM node:18-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    python3 \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

# Install Ollama
RUN curl -fsSL https://ollama.ai/install.sh | sh

# Set working directory
WORKDIR /app

# Copy package files
COPY apps/backend/package*.json ./
COPY apps/frontend/package*.json ./frontend/

# Install Node.js dependencies
RUN npm install
RUN cd frontend && npm install

# Copy Python requirements
COPY apps/backend/requirements.txt ./

# Install Python dependencies
RUN pip3 install -r requirements.txt

# Copy source code
COPY apps/backend/src ./src
COPY apps/frontend/src ./frontend/src
COPY apps/frontend/index.html ./frontend/
COPY apps/frontend/vite.config.ts ./frontend/

# Build frontend
RUN cd frontend && npm run build

# Build backend
RUN npm run build

# Start Ollama in background
RUN ollama serve &
RUN sleep 10 && ollama pull gpt-oss:20b

# Expose ports
EXPOSE 3001 3000

# Start the application
CMD ["npm", "start"]
