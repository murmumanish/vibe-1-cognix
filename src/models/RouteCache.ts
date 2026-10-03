import mongoose, { Schema, Model } from "mongoose";
import { IRouteCache } from "@/types";

const RouteCacheSchema = new Schema<IRouteCache>(
  {
    cacheKey: { type: String, required: true, unique: true, index: true },
    mode: { type: String, enum: ["demo", "geographic"], required: true },
    distance: { type: Number, required: true },
    duration: { type: Number, required: true },
    geometry: { type: Schema.Types.Mixed, default: null },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
  },
  {
    timestamps: true,
  }
);

export const RouteCache: Model<IRouteCache> =
  mongoose.models.RouteCache ||
  mongoose.model<IRouteCache>("RouteCache", RouteCacheSchema);
