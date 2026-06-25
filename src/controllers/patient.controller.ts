import type { Request, Response, NextFunction } from "express";
import { db } from "../db/db.js";
import {
  doctors,
  doctorTransactions,
  invoices,
  patients,
  roomBooking,
  transactions,
} from "../db/schema/index.js";
import { eq, count, or, ilike, desc, like, gte, and } from "drizzle-orm";
import ApiError from "../utils/api-error.js";
import ApiResponse from "../utils/api-response.js";

type Patient = typeof patients.$inferSelect;

export const createPatient = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const {
      firstName,
      lastName,
      cnic,
      gender,
      dateOfBirth,
      phone,
      bloodGroup,
      address,
    } = req.body;

    if (!firstName || !lastName || !gender || !dateOfBirth || !phone) {
      throw new ApiError(
        400,
        "BAD_REQUEST",
        "Missing required patient fields.",
      );
    }

    const currentYear = new Date().getFullYear();
    const prefix = `MR-${currentYear}-`;

    // getting last mrNumber stored
    const [lastPatient] = await db
      .select({ mrNumber: patients.mrNumber })
      .from(patients)
      .where(like(patients.mrNumber, `${prefix}%`))
      .orderBy(desc(patients.mrNumber))
      .limit(1);

    // Parse the sequence and increment and making defaults to 1 if no patients exist this year
    let sequence = 1;
    if (lastPatient && lastPatient.mrNumber) {
      const lastSeq = parseInt(
        lastPatient.mrNumber.split("-")[2] as string,
        10,
      );
      if (!isNaN(lastSeq)) sequence = lastSeq + 1;
    }

    // Format to MR-2026-0001
    const newMrNumber = `${prefix}${sequence.toString().padStart(4, "0")}`;

    const [newPatient] = await db
      .insert(patients)
      .values({
        mrNumber: newMrNumber,
        firstName,
        lastName,
        cnic: cnic || null,
        gender: gender.toUpperCase(),
        dateOfBirth: new Date(dateOfBirth),
        phone,
        bloodGroup,
        address,
      })
      .returning();

    if (!newPatient)
      throw new ApiError(
        500,
        "INTERNAL_SERVER_ERROR",
        "Failed to register patient",
      );

    return res
      .status(201)
      .json(
        new ApiResponse<Patient>(
          201,
          newPatient,
          "Patient registered successfully",
        ),
      );
  } catch (error) {
    // TODO: pg error yoy know that
    if ((error as any).code === "23505") {
      return next(
        new ApiError(
          409,
          "CONFLICT",
          "A patient with this CNIC already exists.",
        ),
      );
    }
    next(error);
  }
};

// TODO: add filter by date too in getPatients and export csv
export const getPatients = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = (req.query.search as string) || "";
    const offset = (page - 1) * limit;

    // this where condition is used to make a where clause can have mr number and other things too
    let whereCondition = undefined;
    if (search.trim() !== "") {
      const searchPattern = `%${search.trim()}%`;
      whereCondition = or(
        ilike(patients.mrNumber, searchPattern),
        ilike(patients.firstName, searchPattern),
        ilike(patients.lastName, searchPattern),
        ilike(patients.cnic, searchPattern),
        ilike(patients.phone, searchPattern),
      );
    }

    const patientsData = await db
      .select()
      .from(patients)
      .where(whereCondition)
      .limit(limit)
      .offset(offset)
      .orderBy(desc(patients.createdAt));

    // for pagination we are finding metadata
    const [countResult] = await db
      .select({ val: count() })
      .from(patients)
      .where(whereCondition);

    if (!countResult) {
      throw new ApiError(
        500,
        "INTERNAL_SERVER_ERROR",
        "Failed to get total doctor",
      );
    }
    const totalCount = Number(countResult.val);
    const totalPages = Math.ceil(totalCount / limit);

    const responsePayload = {
      patients: patientsData,
      pagination: {
        page,
        limit,
        totalPages,
        totalCount,
      },
    };

    return res
      .status(200)
      .json(
        new ApiResponse<typeof responsePayload>(
          200,
          responsePayload,
          "Patients fetched",
        ),
      );
  } catch (error) {
    next(error);
  }
};

