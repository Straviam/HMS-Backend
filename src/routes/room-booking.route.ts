import { Router } from "express";
import { 
    generateRoomBookingInvoice,
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

export default roomBookingRouter;