import mongoose, { Schema, Model } from "mongoose";
import { IIdempotencyRecord } from "@/types";

const IdempotencyRecordSchema = new Schema<IIdempotencyRecord>(
  {
    actorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    action: { type: String, required: true },
    key: { type: String, required: true },
    payloadHash: { type: String, required: true },
    responseStatus: { type: Number, required: true },
    responseBody: { type: Schema.Types.Mixed, required: true },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
  },
  {
    timestamps: true,
  }
);

// Unique compound index scoped to actor and action
IdempotencyRecordSchema.index(
  { actorId: 1, action: 1, key: 1 },
  { unique: true }
);

export const IdempotencyRecord: Model<IIdempotencyRecord> =
  mongoose.models.IdempotencyRecord ||
  mongoose.model<IIdempotencyRecord>("IdempotencyRecord", IdempotencyRecordSchema);
