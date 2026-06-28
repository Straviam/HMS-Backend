import { Router } from "express";
import {
  generateReceptionReceipt,
  addItemToInvoice,
  addPaymentToInvoice,
  finalizeReceptionInvoice
} from "../controllers/invoice.controller.js";
import verifyJwt from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/role-handler.middleware.js";

const invoiceRouter: Router = Router();

invoiceRouter.use(verifyJwt);

invoiceRouter.post(
  "/reception/generate",
  authorizeRoles(["ADMIN","RECEPTIONIST"]),
  generateReceptionReceipt,
);

invoiceRouter.patch(
  "/:id/reception/finalize", 
  authorizeRoles(["ADMIN", "RECEPTIONIST"]), 
  finalizeReceptionInvoice,
);

invoiceRouter.post(
  "/:id/addItem",
  authorizeRoles(["ADMIN","RECEPTIONIST"]),
  addItemToInvoice,
);

invoiceRouter.post(
  "/:id/pay",
  authorizeRoles(["ADMIN","RECEPTIONIST"]), 
  addPaymentToInvoice,
);


export default invoiceRouter;