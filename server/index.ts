import express from 'express';
import cors from 'cors';
import { config, validateConfig } from './config.js';
import { healthRouter } from './routes/health.js';
import { chatRouter } from './routes/chat.js';
import { generateRouter } from './routes/generate.js';

validateConfig();

const app = express();

// CORS -- in dev, Vite proxy handles this; in production, restrict to allowed origin
app.use(cors({
  origin: config.nodeEnv === 'production'
    ? config.allowedOrigin
    : 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'x-stack-access-token'],
}));

// Security headers
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Body parsing -- 10MB limit for document processing (base64 images/PDFs)
app.use(express.json({ limit: '10mb' }));

// Routes
app.use('/api', healthRouter);
app.use('/api', chatRouter);
app.use('/api', generateRouter);

// Global error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(config.port, () => {
  console.log(`Nexus backend running on port ${config.port}`);
  console.log(`Environment: ${config.nodeEnv}`);
});
