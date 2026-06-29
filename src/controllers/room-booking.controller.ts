import type { Response, NextFunction } from "express";
import type { AuthRequest } from "../types/types.js";
import { db } from "../db/db.js";
import { 
  invoices, 
  transactions, 
  serviceTransactions, 
  services, 
  serviceTypes, 
  doctorTransactions, 
  doctors, 
  rooms, 
  roomBooking 
} from "../db/schema/index.js";
import { eq, desc, like, and } from "drizzle-orm";
import ApiError from "../utils/api-error.js";
import ApiResponse from "../utils/api-response.js";

export const generateRoomBookingInvoice = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { patientId, roomId, admissionTime } = req.body;
    const userId = req.user?.id;

    if (!userId) throw new ApiError(401, "UNAUTHORIZED", "User is not authenticated.");
    if (!patientId || !roomId) {
      throw new ApiError(400, "BAD_REQUEST", "Patient ID and Room ID are required.");
    }

    const finalAdmissionTime = admissionTime ? new Date(admissionTime) : new Date();

    const result = await db.transaction(async (tx) => {
      // room verification
      const [room] = await tx.select().from(rooms).where(eq(rooms.id, roomId));
      
      if (!room) throw new ApiError(404, "NOT_FOUND", "Room not found.");
      if (!room.isActive) {
        throw new ApiError(400, "BAD_REQUEST", "This room is currently occupied or unavailable.");
      }

      // invoice generation
      const currentYear = new Date().getFullYear();
      const prefix = `INV-${currentYear}-`;
      const [lastInvoice] = await tx.select({ invoiceNo: invoices.invoiceNo })
        .from(invoices)
        .where(like(invoices.invoiceNo, `${prefix}%`))
        .orderBy(desc(invoices.invoiceNo))
        .limit(1);

      const seq = lastInvoice?.invoiceNo ? parseInt(lastInvoice.invoiceNo.split("-")[2] || "0", 10) + 1 : 1;
      const newInvoiceNo = `${prefix}${seq.toString().padStart(4, "0")}`;

      const [newInvoice] = await tx.insert(invoices).values({
        invoiceNo: newInvoiceNo,
        patientId,
        totalAmount: "0.00",
        discount: "0.00",
        payableAmount: "0.00",
        status: "DRAFT",
      }).returning();

      if (!newInvoice) throw new ApiError(500, "INTERNAL_SERVER_ERROR", "Failed to create admission invoice.");

      // room booking record
      const [newBooking] = await tx.insert(roomBooking).values({
        roomId,
        patientId,
        checkIn: finalAdmissionTime,
        status: "ACTIVE",
        userId: userId,
        invoiceId: newInvoice.id,
      }).returning();

      await tx.update(rooms)
        .set({ status: "OCCUPIED" })
        .where(eq(rooms.id, roomId));

      return {
        booking: newBooking,
        invoice: newInvoice,
        roomNumber: room.roomNumber
      };
    });

    return res.status(201).json(
      new ApiResponse(201, result, "Patient successfully admitted and room assigned.")
    );
  } catch (error) {
    next(error);
  }
};