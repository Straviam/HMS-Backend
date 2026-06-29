import { Router } from "express";
import {
  createPatient,
  getPatients,
  getPatientStats,
  getPatientTimeline,
  updatePatient,
} from "../controllers/patient.controller.js";
import verifyJwt from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/role-handler.middleware.js";

const patientRouter: Router = Router();

patientRouter.use(verifyJwt);

patientRouter.get(
  "/stats",
  authorizeRoles(["ADMIN", "MANAGMENT"]),
  getPatientStats,
);

patientRouter.get(
  "/",
  authorizeRoles([
    "ADMIN",
    "RECEPTIONIST",
    "OPD_OPERATOR",
    "MANAGMENT",
    "DOCTOR",
  ]),
  getPatients,
);

patientRouter.post(
  "/",
  authorizeRoles(["ADMIN", "RECEPTIONIST", "OPD_OPERATOR"]),
  createPatient,
);

patientRouter.get(
  "/:id/timeline",
  authorizeRoles(["ADMIN"]),
  getPatientTimeline,
);

patientRouter.patch(
  "/:id",
  authorizeRoles(["ADMIN", "RECEPTIONIST", "OPD_OPERATOR"]),
  updatePatient
)

export default patientRouter;
