import { Request, Response, NextFunction } from 'express';
import { Prisma } from '../generated/prisma/client';
import { ZodError } from 'zod';

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
    console.error('[Error]', err);

    if (err instanceof ZodError) {
        res.status(400).json({ error: true, message: 'Validation failed', details: err.issues });
        return;
    }

    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
        res.status(404).json({ error: true, message: 'Record not found.' });
        return;
    }

    if (err instanceof Error) {
        res.status(500).json({
            error: true,
            message: process.env.NODE_ENV === 'production' ? 'An unexpected error occurred.' : err.message,
        });
        return;
    }

    res.status(500).json({ error: true, message: 'An unexpected error occurred.' });
}