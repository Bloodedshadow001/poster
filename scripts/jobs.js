import mongoose from "mongoose";
import dotenv from "dotenv";
import { AdBrief } from "../server/models/AdBrief.js";
import { Notification } from "../server/models/Notification.js";

dotenv.config();

const mongoUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/connectpro_nexus";
await mongoose.connect(mongoUri);

const staleDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
const staleBriefs = await AdBrief.find({ status: { $in: ["open", "quotes_received", "in_progress"] }, updatedAt: { $lt: staleDate } }).limit(100).lean();
for (const brief of staleBriefs) {
  await Notification.create({
    user: brief.user,
    title: "Campaign reminder",
    body: `${brief.brandName} has had no update for several days.`,
    type: "reminder",
    linkType: "brief",
    linkId: brief._id.toString(),
    actionLabel: "Open workspace",
    actionView: "marketplace"
  });
}

console.log(`Queued ${staleBriefs.length} reminders.`);
await mongoose.disconnect();
