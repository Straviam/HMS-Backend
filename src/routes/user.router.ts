import { Router } from "express";
import {
  loginUser,
  logoutUser,
  registerUser,
} from "../controllers/user.controller.js";

const userRouter: Router = Router();

userRouter.post("/registerUser", registerUser);
userRouter.get("/login", loginUser);
userRouter.get("/logout", logoutUser);

export default userRouter;
