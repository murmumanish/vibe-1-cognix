import mongoose, { Schema, Model } from "mongoose";
import { IRideRequest } from "@/types";

const ManifestMemberSchema = new Schema(
  {
    memberId: { type: String, required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, lowercase: true, trim: true },
    isFiler: { type: Boolean, default: false },
  },
  { _id: false }
);

const ClashRecordSchema = new Schema(
  {
    riderId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    attemptedAt: { type: Date, default: Date.now },
    reason: { type: String, required: true },
  },
  { _id: false }
);

const LocationSnapshotSchema = new Schema(
  {
    code: { type: String, required: true },
    name: { type: String, required: true },
    coordinates: { type: Schema.Types.Mixed, required: true },
    coordinateMode: { type: String, enum: ["demo", "geographic"], required: true },
  },
  { _id: false }
);

const RideRequestSchema = new Schema<IRideRequest>(
  {
    filerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    originId: { type: Schema.Types.ObjectId, ref: "Location", required: true },
    destinationId: { type: Schema.Types.ObjectId, ref: "Location", required: true },
    originSnapshot: { type: LocationSnapshotSchema, required: true },
    destinationSnapshot: { type: LocationSnapshotSchema, required: true },
    pickupInstant: { type: Date, required: true, index: true },
    latestPickupInstant: { type: Date, required: true },
    passengerCount: { type: Number, required: true, min: 1 },
    manifest: { type: [ManifestMemberSchema], required: true },
    notes: { type: String, default: "" },
    status: {
      type: String,
      enum: ["pending", "accepted", "cancelled", "clashed"],
      default: "pending",
      required: true,
      index: true,
    },
    clashHistory: { type: [ClashRecordSchema], default: [] },
    assignedRiderId: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    tripId: { type: Schema.Types.ObjectId, ref: "Trip", default: null },
    version: { type: Number, default: 1 },
  },
  {
    timestamps: true,
  }
);

RideRequestSchema.index({ status: 1, pickupInstant: 1 });
RideRequestSchema.index({ filerId: 1, createdAt: -1 });

export const RideRequest: Model<IRideRequest> =
  mongoose.models.RideRequest ||
  mongoose.model<IRideRequest>("RideRequest", RideRequestSchema);
