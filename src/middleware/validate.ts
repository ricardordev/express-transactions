import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

export const validate = (schemas: {
    body?: z.ZodTypeAny;
    query?: z.ZodTypeAny;
    params?: z.ZodTypeAny;
}) => {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            if (schemas.params) {
                req.params = await schemas.params.parseAsync(req.params) as any;
            }
            if (schemas.query) {
                const validatedQuery = await schemas.query.parseAsync(req.query);
                Object.defineProperty(req, 'query', {
                    value: validatedQuery,
                    writable: true,
                    enumerable: true,
                    configurable: true,
                });
            }
            if (schemas.body) {
                req.body = await schemas.body.parseAsync(req.body);
            }
            next();
        } catch (error) {
            if (error instanceof z.ZodError) {
                res.status(400).json({ error: true, message: 'Validation failed', details: error.issues });
                return;
            }
            next(error);
        }
    };
};