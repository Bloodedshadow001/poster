import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    recipientBusinessName: { type: String, required: true, trim: true, maxlength: 120 },
    body: { type: String, default: "", trim: true, maxlength: 1000 },
    attachment: {
      url: { type: String, default: "", trim: true, maxlength: 220 },
      name: { type: String, default: "", trim: true, maxlength: 180 },
      type: { type: String, default: "", trim: true, maxlength: 120 },
      size: { type: Number, min: 0, default: 0 }
    },
    direction: { type: String, enum: ["outbound", "inbound"], default: "outbound" },
    contract: { type: mongoose.Schema.Types.ObjectId, ref: "Contract" },
    brief: { type: mongoose.Schema.Types.ObjectId, ref: "AdBrief" },
    quote: { type: mongoose.Schema.Types.ObjectId, ref: "Quote" }
  },
  { timestamps: true }
);

messageSchema.index({ user: 1, recipientBusinessName: 1, createdAt: 1 });

export const Message = mongoose.model("Message", messageSchema);
