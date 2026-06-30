import type { Request, Response, NextFunction } from "express";
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
  roomBooking,
  roomTransactions,
  patients
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

export const finalizeInvoiceAndDischarge = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const invoiceId = req.params.id as string;
    const userId = req.user?.id;

    if (!userId) throw new ApiError(401, "UNAUTHORIZED", "User is not authenticated.");
    if (!invoiceId) throw new ApiError(400, "BAD_REQUEST", "Invoice ID is required.");

    const result = await db.transaction(async (tx) => {
      // verification
      const [invoice] = await tx.select().from(invoices).where(eq(invoices.id, invoiceId));
      
      if (!invoice) throw new ApiError(404, "NOT_FOUND", "Invoice not found.");
      if (invoice.status !== "DRAFT") {
        throw new ApiError(400, "BAD_REQUEST", `Invoice cannot be processed because it is already ${invoice.status}.`);
      }

      // 2. FETCH THE ACTIVE ROOM BOOKING TIED TO THIS INVOICE
      const [booking] = await tx.select().from(roomBooking).where(
        and(
          eq(roomBooking.invoiceId, invoiceId),
          eq(roomBooking.status, "ACTIVE")
        )
      );

      if (!booking) {
        throw new ApiError(404, "NOT_FOUND", "No active room booking found for this invoice. Patient may already be discharged.");
      }

      const [room] = await tx.select().from(rooms).where(eq(rooms.id, booking.roomId));
      if (!room) throw new ApiError(500, "INTERNAL_SERVER_ERROR", "Corrupted system data: Room not found.");

      // room pricing
      const checkOutTime = new Date();
      const checkInTime = new Date(booking.checkIn);
      
      const durationMs = checkOutTime.getTime() - checkInTime.getTime();
      const daysStayed = Math.ceil(durationMs / (1000 * 60 * 60 * 24)); 
      const billableDays = Math.max(1, daysStayed); // charges min 1 day
      const roomTotalCost = billableDays * parseFloat(room.price as string);

      // room transaction
      const txnNo = `TXN-${new Date().getTime().toString().slice(-6)}-RM`;
      const [newTxn] = await tx.insert(transactions).values({
        txnNo,
        patientId: booking.patientId,
        userId,
        invoiceId: invoice.id,
        type: "ROOM", 
        amount: roomTotalCost.toString(),
      }).returning();

      if (!newTxn) throw new ApiError(500, "INTERNAL_SERVER_ERROR", "Failed to create transaction")

      await tx.insert(roomTransactions).values({
        transactionId: newTxn.id,
        roomId: room.id
      });

      // update invoice
      const currentSubtotal = parseFloat(invoice.totalAmount as string);
      const updatedTotal = currentSubtotal + roomTotalCost;
      const runningDiscount = parseFloat(invoice.discount || "0");
      const updatedPayable = updatedTotal - runningDiscount;

      const [updatedInvoice] = await tx.update(invoices)
        .set({ 
          totalAmount: updatedTotal.toString(),
          payableAmount: updatedPayable.toString(),
          status: "ISSUED" 
        })
        .where(eq(invoices.id, invoice.id))
        .returning();

      // update room booking & room
      await tx.update(roomBooking)
        .set({ 
          checkOut: checkOutTime,
          status: "DISCHARGED" 
        })
        .where(eq(roomBooking.id, booking.id));

      await tx.update(rooms)
        .set({ status: "AVAILABLE" })
        .where(eq(rooms.id, room.id));

      // final reciept building
      const rawItems = await tx.select({
        transaction: transactions,
        service: services,
        serviceType: serviceTypes,
        doctor: doctors
      })
      .from(transactions)
      .leftJoin(serviceTransactions, eq(transactions.id, serviceTransactions.transactionId))
      .leftJoin(services, eq(serviceTransactions.serviceId, services.id))
      .leftJoin(serviceTypes, eq(services.serviceTypeId, serviceTypes.id))
      .leftJoin(doctorTransactions, eq(transactions.id, doctorTransactions.transactionId))
      .leftJoin(doctors, eq(doctorTransactions.doctorId, doctors.id))
      .where(eq(transactions.invoiceId, invoice.id));

      const receiptsMap = new Map<string, any>();

      for (const row of rawItems) {
        const itemCost = parseFloat(row.transaction.amount as string);

        if (row.transaction.type === "ROOM") {
          if (!receiptsMap.has("ROOM_ACCOMMODATION")) {
            receiptsMap.set("ROOM_ACCOMMODATION", {
              serviceTypeName: "Room Accommodation",
              isQueuingEnabled: false,
              subTotal: 0,
              items: []
            });
          }
          const roomGroup = receiptsMap.get("ROOM_ACCOMMODATION")!;
          roomGroup.items.push({
            txnNo: row.transaction.txnNo,
            type: row.transaction.type,
            itemName: `${room.roomType} - Room #${room.roomNumber} (${billableDays} Day${billableDays > 1 ? "s" : ""})`,
            price: itemCost
          });
          roomGroup.subTotal += itemCost;
          continue; 
        }

        if (!row.serviceType || !row.service) continue;

        if (!receiptsMap.has(row.serviceType.id)) {
          receiptsMap.set(row.serviceType.id, {
            serviceTypeName: row.serviceType.name,
            isQueuingEnabled: row.serviceType.isQueuingEnabled,
            subTotal: 0,
            items: []
          });
        }

        const receiptGroup = receiptsMap.get(row.serviceType.id)!;
        
        let itemName = row.service.serviceName;
        if (row.doctor) {
          itemName += ` (${row.doctor.doctorName})`;
        }

        receiptGroup.items.push({
          txnNo: row.transaction.txnNo,
          type: row.transaction.type,
          itemName: itemName,
          price: itemCost
        });

        receiptGroup.subTotal += itemCost;
      }

      return {
        invoice: updatedInvoice,
        receipts: Array.from(receiptsMap.values())
      };
    });

    return res.status(200).json(new ApiResponse(200, result, "Patient discharged successfully and final structured bill issued."));
  } catch (error) { 
    next(error); 
  }
};

export const getActiveBookedRooms = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {

    const activeRooms = await db.select({
      booking: roomBooking,
      room: rooms,
      patient: patients,
    })
    .from(roomBooking)
    .innerJoin(rooms, eq(roomBooking.roomId, rooms.id))
    .innerJoin(patients, eq(roomBooking.patientId, patients.id))
    .where(eq(roomBooking.status, "ACTIVE"))
    .orderBy(desc(roomBooking.checkIn));

    return res.status(200).json(
      new ApiResponse(200, activeRooms, "Active booked rooms retrieved successfully")
    );
  } catch (error) {
    next(error);
  }
};