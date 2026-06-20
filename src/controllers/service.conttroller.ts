import type { Request, Response, NextFunction } from "express";
import { db } from "../db/db.js";
import { serviceTypes, services } from "../db/schema/index.js";
import ApiError from "../utils/api-error.js";
import ApiResponse from "../utils/api-response.js";
import { eq } from "drizzle-orm";

type ServiceType = typeof serviceTypes.$inferSelect;
type Service = typeof services.$inferSelect;

interface ServiceTypeWithServices extends ServiceType {
  services: Service[];
}

export const createServiceType = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { name, isQueuingEnabled, doctorInvolvement, description } = req.body;

    if (!name) {
      throw new ApiError(400, "BAD_REQUEST", "Service type name is required.");
    }

    const [newServiceType] = await db
      .insert(serviceTypes)
      .values({
        name: name,
        isQueuingEnabled: isQueuingEnabled ?? false,
        doctorInvolvement: doctorInvolvement ?? "NO",
        description,
      })
      .returning();

    if (!newServiceType) {
      throw new ApiError(
        500,
        "INTERNAL_SERVER_ERROR",
        "Failed to insert service category.",
      );
    }

    return res
      .status(201)
      .json(
        new ApiResponse<ServiceType>(
          201,
          newServiceType,
          "Service category created successfully"
        ),
      );
  } catch (error) {
    if ((error as any).code === "23505") {
      return next(new ApiError(409, "CONFLICT", "A service category with this name already exists."));
    }
    next(error);
  }
};

export const createService = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { serviceTypeId, serviceName, basePrice } = req.body;

    if (!serviceTypeId || !serviceName || !basePrice) {
      throw new ApiError(
        400,
        "BAD_REQUEST",
        "Service Type ID, Name, and Base Price are required."
      );
    }

    const [newService] = await db
      .insert(services)
      .values({
        serviceTypeId,
        serviceName,
        basePrice: basePrice.toString(),
      })
      .returning();

    if (!newService) {
      throw new ApiError(
        500,
        "INTERNAL_SERVER_ERROR",
        "Failed to insert the specific service.",
      );
    }

    return res
      .status(201)
      .json(
        new ApiResponse<Service>(
          201,
          newService,
          "Service added to category successfully"
        ),
      );
  } catch (error) {
    if ((error as any).code === "23503") {
      return next(new ApiError(404, "NOT_FOUND", "The provided Service Type ID does not exist."));
    }
    next(error);
  }
};

export const getServicesByType = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const serviceTypeId  = req.params.serviceTypeId as string;

    if (!serviceTypeId) {
      throw new ApiError(400, "BAD_REQUEST", "Service Type ID is required.");
    }

    const filteredServices = await db.query.services.findMany({
      where: eq(services.serviceTypeId, serviceTypeId),
    });

    return res
      .status(200)
      .json(
        new ApiResponse<Service[]>(
          200,
          filteredServices || [],
          "Category services fetched successfully"
        ),
      );
  } catch (error) {
    if ((error as any).code === "22P02") {
      return next(new ApiError(400, "BAD_REQUEST", "Invalid Service Type ID format."));
    }
    next(error);
  }
};