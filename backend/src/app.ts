import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import apiKeysRouter from './routes/apiKeys.js';
import analyticsRouter from './routes/analytics.js';
import gatewayRouter from './routes/gateway.js';
import { validateJwt } from './services/jwt.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/auth', apiKeysRouter);
app.use('/api/gateway', gatewayRouter);
app.use('/api/analytics', validateJwt, analyticsRouter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

export default app;
