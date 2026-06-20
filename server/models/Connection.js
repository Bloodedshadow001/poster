import mongoose from "mongoose";

const connectionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    businessName: { type: String, required: true, trim: true, maxlength: 120 },
    status: { type: String, enum: ["pending", "connected"], default: "pending" }
  },
  { timestamps: true }
);

connectionSchema.index({ user: 1, businessName: 1 }, { unique: true });

export const Connection = mongoose.model("Connection", connectionSchema);
