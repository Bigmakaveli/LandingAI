#!/bin/bash

# LandingAI Deployment Script
# This script creates a deployment package for the LandingAI project

set -e

echo "🚀 Creating LandingAI deployment package..."

# Configuration
PACKAGE_NAME="landingai-deployment"
PACKAGE_DIR="./$PACKAGE_NAME"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
ARCHIVE_NAME="${PACKAGE_NAME}_${TIMESTAMP}.tar.gz"

# Clean up any existing package directory
if [ -d "$PACKAGE_DIR" ]; then
    echo "🧹 Cleaning up existing package directory..."
    rm -rf "$PACKAGE_DIR"
fi

# Create package directory structure
echo "📁 Creating package directory structure..."
mkdir -p "$PACKAGE_DIR"
mkdir -p "$PACKAGE_DIR/apps/backend"
mkdir -p "$PACKAGE_DIR/apps/frontend"
mkdir -p "$PACKAGE_DIR/scripts"
mkdir -p "$PACKAGE_DIR/config"

# Copy backend files
echo "📦 Packaging backend..."
cp -r apps/backend/src "$PACKAGE_DIR/apps/backend/"
cp -r apps/backend/dist "$PACKAGE_DIR/apps/backend/" 2>/dev/null || true
cp -r apps/backend/python "$PACKAGE_DIR/apps/backend/" 2>/dev/null || true
cp apps/backend/package.json "$PACKAGE_DIR/apps/backend/"
cp apps/backend/tsconfig.json "$PACKAGE_DIR/apps/backend/"
cp apps/backend/requirements.txt "$PACKAGE_DIR/apps/backend/"

# Copy frontend files
echo "📦 Packaging frontend..."
cp -r apps/frontend/src "$PACKAGE_DIR/apps/frontend/"
cp -r apps/frontend/dist "$PACKAGE_DIR/apps/frontend/" 2>/dev/null || true
cp apps/frontend/package.json "$PACKAGE_DIR/apps/frontend/"
cp apps/frontend/tsconfig.json "$PACKAGE_DIR/apps/frontend/"
cp apps/frontend/tsconfig.app.json "$PACKAGE_DIR/apps/frontend/"
cp apps/frontend/tsconfig.node.json "$PACKAGE_DIR/apps/frontend/"
cp apps/frontend/vite.config.ts "$PACKAGE_DIR/apps/frontend/"
cp apps/frontend/index.html "$PACKAGE_DIR/apps/frontend/"
cp apps/frontend/eslint.config.js "$PACKAGE_DIR/apps/frontend/"

# Copy example sites
echo "📦 Packaging example sites..."
cp -r example_page "$PACKAGE_DIR/" 2>/dev/null || true

# Copy root files
echo "📦 Packaging root files..."
cp package.json "$PACKAGE_DIR/"
cp tsconfig.json "$PACKAGE_DIR/"
cp Dockerfile "$PACKAGE_DIR/"
cp README.md "$PACKAGE_DIR/"

# Create production configuration
echo "⚙️ Creating production configuration..."

# Create production package.json for root
cat > "$PACKAGE_DIR/package.json" << 'EOF'
{
  "name": "landingai",
  "private": true,
  "version": "1.0.0",
  "workspaces": [
    "apps/*"
  ],
  "scripts": {
    "install:all": "npm install && cd apps/frontend && npm install && cd ../backend && npm install",
    "build": "npm run build --workspace @landing/frontend && npm run build --workspace @landing/backend",
    "start": "cd apps/backend && npm start",
    "dev": "concurrently -n frontend,backend -c green,blue \"npm run dev --workspace @landing/frontend\" \"npm run dev --workspace @landing/backend\""
  },
  "devDependencies": {
    "concurrently": "^9.0.1"
  }
}
EOF

# Create production vite config
cat > "$PACKAGE_DIR/apps/frontend/vite.config.ts" << 'EOF'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    proxy: {
      '/sites': {
        target: 'http://localhost:3001',
        changeOrigin: true
      },
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    minify: 'terser'
  }
})
EOF

# Create server setup script
cat > "$PACKAGE_DIR/scripts/setup.sh" << 'EOF'
#!/bin/bash

# LandingAI Server Setup Script
set -e

echo "🚀 Setting up LandingAI on server..."

# Update system packages
echo "📦 Updating system packages..."
sudo apt-get update
sudo apt-get install -y curl wget git build-essential

# Install Node.js 18
echo "📦 Installing Node.js 18..."
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Python 3 and pip
echo "📦 Installing Python 3 and pip..."
sudo apt-get install -y python3 python3-pip python3-venv

# Install additional dependencies for OpenAI integration
echo "📦 Installing additional dependencies..."
sudo apt-get install -y jq

# Create application directory
echo "📁 Setting up application directory..."
sudo mkdir -p /opt/landingai
sudo chown $USER:$USER /opt/landingai

# Copy application files
echo "📦 Copying application files..."
cp -r . /opt/landingai/
cd /opt/landingai

# Install dependencies
echo "📦 Installing dependencies..."
npm run install:all

# Install Python dependencies
echo "📦 Installing Python dependencies..."
cd apps/backend
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
deactivate
cd ../..

