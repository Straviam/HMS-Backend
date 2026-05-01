import type { Request, Response, NextFunction } from "express";
import ApiError from "../utils/api-error.js";
import jwt from "jsonwebtoken";
import { db } from "../db/db.js";
import { users } from "../db/schema/patients-and-users.js";
import { eq } from "drizzle-orm";
import type { AuthRequest, CustomJwtPayload } from "../types/types.js";

const SECRET = process.env.SECRET as string;

const verifyJwt = async (req: AuthRequest, _: Response, next: NextFunction) => {
  try {
    const authHeader = req.header("Authorization");
    const token =
      req.cookies?.accessToken || authHeader?.replace("Bearer ", "");

    if (!token) {
      return next(
        new ApiError(401, "UNAUTHORIZED", "Unauthorized: No token provided"),
      );
    }

    const decodedToken = jwt.verify(token, SECRET) as CustomJwtPayload;
    console.log(token);
    console.log(decodedToken);

    if (!decodedToken?.data.userId) {
      return next(new ApiError(401, "UNAUTHORIZED", "Invalid token payload"));
    }

    const userId = decodedToken.data.userId;

    const [foundUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!foundUser) {
      return next(new ApiError(401, "UNAUTHORIZED", "User no longer exists"));
    }

    const { passwordHash, ...safeUser } = foundUser;
    req.user = safeUser;

    next();
  } catch (error) {
    console.log(error);
    return next(new ApiError(401, "UNAUTHORIZED", "invalid or expire token"));
  }
};

export default verifyJwt;
