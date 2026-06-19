import type { Request, Response, NextFunction } from "express";
import { db } from "../db/db.js";
import {
  transactions,
  patients,
  doctorTransactions,
  doctors,
  serviceTransactions,
  services,
  roomTransactions,
  rooms,
  users,
  invoices,
} from "../db/schema/index.js";
import { eq, count, or, ilike, desc, sql, gte, sum } from "drizzle-orm";
import ApiResponse from "../utils/api-response.js";
import ApiError from "../utils/api-error.js";

export const getTransactions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = (req.query.search as string) || "";
    const offset = (page - 1) * limit;

    let whereCondition = undefined;
    if (search.trim() !== "") {
      const searchPattern = `%${search.trim()}%`;
      whereCondition = or(
        ilike(transactions.txnNo, searchPattern),
        ilike(patients.firstName, searchPattern),
        ilike(patients.lastName, searchPattern)
      );
    }

    const rawData = await db
      .select({
        id: transactions.id,
        txnNo: transactions.txnNo,
        type: transactions.type,
        amount: transactions.amount,
        date: transactions.createdAt,
        patientFirstName: patients.firstName,
        patientLastName: patients.lastName,
        doctorName: doctors.doctorName,
        serviceName: services.serviceName,
        roomNumber: rooms.roomNumber,
      })
      .from(transactions)
      .innerJoin(patients, eq(transactions.patientId, patients.id))
      .leftJoin(doctorTransactions, eq(transactions.id, doctorTransactions.transactionId))
      .leftJoin(doctors, eq(doctorTransactions.doctorId, doctors.id))
      .leftJoin(serviceTransactions, eq(transactions.id, serviceTransactions.transactionId))
      .leftJoin(services, eq(serviceTransactions.serviceId, services.id))
      .leftJoin(roomTransactions, eq(transactions.id, roomTransactions.transactionId))
      .leftJoin(rooms, eq(roomTransactions.roomId, rooms.id))
      .where(whereCondition)
      .limit(limit)
      .offset(offset)
      .orderBy(desc(transactions.createdAt));

    // Map the raw SQL joins into your exact Frontend shape
    const formattedTransactions = rawData.map((row) => {
      let detail = "Unknown";
      if (row.type === "DOCTOR") detail = `Dr. ${row.doctorName}`;
      if (row.type === "SERVICE") detail = row.serviceName || "Service";
      if (row.type === "ROOM") detail = `Room ${row.roomNumber}`;

      return {
        id: row.id,
        txnNo: row.txnNo,
        patientName: `${row.patientFirstName} ${row.patientLastName}`,
        type: row.type,
        detail,
        amount: Number(row.amount),
        date: row.date,
      };
    });

    // pagination meta data
    const [countResult] = await db
      .select({ val: count() })
      .from(transactions)
      .innerJoin(patients, eq(transactions.patientId, patients.id)) // Must join patient if searching by name
      .where(whereCondition);

    if (!countResult) {
      throw new Error("Failed to fetched totalCount of transactions")
    }
    const totalCount = Number(countResult.val);
    const totalPages = Math.ceil(totalCount / limit);

    const payload = {
      transactions: formattedTransactions,
      pagination: {
        page,
        totalPages,
        totalCount,
      },
    };

    return res.status(200).json(new ApiResponse(200, payload, "Transactions fetched"));
  } catch (error) {
    next(error);
  }
};

export const getTransactionStats = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    // This executes: SELECT type, SUM(amount) FROM transactions WHERE created_at >= startOfToday GROUP BY type;
    const revenueData = await db
      .select({
        type: transactions.type,
        totalRevenue: sum(transactions.amount),
      })
      .from(transactions)
      .where(gte(transactions.createdAt, startOfToday))
      .groupBy(transactions.type);

    const stats = {
      totalToday: 0,
      serviceRev: 0,
      doctorRev: 0,
      roomRev: 0,
    };

    revenueData.forEach((row) => {
      const val = Number(row.totalRevenue || 0);

      stats.totalToday += val;

      if (row.type === "SERVICE") stats.serviceRev += val;
      if (row.type === "DOCTOR") stats.doctorRev += val;
      if (row.type === "ROOM") stats.roomRev += val;
    });

    return res.status(200).json(new ApiResponse(200, stats, "Stats fetched"));
  } catch (error) {
    next(error);
  }
};


