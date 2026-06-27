import type { Request, Response, NextFunction } from "express";
import { db } from "../db/db.js";
import { doctors, doctorTimings, type dayEnum } from "../db/schema/index.js";
import { eq, count, and, lte, gte, sql, ilike } from "drizzle-orm";
import ApiError from "../utils/api-error.js";
import ApiResponse from "../utils/api-response.js";

type Doctor = typeof doctors.$inferSelect;
type Timing = typeof doctorTimings.$inferSelect;
interface DoctorWithTimings extends Doctor {
  timings: Timing[];
}

export const addDoctor = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { doctorName, specialization, isAvailable } = req.body;

    if (!doctorName || !specialization) {
      throw new ApiError(
        400,
        "BAD_REQUEST",
        "Doctor name and specialization are required.",
      );
    }

    const [newDoctor] = await db
      .insert(doctors)
      .values({
        doctorName: doctorName,
        specialization,
        isAvailable: isAvailable ?? true,
      })
      .returning();

    if (!newDoctor) {
      throw new ApiError(
        500,
        "INTERNAL_SERVER_ERROR",
        "Failed to insert doctor.",
      );
    }

    return res
      .status(201)
      .json(
        new ApiResponse<Doctor>(201, newDoctor, "Doctor added successfully"),
      );
  } catch (error) {
    next(error);
  }
};

export const addDoctorTiming = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { doctorId } = req.params;
    const {
      day,
      startTime,
      endTime,
      avgConsultationTime,
      maxTokens,
      consultationFee,
      isActive,
    } = req.body;

    if (!doctorId || !day || !startTime || !endTime || !consultationFee) {
      throw new ApiError(400, "BAD_REQUEST", "Missing required timing fields.");
    }

    if (startTime >= endTime) {
      throw new ApiError(
        400,
        "BAD_REQUEST",
        "Start time must be before end time.",
      );
    }
    // TODO: check doctor id is real or not
    const [newTiming] = await db
      .insert(doctorTimings)
      .values({
        doctorId: doctorId as string,
        day: day.toUpperCase(),
        startTime,
        endTime,
        avgConsultationTime: avgConsultationTime || 15,
        maxTokens: maxTokens || 20,
        consultationFee: consultationFee.toString(),
        isActive: isActive ?? true,
      })
      .returning();

    if (!newTiming) {
      throw new ApiError(
        500,
        "INTERNAL_SERVER_ERROR",
        "Failed to insert doctor timing.",
      );
    }

    return res
      .status(201)
      .json(
        new ApiResponse<Timing>(
          201,
          newTiming,
          "Doctor timing added successfully",
        ),
      );
  } catch (error) {
    // TODO: pg error generic object
    if ((error as any).code === "23503") {
      return next(new ApiError(404, "NOT_FOUND", "Doctor ID does not exist."));
    }
    next(error);
  }
};

export const deleteDoctorTiming = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { doctorTimingId } = req.params;

    if (!doctorTimingId) {
      throw new ApiError(400, "BAD_REQUEST", "Timing ID is required.");
    }

    const deleted = await db
      .delete(doctorTimings)
      .where(eq(doctorTimings.id, doctorTimingId as string))
      .returning();

    const deletedTiming = deleted[0];
    if (!deletedTiming) {
      throw new ApiError(
        404,
        "NOT_FOUND",
        "Timing slot not found or already deleted.",
      );
    }

    return res
      .status(200)
      .json(
        new ApiResponse<Timing>(
          200,
          deletedTiming,
          "Timing deleted successfully",
        ),
      );
  } catch (error) {
    next(error);
  }
};

export const getAllDoctorsWithTimings = async (
  _: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    // NOTE: there is a difference in db.select and db.query query is a relation api of drizzle
    const allDoctors = (await db.query.doctors.findMany({
      with: { timings: true },
    })) as DoctorWithTimings[];

    if (!allDoctors) { // NOTE: if no dr found then we actuallay want to show empty array not 404
      throw new ApiError(404, "NOT_FOUND", "No doctors found in the database.");
    }

    return res
      .status(200)
      .json(
        new ApiResponse<DoctorWithTimings[]>(
          200,
          allDoctors,
          "Doctors fetched successfully",
        ),
      );
  } catch (error) {
    next(error);
  }
};

export const getDoctorStats = async (
  _: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const [totalRes] = await db.select({ val: count() }).from(doctors);
    if (!totalRes) {
      throw new ApiError(
        500,
        "INTERNAL_SERVER_ERROR",
        "Failed to get total doctor",
      );
    }
    const days = [
      "SUNDAY",
      "MONDAY",
      "TUESDAY",
      "WEDNESDAY",
      "THURSDAY",
      "FRIDAY",
      "SATURDAY",
    ] as const;
    const now = new Date();

    const dayIndex = now.getDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6; // due to shity ts as it was saying
    const todayDay = days[dayIndex];

    //  Added ":00" to strictly match PostgreSQL TIME format (HH:MM:SS)
    const currentTime = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}:00`;

    const [availableRes] = await db
      .select({ val: sql<number>`count(distinct ${doctorTimings.doctorId})` })
      .from(doctorTimings)
      .where(
        and(
          eq(doctorTimings.day, todayDay),
          lte(doctorTimings.startTime, currentTime),
          gte(doctorTimings.endTime, currentTime),
          eq(doctorTimings.isActive, true),
        ),
      );

    if (!availableRes) {
      throw new ApiError(
        500,
        "INTERNAL_SERVER_ERROR",
        "Failed to get no of available doctor",
      );
    }

    const [shiftsTodayRes] = await db
      .select({ val: count() })
      .from(doctorTimings)
      .where(eq(doctorTimings.day, todayDay));

    if (!shiftsTodayRes) {
      throw new ApiError(
        500,
        "INTERNAL_SERVER_ERROR",
        "Failed to get todays shifts of all doctor",
      );
    }
    const stats = {
      total: Number(totalRes.val),
      availableNow: Number(availableRes.val),
      shiftsToday: Number(shiftsTodayRes.val),
    };

    return res
      .status(200)
      .json(
        new ApiResponse<typeof stats>(200, stats, "Stats fetched successfully"),
      );
  } catch (error) {
    next(
      new ApiError(
        500,
        "INTERNAL_SERVER_ERROR",
        "Failed to calculate doctor statistics.",
      ),
    );
  }
};

// TODO: we can make a simple async handler to keep away from try catch error again and agian

export const getAvailableDoctors = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    // for service type consultation 
    const specialization = req.query.specialization as string | undefined;

    const days = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
    const todayEnum = days[new Date().getDay()] as "MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY" | "FRIDAY" | "SATURDAY" | "SUNDAY";

    const filters = [eq(doctors.isAvailable, true)];

    if (specialization && specialization.trim() !== "") {
      filters.push(ilike(doctors.specialization, `%${specialization.trim()}%`));
    }

    const availableDoctors = await db.query.doctors.findMany({
      where: and(...filters),
      with: {
        timings: {
          where: and(
            eq(doctorTimings.day, todayEnum),
            eq(doctorTimings.isActive, true)
          )
        }
      }
    });

    const filteredDoctors = availableDoctors.filter(doc => doc.timings && doc.timings.length > 0);

    return res.status(200).json(
      new ApiResponse(200, filteredDoctors, "Available doctors fetched successfully")
    );
  } catch (error) {
    next(error);
  }
};