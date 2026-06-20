import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import mongoose from "mongoose";
import { Connection } from "./models/Connection.js";
import { Contract } from "./models/Contract.js";
import { Draft } from "./models/Draft.js";
import { Message } from "./models/Message.js";
import { PartnerRequest } from "./models/PartnerRequest.js";
import { Payment } from "./models/Payment.js";
import { Promotion } from "./models/Promotion.js";
import { User } from "./models/User.js";

dotenv.config();

const mongoUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/connectpro_nexus";
const required = ["INITIAL_BUSINESS_NAME", "INITIAL_ADMIN_EMAIL", "INITIAL_ADMIN_PASSWORD", "INITIAL_INDUSTRY"];
const missing = required.filter(key => !process.env[key]);

await mongoose.connect(mongoUri);
await Promise.all([
  Connection.deleteMany({}),
  Contract.deleteMany({}),
  Draft.deleteMany({}),
  Message.deleteMany({}),
  Payment.deleteMany({}),
  PartnerRequest.deleteMany({}),
  Promotion.deleteMany({}),
  User.deleteMany({})
]);

if (missing.length) {
  console.log("Database cleared. No account created because initial account environment variables are not set.");
  await mongoose.disconnect();
  process.exit(0);
}

await User.create({
  businessName: process.env.INITIAL_BUSINESS_NAME,
  email: process.env.INITIAL_ADMIN_EMAIL.toLowerCase(),
  passwordHash: await bcrypt.hash(process.env.INITIAL_ADMIN_PASSWORD, 12),
  profileStrength: 60,
  industry: process.env.INITIAL_INDUSTRY
});

console.log("Database reset and initial account created.");
await mongoose.disconnect();
