import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    action: { type: String, required: true, trim: true, maxlength: 80 },
    entityType: { type: String, default: "", trim: true, maxlength: 40 },
    entityId: { type: String, default: "", trim: true, maxlength: 80 },
    summary: { type: String, default: "", trim: true, maxlength: 300 },
    ip: { type: String, default: "", trim: true, maxlength: 80 }
  },
  { timestamps: true }
);

auditLogSchema.index({ user: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });

export const AuditLog = mongoose.model("AuditLog", auditLogSchema);
