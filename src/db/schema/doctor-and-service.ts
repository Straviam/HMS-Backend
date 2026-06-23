import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  decimal,
  pgEnum,
  integer,
  boolean,
  time,
} from "drizzle-orm/pg-core";

export const doctorInvolvementEnum = pgEnum("doctor_involvement", [
  "YES",
  "NO",
  "PARTIAL",
]); // partial is for just showing name on slip
export const dayEnum = pgEnum("day_of_week", [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
]);

export const doctors = pgTable("doctors", {
  id: uuid("id").primaryKey().defaultRandom(),
  specialization: varchar("specialization", { length: 100 }),
  doctorName: varchar("doctor_name", { length: 100 }),
  isAvailable: boolean("is_available").default(true),
});

export const doctorTimings = pgTable("doctor_timings", {
  id: uuid("id").primaryKey().defaultRandom(),
  doctorId: uuid("doctor_id")
    .references(() => doctors.id)
    .notNull(),
  day: dayEnum("day").notNull(),
  startTime: time("start_time").notNull(),
  endTime: time("end_time").notNull(),
  avgConsultationTime: integer("avg_consultation_time").default(15), // in minutes
  maxTokens: integer("max_tokens").default(20),
  consultationFee: decimal("consultation_fee", {
    precision: 10,
    scale: 2,
  }).notNull(),
  isActive: boolean("is_active").default(true),
});

export const serviceTypes = pgTable("service_types", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 100 }).unique().notNull(),
  isQueuingEnabled: boolean("is_queuing_enabled").default(false).notNull(),
  doctorInvolvement: doctorInvolvementEnum("doctor_involvement")
    .default("NO")
    .notNull(),
  iconKey: varchar("icon_key", { length: 100 }),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const services = pgTable("services", {
  id: uuid("id").primaryKey().defaultRandom(),
  serviceTypeId: uuid("service_type_id")
    .references(() => serviceTypes.id)
    .notNull(),
  serviceName: varchar("service_name", { length: 255 }).notNull(), // e.g., "Chest X-Ray", "Blood Sugar"
  systemCode: varchar("system_code", { length: 100 }),
  isActive: boolean("is_active").default(true),
  basePrice: decimal("base_price", { precision: 10, scale: 2 }).notNull(),
});

// TODO: Add the specialization in a seperate table and also attached this to is_doctor_involve in some way
