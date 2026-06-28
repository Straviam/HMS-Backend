import {
  decimal,
  pgEnum,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { patients } from "./patients-and-users.js";

export const paymentMethod = pgEnum("payment_status_enum", [
  "CARD",
  "CASH",
  "BANK_TRANSFER",
]);

export const paymentStatusEnum = pgEnum("payment_status_enum", [
  "DRAFT",  
  "ISSUED", 
  "PAID",   
]);

export const invoices = pgTable("invoices", {
  id: uuid("id").primaryKey().defaultRandom(),
  invoiceNo: varchar("invoice_no", { length: 50 }).unique().notNull(),
  patientId: uuid("patient_id")
    .references(() => patients.id)
    .notNull(),
  totalAmount: decimal("total_amount", { precision: 12, scale: 2 })
    .default("0.00")
    .notNull(),
  discount: decimal("discount", { precision: 12, scale: 2 }).default("0.00"),
  payableAmount: decimal("payable_amount", {
    precision: 12,
    scale: 2,
  }).notNull(), // Amount after discount
  status: paymentStatusEnum("status").default("DRAFT").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const payments = pgTable("payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  invoiceId: uuid("invoice_id")
    .references(() => invoices.id)
    .notNull(),
  amountPaid: decimal("amount_paid", { precision: 12, scale: 2 }).notNull(),
  paymentMethod: varchar("payment_method", { length: 50 }).notNull(), // Cash, Card, Bank Transfer
  referenceNo: varchar("reference_no", { length: 100 }), // Receipt or Cheque No
  paidAt: timestamp("paid_at").defaultNow().notNull(),
});

// TODO: invoice and payement is not decided and also queue
