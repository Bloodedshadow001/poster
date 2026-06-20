import mongoose from "mongoose";

const webhookEventSchema = new mongoose.Schema(
  {
    provider: { type: String, default: "stripe", trim: true, maxlength: 40 },
    eventId: { type: String, required: true, trim: true, maxlength: 160 },
    type: { type: String, required: true, trim: true, maxlength: 120 },
    processed: { type: Boolean, default: false },
    summary: { type: String, default: "", trim: true, maxlength: 500 }
  },
  { timestamps: true }
);

webhookEventSchema.index({ provider: 1, eventId: 1 }, { unique: true });

export const WebhookEvent = mongoose.model("WebhookEvent", webhookEventSchema);
