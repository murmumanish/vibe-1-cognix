import mongoose, { Schema, Model } from "mongoose";
import { IRateLimit } from "@/types";

const RateLimitSchema = new Schema<IRateLimit>({
  key: { type: String, required: true, index: true },
  count: { type: Number, required: true, default: 1 },
  resetAt: { type: Date, required: true, index: { expires: 0 } },
});

export const RateLimit: Model<IRateLimit> =
  mongoose.models.RateLimit || mongoose.model<IRateLimit>("RateLimit", RateLimitSchema);
