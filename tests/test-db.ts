import "dotenv/config";
import dns from "node:dns";
import mongoose from "mongoose";
import { Location } from "../src/models/Location";
import { Vehicle } from "../src/models/Vehicle";
import { User } from "../src/models/User";

try {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
} catch (e) {
  // ignore if restricted
}

const MONGODB_URI = process.env.MONGODB_URI;

export async function setupTestDatabase() {
  if (MONGODB_URI) {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
    }
  }


  // Ensure test collections exist or mock them
  let college = await Location.findOne({ code: "COL" });
  if (!college && mongoose.connection.readyState === 1) {
    college = await Location.create({
      code: "COL",
      name: "College",
      active: true,
      coordinateMode: "demo",
      coordinates: { x: 100, y: 150 },
      coordinateVersion: 1,
    });
  } else if (!college) {
    college = new Location({
      _id: new mongoose.Types.ObjectId(),
      code: "COL",
      name: "College",
      active: true,
      coordinateMode: "demo",
      coordinates: { x: 100, y: 150 },
      coordinateVersion: 1,
    });
  }

  let station = await Location.findOne({ code: "STA" });
  if (!station && mongoose.connection.readyState === 1) {
    station = await Location.create({
      code: "STA",
      name: "Station",
      active: true,
      coordinateMode: "demo",
      coordinates: { x: 450, y: 120 },
      coordinateVersion: 1,
    });
  } else if (!station) {
    station = new Location({
      _id: new mongoose.Types.ObjectId(),
      code: "STA",
      name: "Station",
      active: true,
      coordinateMode: "demo",
      coordinates: { x: 450, y: 120 },
      coordinateVersion: 1,
    });
  }

  let office = await Location.findOne({ code: "OFF" });
  if (!office && mongoose.connection.readyState === 1) {
    office = await Location.create({
      code: "OFF",
      name: "Office",
      active: true,
      coordinateMode: "demo",
      coordinates: { x: 300, y: 350 },
      coordinateVersion: 1,
    });
  } else if (!office) {
    office = new Location({
      _id: new mongoose.Types.ObjectId(),
      code: "OFF",
      name: "Office",
      active: true,
      coordinateMode: "demo",
      coordinates: { x: 300, y: 350 },
      coordinateVersion: 1,
    });
  }

  let vehicle = await Vehicle.findOne({ code: "TOTO-1" });
  if (!vehicle && mongoose.connection.readyState === 1) {
    vehicle = await Vehicle.create({
      code: "TOTO-1",
      seatCapacity: 4,
      currentLocationId: college._id,
      activeTripId: null,
      scheduleVersion: 1,
      operationalState: "available",
    });
  } else if (!vehicle) {
    vehicle = new Vehicle({
      _id: new mongoose.Types.ObjectId(),
      code: "TOTO-1",
      seatCapacity: 4,
      currentLocationId: college._id,
      activeTripId: null,
      scheduleVersion: 1,
      operationalState: "available",
    });
  }

  const salt = "dummy_hash";
  const alice = await User.findOneAndUpdate(
    { email: "alice@test.com" },
    { $setOnInsert: { name: "Alice", email: "alice@test.com", role: "passenger", passwordHash: salt } },
    { upsert: true, new: true }
  );
  const bob = await User.findOneAndUpdate(
    { email: "bob@test.com" },
    { $setOnInsert: { name: "Bob", email: "bob@test.com", role: "passenger", passwordHash: salt } },
    { upsert: true, new: true }
  );
  const charlie = await User.findOneAndUpdate(
    { email: "charlie@test.com" },
    { $setOnInsert: { name: "Charlie", email: "charlie@test.com", role: "passenger", passwordHash: salt } },
    { upsert: true, new: true }
  );
  const rider1 = await User.findOneAndUpdate(
    { email: "rider1@test.com" },
    { $setOnInsert: { name: "Rider One", email: "rider1@test.com", role: "rider", passwordHash: salt } },
    { upsert: true, new: true }
  );
  const rider2 = await User.findOneAndUpdate(
    { email: "rider2@test.com" },
    { $setOnInsert: { name: "Rider Two", email: "rider2@test.com", role: "rider", passwordHash: salt } },
    { upsert: true, new: true }
  );

  return {
    locations: { college, station, office },
    vehicle,
    users: { alice, bob, charlie, rider1, rider2 },
  };
}

export async function teardownTestDatabase() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}

export async function clearTestCollections() {
  if (mongoose.connection.readyState === 1) {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      if (key !== "locations" && key !== "vehicles") {
        await collections[key].deleteMany({});
      }
    }
  }
}