# Build application
echo "🔨 Building application..."
npm run build

# Create systemd service
echo "⚙️ Creating systemd service..."
sudo tee /etc/systemd/system/landingai.service > /dev/null << 'SERVICE_EOF'
[Unit]
Description=LandingAI Application
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/landingai
ExecStart=/usr/bin/node apps/backend/dist/index.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=3001

[Install]
WantedBy=multi-user.target
SERVICE_EOF

# Create environment configuration
echo "⚙️ Creating environment configuration..."
cat > /opt/landingai/.env << 'ENV_EOF'
NODE_ENV=production
PORT=3001
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_DEFAULT_MODEL=gpt-4o
SITE_SPECIFIC_TEMPERATURE=0.7
ENV_EOF

# Enable and start the service
echo "🚀 Starting LandingAI service..."
sudo systemctl daemon-reload
sudo systemctl enable landingai
sudo systemctl start landingai

echo "✅ LandingAI setup complete!"
echo "🌐 Application should be running on http://localhost:3001"
echo "📊 Check status with: sudo systemctl status landingai"
echo "📝 View logs with: sudo journalctl -u landingai -f"
EOF

chmod +x "$PACKAGE_DIR/scripts/setup.sh"

# Create deployment instructions
cat > "$PACKAGE_DIR/DEPLOYMENT.md" << 'EOF'
# LandingAI Deployment Guide

## Prerequisites
- Ubuntu/Debian server with root access
- SSH access to the server
- At least 4GB RAM and 20GB disk space

## Quick Deployment

1. **Upload the package to your server:**
   ```bash
   scp landingai-deployment_*.tar.gz user@your-server:/home/user/
   ```

2. **SSH into your server:**
   ```bash
   ssh user@your-server
   ```

3. **Extract and setup:**
   ```bash
   tar -xzf landingai-deployment_*.tar.gz
   cd landingai-deployment
   chmod +x scripts/setup.sh
   ./scripts/setup.sh
   ```

## Manual Setup

If you prefer manual setup:

1. **Install dependencies:**
   ```bash
   # Node.js 18
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs

   # Python 3
   sudo apt-get install -y python3 python3-pip

   # Additional tools
   sudo apt-get install -y jq
   ```

2. **Setup application:**
   ```bash
   npm run install:all
   npm run build
   ```

3. **Configure environment:**
   ```bash
   # Set your OpenAI API key
   nano .env
   # Update OPENAI_API_KEY=your_actual_api_key_here
   ```

4. **Start application:**
   ```bash
   npm start
   ```

## Configuration

- **Backend:** Runs on port 3001
- **Frontend:** Runs on port 5173 (development) or serves static files
- **OpenAI API:** Requires valid API key in .env file

## Service Management

```bash
# Check status
sudo systemctl status landingai

# Start/stop/restart
sudo systemctl start landingai
sudo systemctl stop landingai
sudo systemctl restart landingai

# View logs
sudo journalctl -u landingai -f
```

## Troubleshooting

1. **Check if ports are available:**
   ```bash
   sudo netstat -tlnp | grep :3001
   ```

2. **Check environment variables:**
   ```bash
   cat .env
   ```

3. **Check application logs:**
   ```bash
   sudo journalctl -u landingai -f
   ```

## File Structure

```
/opt/landingai/
├── apps/
│   ├── backend/
│   │   ├── dist/          # Compiled backend
│   │   ├── src/           # Source code
│   │   └── package.json
│   └── frontend/
│       ├── dist/          # Built frontend
│       ├── src/           # Source code
│       └── package.json
├── scripts/
│   └── setup.sh           # Setup script
└── package.json
```
EOF

# Create a simple start script
cat > "$PACKAGE_DIR/start.sh" << 'EOF'
#!/bin/bash

# Start LandingAI Application
echo "🚀 Starting LandingAI..."

# Check if environment variables are set
if [ -z "$OPENAI_API_KEY" ] || [ "$OPENAI_API_KEY" = "your_openai_api_key_here" ]; then
    echo "⚠️  Warning: OPENAI_API_KEY not set. Please update the .env file with your OpenAI API key."
    echo "   Edit: nano .env"
fi

# Start the application
echo "🌐 Starting application..."
cd apps/backend
npm start
EOF

chmod +x "$PACKAGE_DIR/start.sh"

# Create .gitignore for the package
cat > "$PACKAGE_DIR/.gitignore" << 'EOF'
node_modules/
dist/
*.log
.env
.venv/
venv/
__pycache__/
*.pyc
.DS_Store
EOF

# Create archive
echo "📦 Creating deployment archive..."
tar -czf "$ARCHIVE_NAME" -C . "$PACKAGE_NAME"

# Clean up package directory
rm -rf "$PACKAGE_DIR"

echo "✅ Deployment package created: $ARCHIVE_NAME"
echo ""
echo "📋 To deploy to your server:"
echo "1. Upload: scp $ARCHIVE_NAME user@your-server:/home/user/"
echo "2. SSH: ssh user@your-server"
echo "3. Extract: tar -xzf $ARCHIVE_NAME"
echo "4. Setup: cd landingai-deployment && ./scripts/setup.sh"
echo ""
echo "📖 See DEPLOYMENT.md for detailed instructions"
