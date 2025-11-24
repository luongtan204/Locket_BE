import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import routes from './routes';
import inviteRoutes from './routes/invite.routes';
import { errorHandler } from './middlewares/error.middleware';

export function createApp() {
  const app = express();
  app.use(helmet());
  app.use(cors());
  app.use(express.json());
  app.use(morgan('dev'));

  // Invite route (không nằm trong /api)
  app.use('/invite', inviteRoutes);

  // API routes
  app.use('/api', routes);

  app.use((req, res) => res.status(404).json({ success: false, message: 'Not Found' }));

  app.use(errorHandler);
  return app;
}
