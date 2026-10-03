import mongoose, { Schema, Model } from "mongoose";
import { ITrip } from "@/types";

const TripManifestMemberSchema = new Schema(
  {
    memberId: { type: String, required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    name: { type: String, required: true, trim: true },
    isFiler: { type: Boolean, default: false },
    boardingStatus: {
      type: String,
      enum: ["unmarked", "boarded", "missed"],
      default: "unmarked",
      required: true,
    },
    boardingMarkedAt: { type: Date, default: null },
    boardingMarkedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    dropoffStatus: {
      type: String,
      enum: ["not_applicable", "pending", "dropped"],
      default: "not_applicable",
      required: true,
    },
    dropoffMarkedAt: { type: Date, default: null },
    dropoffMarkedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { _id: false }
);

const RouteSnapshotSchema = new Schema(
  {
    distance: { type: Number, required: true },
    duration: { type: Number, required: true },
    mode: { type: String, enum: ["demo", "geographic"], required: true },
    geometry: { type: Schema.Types.Mixed, default: null },
    waypoints: { type: [Schema.Types.Mixed], default: [] },
    stops: [
      {
        locationId: { type: Schema.Types.ObjectId, ref: "Location" },
        name: { type: String },
        type: { type: String, enum: ["origin", "destination", "reposition"] },
        etaMinutes: { type: Number },
      },
    ],
    originVersion: { type: Number, required: true },
    destinationVersion: { type: Number, required: true },
    calculatedAt: { type: Date, default: Date.now },
    provider: { type: String, default: "demo" },
  },
  { _id: false }
);

const TripSchema = new Schema<ITrip>(
  {
    requestId: {
      type: Schema.Types.ObjectId,
      ref: "RideRequest",
      required: true,
      unique: true,
      index: true,
    },
    vehicleId: {
      type: Schema.Types.ObjectId,
      ref: "Vehicle",
      required: true,
      index: true,
    },
    riderId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["accepted", "picking_up", "in_progress", "completed", "cancelled"],
      default: "accepted",
      required: true,
      index: true,
    },
    reservationId: {
      type: Schema.Types.ObjectId,
      ref: "Reservation",
      required: true,
    },
    lifecycle: {
      acceptedAt: { type: Date, default: Date.now },
      pickupStartedAt: { type: Date, default: null },
      departedAt: { type: Date, default: null },
      completedAt: { type: Date, default: null },
      cancelledAt: { type: Date, default: null },
    },
    manifest: { type: [TripManifestMemberSchema], required: true },
    routeSnapshot: { type: RouteSnapshotSchema, required: true },
    completionReason: {
      type: String,
      enum: ["normal", "no_show", "cancelled"],
      default: null,
    },
    atRisk: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  }
);

TripSchema.index({ riderId: 1, createdAt: -1 });
TripSchema.index({ status: 1, createdAt: -1 });
TripSchema.index({
  "manifest.userId": 1,
  "manifest.boardingStatus": 1,
  "manifest.dropoffStatus": 1,
});

export const Trip: Model<ITrip> =
  mongoose.models.Trip || mongoose.model<ITrip>("Trip", TripSchema);
