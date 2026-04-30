import { doctors, doctorTimings } from "./doctor-and-service.js";
import { relations } from "drizzle-orm";

export * from "./test-user.js";
export * from "./patients-and-users.js";
export * from "./doctor-and-service.js"

export const doctorsRelations = relations(doctors, ({ many }) => ({
  timings: many(doctorTimings),
}));

export const doctorTimingsRelations = relations(doctorTimings, ({ one }) => ({
  doctor: one(doctors, {
    fields: [doctorTimings.doctorId],
    references: [doctors.id],
  }),
}));
