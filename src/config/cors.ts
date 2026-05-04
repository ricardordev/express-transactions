import { CorsOptions } from 'cors';

export const getCorsOptions = (): CorsOptions => {
    const envOrigins = process.env.ALLOWED_ORIGINS || '';
    const allowedOrigins = new Set(envOrigins.split(',').map(s => s.trim()).filter(Boolean));

    return {
        origin: (origin, callback) => {
            if (!origin || allowedOrigins.has(origin)) {
                callback(null, true);
            } else {
                callback(new Error('Blocked by CORS policy'));
            }
        },
        credentials: true,
    };
};