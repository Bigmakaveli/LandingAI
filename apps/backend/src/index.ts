import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { setupRoutes } from './routes/endpoints';
import { initializeDatabase, checkDatabaseConnection } from './utils/database';

// Load environment variables from .env file
dotenv.config();

// ===== EXPRESS APP SETUP =====

const app = express();

// Configure CORS to allow mobile apps to access static files
app.use(cors({
  origin: true, // Allow all origins for development
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Length', 'Content-Type', 'Last-Modified', 'ETag']
}));

// Increase body limit to allow base64 images in messages
app.use(express.json({ limit: '15mb' }));

const port = process.env.PORT || 3001;

// Initialize database and start server
async function startServer() {
  try {
    // Initialize database
    console.log('Initializing database...');
    await initializeDatabase();
    console.log('Database initialized successfully');
    
    // Check database connection
    const dbConnected = await checkDatabaseConnection();
    if (dbConnected) {
      console.log('Database connection verified');
    } else {
      console.warn('Database connection failed, using file system fallback');
    }
    
    // Setup all routes
    setupRoutes(app);
    
    // Start the server
    app.listen(port, () => {
      console.log(`API listening on http://localhost:${port}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();