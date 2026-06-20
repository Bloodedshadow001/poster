import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    contract: { type: mongoose.Schema.Types.ObjectId, ref: "Contract", required: true },
    brief: { type: mongoose.Schema.Types.ObjectId, ref: "AdBrief" },
    quote: { type: mongoose.Schema.Types.ObjectId, ref: "Quote" },
    recipientBusinessName: { type: String, required: true, trim: true, maxlength: 120 },
    amount: { type: Number, required: true, min: 100 },
    platformFee: { type: Number, min: 0, default: 0 },
    escrowFee: { type: Number, min: 0, default: 0 },
    totalAmount: { type: Number, min: 100, default: 100 },
    invoiceNumber: { type: String, default: "", trim: true, maxlength: 80 },
    currency: { type: String, default: "usd", lowercase: true, trim: true },
    provider: { type: String, enum: ["stripe", "upi", "manual_upi", "manual"], default: "stripe" },
    providerSessionId: { type: String, trim: true },
    payerUpiId: { type: String, default: "", lowercase: true, trim: true, maxlength: 120 },
    upiVpa: { type: String, default: "", trim: true, maxlength: 120 },
    upiPayeeName: { type: String, default: "", trim: true, maxlength: 120 },
    upiReference: { type: String, default: "", trim: true, maxlength: 80 },
    upiUtr: { type: String, default: "", trim: true, maxlength: 80 },
    upiSubmittedAt: { type: Date },
    upiVerifiedAt: { type: Date },
    releaseStatus: { type: String, enum: ["held", "released", "refunded"], default: "held" },
    releaseNote: { type: String, default: "", trim: true, maxlength: 700 },
    releasedAt: { type: Date },
    refundedAt: { type: Date },
    status: { type: String, enum: ["pending", "paid", "failed", "cancelled", "refunded"], default: "pending" }
  },
  { timestamps: true }
);

paymentSchema.index({ user: 1, contract: 1 });
paymentSchema.index({ user: 1, createdAt: -1 });
paymentSchema.index({ providerSessionId: 1 }, { sparse: true });

export const Payment = mongoose.model("Payment", paymentSchema);
