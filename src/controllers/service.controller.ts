import type { Request, Response, NextFunction } from "express";
import { db } from "../db/db.js";
import { serviceTypes, services } from "../db/schema/index.js";
import ApiError from "../utils/api-error.js";
import ApiResponse from "../utils/api-response.js";
import { eq, ilike } from "drizzle-orm";

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
    const { name, isQueuingEnabled, doctorInvolvement, description, iconKey } = req.body;

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
        iconKey,
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
    const { serviceTypeId, serviceName, basePrice, systemCode } = req.body;

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
        systemCode,
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

export const getServicesByServiceType = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const serviceTypeId = req.params.serviceTypeId as string;

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

export const getAllServiceTypes = async (
  _: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const allTypes = await db.query.serviceTypes.findMany();

    return res.status(200).json(
      new ApiResponse<ServiceType[]>(
        200,
        allTypes,
        "Service categories fetched successfully"
      )
    );
  } catch (error) {
    next(error);
  }
};

export const updateServiceType = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const id = req.params.id as string;
    const { name, isQueuingEnabled, doctorInvolvement, description, iconKey } = req.body;

    if (!id) {
      throw new ApiError(400, "BAD_REQUEST", "Service Type ID is required.");
    }

    const [updatedType] = await db
      .update(serviceTypes)
      .set({
        ...(name && { name: name }),
        ...(isQueuingEnabled !== undefined && { isQueuingEnabled }),
        ...(doctorInvolvement && { doctorInvolvement }),
        ...(description !== undefined && { description }),
        ...(iconKey !== undefined && { iconKey }),
      })
      .where(eq(serviceTypes.id, id))
      .returning();

    if (!updatedType) {
      throw new ApiError(404, "NOT_FOUND", "Service category not found.");
    }

    return res.status(200).json(
      new ApiResponse<ServiceType>(200, updatedType, "Category updated successfully")
    );
  } catch (error) {
    if ((error as any).code === "22P02") {
      return next(new ApiError(400, "BAD_REQUEST", "Invalid ID format."));
    }
    if ((error as any).code === "23505") {
      return next(new ApiError(409, "CONFLICT", "A category with this name already exists."));
    }
    next(error);
  }
};

export const updateService = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const id = req.params.id as string;
    const { serviceTypeId, serviceName, basePrice, isActive, systemCode } = req.body;

    if (!id) {
      throw new ApiError(400, "BAD_REQUEST", "Service ID is required.");
    }

    const [updatedService] = await db
      .update(services)
      .set({
        ...(serviceTypeId && { serviceTypeId }),
        ...(serviceName && { serviceName }),
        ...(basePrice && { basePrice: basePrice.toString() }),
        ...(isActive !== undefined && { isActive }),
        ...(systemCode && { systemCode }),
      })
      .where(eq(services.id, id))
      .returning();

    if (!updatedService) {
      throw new ApiError(404, "NOT_FOUND", "Service not found.");
    }

    return res.status(200).json(
      new ApiResponse<Service>(200, updatedService, "Service updated successfully")
    );
  } catch (error) {
    if ((error as any).code === "22P02") {
      return next(new ApiError(400, "BAD_REQUEST", "Invalid ID format."));
    }
    if ((error as any).code === "23503") {
      return next(new ApiError(404, "NOT_FOUND", "The provided Category ID does not exist."));
    }
    next(error);
  }
};

export const searchServices = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const searchQuery = req.query.q as string;

    if (!searchQuery) {
      return res.status(200).json(new ApiResponse(200, [], "Empty search"));
    }

    const searchTerm = `%${searchQuery}%`;

    const matches = await db.query.services.findMany({
      where: ilike(services.serviceName, searchTerm),
      with: {
        serviceType: true
      },
      limit: 10,
    });

    return res.status(200).json(
      new ApiResponse(200, matches, "Search results fetched")
    );
  } catch (error) {
    next(error);
  }
};

export const getAllService = async (
  _: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const allService = await db.query.services.findMany();

    return res.status(200).json(
      new ApiResponse<Service[]>(
        200,
        allService,
        "Service categories fetched successfully"
      )
    );
  } catch (error) {
    next(error);
  }
}
