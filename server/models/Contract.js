import mongoose from "mongoose";

const contractSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    recipientBusinessName: { type: String, required: true, trim: true, maxlength: 120 },
    promotion: { type: mongoose.Schema.Types.ObjectId, ref: "Promotion" },
    promotionTitle: { type: String, trim: true, maxlength: 120 },
    amount: { type: Number, required: true, min: 100 },
    currency: { type: String, default: "usd", lowercase: true, trim: true },
    documentText: { type: String, default: "", trim: true, maxlength: 4000 },
    paymentStatus: { type: String, enum: ["pending", "paid", "failed", "cancelled"], default: "pending" },
    status: { type: String, enum: ["awaiting_payment", "offered", "accepted", "declined", "closed"], default: "awaiting_payment" }
  },
  { timestamps: true }
);

contractSchema.index({ user: 1, recipientBusinessName: 1, promotionTitle: 1 });
contractSchema.index({ user: 1, createdAt: -1 });
contractSchema.index({ user: 1, status: 1, createdAt: -1 });

export const Contract = mongoose.model("Contract", contractSchema);
