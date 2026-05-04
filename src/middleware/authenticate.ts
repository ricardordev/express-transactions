import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../infrastructure/prisma';

export interface UserPayload {
    id: number;
}

export const authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const secret = process.env.JWT_SECRET;

    if (!secret || secret.trim() === '') {
        if (process.env.NODE_ENV !== 'production') {
            console.warn('[Security] JWT_SECRET not defined. Endpoint accessed publicly (development only).');
            return next();
        }
        res.status(500).json({ error: true, message: 'Authentication is not configured.' });
        return;
    }

    const authHeader = req.headers.authorization;
    const token = req.cookies?.access_token || (authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null);

    if (!token) {
        res.status(401).json({ error: true, message: 'JWT Token missing. Use "Bearer <token>" or login cookie.' });
        return;
    }

    try {
        const decoded = jwt.verify(token, secret) as { id: number; v: number };

        const user = await prisma.user.findUnique({
            where: { id: decoded.id },
            select: { token_version: true },
        });

        if (user?.token_version !== decoded.v) {
            res.status(401).json({ error: true, message: 'Session revoked. Please log in again.' });
            return;
        }

        req.user = { id: decoded.id };
        next();
    } catch {
        res.status(401).json({ error: true, message: 'JWT Token invalid or expired.' });
    }
};