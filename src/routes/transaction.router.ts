import { Router } from "express";
import {
  getTransactions,
  getTransactionStats,
} from "../controllers/transaction.controller.js";
import verifyJwt from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/role-handler.middleware.js";

const transactionRouter: Router = Router();

transactionRouter.use(verifyJwt);

transactionRouter.get(
  "/stats",
  authorizeRoles(["ADMIN", "MANAGMENT"]),
  getTransactionStats
);

transactionRouter.get(
  "/",
  authorizeRoles(["ADMIN", "MANAGMENT", "RECEPTIONIST"]),
  getTransactions
);

export default transactionRouter;
