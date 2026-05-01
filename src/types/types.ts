import type { users } from "../db/schema/patients-and-users.js";
import type { Request } from "express";
import jwt from "jsonwebtoken";

export type User = typeof users.$inferSelect;
export type SafeUser = Omit<User, "passwordHash">;
export type UserLoginResponse = {
  userName: string;
  email: string;
  accessToken: string;
  role: string;
};

export interface CustomJwtPayload extends jwt.JwtPayload {
  data: {
    userId: string;
    role: string;
  };
}

export interface AuthRequest extends Request {
  user?: SafeUser;
}
