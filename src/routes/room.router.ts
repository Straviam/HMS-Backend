        import { Router } from "express";
import {
  addRoom,
  getActiveRooms,
  getAllRooms,
  updateRoom,
  decommissionRoom
} from "../controllers/room.controller.js";
import verifyJwt from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/role-handler.middleware.js";

const roomRouter: Router = Router();

roomRouter.use(verifyJwt);

roomRouter.get(
  "/active",
  authorizeRoles(["ADMIN", "MANAGEMENT", "RECEPTIONIST", "OPD_OPERATOR"]),
  getActiveRooms
);

roomRouter.get(
  "/all",
  authorizeRoles(["ADMIN", "MANAGEMENT"]),
  getAllRooms
);

roomRouter.post(
  "/",
  authorizeRoles(["ADMIN", "MANAGEMENT"]),
  addRoom
);

roomRouter.patch(
  "/:id",
  authorizeRoles(["ADMIN", "MANAGEMENT"]),
  updateRoom
);

roomRouter.delete(
  "/:id",
  authorizeRoles(["ADMIN", "MANAGEMENT"]),
  decommissionRoom
);

export default roomRouter;