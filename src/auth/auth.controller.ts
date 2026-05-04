import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { AuthService, AuthError } from "./auth.service";
import { loginSchema, refreshSchema } from "./auth.schema";

export class AuthController {
    static async login(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { login, password } = req.body as z.infer<typeof loginSchema>;
            const pair = await AuthService.login(login, password);

            res.cookie(AuthService.accessCookieName, pair.access_token, AuthService.getAccessTokenCookieOptions());
            res.cookie(AuthService.refreshCookieName, pair.refresh_token, AuthService.getRefreshTokenCookieOptions());
            res.status(200).json({
                token: pair.access_token,
                type: "Bearer",
                expires_in: pair.expires_in,
                refresh_token: pair.refresh_token,
                lookup_key: pair.lookup_key,
            });
        } catch (error) {
            if (error instanceof AuthError) {
                res.status(error.statusCode).json({ error: true, message: error.message });
                return;
            }
            next(error);
        }
    }

    static async refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const body = req.body as z.infer<typeof refreshSchema> | undefined;
            const rt = body?.refresh_token || req.cookies?.[AuthService.refreshCookieName];
            const lk = body?.lookup_key;
            if (!rt || !lk) {
                res.status(400).json({ error: true, message: "refresh_token and lookup_key required." });
                return;
            }
            const pair = await AuthService.refresh(rt, lk);

            res.cookie(AuthService.accessCookieName, pair.access_token, AuthService.getAccessTokenCookieOptions());
            res.cookie(AuthService.refreshCookieName, pair.refresh_token, AuthService.getRefreshTokenCookieOptions());
            res.status(200).json({
                token: pair.access_token,
                type: "Bearer",
                expires_in: pair.expires_in,
                refresh_token: pair.refresh_token,
                lookup_key: pair.lookup_key,
            });
        } catch (error) {
            if (error instanceof AuthError) {
                if (error.message.includes("reuse")) {
                    res.clearCookie(AuthService.accessCookieName, { path: "/" });
                    res.clearCookie(AuthService.refreshCookieName, { path: "/auth" });
                }
                res.status(error.statusCode).json({ error: true, message: error.message });
                return;
            }
            next(error);
        }
    }

    static async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const refreshToken = req.body?.refresh_token || req.cookies?.[AuthService.refreshCookieName];
            const userId = req.user?.id;

            if (!userId) {
                res.status(401).json({ error: true, message: "Not authenticated." });
                return;
            }

            if (refreshToken) {
                await AuthService.logout(userId, refreshToken);
            }

            res.clearCookie(AuthService.accessCookieName, { path: "/" });
            res.clearCookie(AuthService.refreshCookieName, { path: "/auth" });
            res.status(204).send();
        } catch (error) {
            next(error);
        }
    }

    static async me(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({ error: true, message: "Not authenticated." });
                return;
            }
            const profile = await AuthService.getUserProfile(userId);
            res.status(200).json(profile);
        } catch (error) {
            if (error instanceof AuthError) {
                res.status(error.statusCode).json({ error: true, message: error.message });
                return;
            }
            next(error);
        }
    }
}