export const getTransactionAudit = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    if (!id) {
      throw new ApiError(400, "BAD_REQUEST", "Transaction ID is required");
    }

    const [rawTxn] = await db
      .select({
        id: transactions.id,
        txnNo: transactions.txnNo,
        type: transactions.type,
        amount: transactions.amount,
        createdAt: transactions.createdAt,

        operatorName: users.userName,
        operatorRole: users.role,
        patientFirstName: patients.firstName,
        patientLastName: patients.lastName,
        mrNumber: patients.mrNumber,
        invoiceNo: invoices.invoiceNo,

        // Polymorphic Data as only ONE of these blocks will have data, the rest will be null
        doctorName: doctors.doctorName,
        doctorId: doctors.id,

        serviceName: services.serviceName,
        serviceId: services.id,

        roomNumber: rooms.roomNumber,
        roomId: rooms.id,
      })
      .from(transactions)
      .innerJoin(patients, eq(transactions.patientId, patients.id))
      .innerJoin(invoices, eq(transactions.invoiceId, invoices.id))
      .innerJoin(users, eq(transactions.userId, users.id))
      .leftJoin(doctorTransactions, eq(transactions.id, doctorTransactions.transactionId))
      .leftJoin(doctors, eq(doctorTransactions.doctorId, doctors.id))
      .leftJoin(serviceTransactions, eq(transactions.id, serviceTransactions.transactionId))
      .leftJoin(services, eq(serviceTransactions.serviceId, services.id))
      .leftJoin(roomTransactions, eq(transactions.id, roomTransactions.transactionId))
      .leftJoin(rooms, eq(roomTransactions.roomId, rooms.id))
      .where(eq(transactions.id, id as string));

    if (!rawTxn) {
      throw new ApiError(404, "NOT_FOUND", "Transaction not found");
    }

    // Flatten the polymorphic left-joins into the exact fields the frontend expects
    let resolvedDetail = "Unknown Entity";
    let resolvedEntityId = "unknown";

    if (rawTxn.type === "DOCTOR" && rawTxn.doctorId) {
      resolvedDetail = `Dr. ${rawTxn.doctorName} (Consult)`;
      resolvedEntityId = rawTxn.doctorId;
    } else if (rawTxn.type === "SERVICE" && rawTxn.serviceId) {
      resolvedDetail = rawTxn.serviceName || "Service";
      resolvedEntityId = rawTxn.serviceId;
    } else if (rawTxn.type === "ROOM" && rawTxn.roomId) {
      resolvedDetail = `Room ${rawTxn.roomNumber} (Stay)`;
      resolvedEntityId = rawTxn.roomId;
    }

    // Format to match frontend exactly
    const auditData = {
      id: rawTxn.id,
      txnNo: rawTxn.txnNo,
      type: rawTxn.type,
      amount: Number(rawTxn.amount),
      createdAt: rawTxn.createdAt,
      operatorName: `${rawTxn.operatorName} (${rawTxn.operatorRole})`,
      patientName: `${rawTxn.patientFirstName} ${rawTxn.patientLastName}`,
      mrNumber: rawTxn.mrNumber,
      invoiceNo: rawTxn.invoiceNo,
      resolvedDetail,
      resolvedEntityId,
    };

    return res.status(200).json(new ApiResponse(200, auditData, "Audit data fetched successfully"));
  } catch (error) {
    next(error);
  }
};


// TODO: we have to make the error handling whenever there is error for most of the place we have to use ApiError instance
