import mongoose, { Schema, Model } from "mongoose";
import { ILocation } from "@/types";

const LocationSchema = new Schema<ILocation>(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    active: { type: Boolean, default: true, index: true },
    coordinateMode: {
      type: String,
      enum: ["demo", "geographic"],
      required: true,
      default: "demo",
    },
    coordinates: {
      type: Schema.Types.Mixed,
      required: true,
      validate: {
        validator: function (val: any) {
          if (!val) return false;
          if (this.coordinateMode === "demo") {
            return typeof val.x === "number" && typeof val.y === "number";
          }
          if (this.coordinateMode === "geographic") {
            return (
              val.type === "Point" &&
              Array.isArray(val.coordinates) &&
              val.coordinates.length === 2 &&
              typeof val.coordinates[0] === "number" && // longitude: -180 to 180
              typeof val.coordinates[1] === "number" && // latitude: -90 to 90
              val.coordinates[0] >= -180 &&
              val.coordinates[0] <= 180 &&
              val.coordinates[1] >= -90 &&
              val.coordinates[1] <= 90
            );
          }
          return false;
        },
        message: "Invalid coordinates for coordinateMode",
      },
    },
    coordinateVersion: { type: Number, default: 1 },
  },
  {
    timestamps: true,
  }
);

// GeoJSON 2dsphere index for geographic mode support
LocationSchema.index({ "coordinates.coordinates": "2dsphere" }, { sparse: true });

export const Location: Model<ILocation> =
  mongoose.models.Location || mongoose.model<ILocation>("Location", LocationSchema);
