import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from './config/env';
import { requireAdmin, requireAuth } from './middleware/auth';
import { errorHandler } from './middleware/errorHandler';
import { apiRateLimiter } from './middleware/rateLimiter';
import { createBullBoardMiddleware } from './queues/bullBoard';
import authRoutes from './routes/authRoutes';
import dashboardRoutes from './routes/dashboardRoutes';
import emailRoutes from './routes/emailRoutes';
import healthRoutes from './routes/healthRoutes';
import searchRoutes from './routes/searchRoutes';
import senderRoutes from './routes/senderRoutes';
import slackRoutes from './routes/slackRoutes';

export function createApp() {
  const app = express();

  app.use(
    helmet({
      contentSecurityPolicy: false,
    })
  );

  app.use(
    cors({
      origin: env.FRONTEND_URL,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    })
  );

  app.use(express.json({ limit: '15mb' }));
  app.use(express.urlencoded({ extended: true, limit: '15mb' }));
  app.use(cookieParser());

  app.use('/api', apiRateLimiter);

  app.use('/api/health', healthRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/emails', emailRoutes);
  app.use('/api/senders', senderRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/slack', slackRoutes);
  app.use('/api/search', searchRoutes);

  if (env.NODE_ENV !== 'test') {
    app.use('/admin/queues', requireAuth, requireAdmin, createBullBoardMiddleware());
  }

  app.use(errorHandler);
  return app;
}