export const getPatientStats = async (
  _: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const [totalRes] = await db.select({ val: count() }).from(patients);

    if (!totalRes) {
      throw new ApiError(
        500,
        "INTERNAL_SERVER_ERROR",
        "Failed to get total patients count",
      );
    }

    // for finding the patients new this weak
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const [newThisWeekRes] = await db
      .select({ val: count() })
      .from(patients)
      .where(gte(patients.createdAt, oneWeekAgo));

    if (!newThisWeekRes) {
      throw new ApiError(
        500,
        "INTERNAL_SERVER_ERROR",
        "Failed to fetched new patients this week",
      );
    }

    // This returns an array like: [{ gender: 'MALE', count: 55 }, { gender: 'FEMALE', count: 44 }]
    const demographicsData = await db
      .select({
        gender: patients.gender,
        count: count(),
      })
      .from(patients)
      .groupBy(patients.gender);

    if (!demographicsData) {
      throw new ApiError(
        500,
        "INTERNAL_SERVER_ERROR",
        "Failed to fetched patients demographicsData",
      );
    }

    // therefore we need to convert the that array into simple object
    const demographics = { male: 0, female: 0, other: 0, total: 0 };
    demographicsData.forEach((row) => {
      const g = row.gender.toLowerCase();
      if (g === "male" || g === "female" || g === "other") {
        demographics[g] = Number(row.count);
      }
    });
    demographics.total =
      demographics.male + demographics.female + demographics.other;

    const stats = {
      totalPatients: Number(totalRes.val),
      newThisWeek: Number(newThisWeekRes.val),
      demographics,
    };

    return res
      .status(200)
      .json(new ApiResponse<typeof stats>(200, stats, "Stats fetched"));
  } catch (error) {
    next(error);
  }
};

