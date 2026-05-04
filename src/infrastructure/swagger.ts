import { z } from 'zod';
import { extendZodWithOpenApi, OpenAPIRegistry, OpenApiGeneratorV3 } from '@asteasolutions/zod-to-openapi';

extendZodWithOpenApi(z);

const registry = new OpenAPIRegistry();

const bearerAuth = registry.registerComponent('securitySchemes', 'bearerAuth', {
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'JWT',
});

// POST /auth/login
registry.registerPath({
    method: 'post',
    path: '/auth/login',
    summary: 'Login',
    tags: ['Auth'],
    request: {
        body: {
            content: {
                'application/json': {
                    schema: z.object({ login: z.string(), password: z.string() }),
                },
            },
        },
    },
    responses: {
        200: { description: 'JWT access + refresh token pair' },
        400: { description: 'Invalid fields' },
        401: { description: 'Invalid credentials' },
    },
});

// POST /auth/refresh
registry.registerPath({
    method: 'post',
    path: '/auth/refresh',
    summary: 'Refresh access token',
    tags: ['Auth'],
    request: {
        body: {
            content: {
                'application/json': {
                    schema: z.object({ refresh_token: z.string().optional(), lookup_key: z.string() }),
                },
            },
        },
    },
    responses: {
        200: { description: 'New access + refresh token pair' },
        401: { description: 'Invalid/expired refresh token or token reuse detected' },
    },
});

// GET /auth/me
registry.registerPath({
    method: 'get',
    path: '/auth/me',
    summary: 'Get authenticated user profile',
    tags: ['Auth'],
    security: [{ [bearerAuth.name]: [] }],
    responses: {
        200: { description: 'User profile data' },
        401: { description: 'Unauthorized' },
    }
});

// POST /auth/logout
registry.registerPath({
    method: 'post',
    path: '/auth/logout',
    summary: 'Logout (revoke session)',
    tags: ['Auth'],
    security: [{ [bearerAuth.name]: [] }],
    responses: {
        204: { description: 'Session revoked' },
        401: { description: 'Unauthorized' },
    },
});

// Transactions endpoints
registry.registerPath({
    method: 'get',
    path: '/transactions',
    summary: 'List all transactions (paginated, excludes soft-deleted)',
    tags: ['Transactions'],
    security: [{ [bearerAuth.name]: [] }],
    responses: {
        200: { description: 'Paginated list' },
        401: { description: 'Unauthorized' },
    },
});

registry.registerPath({
    method: 'get',
    path: '/transactions/:hash',
    summary: 'Get a transaction by hash',
    tags: ['Transactions'],
    security: [{ [bearerAuth.name]: [] }],
    responses: {
        200: { description: 'Transaction found' },
        401: { description: 'Unauthorized' },
        404: { description: 'Not found' },
    },
});

registry.registerPath({
    method: 'post',
    path: '/transactions',
    summary: 'Create a new transaction',
    tags: ['Transactions'],
    security: [{ [bearerAuth.name]: [] }],
    responses: {
        201: { description: 'Created' },
        400: { description: 'Invalid' },
        401: { description: 'Unauthorized' },
    },
});

registry.registerPath({
    method: 'put',
    path: '/transactions/:hash',
    summary: 'Update a transaction',
    tags: ['Transactions'],
    security: [{ [bearerAuth.name]: [] }],
    responses: {
        200: { description: 'Updated' },
        400: { description: 'Invalid' },
        401: { description: 'Unauthorized' },
        404: { description: 'Not found' },
    },
});

registry.registerPath({
    method: 'delete',
    path: '/transactions/:hash',
    summary: 'Soft-delete a transaction (owner only)',
    tags: ['Transactions'],
    security: [{ [bearerAuth.name]: [] }],
    responses: {
        204: { description: 'Deleted' },
        401: { description: 'Unauthorized' },
        403: { description: 'Not the owner' },
        404: { description: 'Not found' },
    },
});

export function generateOpenAPI(serverUrl: string = '') {
    const generator = new OpenApiGeneratorV3(registry.definitions);
    return generator.generateDocument({
        openapi: '3.0.0',
        info: {
            version: '1.0.0',
            title: 'Transactions API',
            description: 'REST API with JWT auth, refresh tokens, and soft-delete.',
        },
        servers: [{ url: serverUrl }],
    });
}