import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import config from '../config.js';

export function signJwt(payload: object) {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: '2h' });
}

export function validateJwt(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing bearer token' });
  }

  const token = authHeader.replace('Bearer ', '');
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    res.locals.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}
