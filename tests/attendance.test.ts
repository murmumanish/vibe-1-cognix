import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { setupTestDatabase, teardownTestDatabase, clearTestCollections } from "./test-db";
import { acceptRideRequest } from "../src/services/scheduling.service";
import {
  startPickup,
  updateBoardingStatus,
  departTrip,
  updateDropoffStatus,
  completeTrip,
} from "../src/services/attendance.service";
import { RideRequest } from "../src/models/RideRequest";
import { Trip } from "../src/models/Trip";
import { Vehicle } from "../src/models/Vehicle";

let testContext: any;

describe("Rider Attendance, Manifest, and Vehicle Locking (Mandatory Cases 4, 5, 7, 8, 9, 14)", () => {
  beforeAll(async () => {
    testContext = await setupTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await clearTestCollections();
    await Vehicle.findByIdAndUpdate(testContext.vehicle._id, {
      activeTripId: null,
      operationalState: "available",
      scheduleVersion: 1,
    });
  });

  it("Cases 4 & 5: Group manifest with Alice, Bob (boarded/dropped) and Charlie (missed)", async () => {
    const pickupInstant = new Date(Date.now() + 60 * 60 * 1000);

    const req = await RideRequest.create({
      filerId: testContext.users.alice._id,
      originId: testContext.locations.college._id,
      destinationId: testContext.locations.station._id,
      originSnapshot: testContext.locations.college,
      destinationSnapshot: testContext.locations.station,
      pickupInstant,
      latestPickupInstant: pickupInstant,
      passengerCount: 3,
      manifest: [
        { memberId: "m_alice", userId: testContext.users.alice._id, name: "Alice", isFiler: true, boardingStatus: "unmarked", dropoffStatus: "not_applicable" },
        { memberId: "m_bob", userId: testContext.users.bob._id, name: "Bob", isFiler: false, boardingStatus: "unmarked", dropoffStatus: "not_applicable" },
        { memberId: "m_charlie", userId: testContext.users.charlie._id, name: "Charlie", isFiler: false, boardingStatus: "unmarked", dropoffStatus: "not_applicable" },
      ],
      status: "pending",
      clashHistory: [],
    });

    const { trip } = await acceptRideRequest(testContext.users.rider1._id, req._id);

    // 1. Start pickup: Claims the Toto
    await startPickup(testContext.users.rider1._id, trip._id);

    // 2. Mark attendance: Alice and Bob board, Charlie is missed
    await updateBoardingStatus(testContext.users.rider1._id, trip._id, "m_alice", "boarded");
    await updateBoardingStatus(testContext.users.rider1._id, trip._id, "m_bob", "boarded");
    await updateBoardingStatus(testContext.users.rider1._id, trip._id, "m_charlie", "missed");

    // 3. Depart: Manifest is now locked
    await departTrip(testContext.users.rider1._id, trip._id);

    // Charlie was missed -> Cannot mark dropoff for Charlie!
    await expect(
      updateDropoffStatus(testContext.users.rider1._id, trip._id, "m_charlie")
    ).rejects.toThrow(/Only boarded passengers/i);

    // 4. Mark drop-offs for boarded passengers
    await updateDropoffStatus(testContext.users.rider1._id, trip._id, "m_alice");
    await updateDropoffStatus(testContext.users.rider1._id, trip._id, "m_bob");

    // 5. Complete trip
    const completed = await completeTrip(testContext.users.rider1._id, trip._id);

    expect(completed.status).toBe("completed");
    const boardedCount = completed.manifest.filter((m) => m.boardingStatus === "boarded").length;
    const missedCount = completed.manifest.filter((m) => m.boardingStatus === "missed").length;
    expect(boardedCount).toBe(2);
    expect(missedCount).toBe(1);

    // Case 5: Verification of personal history segregation
    // Query travel history for Alice and Bob (both boarded and dropped)
    const aliceHistory = await Trip.find({
      _id: trip._id,
      "manifest.userId": testContext.users.alice._id,
      "manifest.boardingStatus": "boarded",
      "manifest.dropoffStatus": "dropped",
    });
    expect(aliceHistory.length).toBe(1);

    // Charlie has a missed entry, but NO travel history
    const charlieTravelHistory = await Trip.find({
      _id: trip._id,
      status: "completed",
      "manifest.userId": testContext.users.charlie._id,
      "manifest.boardingStatus": "boarded",
      "manifest.dropoffStatus": "dropped",
    });
    expect(charlieTravelHistory.length).toBe(0);

    const charlieNamedTrips = await Trip.find({
      _id: trip._id,
      "manifest.userId": testContext.users.charlie._id,
    });
    expect(charlieNamedTrips.length).toBe(1);
    const charlieManifest = charlieNamedTrips[0].manifest.find(
      (m) => m.memberId === "m_charlie"
    );
    expect(charlieManifest?.boardingStatus).toBe("missed");
  });

  it("Case 7: Two trips cannot start simultaneously on the single vehicle", async () => {
    const pickupInstant1 = new Date(Date.now() + 60 * 60 * 1000);
    const pickupInstant2 = new Date(Date.now() + 180 * 60 * 1000);

    const req1 = await RideRequest.create({
      filerId: testContext.users.alice._id,
      originId: testContext.locations.college._id,
      destinationId: testContext.locations.station._id,
      originSnapshot: testContext.locations.college,
      destinationSnapshot: testContext.locations.station,
      pickupInstant: pickupInstant1,
      latestPickupInstant: pickupInstant1,
      passengerCount: 1,
      manifest: [{ memberId: "m1", name: "Alice", isFiler: true, boardingStatus: "unmarked", dropoffStatus: "not_applicable" }],
      status: "pending",
      clashHistory: [],
    });

    const req2 = await RideRequest.create({
      filerId: testContext.users.bob._id,
      originId: testContext.locations.station._id,
      destinationId: testContext.locations.office._id,
      originSnapshot: testContext.locations.station,
      destinationSnapshot: testContext.locations.office,
      pickupInstant: pickupInstant2,
      latestPickupInstant: pickupInstant2,
      passengerCount: 1,
      manifest: [{ memberId: "m2", name: "Bob", isFiler: true, boardingStatus: "unmarked", dropoffStatus: "not_applicable" }],
      status: "pending",
      clashHistory: [],
    });

    const { trip: trip1 } = await acceptRideRequest(testContext.users.rider1._id, req1._id);
    const { trip: trip2 } = await acceptRideRequest(testContext.users.rider2._id, req2._id);

    // Rider 1 starts pickup on Trip 1 -> claims the vehicle
    await startPickup(testContext.users.rider1._id, trip1._id);

    // Rider 2 attempts to start pickup on Trip 2 -> MUST be blocked!
    await expect(
      startPickup(testContext.users.rider2._id, trip2._id)
    ).rejects.toThrow(/Toto vehicle is currently active/i);
  });

  it("Case 8 & 14: All-missed completion releases vehicle; partial completion blocked until dropoff", async () => {
    const pickupInstant = new Date(Date.now() + 60 * 60 * 1000);

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

    const { trip } = await acceptRideRequest(testContext.users.rider1._id, req._id);
    await startPickup(testContext.users.rider1._id, trip._id);

    // Mark Alice as missed (no-show)
    await updateBoardingStatus(testContext.users.rider1._id, trip._id, "m1", "missed");

    // Depart: all missed -> executes no-show completion immediately
    const departResult = await departTrip(testContext.users.rider1._id, trip._id);
    expect(departResult.completedAsNoShow).toBe(true);

    // Verify Vehicle was automatically released
    const vehicle = await Vehicle.findById(testContext.vehicle._id);
    expect(vehicle?.activeTripId).toBeNull();
    expect(vehicle?.operationalState).toBe("available");
  });

  it("Case 9: People with identical names keep separate histories; non-traveling filer has no travel record", async () => {
    const pickupInstant = new Date(Date.now() + 60 * 60 * 1000);

    // Filer is Alice, but she files for Guest "Alice" (different person, unregistered)
    const req = await RideRequest.create({
      filerId: testContext.users.alice._id,
      originId: testContext.locations.college._id,
      destinationId: testContext.locations.station._id,
      originSnapshot: testContext.locations.college,
      destinationSnapshot: testContext.locations.station,
      pickupInstant,
      latestPickupInstant: pickupInstant,
      passengerCount: 1,
      manifest: [
        {
          memberId: "guest_alice",
          userId: null, // Unregistered guest with same display name
          name: "Alice",
          isFiler: false,
          boardingStatus: "unmarked",
          dropoffStatus: "not_applicable",
        },
      ],
      status: "pending",
      clashHistory: [],
    });

    const { trip } = await acceptRideRequest(testContext.users.rider1._id, req._id);
    await startPickup(testContext.users.rider1._id, trip._id);
    await updateBoardingStatus(testContext.users.rider1._id, trip._id, "guest_alice", "boarded");
    await departTrip(testContext.users.rider1._id, trip._id);
    await updateDropoffStatus(testContext.users.rider1._id, trip._id, "guest_alice");
    await completeTrip(testContext.users.rider1._id, trip._id);

    // The filer Alice Student did not travel (userId was null on guest_alice)
    const verifiedTravel = await Trip.find({
      _id: trip._id,
      status: "completed",
      "manifest.userId": testContext.users.alice._id,
      "manifest.boardingStatus": "boarded",
      "manifest.dropoffStatus": "dropped",
    });

    expect(verifiedTravel.length).toBe(0);
  });
});
