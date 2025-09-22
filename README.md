# LandingAI - AI-Powered Website Builder

A full-stack application that allows users to build and modify websites through natural language conversations with AI. Built with modern technologies and secure configuration management.

## 🏗️ Architecture

```
LandingAI/
├── apps/
│   ├── backend/     # Node.js/TypeScript API server
│   │   ├── src/     # TypeScript source code
│   │   └── python/  # Python utilities and AI analysis tools
│   └── frontend/    # React web application
├── deployments/     # Deployment scripts and configurations
├── api-keys.template.txt  # API keys template (safe for git)
└── api-keys.txt     # Local API keys (gitignored)
```

## 🚀 Features

### Backend (Node.js/TypeScript)
- **AI Integration**: OpenAI GPT-4o for natural language processing
- **Aider Integration**: AI-powered code modification and analysis
- **Database Management**: PostgreSQL integration with connection pooling
- **Git Management**: Version control with undo/redo functionality
- **GitHub Publishing**: Push changes to GitHub repositories
- **Site Management**: Serve and manage multiple sites
- **Chat History**: Persistent conversation storage
- **Gift Card System**: Integrated gift card management
- **Process Management**: Advanced aider process handling
- **Security**: Secure API keys management with external configuration

### Frontend (React/TypeScript)
- **Modern UI**: React-based web application with TypeScript
- **Real-time Chat**: AI conversation interface with overlay
- **Site Preview**: Live preview of website changes
- **Version Control**: Undo/redo and publish functionality
- **Responsive Design**: Mobile-friendly interface

### Python Utilities
- **AI Analysis Tools**: Comprehensive model testing and comparison
- **Aider Runner**: Automated code generation and testing
- **Test Framework**: Automated testing with multiple AI models


## 🛠️ Setup

### Prerequisites
- Node.js (v18 or higher)
- Python 3.8+ (for Aider integration)
- Git
- PostgreSQL (for database functionality)

### Quick Start

1. **Clone and install dependencies**:
   ```bash
   git clone https://github.com/Bigmakaveli/LandingAI.git
   cd LandingAI
   npm install
   ```

2. **Configure API keys**:
   ```bash
   # Copy the template file
   cp api-keys.template.txt api-keys.txt
   
   # Edit api-keys.txt with your actual values
   nano api-keys.txt
   ```

3. **Install Python dependencies**:
   ```bash
   cd apps/backend
   pip install -r requirements.txt
   cd ../..
   ```

4. **Start the application**:
   ```bash
   # Start both frontend and backend
   npm run dev
   
   # Or start individually
   npm run dev --workspace @landing/backend
   npm run dev --workspace @landing/frontend
   ```

5. **Access the applications**:
   - **Web App**: http://localhost:3000
   - **API**: http://localhost:3001


## 🔧 Configuration

### API Keys Management
The project uses a secure API keys management system:

1. **Local Development**: Use `api-keys.txt` (gitignored)
2. **Production**: Use environment variables
3. **Team Development**: Use `api-keys.template.txt` as a guide

#### API Keys File Structure
```bash
# api-keys.txt
OPENAI_API_KEY=your-openai-api-key-here
DATABASE_URL=your-database-connection-string-here
SITES_PATH=/path/to/your/sites/directory
```

#### Environment Variables (Alternative)
```bash
export OPENAI_API_KEY="your-openai-api-key"
export DATABASE_URL="your-database-url"
export SITES_PATH="/path/to/sites"
```

### Backend Configuration
The backend automatically loads configuration from:
1. `api-keys.txt` file (if available)
2. Environment variables
3. Default values (fallback)

### Database Configuration
- **Type**: PostgreSQL
- **Connection Pooling**: Enabled
- **Configuration**: Via `DATABASE_URL` or `api-keys.txt`


## 🚀 Deployment

### Automated Deployment Package
Create a deployment package with all necessary files:

```bash
# Generate deployment tar.gz
./create-deployment.sh

# This creates: landingai_deployment_YYYYMMDD_HHMMSS.tar.gz
```

### Manual Deployment

