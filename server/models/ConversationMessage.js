import mongoose from "mongoose";

const conversationMessageSchema = new mongoose.Schema(
  {
    conversation: { type: mongoose.Schema.Types.ObjectId, ref: "Conversation", required: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    senderName: { type: String, required: true, trim: true, maxlength: 120 },
    body: { type: String, default: "", trim: true, maxlength: 1000 },
    attachment: {
      url: { type: String, default: "", trim: true, maxlength: 220 },
      name: { type: String, default: "", trim: true, maxlength: 180 },
      type: { type: String, default: "", trim: true, maxlength: 120 },
      size: { type: Number, min: 0, default: 0 }
    }
  },
  { timestamps: true }
);

conversationMessageSchema.index({ conversation: 1, createdAt: 1 });

export const ConversationMessage = mongoose.model("ConversationMessage", conversationMessageSchema);
