import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { setupRoutes } from './routes/endpoints';

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

// Setup all routes
setupRoutes(app);

// Start the server
app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});