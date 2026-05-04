import { Router } from "express";
import { AuthController } from "./auth.controller";
import { authenticate } from "../middleware/authenticate";
import { validate } from "../middleware/validate";
import { loginSchema, refreshSchema } from "./auth.schema";

const router = Router();

router.post("/auth/login", validate({ body: loginSchema }), AuthController.login);
router.post("/auth/refresh", validate({ body: refreshSchema }), AuthController.refresh);
router.post("/auth/logout", authenticate, AuthController.logout);
router.get("/auth/me", authenticate, AuthController.me);

export default router;
