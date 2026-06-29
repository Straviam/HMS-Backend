import { Router } from "express";
import {
  addRoom,
  getActiveRooms,
  getAllRooms,
  updateRoom,
  decommissionRoom,
  getRoomStats,
  applyGlobalMultiplier,
  bulkUpdateRoomRates
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
  "/",
  authorizeRoles(["ADMIN", "MANAGEMENT", "RECEPTIONIST"]),
  getAllRooms
);

roomRouter.post(
  "/",
  authorizeRoles(["ADMIN", "MANAGEMENT", "RECEPTIONIST"]),
  addRoom
);

roomRouter.patch(
  "/:id",
  authorizeRoles(["ADMIN", "MANAGEMENT", "RECEPTIONIST"]),
  updateRoom
);

roomRouter.delete(
  "/:id",
  authorizeRoles(["ADMIN", "MANAGEMENT", "RECEPTIONIST"]),
  decommissionRoom
);

roomRouter.get(
  "/stats",
  authorizeRoles(["ADMIN", "MANAGEMENT", "RECEPTIONIST"]),
  getRoomStats
)

roomRouter.patch(
  "/pricing/bulk-multiplier",
  authorizeRoles(["ADMIN", "MANAGMENT", "RECEPTIONIST"]),
  applyGlobalMultiplier
);

roomRouter.put(
  "/pricing/bulk-override",
  authorizeRoles(["ADMIN", "MANAGMENT", "RECEPTIONIST"]),
  bulkUpdateRoomRates
);

export default roomRouter;
