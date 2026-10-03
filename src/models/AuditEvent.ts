import mongoose, { Schema, Model } from "mongoose";
import { IAuditEvent } from "@/types";

const AuditEventSchema = new Schema<IAuditEvent>(
  {
    actorId: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    entityType: { type: String, required: true, index: true },
    entityId: { type: String, required: true, index: true },
    action: { type: String, required: true, index: true },
    before: { type: Schema.Types.Mixed, default: null },
    after: { type: Schema.Types.Mixed, default: null },
    idempotencyKey: { type: String, default: null, index: true },
    timestamp: { type: Date, default: Date.now, index: true },
  },
  {
    timestamps: false, // strictly append-only audit trail
  }
);

export const AuditEvent: Model<IAuditEvent> =
  mongoose.models.AuditEvent ||
  mongoose.model<IAuditEvent>("AuditEvent", AuditEventSchema);
