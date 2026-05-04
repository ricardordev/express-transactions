import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CorsOptions } from 'cors';
import { getCorsOptions } from '../cors';

describe('CORS Configuration', () => {
    let originCallback: ReturnType<typeof vi.fn>;
    let options: CorsOptions;

    beforeEach(() => {
        vi.clearAllMocks();
        originCallback = vi.fn();
    });

    function callOrigin(origin: string | null | undefined) {
        const opt = options.origin;
        if (typeof opt === 'function') {
            opt(origin as string, originCallback as (err: Error | null, allow?: unknown) => void);
        }
    }
    it.each([
        { desc: 'null origin (server-to-server)', allowedOrigins: 'http://localhost:3000', origin: null as string | null, expectAllowed: true },
        { desc: 'configured origin via Set.has()', allowedOrigins: 'http://localhost:3000,https://app.example.com', origin: 'http://localhost:3000', expectAllowed: true },
        { desc: 'unconfigured origin (blocked)', allowedOrigins: 'http://localhost:3000', origin: 'https://evil.com', expectAllowed: false },
    ])('should handle $desc', ({ allowedOrigins, origin, expectAllowed }) => {
        process.env.ALLOWED_ORIGINS = allowedOrigins;
        options = getCorsOptions();

        callOrigin(origin);

        if (expectAllowed) {
            expect(originCallback).toHaveBeenCalledWith(null, true);
        } else {
            expect(originCallback).toHaveBeenCalledWith(expect.any(Error));
        }
    });

    it('should handle empty ALLOWED_ORIGINS gracefully', () => {
        delete process.env.ALLOWED_ORIGINS;
        options = getCorsOptions();

        callOrigin('https://any-origin.com');

        expect(originCallback).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should trim whitespace from origins', () => {
        process.env.ALLOWED_ORIGINS = '  http://localhost:3000 , https://app.example.com  ';
        options = getCorsOptions();

        callOrigin('https://app.example.com');

        expect(originCallback).toHaveBeenCalledWith(null, true);
    });

    it('should filter out empty strings after split', () => {
        process.env.ALLOWED_ORIGINS = 'http://localhost:3000,,,https://app.example.com';
        options = getCorsOptions();

        callOrigin('https://app.example.com');

        expect(originCallback).toHaveBeenCalledWith(null, true);
    });

    it('should have credentials enabled', () => {
        process.env.ALLOWED_ORIGINS = 'http://localhost:3000';
        options = getCorsOptions();

        expect(options.credentials).toBe(true);
    });
});