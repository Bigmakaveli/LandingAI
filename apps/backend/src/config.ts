export const OPENAI_CONFIG = {
  // API Configuration
  API_KEY: process.env.OPENAI_API_KEY || "",
  
  // Model configuration
  DEFAULT_MODEL: 'gpt-4o',
  
  // Temperature settings
  DEFAULT_TEMPERATURE: 0.1,
  SITE_SPECIFIC_TEMPERATURE: 0.7,
  
};