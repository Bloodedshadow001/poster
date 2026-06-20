import mongoose from "mongoose";

const partnerRequestSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    businessName: { type: String, required: true, trim: true, maxlength: 120 },
    note: { type: String, trim: true, maxlength: 240 },
    status: { type: String, enum: ["new", "accepted", "declined"], default: "new" }
  },
  { timestamps: true }
);

partnerRequestSchema.index({ user: 1, status: 1, createdAt: -1 });
partnerRequestSchema.index({ user: 1, createdAt: -1 });

export const PartnerRequest = mongoose.model("PartnerRequest", partnerRequestSchema);
