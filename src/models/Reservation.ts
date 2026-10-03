import mongoose, { Schema, Model } from "mongoose";
import { IReservation } from "@/types";

const ReservationSchema = new Schema<IReservation>(
  {
    vehicleId: {
      type: Schema.Types.ObjectId,
      ref: "Vehicle",
      required: true,
      index: true,
    },
    tripId: {
      type: Schema.Types.ObjectId,
      ref: "Trip",
      required: true,
      index: true,
    },
    reservedStart: { type: Date, required: true },
    reservedEnd: { type: Date, required: true },
    status: {
      type: String,
      enum: ["active", "completed", "cancelled"],
      default: "active",
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index supporting vehicle/reservation interval queries
ReservationSchema.index({ vehicleId: 1, reservedStart: 1, reservedEnd: 1 });
ReservationSchema.index({ vehicleId: 1, status: 1 });

export const Reservation: Model<IReservation> =
  mongoose.models.Reservation ||
  mongoose.model<IReservation>("Reservation", ReservationSchema);
