import mongoose from "mongoose";

const quoteSchema = new mongoose.Schema(
  {
    brief: { type: mongoose.Schema.Types.ObjectId, ref: "AdBrief", required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    expertName: { type: String, required: true, trim: true, maxlength: 120 },
    amount: { type: String, required: true, trim: true, maxlength: 80 },
    amountMinor: { type: Number, min: 0, default: 0 },
    timeline: { type: String, required: true, trim: true, maxlength: 120 },
    deliveryDays: { type: Number, min: 0, default: 0 },
    message: { type: String, required: true, trim: true, maxlength: 700 },
    matchScore: { type: Number, min: 0, max: 100, default: 0 },
    revisionNote: { type: String, default: "", trim: true, maxlength: 700 },
    revisionCount: { type: Number, min: 0, default: 0 },
    counterAmount: { type: String, default: "", trim: true, maxlength: 80 },
    counterTimeline: { type: String, default: "", trim: true, maxlength: 120 },
    counterMessage: { type: String, default: "", trim: true, maxlength: 700 },
    counterStatus: { type: String, enum: ["none", "proposed", "accepted", "declined"], default: "none" },
    isBid: { type: Boolean, default: false },
    bidExpiresAt: { type: Date },
    shortlisted: { type: Boolean, default: false },
    status: { type: String, enum: ["submitted", "accepted", "declined", "withdrawn"], default: "submitted" }
  },
  { timestamps: true }
);

quoteSchema.index({ brief: 1, createdAt: -1 });
quoteSchema.index({ user: 1, createdAt: -1 });

export const Quote = mongoose.model("Quote", quoteSchema);
