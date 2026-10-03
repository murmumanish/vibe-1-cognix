import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

import { User } from "../src/models/User";
import { Session } from "../src/models/Session";
import { Location } from "../src/models/Location";
import { Vehicle } from "../src/models/Vehicle";
import { RideRequest } from "../src/models/RideRequest";
import { Trip } from "../src/models/Trip";
import { Reservation } from "../src/models/Reservation";
import { AuditEvent } from "../src/models/AuditEvent";
import { IdempotencyRecord } from "../src/models/IdempotencyRecord";
import { RouteCache } from "../src/models/RouteCache";
import { RateLimit } from "../src/models/RateLimit";

const MONGODB_URI = process.env.MONGODB_URI;

export async function setupIndexes() {
  if (!MONGODB_URI) {
    throw new Error("MONGODB_URI is not defined. Please set it in .env or environment.");
  }

  console.log("Connecting to MongoDB to create database indexes...");
  await mongoose.connect(MONGODB_URI);

  const models = [
    User,
    Session,
    Location,
    Vehicle,
    RideRequest,
    Trip,
    Reservation,
    AuditEvent,
    IdempotencyRecord,
    RouteCache,
    RateLimit,
  ];

  for (const model of models) {
    console.log(`Ensuring indexes for ${model.modelName}...`);
    await model.createIndexes();
  }

  console.log("All collection indexes created successfully!");
}

if (require.main === module || process.argv[1]?.endsWith("setup-indexes.ts")) {
  setupIndexes()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Index creation error:", err);
      process.exit(1);
    });
}
