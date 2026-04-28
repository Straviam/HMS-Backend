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

const corsOptions = {
  origin: ["http://localhost:3000", "*"],
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
