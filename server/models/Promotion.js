import mongoose from "mongoose";

const promotionSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 90 },
    description: { type: String, required: true, trim: true, maxlength: 600 },
    type: { type: String, required: true, trim: true, maxlength: 80 },
    audience: { type: String, trim: true, maxlength: 80, default: "Audience pending" },
    partner: { type: String, trim: true, maxlength: 120, default: "Partner opportunity" },
    price: { type: String, trim: true, maxlength: 40, default: "New listing" },
    status: { type: String, enum: ["Online", "Offline", "Scheduled"], default: "Online" },
    image: { type: String, trim: true, default: "https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=900&q=80" },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
  },
  { timestamps: true }
);

promotionSchema.index({ title: "text", partner: "text", type: "text", audience: "text", status: "text" });
promotionSchema.index({ status: 1, createdAt: -1 });
promotionSchema.index({ type: 1, createdAt: -1 });
promotionSchema.index({ owner: 1, createdAt: -1 });

export const Promotion = mongoose.model("Promotion", promotionSchema);