1. **Set up API keys**:
   ```bash
   # Copy template and configure
   cp api-keys.template.txt api-keys.txt
   # Edit api-keys.txt with your values
   ```

2. **Install dependencies**:
   ```bash
   npm install
   cd apps/backend && npm install && pip install -r requirements.txt
   cd ../frontend && npm install
   ```

3. **Build the application**:
   ```bash
   npm run build
   ```

4. **Start the application**:
   ```bash
   # Production mode
   npm start
   
   # Or use the included start script
   ./start.sh
   ```

### Docker Deployment
```bash
# Build Docker image
docker build -t landingai .

# Run container
docker run -p 3000:3000 -p 3001:3001 landingai
```

### Environment Variables for Production
```bash
export OPENAI_API_KEY="your-production-api-key"
export DATABASE_URL="your-production-database-url"
export SITES_PATH="/app/sites"
```


## 📚 API Documentation

### Chat Endpoints
- `POST /api/:siteId/chat` - Send chat message to AI
- `GET /api/:siteId/chat/history` - Get chat history
- `DELETE /api/:siteId/chat/history` - Clear chat history

### Site Management
- `GET /sites/:siteId` - Serve site content
- `POST /api/:siteId/undo` - Undo last changes
- `POST /api/:siteId/redo` - Redo undone changes
- `POST /api/:siteId/github/push` - Publish changes to GitHub
- `POST /api/:siteId/start-over` - Reset to latest version
- `GET /api/:siteId/status` - Get site status

### AI Analysis Endpoints
- `POST /api/analyze` - Run AI model analysis
- `GET /api/models` - Get available AI models
- `POST /api/test-aider` - Test aider integration

### Database Endpoints
- `GET /api/sites` - List all sites
- `POST /api/sites` - Create new site
- `DELETE /api/sites/:siteId` - Delete site

## 🐛 Troubleshooting

### Common Issues

**Backend not starting**:
- Check if port 3001 is available
- Verify API keys are configured in `api-keys.txt` or environment variables
- Check Python virtual environment and dependencies
- Ensure database connection is working

**API Key Issues**:
- Make sure `api-keys.txt` exists and contains valid keys
- Check that the file is not empty or corrupted
- Verify environment variables are set correctly

**Database Connection Issues**:
- Verify `DATABASE_URL` is correct
- Check if PostgreSQL is running
- Ensure database credentials are valid

**TypeScript Compilation Errors**:
- Run `npm install` to ensure all dependencies are installed
- Check if `@types/node` is installed: `npm install @types/node`
- Verify TypeScript configuration in `tsconfig.json`

**Python/Aider Issues**:
- Ensure Python 3.8+ is installed
- Install Python dependencies: `pip install -r requirements.txt`
- Check if aider is properly installed and configured



## 🛠️ Development

### Project Structure
- **Backend**: Node.js/TypeScript with Express
- **Frontend**: React with TypeScript and Vite
- **Python**: AI analysis tools and aider integration
- **Database**: PostgreSQL with connection pooling
- **Security**: External API keys management

### Development Scripts
```bash
# Install all dependencies
npm install

# Start development servers
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run Python analysis
cd apps/backend/python
python aider_analysis.py
```

### Code Quality
- TypeScript for type safety
- ESLint for code linting
- Prettier for code formatting
- Git hooks for pre-commit checks

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Set up your development environment:
   ```bash
   cp api-keys.template.txt api-keys.txt
   # Edit api-keys.txt with your test keys
   ```
4. Make your changes
5. Test thoroughly
6. Commit your changes (`git commit -m 'Add amazing feature'`)
7. Push to the branch (`git push origin feature/amazing-feature`)
8. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:
- 📖 Check the troubleshooting section above
- 📚 Review the API documentation
- 🐛 Open an issue on [GitHub](https://github.com/Bigmakaveli/LandingAI/issues)
- 💬 Start a discussion for questions

## 🎯 Roadmap

- [ ] Enhanced AI model support
- [ ] Real-time collaboration features
- [ ] Advanced site templates
- [ ] Mobile app development
- [ ] Performance optimizations
- [ ] Additional deployment options
