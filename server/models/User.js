import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    businessName: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    emailVerified: { type: Boolean, default: false },
    emailVerificationToken: { type: String, default: "", trim: true },
    passwordResetToken: { type: String, default: "", trim: true },
    passwordResetExpires: { type: Date },
    refreshTokens: [{
      token: { type: String, trim: true },
      createdAt: { type: Date, default: Date.now },
      revokedAt: { type: Date }
    }],
    role: { type: String, enum: ["member", "admin"], default: "member" },
    accountMode: { type: String, enum: ["buyer", "expert", "both"], default: "buyer" },
    profileStrength: { type: Number, default: 84 },
    industry: { type: String, default: "Tech & Innovation" },
    description: { type: String, default: "", trim: true, maxlength: 700 },
    website: { type: String, default: "", trim: true, maxlength: 180 },
    location: { type: String, default: "", trim: true, maxlength: 120 },
    phone: { type: String, default: "", trim: true, maxlength: 40 },
    upiId: { type: String, default: "", lowercase: true, trim: true, maxlength: 120 },
    expertise: { type: String, default: "", trim: true, maxlength: 120 },
    instagram: { type: String, default: "", trim: true, maxlength: 120 },
    youtube: { type: String, default: "", trim: true, maxlength: 120 },
    linkedin: { type: String, default: "", trim: true, maxlength: 120 },
    facebook: { type: String, default: "", trim: true, maxlength: 120 },
    twitter: { type: String, default: "", trim: true, maxlength: 120 },
    tiktok: { type: String, default: "", trim: true, maxlength: 120 },
    snapchat: { type: String, default: "", trim: true, maxlength: 120 },
    pinterest: { type: String, default: "", trim: true, maxlength: 120 },
    whatsapp: { type: String, default: "", trim: true, maxlength: 120 },
    telegram: { type: String, default: "", trim: true, maxlength: 120 },
    availability: { type: String, enum: ["available", "busy", "offline"], default: "available" },
    minBudget: { type: Number, min: 0, default: 0 },
    turnaroundDays: { type: Number, min: 0, default: 0 },
    followerCount: { type: Number, min: 0, default: 0 },
    serviceLanguages: [{ type: String, trim: true, maxlength: 40 }],
    serviceCatalog: [{
      platform: { type: String, trim: true, maxlength: 40 },
      service: { type: String, trim: true, maxlength: 120 },
      startingPrice: { type: String, trim: true, maxlength: 80 },
      deliveryDays: { type: Number, min: 0, default: 0 },
      portfolioLink: { type: String, trim: true, maxlength: 220 }
    }],
    caseStudies: [{
      title: { type: String, trim: true, maxlength: 120 },
      platform: { type: String, trim: true, maxlength: 40 },
      summary: { type: String, trim: true, maxlength: 700 },
      resultMetric: { type: String, trim: true, maxlength: 120 },
      proofLink: { type: String, trim: true, maxlength: 220 }
    }],
    averageRating: { type: Number, min: 0, max: 5, default: 0 },
    reviewCount: { type: Number, min: 0, default: 0 }
  },
  { timestamps: true }
);

export const User = mongoose.model("User", userSchema);
