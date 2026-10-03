import mongoose, { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { Vehicle } from "@/models/Vehicle";
import { RideRequest } from "@/models/RideRequest";
import { Trip } from "@/models/Trip";
import { Reservation } from "@/models/Reservation";
import { Location } from "@/models/Location";
import { AuditEvent } from "@/models/AuditEvent";
import { IdempotencyRecord } from "@/models/IdempotencyRecord";
import { calculateRoute } from "./routing.service";
import { intervalsOverlap } from "@/lib/date-utils";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { IRideRequest, ITrip, ILocation, IVehicle } from "@/types";

const PICKUP_HANDLING_BUFFER_MINUTES = parseInt(
  process.env.PICKUP_HANDLING_BUFFER_MINUTES || "3",
  10
);
const DROPOFF_HANDLING_BUFFER_MINUTES = parseInt(
  process.env.DROPOFF_HANDLING_BUFFER_MINUTES || "2",
  10
);
const SAFETY_BUFFER_MINUTES = parseInt(process.env.SAFETY_BUFFER_MINUTES || "5", 10);

export interface AcceptRequestResult {
  success: boolean;
  trip: ITrip;
  request: IRideRequest;
  message: string;
}

/**
 * Calculates total reservation interval [reservedStart, reservedEnd)
 */
export function computeReservationInterval(
  pickupInstant: Date,
  durationMinutes: number
): { reservedStart: Date; reservedEnd: Date } {
  const reservedStart = new Date(pickupInstant);
  const totalMinutes =
    durationMinutes +
    PICKUP_HANDLING_BUFFER_MINUTES +
    DROPOFF_HANDLING_BUFFER_MINUTES +
    SAFETY_BUFFER_MINUTES;

  const reservedEnd = new Date(reservedStart.getTime() + totalMinutes * 60 * 1000);
  return { reservedStart, reservedEnd };
}

/**
 * Accepts a ride request with strict MongoDB transaction and Vehicle scheduleVersion serialization
 */
export async function acceptRideRequest(
  riderId: Types.ObjectId | string,
  requestId: Types.ObjectId | string,
  idempotencyKey?: string
): Promise<AcceptRequestResult> {
  const db = await connectToDatabase();
  const riderObjId = new Types.ObjectId(riderId);
  const reqObjId = new Types.ObjectId(requestId);

  // Check Idempotency first
  if (idempotencyKey) {
    const existing = await IdempotencyRecord.findOne({
      actorId: riderObjId,
      action: "accept_request",
      key: idempotencyKey,
    });
    if (existing) {
      return existing.responseBody as AcceptRequestResult;
    }
  }

  // Pre-flight check (outside transaction)
  const initialRequest = await RideRequest.findById(reqObjId);
  if (!initialRequest) {
    throw new NotFoundError("Ride request not found.");
  }
  if (initialRequest.status !== "pending") {
    if (initialRequest.status === "accepted") {
      if (initialRequest.assignedRiderId?.toString() === riderObjId.toString()) {
        const existingTrip = await Trip.findOne({ requestId: reqObjId });
        if (existingTrip) {
          return {
            success: true,
            trip: existingTrip.toObject(),
            request: initialRequest.toObject(),
            message: "Request was already accepted by you.",
          };
        }
      }
      throw new ConflictError("This request has already been accepted by another rider.");
    }
    throw new ConflictError(`Cannot accept request in '${initialRequest.status}' status.`);
  }

  // Find the single vehicle
  const initialVehicle = await Vehicle.findOne();
  if (!initialVehicle) {
    throw new NotFoundError("No vehicle (Toto) registered in the system.");
  }

  // Fetch locations
  const originLoc = await Location.findById(initialRequest.originId);
  const destLoc = await Location.findById(initialRequest.destinationId);
  if (!originLoc || !destLoc) {
    throw new NotFoundError("Origin or destination location not found.");
  }

  // Calculate route and reservation duration OUTSIDE the transaction
  const { route, snapshot } = await calculateRoute(originLoc, destLoc);
  const { reservedStart, reservedEnd } = computeReservationInterval(
    initialRequest.pickupInstant,
    route.duration
  );

  // Max retries for optimistic serialization conflict
  const maxRetries = 3;
  let attempt = 0;

  while (attempt < maxRetries) {
    attempt++;
    const session = await db.startSession();

    try {
      let committedResult: AcceptRequestResult | null = null;

      await session.withTransaction(async () => {
        // 1. Serialization point: Conditionally increment Vehicle scheduleVersion
        const vehicle = await Vehicle.findOneAndUpdate(
          { _id: initialVehicle._id, scheduleVersion: initialVehicle.scheduleVersion + (attempt - 1) },
          { $inc: { scheduleVersion: 1 } },
          { session, new: true }
        );

        if (!vehicle) {
          // Check current vehicle version
          const currentVehicle = await Vehicle.findById(initialVehicle._id).session(session);
          throw new ConflictError(
            "Schedule version conflict: Another rider modified the schedule concurrently."
          );
        }

        // 2. Re-read and validate RideRequest within transaction
        const request = await RideRequest.findById(reqObjId).session(session);
        if (!request || request.status !== "pending") {
          throw new ConflictError(
            request?.status === "accepted"
              ? "Request has already been accepted by another rider."
              : "Request is no longer pending."
          );
        }

        // 3. Query all active reservations for this vehicle to check conflicts
        const activeReservations = await Reservation.find({
          vehicleId: vehicle._id,
          status: "active",
        }).session(session);

        // a) Direct interval overlap check: [reservedStart, reservedEnd)
        for (const res of activeReservations) {
          if (intervalsOverlap(reservedStart, reservedEnd, res.reservedStart, res.reservedEnd)) {
            // Record clash on the request
            await RideRequest.findByIdAndUpdate(
              reqObjId,
              {
                $push: {
                  clashHistory: {
                    riderId: riderObjId,
                    attemptedAt: new Date(),
                    reason: `Direct time conflict with existing reservation (${res.reservedStart.toISOString()} - ${res.reservedEnd.toISOString()})`,
                  },
                },
              },
              { session }
            );

            throw new ConflictError(
              `Time conflict: Toto is already reserved from ${res.reservedStart.toLocaleTimeString()} to ${res.reservedEnd.toLocaleTimeString()}.`
            );
          }
        }

        // b) Repositioning feasibility check
        // Check prior reservation and next reservation
        const priorReservation = await Reservation.findOne({
          vehicleId: vehicle._id,
          status: "active",
          reservedEnd: { $lte: reservedStart },
        })
          .sort({ reservedEnd: -1 })
          .session(session);

        if (priorReservation) {
          const priorTrip = await Trip.findById(priorReservation.tripId).session(session);
          if (priorTrip) {
            const priorRequest = await RideRequest.findById(priorTrip.requestId).session(session);
            if (priorRequest && priorRequest.destinationId.toString() !== request.originId.toString()) {
              // Calculate repositioning time from prior destination to this request origin
              const priorDestLoc = await Location.findById(priorRequest.destinationId).session(session);
              if (priorDestLoc) {
                const { route: repositionRoute } = await calculateRoute(priorDestLoc, originLoc);
                const repositionMinutes = repositionRoute.duration;
                const availableGapMinutes =
                  (reservedStart.getTime() - priorReservation.reservedEnd.getTime()) / (60 * 1000);

                if (availableGapMinutes < repositionMinutes) {
                  const reason = `Insufficient repositioning time: Toto needs ${repositionMinutes} mins to travel from ${priorDestLoc.name} to ${originLoc.name}, but only ${Math.round(availableGapMinutes)} mins are available.`;
                  
                  await RideRequest.findByIdAndUpdate(
                    reqObjId,
                    {
                      $push: {
                        clashHistory: {
                          riderId: riderObjId,
                          attemptedAt: new Date(),
                          reason,
                        },
                      },
                    },
                    { session }
                  );

                  throw new ConflictError(reason);
                }
              }
            }
          }
        }

        // 4. Create Reservation
        const newReservation = new Reservation({
          vehicleId: vehicle._id,
          tripId: new Types.ObjectId(), // placeholder, assigned below
          reservedStart,
          reservedEnd,
          status: "active",
        });

        // 5. Create Trip
        const tripManifest = request.manifest.map((m) => ({
          memberId: m.memberId,
          userId: m.userId,
          name: m.name,
          isFiler: m.isFiler,
          boardingStatus: "unmarked",
          boardingMarkedAt: null,
          boardingMarkedBy: null,
          dropoffStatus: "not_applicable",
          dropoffMarkedAt: null,
          dropoffMarkedBy: null,
        }));

        const newTrip = new Trip({
          _id: newReservation.tripId,
          requestId: request._id,
          vehicleId: vehicle._id,
          riderId: riderObjId,
          status: "accepted",
          reservationId: newReservation._id,
          lifecycle: {
            acceptedAt: new Date(),
          },
          manifest: tripManifest,
          routeSnapshot: snapshot,
          completionReason: null,
          atRisk: false,
        });

        await newReservation.save({ session });
        await newTrip.save({ session });

        // 6. Update RideRequest
        request.status = "accepted";
        request.assignedRiderId = riderObjId;
        request.tripId = newTrip._id as Types.ObjectId;
        request.version += 1;
        await request.save({ session });

        // 7. Record Audit Event
        await AuditEvent.create(
          [
            {
              actorId: riderObjId,
              entityType: "RideRequest",
              entityId: request._id.toString(),
              action: "accept_request",
              before: { status: "pending" },
              after: {
                status: "accepted",
                assignedRiderId: riderObjId,
                tripId: newTrip._id,
              },
              idempotencyKey,
              timestamp: new Date(),
            },
          ],
          { session }
        );

        committedResult = {
          success: true,
          trip: newTrip.toObject(),
          request: request.toObject(),
          message: "Request successfully accepted and trip scheduled.",
        };

        // 8. Save Idempotency Record if key provided
        if (idempotencyKey) {
          await IdempotencyRecord.create(
            [
              {
                actorId: riderObjId,
                action: "accept_request",
                key: idempotencyKey,
                payloadHash: requestId.toString(),
                responseStatus: 200,
                responseBody: committedResult,
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
              },
            ],
            { session }
          );
        }
      });

      return committedResult!;
    } catch (err: any) {
      if (err instanceof ConflictError) {
        throw err;
      }
      if (attempt >= maxRetries) {
        throw new ConflictError(
          `Unable to complete acceptance due to concurrent updates. Please try again. (${err.message})`
        );
      }
      // Brief jitter backoff before retry
      await new Promise((resolve) => setTimeout(resolve, 50 * attempt));
    } finally {
      await session.endSession();
    }
  }

  throw new ConflictError("Acceptance failed due to persistent concurrency clashes.");
}

/**
 * Passenger or Rider cancels an eligible request
 */
export async function cancelRideRequest(
  userId: Types.ObjectId | string,
  role: string,
  requestId: Types.ObjectId | string,
  reason: string = "User requested cancellation"
): Promise<{ success: boolean; message: string }> {
  await connectToDatabase();
  const reqObjId = new Types.ObjectId(requestId);
  const userObjId = new Types.ObjectId(userId);

  const request = await RideRequest.findById(reqObjId);
  if (!request) {
    throw new NotFoundError("Ride request not found.");
  }

  // Authorization: Only the filer or a rider can cancel
  if (role !== "rider" && request.filerId.toString() !== userObjId.toString()) {
    throw new ValidationError("You do not have permission to cancel this request.");
  }

  if (request.status === "cancelled") {
    return { success: true, message: "Request was already cancelled." };
  }

  if (["completed", "in_progress", "picking_up"].includes(request.status)) {
    throw new ConflictError(
      `Cannot cancel request. The trip is already ${request.status.replace("_", " ")}.`
    );
  }

  if (request.status === "accepted" && request.tripId) {
    const trip = await Trip.findById(request.tripId);
    if (trip && trip.status !== "accepted") {
      throw new ConflictError(
        `Cannot cancel request. Trip is already in progress (${trip.status}).`
      );
    }

    // Cancel trip and reservation
    if (trip) {
      trip.status = "cancelled";
      trip.completionReason = "cancelled";
      trip.lifecycle.cancelledAt = new Date();
      await trip.save();

      await Reservation.findOneAndUpdate(
        { tripId: trip._id },
        { status: "cancelled" }
      );
    }
  }

  request.status = "cancelled";
  await request.save();

  await AuditEvent.create({
    actorId: userObjId,
    entityType: "RideRequest",
    entityId: request._id.toString(),
    action: "cancel_request",
    before: { status: request.status },
    after: { status: "cancelled", reason },
    timestamp: new Date(),
  });

  return { success: true, message: "Request successfully cancelled." };
}