export const exportPatientsCsv = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const search = (req.query.search as string) || "";

    // Build the exact same search condition you used in getPatients
    let whereCondition = undefined;
    if (search.trim() !== "") {
      const searchPattern = `%${search.trim()}%`;
      whereCondition = or(
        ilike(patients.mrNumber, searchPattern),
        ilike(patients.firstName, searchPattern),
        ilike(patients.lastName, searchPattern),
        ilike(patients.cnic, searchPattern),
        ilike(patients.phone, searchPattern),
      );
    }

    const patientsData = await db
      .select()
      .from(patients)
      .where(whereCondition)
      .orderBy(desc(patients.createdAt));

    // simple csv builder
    const headers = [
      "MR Number",
      "First Name",
      "Last Name",
      "CNIC",
      "Phone",
      "Gender",
      "Address",
    ];

    const csvRows = patientsData.map((p) => {
      // address may have comma so csv can break add address in quotes
      const safeAddress = p.address
        ? `"${p.address.replace(/"/g, '""')}"`
        : '""';

      return [
        p.mrNumber,
        p.firstName,
        p.lastName,
        p.cnic || "N/A",
        p.phone,
        p.gender,
        safeAddress,
      ].join(","); // Join columns with commas
    });

    const csvString = [headers.join(","), ...csvRows].join("\n");

    // Set HTTP Headers to force a file download
    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="patients_export_${new Date().toISOString().split("T")[0]}.csv"`,
    );

    //  Send the raw string so that on frontend we can handel blobs
    return res.status(200).send(csvString);
  } catch (error) {
    next(error);
  }
};

export const getPatientTimeline = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id: patientId } = req.params;

    if (!patientId) {
      throw new ApiError(400, "BAD_REQUEST", "Patient ID is required");
    }

    const [patientInvoices, patientBookings, doctorTxns] = await Promise.all([
      // fetching the paid invoices for patient
      db.query.invoices.findMany({
        where: and(
          eq(invoices.patientId, patientId as string),
          eq(invoices.status, "PAID"),
        ),
        orderBy: [desc(invoices.createdAt)],
      }),

      // TODO: Refactor as string it is written too much time
      // etching the room detail for patient
      db.query.roomBooking.findMany({
        where: eq(roomBooking.patientId, patientId as string),
        with: { room: true },
        orderBy: [desc(roomBooking.checkIn)],
      }),

      // fetching the doctor transaction of the patients
      db
        .select({
          amount: transactions.amount,
          createdAt: transactions.createdAt,
          doctorName: doctors.doctorName,
        })
        .from(transactions)
        .innerJoin(
          doctorTransactions,
          eq(transactions.id, doctorTransactions.transactionId),
        )
        .innerJoin(doctors, eq(doctorTransactions.doctorId, doctors.id))
        .where(eq(transactions.patientId, patientId as string)),
    ]);

    // now from this fetched data i have to make a timeline
    // why timeline like this? cuz the frontend built first and it required the data to be organized like that therefore

    const timelineEvents: any[] = [];

    // Map Invoices
    patientInvoices.forEach((inv) => {
      timelineEvents.push({
        id: `inv-${inv.id}`,
        date: inv.createdAt,
        type: "INVOICE_PAID",
        title: `Invoice #${inv.invoiceNo} Paid`,
        amount: Number(inv.payableAmount),
      });
    });

    // Map Bookings admissions and discharges are separate events
    patientBookings.forEach((booking) => {
      // Admit Event
      timelineEvents.push({
        id: `admit-${booking.id}`,
        date: booking.checkIn,
        type: "ROOM_ADMIT",
        title: `Admitted to ${booking.room?.roomNumber || "Ward"}`,
        detail: "Inpatient Admission",
      });

      // Discharge Event
      if (booking.checkOut) {
        // Calculate days stayed
        const msPerDay = 1000 * 60 * 60 * 24;
        const days = Math.ceil(
          (booking.checkOut.getTime() - booking.checkIn.getTime()) / msPerDay,
        );

        timelineEvents.push({
          id: `discharge-${booking.id}`,
          date: booking.checkOut,
          type: "ROOM_DISCHARGE",
          title: `Discharged from ${booking.room?.roomNumber || "Ward"}`,
          detail: `Stayed for ${days} Day(s)`,
        });
      }
    });

    // Map Doctor Visits
    doctorTxns.forEach((txn) => {
      timelineEvents.push({
        id: `doc-${txn.createdAt.getTime()}`,
        date: txn.createdAt,
        type: "DOCTOR_VISIT",
        title: `Consultation: ${txn.doctorName}`,
        amount: Number(txn.amount),
      });
    });

    // Sort all combined events descending so that newest first event happened
    // here i use the functional programming approach
    timelineEvents.sort((a, b) => b.date.getTime() - a.date.getTime());

    // Calculate Lifetime Value (LTV) - Sum of all paid invoices
    const ltv = patientInvoices.reduce(
      (sum, inv) => sum + Number(inv.payableAmount),
      0,
    );

    const payload = {
      ltv,
      timelineEvents,
    };

    return res
      .status(200)
      .json(new ApiResponse<typeof payload>(200, payload, "Timeline fetched"));
  } catch (error) {
    next(error);
  }
};

export const searchPatientsForReception = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const q = req.query.q as string;

    if (!q || q.trim() === "") {
      return res.status(200).json(new ApiResponse(200, [], "Empty search query"));
    }

    const searchPattern = `%${q.trim()}%`;

    const matches = await db.query.patients.findMany({
      where: or(
        ilike(patients.mrNumber, searchPattern),
        ilike(patients.phone, searchPattern),
        ilike(patients.cnic, searchPattern)
      ),
      limit: 10, 
      columns: {
        id: true,
        mrNumber: true,
        firstName: true,
        lastName: true,
        phone: true,
        cnic: true
      }
    });

    return res.status(200).json(
      new ApiResponse(200, matches, "Patients found")
    );
  } catch (error) {
    next(error);
  }
};
