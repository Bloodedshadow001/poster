import mongoose from "mongoose";
import dotenv from "dotenv";
import { AdBrief } from "../server/models/AdBrief.js";
import { Payment } from "../server/models/Payment.js";

dotenv.config();

const mongoUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/connectpro_nexus";

function budgetRange(value = "") {
  const nums = String(value).replace(/,/g, "").match(/\d+(\.\d+)?/g) || [];
  const parsed = nums.map(Number).filter(Number.isFinite);
  if (!parsed.length) return { budgetMin: 0, budgetMax: 0 };
  if (parsed.length === 1) return { budgetMin: parsed[0], budgetMax: parsed[0] };
  return { budgetMin: Math.min(...parsed), budgetMax: Math.max(...parsed) };
}

await mongoose.connect(mongoUri);

const briefs = await AdBrief.find({ $or: [{ budgetMin: 0 }, { budgetMax: 0 }, { proofStatus: { $exists: false } }] });
for (const brief of briefs) {
  const range = budgetRange(brief.budget);
  if (!brief.budgetMin) brief.budgetMin = range.budgetMin;
  if (!brief.budgetMax) brief.budgetMax = range.budgetMax;
  if (!brief.proofStatus) brief.proofStatus = brief.proofLink ? "submitted" : "none";
  await brief.save();
}

await Payment.updateMany({ releaseStatus: { $exists: false } }, { releaseStatus: "held" });

console.log(`Migrated ${briefs.length} briefs.`);
await mongoose.disconnect();
