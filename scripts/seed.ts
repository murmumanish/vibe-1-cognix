import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
dotenv.config();

import { User } from "../src/models/User";
import { Location } from "../src/models/Location";
import { Vehicle } from "../src/models/Vehicle";
import { setupIndexes } from "./setup-indexes";

const MONGODB_URI = process.env.MONGODB_URI;

export async function seedDatabase() {
  if (!MONGODB_URI) {
    throw new Error("MONGODB_URI environment variable is required.");
  }

  console.log("Connecting to MongoDB for database seeding...");
  await mongoose.connect(MONGODB_URI);

  // 1. Create indexes
  await setupIndexes();

  console.log("Seeding initial campus locations...");
  // 2. Seed Locations: College, Station, Office
  const initialLocations = [
    {
      code: "COL",
      name: "College",
      active: true,
      coordinateMode: "demo",
      coordinates: { x: 100, y: 150 },
      coordinateVersion: 1,
    },
    {
      code: "STA",
      name: "Station",
      active: true,
      coordinateMode: "demo",
      coordinates: { x: 450, y: 120 },
      coordinateVersion: 1,
    },
    {
      code: "OFF",
      name: "Office",
      active: true,
      coordinateMode: "demo",
      coordinates: { x: 300, y: 350 },
      coordinateVersion: 1,
    },
  ];

  const locationMap = new Map<string, any>();

  for (const loc of initialLocations) {
    const existing = await Location.findOneAndUpdate(
      { code: loc.code },
      { $setOnInsert: loc },
      { upsert: true, new: true }
    );
    locationMap.set(loc.code, existing);
    console.log(`- Location ready: ${loc.name} (${loc.code}) at (${loc.coordinates.x}, ${loc.coordinates.y})`);
  }

  // 3. Seed Singleton Vehicle (Toto-1)
  console.log("Seeding singleton Toto vehicle document...");
  const collegeLoc = locationMap.get("COL");
  const vehicle = await Vehicle.findOneAndUpdate(
    { code: "TOTO-1" },
    {
      $setOnInsert: {
        code: "TOTO-1",
        seatCapacity: parseInt(process.env.VEHICLE_SEAT_CAPACITY || "4", 10),
        currentLocationId: collegeLoc._id,
        activeTripId: null,
        scheduleVersion: 1,
        operationalState: "available",
      },
    },
    { upsert: true, new: true }
  );
  console.log(`- Vehicle ready: ${vehicle.code}, Seat Capacity: ${vehicle.seatCapacity}`);

  // 4. Seed Test Users
  console.log("Seeding test passenger and rider users...");
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash("Password123!", salt);

  const testUsers = [
    { name: "Alice Student", email: "alice@xyz.com", role: "passenger" },
    { name: "Bob Employee", email: "bob@xyz.com", role: "passenger" },
    { name: "Charlie Staff", email: "charlie@xyz.com", role: "passenger" },
    { name: "Rider Dave (Unit 1)", email: "rider1@xyz.com", role: "rider" },
    { name: "Rider Elena (Unit 2)", email: "rider2@xyz.com", role: "rider" },
  ];

  for (const u of testUsers) {
    await User.findOneAndUpdate(
      { email: u.email },
      {
        $setOnInsert: {
          name: u.name,
          email: u.email,
          passwordHash,
          role: u.role,
        },
      },
      { upsert: true }
    );
    console.log(`- User ready: ${u.email} (${u.role})`);
  }

  console.log("\n=======================================================");
  console.log("Seed complete! Internal Mobility Desk is ready.");
  console.log("Test Login Credentials (Password: Password123!):");
  console.log("  Passenger 1: alice@xyz.com");
  console.log("  Passenger 2: bob@xyz.com");
  console.log("  Passenger 3: charlie@xyz.com");
  console.log("  Rider 1:     rider1@xyz.com");
  console.log("  Rider 2:     rider2@xyz.com");
  console.log("=======================================================\n");
}

if (require.main === module || process.argv[1]?.endsWith("seed.ts")) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Seeding error:", err);
      process.exit(1);
    });
}
