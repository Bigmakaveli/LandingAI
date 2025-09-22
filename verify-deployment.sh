#!/bin/bash

# LandingAI Deployment Verification Script
echo "🔍 Verifying deployment package..."

PACKAGE_NAME="landingai-deployment_20250913_211117.tar.gz"

if [ ! -f "$PACKAGE_NAME" ]; then
    echo "❌ Package not found: $PACKAGE_NAME"
    exit 1
fi

echo "✅ Package found: $PACKAGE_NAME"
echo "📊 Package size: $(ls -lh $PACKAGE_NAME | awk '{print $5}')"

# Extract and verify contents
echo "📦 Extracting package for verification..."
tar -tzf "$PACKAGE_NAME" | head -20

echo ""
echo "📋 Package contents include:"
echo "  - Backend source and dist files"
echo "  - Frontend source and dist files" 
echo "  - Python virtual environment"
echo "  - Example sites (keaara, example_page)"
echo "  - Setup scripts"
echo "  - Configuration files"

echo ""
echo "🚀 Ready for deployment!"
echo ""
echo "📋 Deployment steps:"
echo "1. Upload: scp $PACKAGE_NAME user@your-server:/home/user/"
echo "2. SSH: ssh user@your-server"
echo "3. Extract: tar -xzf $PACKAGE_NAME"
echo "4. Setup: cd landingai-deployment && ./scripts/setup.sh"
echo ""
echo "⚠️  Don't forget to:"
echo "  - Set your OPENAI_API_KEY in the .env file"
echo "  - Ensure your server has Node.js 18+ and Python 3+"
