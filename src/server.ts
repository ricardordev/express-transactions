import 'dotenv/config';

import express, { Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';

import { getCorsOptions } from './config/cors';
import { generateOpenAPI } from './infrastructure/swagger';
import { errorHandler } from './infrastructure/error-handler';
import { prisma } from './infrastructure/prisma';

import authRoutes from './auth/auth.routes';
import transactionsRoutes from './transactions/transactions.routes';

const app = express();

app.set('trust proxy', 1);
app.use(helmet());
app.use(cors(getCorsOptions()));
app.use(cookieParser());
app.use(morgan('dev'));
app.use(express.json());

const PORT = Number.parseInt(process.env.PORT || '3000', 10);
const RATE_LIMIT_REQUESTS = Number.parseInt(process.env.RATE_LIMIT_REQUESTS || '100', 10);
const RATE_LIMIT_SECONDS = Number.parseInt(process.env.RATE_LIMIT_SECONDS || '60', 10);

const limiter = rateLimit({
    windowMs: RATE_LIMIT_SECONDS * 1000,
    max: RATE_LIMIT_REQUESTS,
    message: { error: true, message: 'Too many requests. Try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
});

// health check for load balancing purposes
app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
});

// docs for development purposes
const openApiDocument = generateOpenAPI();
app.use('/docs', limiter, swaggerUi.serve, swaggerUi.setup(openApiDocument));

// routes
app.use('/', limiter, authRoutes);
app.use('/', limiter, transactionsRoutes);

// not found handler
app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: true, message: 'Route not found.' });
});

app.use(errorHandler);

export { app };

// Only start listening in non-test environments
if (process.env.NODE_ENV !== 'test') {
    const server = app.listen(PORT, () => {
        console.log(`API running on http://localhost:${PORT}`);
        console.log(`Docs: http://localhost:${PORT}/docs`);
        console.log(`Health: http://localhost:${PORT}/health`);
    });

    // graceful shutdown
    function shutdown(signal: string) {
        console.log(`\n${signal} received. Shutting down...`);
        server.close(async () => {
            await prisma.$disconnect();
            console.log('Database connections closed.');
            process.exit(0);
        });
        setTimeout(() => { process.exit(1); }, 10000);
    }

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
}
