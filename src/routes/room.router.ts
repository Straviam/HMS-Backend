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

roomRouter.get(
  "/stats",
  authorizeRoles(["ADMIN", "MANAGEMENT"]),
  getRoomStats
)

roomRouter.patch(
  "/pricing/bulk-multiplier",
  authorizeRoles(["ADMIN", "MANAGMENT"]),
  applyGlobalMultiplier
);

roomRouter.put(
  "/pricing/bulk-override",
  authorizeRoles(["ADMIN", "MANAGMENT"]),
  bulkUpdateRoomRates
);

export default roomRouter;
