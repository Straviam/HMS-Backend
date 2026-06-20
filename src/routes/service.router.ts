import { Router } from "express";
import {
  createServiceType,
  createService,
  getServicesByServiceType
} from "../controllers/service.controller.js";
import verifyJwt from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/role-handler.middleware.js";

const serviceRouter: Router = Router();

serviceRouter.use(verifyJwt);

serviceRouter.get(
  "/type/:serviceTypeId",
  authorizeRoles(["ADMIN", "MANAGEMENT", "RECEPTIONIST"]),
  getServicesByServiceType
);

serviceRouter.post(
  "/types",
  authorizeRoles(["ADMIN", "MANAGEMENT"]),
  createServiceType
);

serviceRouter.post(
  "/",
  authorizeRoles(["ADMIN", "MANAGEMENT"]),
  createService
);

export default serviceRouter;