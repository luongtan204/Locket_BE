import dotenv from 'dotenv';
dotenv.config();

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '4000', 10),
  MONGO_URI: process.env.MONGO_URI ,
  JWT_SECRET: process.env.JWT_SECRET || 'change_me',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME || '',
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY || '',
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET || '',
  // Email config (dùng Gmail SMTP miễn phí)
  EMAIL_HOST: process.env.EMAIL_HOST || 'smtp.gmail.com',
  EMAIL_PORT: parseInt(process.env.EMAIL_PORT || '587', 10),
  EMAIL_USER: process.env.EMAIL_USER || '',
  EMAIL_PASS: process.env.EMAIL_PASS || '', // App password cho Gmail
  EMAIL_FROM: process.env.EMAIL_FROM || process.env.EMAIL_USER || '',
  // NSFW Moderation config
  NSFW_ENABLED: process.env.NSFW_ENABLED !== 'false', // Default: true, set to 'false' to disable
  // Groq API config (for caption suggestion)
  GROQ_API_KEY: process.env.GROQ_API_KEY || '',
  // Firebase Admin config (for push notifications)
  FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID || '',
  FIREBASE_PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n') || '',
  FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL || '',
};

// eslint-disable-next-line no-console
console.log(`ENV: NODE_ENV=${env.NODE_ENV} PORT=${env.PORT}`);
