import type { Request, Response, NextFunction } from "express";
import { db } from "../db/db.js";
import { invoices, transactions, serviceTransactions, doctorTransactions, services, doctorTimings, serviceTypes } from "../db/schema/index.js";
import { eq, desc, like } from "drizzle-orm";
import ApiError from "../utils/api-error.js";
import ApiResponse from "../utils/api-response.js";
import type { AuthRequest } from "../types/types.js";

export const generateReceptionInvoice = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { patientId, discount, items } = req.body;
    const userId = req.user?.id; 

    if (!userId) {
      throw new ApiError(401, "UNAUTHORIZED", "User is not authenticated.");
    }

    if (!patientId || !items || items.length === 0) {
      throw new ApiError(400, "BAD_REQUEST", "Patient ID and items are required.");
    }

    const generationResult = await db.transaction(async (tx) => {
      let calculatedTotal = 0;
      const processedItems: any[] = [];
      const receiptsMap = new Map<string, { serviceTypeName: string, isQueuingEnabled: boolean, items: any[], totalAmount: number }>();

      // pricing & reciept building
      for (const item of items) {
        let itemTotalCost = 0;
        let itemName = "";

        const [serviceTypeInfo] = await tx.select().from(serviceTypes).where(eq(serviceTypes.id, item.serviceTypeId));
        if (!serviceTypeInfo) throw new ApiError(404, "NOT_FOUND", "Invalid Service Type ID.");

        const [serviceData] = await tx.select().from(services).where(eq(services.id, item.serviceId));
        if (!serviceData) throw new ApiError(404, "NOT_FOUND", `Service not found.`);
        
        itemTotalCost += parseFloat(serviceData.basePrice as string);
        itemName = serviceData.serviceName;

        if (item.doctorId && item.timingId) {
          const [timingData] = await tx.select().from(doctorTimings).where(eq(doctorTimings.id, item.timingId));
          if (!timingData) throw new ApiError(404, "NOT_FOUND", `Doctor timing not found.`);
          itemTotalCost += parseFloat(timingData.consultationFee as string);
          itemName = `${serviceData.serviceName} (with Doctor)`; 
        }

        calculatedTotal += itemTotalCost;
        const processedItem = { ...item, price: itemTotalCost, itemName };
        processedItems.push(processedItem);

        if (!receiptsMap.has(serviceTypeInfo.id)) {
          receiptsMap.set(serviceTypeInfo.id, {
            serviceTypeName: serviceTypeInfo.name,
            isQueuingEnabled: serviceTypeInfo.isQueuingEnabled,
            items: [],
            totalAmount: 0
          });
        }
        const receiptGroup = receiptsMap.get(serviceTypeInfo.id)!;
        receiptGroup.items.push(processedItem);
        receiptGroup.totalAmount += itemTotalCost;
      }

      const payableAmount = calculatedTotal - (discount || 0);

      // inv-no generation
      const currentYear = new Date().getFullYear();
      const prefix = `INV-${currentYear}-`;
      const [lastInvoice] = await tx.select({ invoiceNo: invoices.invoiceNo })
        .from(invoices)
        .where(like(invoices.invoiceNo, `${prefix}%`))
        .orderBy(desc(invoices.invoiceNo))
        .limit(1);

      let seq = 1;
      if (lastInvoice && lastInvoice.invoiceNo) {
        seq = parseInt(lastInvoice.invoiceNo.split("-")[2] as string, 10) + 1;
      }
      const newInvoiceNo = `${prefix}${seq.toString().padStart(4, "0")}`;

      // adding invoice 
      const [newInvoice] = await tx.insert(invoices).values({
        invoiceNo: newInvoiceNo,
        patientId,
        totalAmount: calculatedTotal.toString(),
        discount: (discount || 0).toString(),
        payableAmount: payableAmount.toString(),
        status: "ISSUED", // for now issued, then we can prompt the payment procedure
      }).returning();

      if (!newInvoice) {
        throw new ApiError(500, "INTERNAL_SERVER_ERROR", "Failed to create invoice record.");
      }

      // adding to trasaction table
      let txnCounter = 1;
      for (const item of processedItems) {
        const txnNo = `TXN-${new Date().getTime().toString().slice(-6)}-${txnCounter++}`;
        const txnType = item.doctorId ? "DOCTOR" : "SERVICE";

        const [newTxn] = await tx.insert(transactions).values({
          txnNo,
          patientId,
          userId, 
          invoiceId: newInvoice.id,
          type: txnType,
          amount: item.price.toString(),
        }).returning();

        if (!newTxn) {
        throw new ApiError(500, "INTERNAL_SERVER_ERROR", "Failed to create Transaction record.");
        }

        await tx.insert(serviceTransactions).values({
          transactionId: newTxn.id,
          serviceId: item.serviceId,
        });

        if (item.doctorId) {
          await tx.insert(doctorTransactions).values({
            transactionId: newTxn.id,
            doctorId: item.doctorId,
          });
        }
      }

      return {
        invoice: newInvoice,
        receipts: Array.from(receiptsMap.values())
      };
    });

    return res.status(201).json(
      new ApiResponse(201, generationResult, "Invoice generated and waiting for payment")
    );
  } catch (error) {
    next(error);
  }
};