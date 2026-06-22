import { Router } from "express";
import {
  createServiceType,
  createService,
  getServicesByServiceType,
  getAllServiceTypes,
  updateServiceType,
  updateService,
  searchServices
} from "../controllers/service.controller.js";
import verifyJwt from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/role-handler.middleware.js";

const serviceRouter: Router = Router();

serviceRouter.use(verifyJwt);

serviceRouter.get(
  "/search",
  authorizeRoles(["ADMIN", "MANAGEMENT", "RECEPTIONIST"]),
  searchServices
);

serviceRouter.get(
  "/types",
  authorizeRoles(["ADMIN", "MANAGEMENT", "RECEPTIONIST"]),
  getAllServiceTypes
);

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

serviceRouter.patch(
  "/types/:id",
  authorizeRoles(["ADMIN", "MANAGEMENT"]),
  updateServiceType
);

serviceRouter.patch(
  "/:id",
  authorizeRoles(["ADMIN", "MANAGEMENT"]),
  updateService
);

export default serviceRouter;