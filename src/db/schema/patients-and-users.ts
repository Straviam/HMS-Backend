import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("user_role", [
  "ADMIN",
  "DOCTOR",
  "RECEPTIONIST",
  "OPD_OPERATOR",
  "MANAGEMENT",
  "ACCOUNTANT",
]);
export const genderEnum = pgEnum("gender", ["MALE", "FEMALE", "OTHER"]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  userName: varchar("full_name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).unique().notNull(),
  passwordHash: text("password_hash").notNull(),
  role: roleEnum("role").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const patients = pgTable("patients", {
  id: uuid("id").primaryKey().defaultRandom(),
  mrNumber: varchar("mr_number", { length: 50 }).unique().notNull(), // e.g., MR-2026-0001
  firstName: varchar("first_name", { length: 100 }).notNull(),
  lastName: varchar("last_name", { length: 100 }).notNull(),
  cnic: varchar("cnic", { length: 20 }).unique(),
  gender: genderEnum("gender").notNull(),
  dateOfBirth: timestamp("date_of_birth").notNull(),
  phone: varchar("phone", { length: 20 }).notNull(),
  bloodGroup: varchar("blood_group", { length: 5 }),
  address: text("address"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
