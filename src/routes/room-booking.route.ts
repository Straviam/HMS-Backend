import { Router } from "express";
import { 
    generateRoomBookingInvoice,
    finalizeInvoiceAndDischarge,
    getActiveBookedRooms
} from "../controllers/room-booking.controller.js";
import verifyJwt from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/role-handler.middleware.js";

const roomBookingRouter: Router = Router();

roomBookingRouter.use(verifyJwt);

roomBookingRouter.post(
  "/generate",
  authorizeRoles(["ADMIN","RECEPTIONIST"]),
  generateRoomBookingInvoice,
);

roomBookingRouter.get(
  "/active",
  authorizeRoles(["ADMIN", "RECEPTIONIST"]),
  getActiveBookedRooms
);

roomBookingRouter.patch(
    "/:id/finalize", 
    authorizeRoles(["ADMIN", "RECEPTIONIST"]), 
    finalizeInvoiceAndDischarge
);

export default roomBookingRouter;