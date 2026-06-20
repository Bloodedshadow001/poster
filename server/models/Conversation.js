import mongoose from "mongoose";

const conversationSchema = new mongoose.Schema(
  {
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }],
    participantNames: [{ type: String, trim: true, maxlength: 120 }],
    brief: { type: mongoose.Schema.Types.ObjectId, ref: "AdBrief" },
    quote: { type: mongoose.Schema.Types.ObjectId, ref: "Quote" },
    contract: { type: mongoose.Schema.Types.ObjectId, ref: "Contract" },
    lastMessage: { type: String, default: "", trim: true, maxlength: 1000 },
    lastMessageAt: { type: Date },
    unreadBy: [{
      user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      count: { type: Number, min: 0, default: 0 }
    }]
  },
  { timestamps: true }
);

conversationSchema.index({ participants: 1, updatedAt: -1 });
conversationSchema.index({ brief: 1, participants: 1 });

export const Conversation = mongoose.model("Conversation", conversationSchema);
