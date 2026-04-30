import { Router } from "express";
import {
  loginUser,
  logoutUser,
  registerUser,
} from "../controllers/user.controller.js";
import verifyJwt from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/role-handler.middleware.js";

const userRouter: Router = Router();

userRouter.post("/registerUser", verifyJwt, authorizeRoles(["ADMIN"]), registerUser);
userRouter.post("/login", loginUser);
userRouter.get("/logout", verifyJwt, logoutUser);

export default userRouter;
