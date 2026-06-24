import type { Request, Response, NextFunction } from "express";
import { db } from "../db/db.js";
import { rooms } from "../db/schema/index.js";
import ApiError from "../utils/api-error.js";
import ApiResponse from "../utils/api-response.js";
import { eq, and, count } from "drizzle-orm";

type Room = typeof rooms.$inferSelect;

export const addRoom = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { roomNumber, roomType, price } = req.body;

    if (!roomNumber || !roomType || !price) {
      throw new ApiError(400, "BAD_REQUEST", "Room number, type, and price are required.");
    }

    const [newRoom] = await db
      .insert(rooms)
      .values({
        roomNumber: roomNumber.toUpperCase(),
        roomType,
        price: price.toString(),
      })
      .returning();

    if (!newRoom) {
      throw new ApiError(500, "INTERNAL_SERVER_ERROR", "Failed to insert room.");
    }

    return res.status(201).json(
      new ApiResponse<Room>(201, newRoom, "Room added successfully")
    );
  } catch (error) {
    if ((error as any).code === "23505") {
      return next(new ApiError(409, "CONFLICT", "A room with this number already exists."));
    }
    next(error);
  }
};

export const getActiveRooms = async (
  _: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const activeRooms = await db.query.rooms.findMany({
      where: eq(rooms.isActive, true),
      orderBy: (rooms, { asc }) => [asc(rooms.roomNumber)],
    });

    return res.status(200).json(
      new ApiResponse<Room[]>(200, activeRooms, "Active rooms fetched successfully")
    );
  } catch (error) {
    next(error);
  }
};

export const getAllRooms = async (
  _: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const allRooms = await db.query.rooms.findMany({
      orderBy: (rooms, { asc }) => [asc(rooms.roomNumber)],
    });

    return res.status(200).json(
      new ApiResponse<Room[]>(200, allRooms, "All rooms fetched successfully")
    );
  } catch (error) {
    next(error);
  }
};

export const updateRoom = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const id = req.params.id as string;
    const { status, price, isActive } = req.body;

    if (!id) {
      throw new ApiError(400, "BAD_REQUEST", "Room ID is required.");
    }

    // TODO: first check wheather the Id exits in db or not
    const [updatedRoom] = await db
      .update(rooms)
      .set({
        ...(status && { status }),
        ...(price && { price: price.toString() }),
        ...(isActive !== undefined && { isActive }),
      })
      .where(eq(rooms.id, id))
      .returning();

    if (!updatedRoom) {
      throw new ApiError(404, "NOT_FOUND", "Room not found.");
    }

    return res.status(200).json(
      new ApiResponse<Room>(200, updatedRoom, "Room configuration updated successfully")
    );
  } catch (error) {
    if ((error as any).code === "22P02") {
      return next(new ApiError(400, "BAD_REQUEST", "Invalid Room ID format."));
    }
    if ((error as any).code === "22P02" && (error as any).message.includes("enum")) {
      return next(new ApiError(400, "BAD_REQUEST", "Invalid room status provided."));
    }
    next(error);
  }
};

export const decommissionRoom = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const id = req.params.id as string;

    if (!id) {
      throw new ApiError(400, "BAD_REQUEST", "Room ID is required.");
    }

    const [decommissionedRoom] = await db
      .update(rooms)
      .set({
        isActive: false,
        status: "UNDER_MAINTENANCE"
      })
      .where(eq(rooms.id, id))
      .returning();

    if (!decommissionedRoom) {
      throw new ApiError(404, "NOT_FOUND", "Room not found.");
    }

    return res.status(200).json(
      new ApiResponse<Room>(200, decommissionedRoom, "Room has been decommissioned")
    );
  } catch (error) {
    if ((error as any).code === "22P02") {
      return next(new ApiError(400, "BAD_REQUEST", "Invalid Room ID format."));
    }
    next(error);
  }
};

export const getRoomStats = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rawStats = await db
      .select({
        status: rooms.status,
        count: count(),
      })
      .from(rooms)
      .groupBy(rooms.status);

    const stats = {
      total: 0,
      occupied: 0,
      maintenance: 0,
      cleaning: 0,
      available: 0,
    };

    rawStats.forEach((row) => {
      // Drizzle returns counts as strings, so i am  casting it to Number
      const val = Number(row.count);

      stats.total += val;
      console.log(row)

      const status = row.status?.toUpperCase();
      if (status === "OCCUPIED") stats.occupied += val;
      else if (status === "UNDER_MAINTENANCE") stats.maintenance += val;
      else if (status === "CLEANING") stats.cleaning += val;
      else if (status === "AVAILABLE") stats.available += val;
    });

    return res.status(200).json(new ApiResponse(200, stats, "Room stats fetched"));
  } catch (error) {
    next(error);
  }
};

// TODO: stats Contoller and bulk price updator and percentange updator
