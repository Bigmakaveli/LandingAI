# LandingAI - AI-Powered Website Builder

A full-stack application that allows users to build and modify websites through natural language conversations with AI.

## 🏗️ Architecture

```
LandingAI/
├── apps/
│   ├── backend/     # Node.js/Express API server
│   └── frontend/    # React web application
├── example_page/    # Example landing page
└── keaara/         # User site example
```

## 🚀 Features

### Backend (Node.js/Express)
- **AI Integration**: OpenAI GPT for natural language processing
- **Aider Integration**: AI-powered code modification
- **Git Management**: Version control with undo/redo functionality
- **GitHub Publishing**: Push changes to GitHub repositories
- **Site Management**: Serve and manage multiple sites
- **Chat History**: Persistent conversation storage

### Frontend (React)
- **Web Interface**: Modern React-based web application
- **Real-time Chat**: AI conversation interface
- **Site Preview**: Live preview of website changes
- **Version Control**: Undo/redo and publish functionality


## 🛠️ Setup

### Prerequisites
- Node.js (v16 or higher)
- Python 3.8+ (for Aider integration)
- Git

### Quick Start

1. **Clone and install dependencies**:
   ```bash
   git clone <repository-url>
   cd LandingAI
   npm install
   ```

2. **Configure OpenAI API**:
   ```bash
   # Edit apps/backend/src/config.ts
   # Set your OPENAI_API_KEY
   ```

3. **Start the backend**:
   ```bash
   npm run dev
   ```

4. **Access the applications**:
   - **Web App**: http://localhost:3000
   - **API**: http://localhost:3001


## 🔧 Configuration

### Backend Configuration
Edit `apps/backend/src/config.ts`:
```typescript
export const OPENAI_CONFIG = {
  API_KEY: 'your-openai-api-key',
  DEFAULT_MODEL: 'gpt-4o-mini',
};
```


## 🚀 Deployment

### Backend Deployment
1. Set environment variables
2. Deploy to your preferred platform (Heroku, Vercel, etc.)


## 📚 API Documentation

### Chat Endpoints
- `POST /api/:siteId/chat` - Send chat message
- `GET /api/:siteId/chat/history` - Get chat history
- `DELETE /api/:siteId/chat/history` - Clear chat history

### Site Management
- `GET /sites/:siteId` - Serve site content
- `POST /api/:siteId/undo` - Undo changes
- `POST /api/:siteId/redo` - Redo changes
- `POST /api/:siteId/github/push` - Publish changes
- `POST /api/:siteId/start-over` - Reset to latest version

## 🐛 Troubleshooting

### Common Issues

**Backend not starting**:
- Check if port 3001 is available
- Verify OpenAI API key is set
- Check Python virtual environment



## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For support and questions:
- Check the troubleshooting section
- Review the API documentation
- Open an issue on GitHub
