import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { Trip } from "@/models/Trip";
import { Vehicle } from "@/models/Vehicle";
import { Reservation } from "@/models/Reservation";
import { RideRequest } from "@/models/RideRequest";
import { AuditEvent } from "@/models/AuditEvent";
import { ConflictError, NotFoundError, ForbiddenError, ValidationError } from "@/lib/errors";
import { ITrip, BoardingStatus, DropoffStatus } from "@/types";

/**
 * 1. Start Pickup: Claims the Toto exclusively for this trip.
 */
export async function startPickup(
  riderId: Types.ObjectId | string,
  tripId: Types.ObjectId | string
): Promise<ITrip> {
  await connectToDatabase();
  const riderObjId = new Types.ObjectId(riderId);
  const tripObjId = new Types.ObjectId(tripId);

  const trip = await Trip.findById(tripObjId);
  if (!trip) throw new NotFoundError("Trip not found.");

  // Role check: Only assigned rider can operate
  if (trip.riderId.toString() !== riderObjId.toString()) {
    throw new ForbiddenError("Only the assigned rider may start this trip.");
  }

  if (trip.status !== "accepted") {
    throw new ConflictError(`Cannot start pickup. Trip is currently in '${trip.status}' status.`);
  }

  // Atomic conditional vehicle claim: activeTripId MUST be null
  const vehicle = await Vehicle.findOneAndUpdate(
    { _id: trip.vehicleId, activeTripId: null },
    { activeTripId: trip._id, operationalState: "busy" },
    { new: true }
  );

  if (!vehicle) {
    // Check which trip is currently holding the vehicle
    const currentVehicle = await Vehicle.findById(trip.vehicleId);
    throw new ConflictError(
      `Cannot start pickup: Toto vehicle is currently active on trip ${currentVehicle?.activeTripId}. Exactly one trip may be active at any time.`
    );
  }

  trip.status = "picking_up";
  trip.lifecycle.pickupStartedAt = new Date();
  await trip.save();

  await RideRequest.findByIdAndUpdate(trip.requestId, { status: "picking_up" });

  await AuditEvent.create({
    actorId: riderObjId,
    entityType: "Trip",
    entityId: trip._id.toString(),
    action: "start_pickup",
    before: { status: "accepted" },
    after: { status: "picking_up", activeTripId: trip._id },
    timestamp: new Date(),
  });

  return trip.toObject();
}

/**
 * 2. Mark Member Boarding: Mark Boarded or Missed during pickup
 */
export async function updateBoardingStatus(
  riderId: Types.ObjectId | string,
  tripId: Types.ObjectId | string,
  memberId: string,
  status: BoardingStatus
): Promise<ITrip> {
  await connectToDatabase();
  const riderObjId = new Types.ObjectId(riderId);
  const tripObjId = new Types.ObjectId(tripId);

  const trip = await Trip.findById(tripObjId);
  if (!trip) throw new NotFoundError("Trip not found.");

  if (trip.riderId.toString() !== riderObjId.toString()) {
    throw new ForbiddenError("Only the assigned rider may mark passenger attendance.");
  }

  if (trip.status !== "picking_up") {
    throw new ConflictError(
      `Attendance can only be modified during 'picking_up' status. Current status: ${trip.status}`
    );
  }

  const member = trip.manifest.find((m) => m.memberId === memberId);
  if (!member) {
    throw new NotFoundError(`Passenger member '${memberId}' not found on this trip manifest.`);
  }

  const previousStatus = member.boardingStatus;
  member.boardingStatus = status;
  member.boardingMarkedAt = new Date();
  member.boardingMarkedBy = riderObjId;

  await trip.save();

  await AuditEvent.create({
    actorId: riderObjId,
    entityType: "Attendance",
    entityId: `${trip._id}:${memberId}`,
    action: "mark_boarding",
    before: { boardingStatus: previousStatus },
    after: { boardingStatus: status, markedAt: member.boardingMarkedAt },
    timestamp: new Date(),
  });

  return trip.toObject();
}

/**
 * 3. Depart: Transition from picking_up to in_progress (or no_show completion if everyone missed)
 */
export async function departTrip(
  riderId: Types.ObjectId | string,
  tripId: Types.ObjectId | string
): Promise<{ trip: ITrip; completedAsNoShow: boolean }> {
  await connectToDatabase();
  const riderObjId = new Types.ObjectId(riderId);
  const tripObjId = new Types.ObjectId(tripId);

  const trip = await Trip.findById(tripObjId);
  if (!trip) throw new NotFoundError("Trip not found.");

  if (trip.riderId.toString() !== riderObjId.toString()) {
    throw new ForbiddenError("Only the assigned rider may depart this trip.");
  }

  if (trip.status !== "picking_up") {
    throw new ConflictError(`Cannot depart. Trip is currently in '${trip.status}' status.`);
  }

  // Require EVERY member to be either Boarded or Missed
  const unmarkedMembers = trip.manifest.filter((m) => m.boardingStatus === "unmarked");
  if (unmarkedMembers.length > 0) {
    const names = unmarkedMembers.map((m) => m.name).join(", ");
    throw new ValidationError(
      `Cannot depart: The following passengers have not been marked yet: ${names}. Please click 'Board' if they boarded, or 'Missed' if they are absent.`
    );
  }

  const boardedMembers = trip.manifest.filter((m) => m.boardingStatus === "boarded");
  const missedMembers = trip.manifest.filter((m) => m.boardingStatus === "missed");

  // Check if EVERYONE missed (No-show completion)
  if (boardedMembers.length === 0 && missedMembers.length > 0) {
    // Release vehicle immediately
    await Vehicle.findByIdAndUpdate(trip.vehicleId, {
      activeTripId: null,
      operationalState: "available",
    });

    trip.status = "completed";
    trip.completionReason = "no_show";
    trip.lifecycle.completedAt = new Date();
    await trip.save();

    await Reservation.findOneAndUpdate(
      { tripId: trip._id },
      { status: "completed" }
    );

    await RideRequest.findByIdAndUpdate(trip.requestId, { status: "completed" });

    await AuditEvent.create({
      actorId: riderObjId,
      entityType: "Trip",
      entityId: trip._id.toString(),
      action: "no_show_completion",
      before: { status: "picking_up" },
      after: { status: "completed", completionReason: "no_show", transportedCount: 0 },
      timestamp: new Date(),
    });

    return { trip: trip.toObject(), completedAsNoShow: true };
  }

  // Regular departure: Set dropoffStatus = 'pending' for all boarded passengers
  for (const m of trip.manifest) {
    if (m.boardingStatus === "boarded") {
      m.dropoffStatus = "pending";
    } else {
      m.dropoffStatus = "not_applicable";
    }
  }

  trip.status = "in_progress";
  trip.lifecycle.departedAt = new Date();
  await trip.save();

  await RideRequest.findByIdAndUpdate(trip.requestId, { status: "in_progress" });

  await AuditEvent.create({
    actorId: riderObjId,
    entityType: "Trip",
    entityId: trip._id.toString(),
    action: "depart_trip",
    before: { status: "picking_up" },
    after: { status: "in_progress", boardedCount: boardedMembers.length },
    timestamp: new Date(),
  });

  return { trip: trip.toObject(), completedAsNoShow: false };
}

