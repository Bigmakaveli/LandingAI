#!/bin/bash

# Install Ollama script for deployment
echo "Installing Ollama..."

# Check if Ollama is already installed
if command -v ollama &> /dev/null; then
    echo "Ollama is already installed"
    ollama --version
else
    echo "Installing Ollama..."
    
    # Install Ollama using the official installer
    curl -fsSL https://ollama.ai/install.sh | sh
    
    # Start Ollama service
    ollama serve &
    
    # Wait a moment for Ollama to start
    sleep 5
    
    # Pull the gpt-oss:20b model
    echo "Pulling gpt-oss:20b model..."
    ollama pull gpt-oss:20b
    
    echo "Ollama installation completed!"
fi
