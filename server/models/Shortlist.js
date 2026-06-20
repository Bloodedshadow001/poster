import mongoose from "mongoose";

const shortlistSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    expert: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    brief: { type: mongoose.Schema.Types.ObjectId, ref: "AdBrief" }
  },
  { timestamps: true }
);

shortlistSchema.index({ user: 1, name: 1, expert: 1 }, { unique: true });
shortlistSchema.index({ user: 1, createdAt: -1 });

export const Shortlist = mongoose.model("Shortlist", shortlistSchema);
