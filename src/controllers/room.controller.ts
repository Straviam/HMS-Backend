import type { Request, Response, NextFunction } from "express";
import { db } from "../db/db.js";
import { rooms } from "../db/schema/index.js";
import ApiError from "../utils/api-error.js";
import ApiResponse from "../utils/api-response.js";
import { eq, and } from "drizzle-orm";

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
        pricePerHour: price.toString(),
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
    const { status, price } = req.body;

    if (!id) {
      throw new ApiError(400, "BAD_REQUEST", "Room ID is required.");
    }

    const [updatedRoom] = await db
      .update(rooms)
      .set({
        ...(status && { status }),
        ...(price && { pricePerHour: price.toString() }),
      })
      .where(and(eq(rooms.id, id), eq(rooms.isActive, true)))
      .returning();

    if (!updatedRoom) {
      throw new ApiError(404, "NOT_FOUND", "Active room not found.");
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