/**
 * 4. Drop off: Mark boarded passenger as dropped off
 */
export async function updateDropoffStatus(
  riderId: Types.ObjectId | string,
  tripId: Types.ObjectId | string,
  memberId: string
): Promise<ITrip> {
  await connectToDatabase();
  const riderObjId = new Types.ObjectId(riderId);
  const tripObjId = new Types.ObjectId(tripId);

  const trip = await Trip.findById(tripObjId);
  if (!trip) throw new NotFoundError("Trip not found.");

  if (trip.riderId.toString() !== riderObjId.toString()) {
    throw new ForbiddenError("Only the assigned rider may mark drop-offs.");
  }

  if (trip.status !== "in_progress") {
    throw new ConflictError(
      `Drop-offs can only be recorded when the trip is 'in_progress'. Current status: ${trip.status}`
    );
  }

  const member = trip.manifest.find((m) => m.memberId === memberId);
  if (!member) {
    throw new NotFoundError(`Passenger member '${memberId}' not found on this trip manifest.`);
  }

  if (member.boardingStatus !== "boarded") {
    throw new ValidationError(
      `Cannot drop off passenger '${member.name}': They were marked as '${member.boardingStatus}'. Only boarded passengers can be dropped off.`
    );
  }

  member.dropoffStatus = "dropped";
  member.dropoffMarkedAt = new Date();
  member.dropoffMarkedBy = riderObjId;

  await trip.save();

  await AuditEvent.create({
    actorId: riderObjId,
    entityType: "Attendance",
    entityId: `${trip._id}:${memberId}`,
    action: "mark_dropoff",
    before: { dropoffStatus: "pending" },
    after: { dropoffStatus: "dropped", markedAt: member.dropoffMarkedAt },
    timestamp: new Date(),
  });

  return trip.toObject();
}

/**
 * 5. Complete Trip: Validates all boarded passengers dropped, releases Toto vehicle, closes reservation.
 */
export async function completeTrip(
  riderId: Types.ObjectId | string,
  tripId: Types.ObjectId | string
): Promise<ITrip> {
  await connectToDatabase();
  const riderObjId = new Types.ObjectId(riderId);
  const tripObjId = new Types.ObjectId(tripId);

  const trip = await Trip.findById(tripObjId);
  if (!trip) throw new NotFoundError("Trip not found.");

  if (trip.riderId.toString() !== riderObjId.toString()) {
    throw new ForbiddenError("Only the assigned rider may complete this trip.");
  }

  if (trip.status !== "in_progress") {
    throw new ConflictError(`Cannot complete trip in '${trip.status}' status.`);
  }

  // Require EVERY boarded person to be dropped
  const pendingDropoffs = trip.manifest.filter(
    (m) => m.boardingStatus === "boarded" && m.dropoffStatus !== "dropped"
  );

  if (pendingDropoffs.length > 0) {
    const names = pendingDropoffs.map((m) => m.name).join(", ");
    throw new ValidationError(
      `Cannot complete trip: The following boarded passengers have not been marked dropped off: ${names}.`
    );
  }

  // Fetch request to update vehicle location to destination
  const request = await RideRequest.findById(trip.requestId);
  const destinationId = request ? request.destinationId : null;

  // Release vehicle and update current location
  const updateData: any = {
    activeTripId: null,
    operationalState: "available",
  };
  if (destinationId) {
    updateData.currentLocationId = destinationId;
  }

  await Vehicle.findByIdAndUpdate(trip.vehicleId, updateData);

  // Close reservation
  await Reservation.findOneAndUpdate(
    { tripId: trip._id },
    { status: "completed" }
  );

  trip.status = "completed";
  trip.completionReason = "normal";
  trip.lifecycle.completedAt = new Date();
  await trip.save();

  await RideRequest.findByIdAndUpdate(trip.requestId, { status: "completed" });

  await AuditEvent.create({
    actorId: riderObjId,
    entityType: "Trip",
    entityId: trip._id.toString(),
    action: "complete_trip",
    before: { status: "in_progress" },
    after: { status: "completed", completionReason: "normal", destinationId },
    timestamp: new Date(),
  });

  return trip.toObject();
}
