import express, {
  type Request,
  type Response,
  type Application,
} from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { db } from "./db/db.js";
import { testUsersTable } from "./db/schema/test-user.js";
import { errorHandler } from "./middlewares/error.middleware.js";
import userRouter from "./routes/user.router.js";
import doctorRouter from "./routes/doctor.route.js";
import patientRouter from "./routes/patient.router.js";
import serviceRouter from "./routes/service.router.js";
import roomRouter from "./routes/room.router.js";
import invoiceRouter from "./routes/invoice.router.js";
import roomBookingRouter from "./routes/room-booking.route.js";

const corsOptions = {
  origin: ["http://localhost:5173", "*"],
  methods: ["Get", "POST", "PUT", "DELETE", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true, // for cookies
};
const app: Application = express();

app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(cookieParser());
app.use(cors(corsOptions));

app.use("/api/v1/users", userRouter);
app.use("/api/v1/doctors", doctorRouter);
app.use("/api/v1/patients", patientRouter);
app.use("/api/v1/services", serviceRouter);
app.use("/api/v1/rooms", roomRouter);
app.use("/api/v1/invoices", invoiceRouter);
app.use("/api/v1/roomBooking", roomBookingRouter);


app.get("/healthz", async (_: Request, res: Response) => {
  const testUser = await db.select().from(testUsersTable);

  const healthData = {
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    db_status: testUser ? "db is up" : "db is down",
  };

  return res.status(200).json(healthData);
});

app.use(errorHandler);

export default app;
