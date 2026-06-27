import { Router } from "express";
import {
  addDoctor,
  addDoctorTiming,
  deleteDoctorTiming,
  getAllDoctorsWithTimings,
  getDoctorStats,
  getAvailableDoctors
} from "../controllers/doctor.controller.js";
import verifyJwt from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/role-handler.middleware.js";

const doctorRouter: Router = Router();

// golabaly apply to all routes of doctor Router this act as firewall
doctorRouter.use(verifyJwt);

doctorRouter.get(
  "/stats",
  authorizeRoles(["ADMIN", "MANAGEMENT"]),
  getDoctorStats,
);

doctorRouter.get(
  "/",
  authorizeRoles(["ADMIN", "RECEPTIONIST", "OPD_OPERATOR", "MANAGEMENT"]),
  getAllDoctorsWithTimings,
);

doctorRouter.post("/", authorizeRoles(["ADMIN"]), addDoctor);

doctorRouter.post(
  "/:doctorId/timing",
  authorizeRoles(["ADMIN"]),
  addDoctorTiming,
);

doctorRouter.delete(
  "/timing/:doctorTimingId",
  authorizeRoles(["ADMIN"]),
  deleteDoctorTiming,
);

doctorRouter.get(
  "/available",
  getAvailableDoctors
)

export default doctorRouter;
