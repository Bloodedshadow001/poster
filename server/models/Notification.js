import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    body: { type: String, required: true, trim: true, maxlength: 280 },
    type: { type: String, default: "activity", trim: true, maxlength: 40 },
    read: { type: Boolean, default: false },
    linkType: { type: String, default: "", trim: true, maxlength: 40 },
    linkId: { type: String, default: "", trim: true, maxlength: 80 },
    actionLabel: { type: String, default: "", trim: true, maxlength: 80 },
    actionView: { type: String, default: "", trim: true, maxlength: 40 }
  },
  { timestamps: true }
);

notificationSchema.index({ user: 1, read: 1, createdAt: -1 });
notificationSchema.index({ user: 1, createdAt: -1 });

export const Notification = mongoose.model("Notification", notificationSchema);
