import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { setupTestDatabase, teardownTestDatabase, clearTestCollections } from "./test-db";
import { acceptRideRequest, cancelRideRequest } from "../src/services/scheduling.service";
import { RideRequest } from "../src/models/RideRequest";
import { Trip } from "../src/models/Trip";
import { Reservation } from "../src/models/Reservation";
import { Vehicle } from "../src/models/Vehicle";

let testContext: any;

describe("Trip Scheduling & Concurrency Protection (Mandatory Cases 1, 2, 3, 6, 13)", () => {
  beforeAll(async () => {
    testContext = await setupTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await clearTestCollections();
    // Reset vehicle state
    await Vehicle.findByIdAndUpdate(testContext.vehicle._id, {
      activeTripId: null,
      operationalState: "available",
      scheduleVersion: 1,
    });
  });

  it("Case 1: Two requests for the same pickup time; one accepted, the other reports Clash", async () => {
    const pickupInstant = new Date(Date.now() + 60 * 60 * 1000); // 1 hr from now

    // Create two conflicting requests for the same time
    const req1 = await RideRequest.create({
      filerId: testContext.users.alice._id,
      originId: testContext.locations.college._id,
      destinationId: testContext.locations.station._id,
      originSnapshot: testContext.locations.college,
      destinationSnapshot: testContext.locations.station,
      pickupInstant,
      latestPickupInstant: pickupInstant,
      passengerCount: 1,
      manifest: [{ memberId: "m1", name: "Alice", isFiler: true, boardingStatus: "unmarked", dropoffStatus: "not_applicable" }],
      status: "pending",
      clashHistory: [],
    });

    const req2 = await RideRequest.create({
      filerId: testContext.users.bob._id,
      originId: testContext.locations.college._id,
      destinationId: testContext.locations.office._id,
      originSnapshot: testContext.locations.college,
      destinationSnapshot: testContext.locations.office,
      pickupInstant,
      latestPickupInstant: pickupInstant,
      passengerCount: 1,
      manifest: [{ memberId: "m2", name: "Bob", isFiler: true, boardingStatus: "unmarked", dropoffStatus: "not_applicable" }],
      status: "pending",
      clashHistory: [],
    });

    // Accept first request
    const result1 = await acceptRideRequest(testContext.users.rider1._id, req1._id);
    expect(result1.success).toBe(true);

    // Accept second conflicting request: must fail with Clash
    await expect(
      acceptRideRequest(testContext.users.rider2._id, req2._id)
    ).rejects.toThrow(/Time conflict|clash/i);

    // Verify only one committed trip and one active reservation exist
    const trips = await Trip.find({ status: "accepted" });
    expect(trips.length).toBe(1);
    expect(trips[0].requestId.toString()).toBe(req1._id.toString());

    const reservations = await Reservation.find({ status: "active" });
    expect(reservations.length).toBe(1);

    // Verify req2 recorded the clash attempt in clashHistory
    const updatedReq2 = await RideRequest.findById(req2._id);
    expect(updatedReq2?.status).toBe("pending");
    expect(updatedReq2?.clashHistory.length).toBe(1);
  });

  it("Case 2: Simultaneous acceptance calls for conflicting requests commit exactly one trip", async () => {
    const pickupInstant = new Date(Date.now() + 120 * 60 * 1000);

    const reqA = await RideRequest.create({
      filerId: testContext.users.alice._id,
      originId: testContext.locations.station._id,
      destinationId: testContext.locations.office._id,
      originSnapshot: testContext.locations.station,
      destinationSnapshot: testContext.locations.office,
      pickupInstant,
      latestPickupInstant: pickupInstant,
      passengerCount: 1,
      manifest: [{ memberId: "mA", name: "Alice", isFiler: true, boardingStatus: "unmarked", dropoffStatus: "not_applicable" }],
      status: "pending",
      clashHistory: [],
    });

    const reqB = await RideRequest.create({
      filerId: testContext.users.bob._id,
      originId: testContext.locations.college._id,
      destinationId: testContext.locations.station._id,
      originSnapshot: testContext.locations.college,
      destinationSnapshot: testContext.locations.station,
      pickupInstant,
      latestPickupInstant: pickupInstant,
      passengerCount: 1,
      manifest: [{ memberId: "mB", name: "Bob", isFiler: true, boardingStatus: "unmarked", dropoffStatus: "not_applicable" }],
      status: "pending",
      clashHistory: [],
    });

    // Execute concurrently using Promise.allSettled
    const [resA, resB] = await Promise.allSettled([
      acceptRideRequest(testContext.users.rider1._id, reqA._id),
      acceptRideRequest(testContext.users.rider2._id, reqB._id),
    ]);

    // Exactly one must be fulfilled, exactly one must be rejected
    const fulfilledCount = [resA, resB].filter((r) => r.status === "fulfilled").length;
    const rejectedCount = [resA, resB].filter((r) => r.status === "rejected").length;

    expect(fulfilledCount).toBe(1);
    expect(rejectedCount).toBe(1);

    const committedTrips = await Trip.find({ status: "accepted" });
    expect(committedTrips.length).toBe(1);
  });

  it("Case 3: Two riders accept the same request concurrently: exactly one trip exists", async () => {
    const pickupInstant = new Date(Date.now() + 180 * 60 * 1000);

    const req = await RideRequest.create({
      filerId: testContext.users.alice._id,
      originId: testContext.locations.college._id,
      destinationId: testContext.locations.office._id,
      originSnapshot: testContext.locations.college,
      destinationSnapshot: testContext.locations.office,
      pickupInstant,
      latestPickupInstant: pickupInstant,
      passengerCount: 1,
      manifest: [{ memberId: "m1", name: "Alice", isFiler: true, boardingStatus: "unmarked", dropoffStatus: "not_applicable" }],
      status: "pending",
      clashHistory: [],
    });

    // Send simultaneous acceptances for the same request
    const results = await Promise.allSettled([
      acceptRideRequest(testContext.users.rider1._id, req._id),
      acceptRideRequest(testContext.users.rider2._id, req._id),
    ]);

    const trips = await Trip.find({ requestId: req._id });
    expect(trips.length).toBe(1);

    const updatedReq = await RideRequest.findById(req._id);
    expect(updatedReq?.status).toBe("accepted");
  });

  it("Case 6: Overlapping intervals clash even if pickup timestamps differ, and insufficient repositioning time clashes", async () => {
    const basePickup = new Date(Date.now() + 240 * 60 * 1000);

    // Trip 1: College -> Station at basePickup (duration ~24 mins + 10 mins buffer = 34 mins)
    const req1 = await RideRequest.create({
      filerId: testContext.users.alice._id,
      originId: testContext.locations.college._id,
      destinationId: testContext.locations.station._id,
      originSnapshot: testContext.locations.college,
      destinationSnapshot: testContext.locations.station,
      pickupInstant: basePickup,
      latestPickupInstant: basePickup,
      passengerCount: 1,
      manifest: [{ memberId: "m1", name: "Alice", isFiler: true, boardingStatus: "unmarked", dropoffStatus: "not_applicable" }],
      status: "pending",
      clashHistory: [],
    });

    await acceptRideRequest(testContext.users.rider1._id, req1._id);

    // Trip 2: Starts 15 minutes after Trip 1 starts (inside Trip 1's reserved window)
    const overlappingPickup = new Date(basePickup.getTime() + 15 * 60 * 1000);
    const reqOverlap = await RideRequest.create({
      filerId: testContext.users.bob._id,
      originId: testContext.locations.office._id,
      destinationId: testContext.locations.station._id,
      originSnapshot: testContext.locations.office,
      destinationSnapshot: testContext.locations.station,
      pickupInstant: overlappingPickup,
      latestPickupInstant: overlappingPickup,
      passengerCount: 1,
      manifest: [{ memberId: "m2", name: "Bob", isFiler: true, boardingStatus: "unmarked", dropoffStatus: "not_applicable" }],
      status: "pending",
      clashHistory: [],
    });

    await expect(
      acceptRideRequest(testContext.users.rider1._id, reqOverlap._id)
    ).rejects.toThrow(/Time conflict/i);
  });

  it("Case 13: Cancellation maintains schedule consistency and allows new booking", async () => {
    const pickupInstant = new Date(Date.now() + 300 * 60 * 1000);

    const req = await RideRequest.create({
      filerId: testContext.users.alice._id,
      originId: testContext.locations.college._id,
      destinationId: testContext.locations.station._id,
      originSnapshot: testContext.locations.college,
      destinationSnapshot: testContext.locations.station,
      pickupInstant,
      latestPickupInstant: pickupInstant,
      passengerCount: 1,
      manifest: [{ memberId: "m1", name: "Alice", isFiler: true, boardingStatus: "unmarked", dropoffStatus: "not_applicable" }],
      status: "pending",
      clashHistory: [],
    });

    await acceptRideRequest(testContext.users.rider1._id, req._id);

    // Cancel the accepted request
    const cancelRes = await cancelRideRequest(testContext.users.alice._id, "passenger", req._id);
    expect(cancelRes.success).toBe(true);

    const reservation = await Reservation.findOne({ tripId: (await Trip.findOne({ requestId: req._id }))?._id });
    expect(reservation?.status).toBe("cancelled");

    // Now a new request for the same time can be accepted!
    const reqNew = await RideRequest.create({
      filerId: testContext.users.bob._id,
      originId: testContext.locations.college._id,
      destinationId: testContext.locations.station._id,
      originSnapshot: testContext.locations.college,
      destinationSnapshot: testContext.locations.station,
      pickupInstant,
      latestPickupInstant: pickupInstant,
      passengerCount: 1,
      manifest: [{ memberId: "m2", name: "Bob", isFiler: true, boardingStatus: "unmarked", dropoffStatus: "not_applicable" }],
      status: "pending",
      clashHistory: [],
    });

    const newAccept = await acceptRideRequest(testContext.users.rider2._id, reqNew._id);
    expect(newAccept.success).toBe(true);
  });
});
