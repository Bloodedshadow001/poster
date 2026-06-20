import mongoose from "mongoose";

const draftSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    title: { type: String, trim: true, maxlength: 90 },
    description: { type: String, trim: true, maxlength: 600 },
    type: { type: String, trim: true, maxlength: 80 },
    audience: { type: String, trim: true, maxlength: 80 },
    partner: { type: String, trim: true, maxlength: 120 }
  },
  { timestamps: true }
);

export const Draft = mongoose.model("Draft", draftSchema);
