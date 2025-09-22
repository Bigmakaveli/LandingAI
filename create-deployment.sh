#!/bin/bash

# LandingAI Deployment Package Creator
# This script creates a deployment tar.gz package for the LandingAI project

set -e

# Configuration
PROJECT_NAME="landingai"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
DEPLOYMENT_NAME="${PROJECT_NAME}_deployment_${TIMESTAMP}"
TEMP_DIR="/tmp/${DEPLOYMENT_NAME}"
ARCHIVE_NAME="${DEPLOYMENT_NAME}.tar.gz"

echo "🚀 Creating LandingAI deployment package..."
echo "📦 Package name: ${ARCHIVE_NAME}"

# Clean up any existing temp directory
if [ -d "$TEMP_DIR" ]; then
    rm -rf "$TEMP_DIR"
fi

# Create temporary directory structure
mkdir -p "$TEMP_DIR"
mkdir -p "$TEMP_DIR/apps/backend"
mkdir -p "$TEMP_DIR/apps/frontend"
mkdir -p "$TEMP_DIR/deployments"

echo "📁 Setting up directory structure..."

# Copy essential project files
echo "📋 Copying project configuration files..."
cp package.json "$TEMP_DIR/"
cp package-lock.json "$TEMP_DIR/"
cp tsconfig.json "$TEMP_DIR/"
cp Dockerfile "$TEMP_DIR/"
cp README.md "$TEMP_DIR/"
cp api-keys.template.txt "$TEMP_DIR/"

# Copy backend files
echo "🔧 Copying backend files..."
cp -r apps/backend/src "$TEMP_DIR/apps/backend/"
cp apps/backend/package.json "$TEMP_DIR/apps/backend/"
cp apps/backend/tsconfig.json "$TEMP_DIR/apps/backend/"
cp apps/backend/requirements.txt "$TEMP_DIR/apps/backend/"
cp apps/backend/sites-config.json "$TEMP_DIR/apps/backend/"
cp apps/backend/system_message.txt "$TEMP_DIR/apps/backend/"
cp apps/backend/code_diff_system_message.txt "$TEMP_DIR/apps/backend/"
cp apps/backend/decision_system_message.txt "$TEMP_DIR/apps/backend/"

