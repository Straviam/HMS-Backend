import type { Response, NextFunction } from "express";
import type { AuthRequest } from "../types/types.js";
import { db } from "../db/db.js";
import { invoices, transactions, serviceTransactions, doctorTransactions, services, doctorTimings, serviceTypes, payments } from "../db/schema/index.js";
import { eq, desc, like, sum } from "drizzle-orm";
import ApiError from "../utils/api-error.js";
import ApiResponse from "../utils/api-response.js";

export const generateReceptionReceipt = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { patientId, items } = req.body;
    const userId = req.user?.id; 

    if (!userId) throw new ApiError(401, "UNAUTHORIZED", "User is not authenticated.");
    if (!patientId || !items || items.length === 0) {
      throw new ApiError(400, "BAD_REQUEST", "Patient ID and at least one item are required.");
    }

    const result = await db.transaction(async (tx) => {
      let calculatedTotal = 0;
      const processedItems: any[] = [];
      let serviceTypeInfo: any = null;

      // pricing 
      for (const item of items) {
        let itemTotalCost = 0;
        let itemName = "";

        // service type verification
        if (!serviceTypeInfo) {
          const [typeData] = await tx.select().from(serviceTypes).where(eq(serviceTypes.id, item.serviceTypeId));
          if (!typeData) throw new ApiError(404, "NOT_FOUND", "Invalid Service Type.");
          serviceTypeInfo = typeData;
        }

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
        processedItems.push({ ...item, price: itemTotalCost, itemName });
      }

      // invoice generatiion
      const currentYear = new Date().getFullYear();
      const prefix = `INV-${currentYear}-`;
      const [lastInvoice] = await tx.select({ invoiceNo: invoices.invoiceNo })
        .from(invoices).where(like(invoices.invoiceNo, `${prefix}%`)).orderBy(desc(invoices.invoiceNo)).limit(1);

      const seq = lastInvoice?.invoiceNo ? parseInt(lastInvoice.invoiceNo.split("-")[2] || "0", 10) + 1 : 1;
      const newInvoiceNo = `${prefix}${seq.toString().padStart(4, "0")}`;

      const [newInvoice] = await tx.insert(invoices).values({
        invoiceNo: newInvoiceNo,
        patientId,
        totalAmount: calculatedTotal.toString(),
        discount: "0.00",
        payableAmount: calculatedTotal.toString(),
        status: "ISSUED",
      }).returning();

      if (!newInvoice) throw new ApiError(500, "INTERNAL_SERVER_ERROR", "Failed to create invoice.");

      // transaction generation
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
        
        if (!newTxn) throw new ApiError(500, "INTERNAL_SERVER_ERROR", "Failed to create transaction")

        await tx.insert(serviceTransactions).values({ transactionId: newTxn.id, serviceId: item.serviceId });
        if (item.doctorId) {
          await tx.insert(doctorTransactions).values({ transactionId: newTxn.id, doctorId: item.doctorId });
        }
      }

      // reciept 
      const receipt = {
        serviceTypeName: serviceTypeInfo.name,
        isQueuingEnabled: serviceTypeInfo.isQueuingEnabled,
        items: processedItems,
        totalAmount: calculatedTotal
      };

      return { invoice: newInvoice, receipt };
    });

    return res.status(201).json(new ApiResponse(201, result, "Invoice created and receipt generated successfully"));
  } catch (error) { next(error); }
};

export const addItemToInvoice = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const invoiceId = req.params.id as string;
    const { items } = req.body;
    const userId = req.user?.id;

    if (!userId) throw new ApiError(401, "UNAUTHORIZED", "User is not authenticated.");
    if (!invoiceId || !items || items.length === 0) {
      throw new ApiError(400, "BAD_REQUEST", "Invoice ID and items are required.");
    }

    const result = await db.transaction(async (tx) => {
      // check for invoice status
      const [existingInvoice] = await tx.select().from(invoices).where(eq(invoices.id, invoiceId));
      if (!existingInvoice) throw new ApiError(404, "NOT_FOUND", "Invoice not found.");
      if (existingInvoice.status === "PAID") throw new ApiError(400, "BAD_REQUEST", "Cannot add items to a completed invoice.");

      let newItemTotal = 0;
      const processedItems: any[] = [];
      let serviceTypeInfo: any = null;

      // pricing
      for (const item of items) {
        let itemTotalCost = 0;
        let itemName = "";

        if (!serviceTypeInfo) {
          const [serviceTypeData] = await tx.select().from(serviceTypes).where(eq(serviceTypes.id, item.serviceTypeId));
          if (!serviceTypeData) throw new ApiError(404, "NOT_FOUND", "Invalid Service Type.");
          serviceTypeInfo = serviceTypeData;
        }

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

        newItemTotal += itemTotalCost;
        processedItems.push({ ...item, price: itemTotalCost, itemName });
      }

      // invoice update
      const newTotal = parseFloat(existingInvoice.totalAmount as string) + newItemTotal;
      const currentDiscount = parseFloat(existingInvoice.discount || "0");
      const newPayable = newTotal - currentDiscount;

      const [updatedInvoice] = await tx.update(invoices)
        .set({ 
          totalAmount: newTotal.toString(),
          payableAmount: newPayable.toString()
        })
        .where(eq(invoices.id, invoiceId))
        .returning();

      // transaction generation
      let txnCounter = 1;
      for (const item of processedItems) {
        const txnNo = `TXN-${new Date().getTime().toString().slice(-6)}-${txnCounter++}`;
        const txnType = item.doctorId ? "DOCTOR" : "SERVICE";

        const [newTxn] = await tx.insert(transactions).values({
          txnNo,
          patientId: existingInvoice.patientId,
          userId, 
          invoiceId: existingInvoice.id,
          type: txnType,
          amount: item.price.toString(),
        }).returning();

        if (!newTxn) throw new ApiError(500, "INTERNAL_SERVER_ERROR", "Failed to create transaction")

        await tx.insert(serviceTransactions).values({ transactionId: newTxn.id, serviceId: item.serviceId });
        if (item.doctorId) {
          await tx.insert(doctorTransactions).values({ transactionId: newTxn.id, doctorId: item.doctorId });
        }
      }

      // new reciept
      const receipt = {
        serviceTypeName: serviceTypeInfo.name,
        isQueuingEnabled: serviceTypeInfo.isQueuingEnabled,
        items: processedItems,
        totalAmount: newItemTotal
      };

      return { invoice: updatedInvoice, receipt };
    });

    return res.status(200).json(new ApiResponse(200, result, "Items successfully appended to invoice"));
  } catch (error) { next(error); }
};
