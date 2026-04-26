import { pgTable, uuid, varchar, text, timestamp, decimal, pgEnum, integer, boolean } from "drizzle-orm/pg-core";
import { patients, users } from "./patients-and-users.js";
import { doctors, services } from "./doctor-and-service.js";

export const txnTypeEnum = pgEnum("txn_type", ["SERVICE", "DOCTOR", "ROOM"]);

export const transactions = pgTable("transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  txnNo: varchar("txn_no", { length: 50 }).unique().notNull(), // i will use time for tnx number
  patientId: uuid("patient_id").references(() => patients.id).notNull(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  type: txnTypeEnum("type").notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// SUB-TRANSACTIONS
export const doctorTransactions = pgTable("doctor_transactions", {
  transactionId: uuid("transaction_id").primaryKey().references(() => transactions.id),
  doctorId: uuid("doctor_id").references(() => doctors.id).notNull(),
});

export const serviceTransactions = pgTable("service_transactions", {
  transactionId: uuid("transaction_id").primaryKey().references(() => transactions.id),
  serviceId: uuid("service_id").references(() => services.id).notNull(),
});

// remember the doctor and service transacation is not dijoint it is overlapping btw
