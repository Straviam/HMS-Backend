import type { users } from "../db/schema/patients-and-users.js";

export type User = typeof users.$inferSelect;
export type safeUser = Omit<User, "passwordHash">;
export type UserLoginResponse = {
  userName: string;
  email: string;
  accessToken: string;
  role: string;
};
