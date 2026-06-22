import {
  decimal,
  pgEnum,
  pgTable,
  timestamp,
  uuid,
  boolean,
  varchar,
} from "drizzle-orm/pg-core";
import { roomTransactions } from "./transactions.js";
import { patients } from "./patients-and-users.js";

export const roomStatusEnum = pgEnum("room_status", [
  "AVAILABLE",
  "OCCUPIED",
  "UNDER_MAINTENANCE",
  "CLEANING",
]);

export const rooms = pgTable("rooms", {
  id: uuid("id").primaryKey().defaultRandom(),
  roomNumber: varchar("room_number", { length: 20 }).unique().notNull(),
  roomType: varchar("room_type", { length: 50 }).notNull(),
  pricePerHour: decimal("price_per_day", { precision: 10, scale: 2 }).notNull(),
  status: roomStatusEnum("status").default("AVAILABLE").notNull(),
  lastCleanedAt: timestamp("last_cleaned_at"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const roomBooking = pgTable("room_booking", {
  id: uuid("id").primaryKey().defaultRandom(),
  // transactionId: uuid("transaction_id")
  //  .references(() => roomTransactions.transactionId)
  // .notNull(), // i think this could be null is put in trnsation only when check out
  roomId: uuid("room_id")
    .references(() => rooms.id)
    .notNull(),
  patientId: uuid("patient_id")
    .references(() => patients.id)
    .notNull(),

  checkIn: timestamp("check_in").defaultNow().notNull(),
  checkOut: timestamp("check_out"), // Null until the patient is discharged

  status: varchar("status", { length: 20 }).default("ACTIVE"),
});
// NOTE:  it seems like room transactions and room booking are same room but they are not room booking keep track of everything it get added on transaction only when checkout
