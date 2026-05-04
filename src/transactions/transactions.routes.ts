import { Router, Request, Response } from "express";
import { TransactionsController } from "./transactions.controller";
import { authenticate } from "../middleware/authenticate";
import { validate } from "../middleware/validate";
import { createTransactionSchema, updateTransactionSchema, deleteTransactionParamsSchema, getTransactionParamsSchema, paginationQuerySchema } from "./transactions.schema";

const router = Router();

router.use("/transactions", authenticate);

router.route("/transactions")
    .get(validate({ query: paginationQuerySchema }), TransactionsController.get)
    .post(validate({ body: createTransactionSchema }), TransactionsController.post)
    .all((req: Request, res: Response) => res.status(405).json({ error: true, message: `Method ${req.method} not allowed.` }));

router.route("/transactions/:hash")
    .get(validate({ params: getTransactionParamsSchema }), TransactionsController.getByHash)
    .put(validate({ params: getTransactionParamsSchema, body: updateTransactionSchema }), TransactionsController.put)
    .delete(validate({ params: deleteTransactionParamsSchema }), TransactionsController.delete)
    .all((req: Request, res: Response) => res.status(405).json({ error: true, message: `Method ${req.method} not allowed.` }));

export default router;
