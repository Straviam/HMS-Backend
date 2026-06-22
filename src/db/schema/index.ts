import { doctors, doctorTimings, services, serviceTypes } from "./doctor-and-service.js";
import { relations } from "drizzle-orm";
import {
  doctorTransactions,
  roomTransactions,
  serviceTransactions,
  transactions,
} from "./transactions.js";
import { patients } from "./patients-and-users.js";
import { invoices, payments } from "./invoice-and-payment.js";
import { roomBooking, rooms } from "./rooms.js";

export * from "./test-user.js";
export * from "./patients-and-users.js";
export * from "./doctor-and-service.js";
export * from "./invoice-and-payment.js";
export * from "./rooms.js";
export * from "./transactions.js";

// TODO: May be we donot need to export these relation will handle it later

// this is simple relation a patients can have many invoice room booking and transactions
export const patientRelations = relations(patients, ({ many }) => ({
  invoices: many(invoices),
  roomBookings: many(roomBooking),
  transactions: many(transactions),
}));

export const invoiceRelations = relations(invoices, ({ one, many }) => ({
  patient: one(patients, {
    fields: [invoices.patientId],
    references: [patients.id],
  }),
  transactions: many(transactions),
  payments: many(payments),
}));

// here why i have to explicitly mention attribute cuz the forigen key is present in this entity set
export const paymentRelations = relations(payments, ({ one }) => ({
  invoice: one(invoices, {
    fields: [payments.invoiceId],
    references: [invoices.id],
  }),
}));

export const transactionRelations = relations(transactions, ({ one }) => ({
  invoice: one(invoices, {
    fields: [transactions.invoiceId],
    references: [invoices.id],
  }),

  // These are One-to-One relations to your sub-tables
  doctorDetails: one(doctorTransactions, {
    fields: [transactions.id],
    references: [doctorTransactions.transactionId],
  }),
  serviceDetails: one(serviceTransactions, {
    fields: [transactions.id],
    references: [serviceTransactions.transactionId],
  }),
  roomDetails: one(roomTransactions, {
    fields: [transactions.id],
    references: [roomTransactions.transactionId],
  }),
}));

export const doctorTransactionRelations = relations(
  doctorTransactions,
  ({ one }) => ({
    parentTransaction: one(transactions, {
      fields: [doctorTransactions.transactionId],
      references: [transactions.id],
    }),
    doctor: one(doctors, {
      fields: [doctorTransactions.doctorId],
      references: [doctors.id],
    }),
  }),
);

export const serviceTransactionRelations = relations(
  serviceTransactions,
  ({ one }) => ({
    parentTransaction: one(transactions, {
      fields: [serviceTransactions.transactionId],
      references: [transactions.id],
    }),
    service: one(services, {
      fields: [serviceTransactions.serviceId],
      references: [services.id],
    }),
  }),
);

export const roomTransactionRelations = relations(
  roomTransactions,
  ({ one }) => ({
    parentTransaction: one(transactions, {
      fields: [roomTransactions.transactionId],
      references: [transactions.id],
    }),
    room: one(rooms, {
      fields: [roomTransactions.roomId],
      references: [rooms.id],
    }),
  }),
);

export const roomBookingRelations = relations(roomBooking, ({ one }) => ({
  patient: one(patients, {
    fields: [roomBooking.patientId],
    references: [patients.id],
  }),
  room: one(rooms, {
    fields: [roomBooking.roomId],
    references: [rooms.id],
  }),
}));

export const doctorRelations = relations(doctors, ({ many }) => ({
  timings: many(doctorTimings), // From your earlier doctor module
  transactions: many(doctorTransactions),
}));

export const roomRelations = relations(rooms, ({ many }) => ({
  bookings: many(roomBooking),
  transactions: many(roomTransactions),
}));

export const serviceTypeRelations = relations(serviceTypes, ({ many }) => ({
  services: many(services),
}));

export const serviceRelations = relations(services, ({ one, many }) => ({
  serviceType: one(serviceTypes, {
    fields: [services.serviceTypeId],
    references: [serviceTypes.id],
  }),
  transactions: many(serviceTransactions),
}));

export const doctorTimingsRelations = relations(doctorTimings, ({ one }) => ({
  doctor: one(doctors, {
    fields: [doctorTimings.doctorId],
    references: [doctors.id],
  }),
}));