# Copy Python files
echo "🐍 Copying Python files..."
mkdir -p "$TEMP_DIR/apps/backend/python"
cp -r apps/backend/python/*.py "$TEMP_DIR/apps/backend/python/" 2>/dev/null || true
cp -r apps/backend/python/venv "$TEMP_DIR/apps/backend/python/" 2>/dev/null || true

# Copy frontend files
echo "⚛️  Copying frontend files..."
cp -r apps/frontend/src "$TEMP_DIR/apps/frontend/"
cp apps/frontend/package.json "$TEMP_DIR/apps/frontend/"
cp apps/frontend/tsconfig.json "$TEMP_DIR/apps/frontend/"
cp apps/frontend/tsconfig.app.json "$TEMP_DIR/apps/frontend/"
cp apps/frontend/tsconfig.node.json "$TEMP_DIR/apps/frontend/"
cp apps/frontend/vite.config.ts "$TEMP_DIR/apps/frontend/"
cp apps/frontend/index.html "$TEMP_DIR/apps/frontend/"
cp apps/frontend/eslint.config.js "$TEMP_DIR/apps/frontend/"

# Copy public assets
mkdir -p "$TEMP_DIR/apps/frontend/public"
cp -r apps/frontend/public/* "$TEMP_DIR/apps/frontend/public/" 2>/dev/null || true

# Copy deployment files
echo "🚀 Copying deployment files..."
cp -r deployments/* "$TEMP_DIR/deployments/" 2>/dev/null || true

# Create deployment instructions
echo "📝 Creating deployment instructions..."
cat > "$TEMP_DIR/DEPLOYMENT_INSTRUCTIONS.md" << 'EOF'
# LandingAI Deployment Instructions

## Prerequisites
- Node.js 18+ 
- Python 3.8+
- npm or yarn
- pip

## Quick Start

1. **Install dependencies:**
   ```bash
   # Install root dependencies
   npm install
   
   # Install backend dependencies
   cd apps/backend
   npm install
   pip install -r requirements.txt
   
   # Install frontend dependencies
   cd ../frontend
   npm install
   ```

2. **Build the application:**
   ```bash
   # From project root
   npm run build
   ```

3. **Start the application:**
   ```bash
   # Backend (from apps/backend)
   npm start
   
   # Frontend (from apps/frontend) - in another terminal
   npm run dev
   ```

## Docker Deployment

Use the included Dockerfile for containerized deployment:

```bash
docker build -t landingai .
docker run -p 3000:3000 -p 3001:3001 landingai
```

## Environment Variables

1. **Copy the API keys template:**
   ```bash
   cp api-keys.template.txt api-keys.txt
   ```

2. **Edit api-keys.txt with your actual values:**
   - Set your OpenAI API key
   - Set your database connection string
   - Set your sites directory path

3. **Alternative: Set environment variables:**
   ```bash
   export OPENAI_API_KEY="your-api-key"
   export DATABASE_URL="your-database-url"
   export SITES_PATH="/path/to/sites"
   ```

## File Structure

- `apps/backend/` - Node.js/TypeScript backend
- `apps/frontend/` - React frontend
- `apps/backend/python/` - Python utilities and scripts
- `deployments/` - Deployment scripts and configurations
EOF

# Create a simple start script
echo "🔧 Creating start script..."
cat > "$TEMP_DIR/start.sh" << 'EOF'
#!/bin/bash
echo "🚀 Starting LandingAI..."

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

if [ ! -d "apps/backend/node_modules" ]; then
    echo "📦 Installing backend dependencies..."
    cd apps/backend && npm install && cd ../..
fi

if [ ! -d "apps/frontend/node_modules" ]; then
    echo "📦 Installing frontend dependencies..."
    cd apps/frontend && npm install && cd ../..
fi

# Build the application
echo "🔨 Building application..."
npm run build

# Start the application
echo "🎉 Starting LandingAI..."
npm run dev
EOF

chmod +x "$TEMP_DIR/start.sh"

# Create .gitignore for deployment
echo "📝 Creating deployment .gitignore..."
cat > "$TEMP_DIR/.gitignore" << 'EOF'
# Dependencies
node_modules/
*/node_modules/
venv/
__pycache__/
*.pyc

# Build outputs
dist/
build/
*/dist/
*/build/

# Environment files
.env
.env.local
.env.production

# Logs
*.log
logs/

# OS generated files
.DS_Store
.DS_Store?
._*
.Spotlight-V100
.Trashes
ehthumbs.db
Thumbs.db

# IDE files
.vscode/
.idea/
*.swp
*.swo

# Temporary files
*.tmp
*.temp
EOF

# Create the tar.gz archive
echo "📦 Creating tar.gz archive..."
cd /tmp
tar -czf "$ARCHIVE_NAME" "$DEPLOYMENT_NAME"

# Move to project directory
mv "$ARCHIVE_NAME" "/Users/tamernas/Desktop/LandingAI/"

# Clean up temp directory
rm -rf "$TEMP_DIR"

echo "✅ Deployment package created successfully!"
echo "📁 Archive location: /Users/tamernas/Desktop/LandingAI/${ARCHIVE_NAME}"
echo "📊 Archive size: $(du -h "/Users/tamernas/Desktop/LandingAI/${ARCHIVE_NAME}" | cut -f1)"

echo ""
echo "🎯 To deploy:"
echo "1. Extract the archive: tar -xzf ${ARCHIVE_NAME}"
echo "2. Follow instructions in DEPLOYMENT_INSTRUCTIONS.md"
echo "3. Or run: ./start.sh"
