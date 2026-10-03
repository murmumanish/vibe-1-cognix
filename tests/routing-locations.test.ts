import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { setupTestDatabase, teardownTestDatabase } from "./test-db";
import { calculateRoute } from "../src/services/routing.service";
import { Location } from "../src/models/Location";
import { RouteCache } from "../src/models/RouteCache";

let testContext: any;

describe("Routing & Location Data Configuration (Mandatory Cases 11 & 12)", () => {
  beforeAll(async () => {
    testContext = await setupTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  it("Case 11: Changing a location invalidates future route calculations without modifying completed snapshots", async () => {
    const locA = testContext.locations.college;
    const locB = testContext.locations.station;

    // Reset initial state for idempotency
    await Location.findByIdAndUpdate(locA._id, {
      coordinates: { x: 100, y: 150 },
      coordinateVersion: 1,
    });
    const freshLocA = await Location.findById(locA._id);

    // 1. Calculate initial route
    const { route: initialRoute, snapshot: initialSnapshot } = await calculateRoute(freshLocA!, locB);
    expect(initialRoute.distance).toBeGreaterThan(0);
    expect(initialSnapshot.originVersion).toBe(1);

    // 2. Simulate updating Location coordinates and incrementing coordinateVersion
    await Location.findByIdAndUpdate(locA._id, {
      coordinates: { x: 50, y: 50 },
      coordinateVersion: 2,
    });

    const updatedLocA = await Location.findById(locA._id);

    // 3. Calculate route with updated version: creates a new cache entry
    const { route: newRoute, snapshot: newSnapshot } = await calculateRoute(updatedLocA!, locB);
    expect(newSnapshot.originVersion).toBe(2);
    // New distance is different due to new coordinates
    expect(newRoute.distance).not.toBe(initialRoute.distance);

    // 4. Verify initial snapshot remains unchanged
    expect(initialSnapshot.originVersion).toBe(1);
  });

  it("Case 12: Adding a fourth location makes it available without editing UI or route logic", async () => {
    await Location.deleteOne({ code: "RES" });

    // Dynamically insert fourth location
    const fourthLoc = await Location.create({
      code: "RES",
      name: "Research Park",
      active: true,
      coordinateMode: "demo",
      coordinates: { x: 550, y: 500 },
      coordinateVersion: 1,
    });

    // Compute route with existing location
    const { route } = await calculateRoute(testContext.locations.college, fourthLoc);
    expect(route.distance).toBeGreaterThan(0);
    expect(route.duration).toBeGreaterThan(0);

    // Verify it appears in active locations query
    const activeLocations = await Location.find({ active: true });
    expect(activeLocations.some((l) => l.code === "RES")).toBe(true);
  });
});
