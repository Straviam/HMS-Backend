import type { Response, NextFunction } from "express";
import type { AuthRequest } from "../types/types.js";
import { db } from "../db/db.js";
import { invoices, transactions, serviceTransactions, doctorTransactions, services, doctors, doctorTimings, serviceTypes, payments } from "../db/schema/index.js";
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
        status: "DRAFT",
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
      if (existingInvoice.status !== "DRAFT") throw new ApiError(400, "BAD_REQUEST", "Items can only be added to a DRAFT invoice.");

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

export const addPaymentToInvoice = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const invoiceId = req.params.id as string;
    const { amountPaid, paymentMethod, referenceNo, discount } = req.body;

    if (!invoiceId || !amountPaid || !paymentMethod) {
      throw new ApiError(400, "BAD_REQUEST", "Invoice ID, amountPaid, and paymentMethod are required.");
    }

    const result = await db.transaction(async (tx) => {

      const [invoice] = await tx.select().from(invoices).where(eq(invoices.id, invoiceId));
      if (!invoice) throw new ApiError(404, "NOT_FOUND", "Invoice not found.");
      if (invoice.status === "PAID") throw new ApiError(400, "BAD_REQUEST", "Invoice is already paid.");

      let currentPayable = parseFloat(invoice.payableAmount as string);

      // apply discount
      if (discount !== undefined && parseFloat(discount) >= 0) {
        const totalAmount = parseFloat(invoice.totalAmount as string);
        currentPayable = totalAmount - parseFloat(discount);
        
        const updateDiscount = invoice.discount + discount

        await tx.update(invoices).set({ 
          discount: updateDiscount.toString(),
          payableAmount: currentPayable.toString()
        }).where(eq(invoices.id, invoiceId));
      }

      // payment generation
      const [newPayment] = await tx.insert(payments).values({
        invoiceId: invoice.id,
        amountPaid: amountPaid.toString(),
        paymentMethod: paymentMethod,
        referenceNo: referenceNo || null,
      }).returning();

      // amount paid till now
      const [paymentTotals] = await tx.select({ total: sum(payments.amountPaid) })
        .from(payments)
        .where(eq(payments.invoiceId, invoiceId));
        
      const totalPaidSoFar = parseFloat((paymentTotals?.total as string) || "0");

      // status update
      const updatedStatus = totalPaidSoFar >= currentPayable ? "PAID" : invoice.status;

      if (updatedStatus === "PAID") {
        await tx.update(invoices).set({ status: "PAID" }).where(eq(invoices.id, invoiceId));
      }
      
      return {
        payment: newPayment,
        totalPaid: totalPaidSoFar,
        remainingBalance: Math.max(0, currentPayable - totalPaidSoFar),
        invoiceStatus: updatedStatus
      };
    });

    return res.status(200).json(new ApiResponse(200, result, "Payment processed"));
  } catch (error) { next(error); }
};

export const finalizeReceptionInvoice = async (
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
      const [invoice] = await tx.select().from(invoices).where(eq(invoices.id, invoiceId));

      if (!invoice) throw new ApiError(404, "NOT_FOUND", "Invoice not found.");
      if (invoice.status !== "DRAFT") {
        throw new ApiError(400, "BAD_REQUEST", `Invoice cannot be finalized because it is already ${invoice.status}.`);
      }

      const [updatedInvoice] = await tx.update(invoices)
        .set({ status: "ISSUED" })
        .where(eq(invoices.id, invoiceId))
        .returning();

      // gettin all items
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
      .where(eq(transactions.invoiceId, invoiceId));

      // grouping in reciept
      const receiptsMap = new Map<string, any>();

      for (const row of rawItems) {
        // safety skip for corrupted data (as using left join)
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
        const itemCost = parseFloat(row.transaction.amount as string);

        // formatting
        let itemName = row.service.serviceName;
        if (row.doctor) {
          itemName += ` (with ${row.doctor.doctorName})`;
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

    return res.status(200).json(new ApiResponse(200, result, "Invoice finalized and ready for payment"));
  } catch (error) { 
    next(error); 
  }
};