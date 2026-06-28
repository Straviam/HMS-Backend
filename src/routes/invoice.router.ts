import { Router } from "express";
import {
  generateReceptionInvoice
} from "../controllers/invoice.controller.js";
import verifyJwt from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/role-handler.middleware.js";

const invoiceRouter: Router = Router();

invoiceRouter.use(verifyJwt);

invoiceRouter.post(
  "/reception/generate",
  authorizeRoles(["ADMIN","RECEPTIONIST"]),
  generateReceptionInvoice,
);

export default invoiceRouter;