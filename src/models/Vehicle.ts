import mongoose, { Schema, Model } from "mongoose";
import { IVehicle } from "@/types";

const VehicleSchema = new Schema<IVehicle>(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    seatCapacity: { type: Number, required: true, default: 4 },
    currentLocationId: {
      type: Schema.Types.ObjectId,
      ref: "Location",
      required: true,
    },
    activeTripId: {
      type: Schema.Types.ObjectId,
      ref: "Trip",
      default: null,
      index: true,
    },
    scheduleVersion: {
      type: Number,
      required: true,
      default: 1,
    },
    operationalState: {
      type: String,
      enum: ["available", "busy", "maintenance"],
      default: "available",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

export const Vehicle: Model<IVehicle> =
  mongoose.models.Vehicle || mongoose.model<IVehicle>("Vehicle", VehicleSchema);
