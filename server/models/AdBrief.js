import mongoose from "mongoose";

const adBriefSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    platform: { type: String, default: "Instagram", trim: true, maxlength: 40 },
    format: { type: String, default: "Social Media Promotion", trim: true, maxlength: 80 },
    socialHandle: { type: String, default: "", trim: true, maxlength: 120 },
    instagramHandle: { type: String, default: "", trim: true, maxlength: 120 },
    brandName: { type: String, required: true, trim: true, maxlength: 120 },
    goal: { type: String, required: true, trim: true, maxlength: 240 },
    targetAudience: { type: String, required: true, trim: true, maxlength: 160 },
    ageMin: { type: Number, min: 0, max: 120, default: 0 },
    ageMax: { type: Number, min: 0, max: 120, default: 0 },
    city: { type: String, default: "", trim: true, maxlength: 100 },
    language: { type: String, default: "English", trim: true, maxlength: 80 },
    budget: { type: String, required: true, trim: true, maxlength: 80 },
    budgetMin: { type: Number, min: 0, default: 0 },
    budgetMax: { type: Number, min: 0, default: 0 },
    preferredDate: { type: String, default: "", trim: true, maxlength: 40 },
    creativeLink: { type: String, default: "", trim: true, maxlength: 220 },
    notes: { type: String, default: "", trim: true, maxlength: 700 },
    currency: { type: String, default: "inr", lowercase: true, trim: true, maxlength: 8 },
    isAuction: { type: Boolean, default: false },
    urgency: { type: String, enum: ["standard", "fast", "urgent"], default: "standard" },
    auctionEndsAt: { type: Date },
    auctionStatus: { type: String, enum: ["none", "live", "ended", "awarded"], default: "none" },
    invitedExperts: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    invitations: [{
      expert: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      status: { type: String, enum: ["invited", "accepted", "declined"], default: "invited" },
      respondedAt: { type: Date }
    }],
    selectedQuote: { type: mongoose.Schema.Types.ObjectId, ref: "Quote" },
    proofLink: { type: String, default: "", trim: true, maxlength: 220 },
    proofNotes: { type: String, default: "", trim: true, maxlength: 700 },
    proofReach: { type: Number, min: 0, default: 0 },
    proofClicks: { type: Number, min: 0, default: 0 },
    proofMetrics: { type: mongoose.Schema.Types.Mixed, default: {} },
    proofScreenshot: { type: String, default: "", trim: true, maxlength: 300000 },
    proofStatus: { type: String, enum: ["none", "submitted", "approved", "revision_requested"], default: "none" },
    proofRevisionNote: { type: String, default: "", trim: true, maxlength: 700 },
    disputeEvidence: [{
      user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      role: { type: String, enum: ["buyer", "expert", "admin"], default: "buyer" },
      note: { type: String, trim: true, maxlength: 700 },
      file: { type: String, trim: true, maxlength: 220 },
      requestedResolution: { type: String, trim: true, maxlength: 160 },
      createdAt: { type: Date, default: Date.now }
    }],
    rating: { type: Number, min: 0, max: 5, default: 0 },
    reviewText: { type: String, default: "", trim: true, maxlength: 700 },
    disputeReason: { type: String, default: "", trim: true, maxlength: 700 },
    status: { type: String, enum: ["open", "quotes_received", "expert_selected", "paid", "in_progress", "proof_submitted", "completed", "closed", "disputed"], default: "open" }
  },
  { timestamps: true }
);

adBriefSchema.index({ user: 1, createdAt: -1 });
adBriefSchema.index({ invitedExperts: 1, status: 1, createdAt: -1 });
adBriefSchema.index({ platform: 1, language: 1, city: 1, status: 1, createdAt: -1 });
adBriefSchema.index({ isAuction: 1, auctionStatus: 1, auctionEndsAt: 1, status: 1 });
adBriefSchema.index({ platform: "text", format: "text", brandName: "text", goal: "text", targetAudience: "text", city: "text", socialHandle: "text" });

export const AdBrief = mongoose.model("AdBrief", adBriefSchema);
