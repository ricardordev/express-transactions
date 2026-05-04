import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

const dbType = process.env.DATABASE_TYPE || 'mysql';
let adapter: PrismaPg | PrismaMariaDb;

if (dbType === 'postgresql') {
    adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL || '' });
} else {
    adapter = new PrismaMariaDb({
        host: process.env.DATABASE_HOST || 'localhost',
        port: Number.parseInt(process.env.DATABASE_PORT || '3306'),
        user: process.env.DATABASE_USER || '',
        password: process.env.DATABASE_PASSWORD || '',
        database: process.env.DATABASE_NAME || '',
        connectionLimit: Number.parseInt(process.env.DATABASE_CONNECTION_LIMIT || '5'),
    });
}

export const prisma = new PrismaClient({ adapter });
