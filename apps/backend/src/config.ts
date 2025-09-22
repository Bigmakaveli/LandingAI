import { promises as fs } from 'fs';
import path from 'path';

// Load API keys from external file
async function loadApiKeys() {
  try {
    const keysPath = path.resolve(process.cwd(), 'api-keys.txt');
    const keysData = await fs.readFile(keysPath, 'utf8');
    const keys: Record<string, string> = {};
    
    // Parse the keys file
    keysData.split('\n').forEach(line => {
      const trimmedLine = line.trim();
      if (trimmedLine && !trimmedLine.startsWith('#')) {
        const [key, value] = trimmedLine.split('=');
        if (key && value) {
          keys[key.trim()] = value.trim();
        }
      }
    });
    
    return keys;
  } catch (error) {
    console.warn('[Config] Failed to load api-keys.txt, using environment variables only');
    return {};
  }
}

// Cache for API keys
let apiKeysCache: Record<string, string> | null = null;

// Function to get API keys (with caching)
async function getApiKeys(): Promise<Record<string, string>> {
  if (apiKeysCache === null) {
    apiKeysCache = await loadApiKeys();
  }
  return apiKeysCache;
}

// Function to get OpenAI config
export async function getOpenAIConfig() {
  const apiKeys = await getApiKeys();
  return {
    // API Configuration
    API_KEY: process.env.OPENAI_API_KEY || apiKeys.OPENAI_API_KEY || "",
    
    // Model configuration
    DEFAULT_MODEL: 'gpt-4o',
    
    // Temperature settings
    DEFAULT_TEMPERATURE: 0.1,
    SITE_SPECIFIC_TEMPERATURE: 0.7,
  };
}

// Function to get Database config
export async function getDatabaseConfig() {
  const apiKeys = await getApiKeys();
  return {
    // Database Configuration
    CONNECTION_STRING: process.env.DATABASE_URL || apiKeys.DATABASE_URL || "",
    
    // Connection pool settings
    MAX_CONNECTIONS: 20,
    IDLE_TIMEOUT_MS: 30000,
    CONNECTION_TIMEOUT_MS: 2000,
  };
}

// Load sites configuration from JSON file
async function loadSitesConfig() {
  try {
    const configPath = path.resolve(process.cwd(), 'sites-config.json');
    const configData = await fs.readFile(configPath, 'utf8');
    const config = JSON.parse(configData);
    const apiKeys = await getApiKeys();
    return config.sitesPath || apiKeys.SITES_PATH || "/Users/tamernas/Desktop/LandingAI-sites";
  } catch (error) {
    console.warn('[Config] Failed to load sites-config.json, using default path');
    const apiKeys = await getApiKeys();
    return apiKeys.SITES_PATH || "/Users/tamernas/Desktop/LandingAI-sites";
  }
}

// Export a function to get the sites path
export async function getSitesPath(): Promise<string> {
  return await loadSitesConfig();
}

// Legacy exports for backward compatibility (will use environment variables only)
export const OPENAI_CONFIG = {
  // API Configuration
  API_KEY: process.env.OPENAI_API_KEY || "",
  
  // Model configuration
  DEFAULT_MODEL: 'gpt-4o',
  
  // Temperature settings
  DEFAULT_TEMPERATURE: 0.1,
  SITE_SPECIFIC_TEMPERATURE: 0.7,
};

export const DATABASE_CONFIG = {
  // Database Configuration
  CONNECTION_STRING: process.env.DATABASE_URL || "",
  
  // Connection pool settings
  MAX_CONNECTIONS: 20,
  IDLE_TIMEOUT_MS: 30000,
  CONNECTION_TIMEOUT_MS: 2000,
};

export const SITES_CONFIG = {
  // Sites directory path - loaded from environment variables
  SITES_PATH: process.env.SITES_PATH || "/Users/tamernas/Desktop/LandingAI-sites",
};