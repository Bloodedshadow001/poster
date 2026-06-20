import mongoose from "mongoose";
import { AdBrief } from "../server/models/AdBrief.js";
import { AuditLog } from "../server/models/AuditLog.js";
import { Conversation } from "../server/models/Conversation.js";
import { ConversationMessage } from "../server/models/ConversationMessage.js";
import { Contract } from "../server/models/Contract.js";
import { Message } from "../server/models/Message.js";
import { Notification } from "../server/models/Notification.js";
import { Payment } from "../server/models/Payment.js";
import { Quote } from "../server/models/Quote.js";
import { Shortlist } from "../server/models/Shortlist.js";
import { User } from "../server/models/User.js";

const baseUrl = process.env.API_BASE_URL || "http://127.0.0.1:5050";
const mongoUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/connectpro_nexus";
const created = { users: [], briefs: [], quotes: [], contracts: [], payments: [] };

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      ...(options.headers || {})
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${options.method || "GET"} ${path} failed: ${data.message || response.status}`);
  return data;
}

async function submitPaymentReference(checkoutUrl, reference) {
  const sessionId = String(checkoutUrl || "").split("/").filter(Boolean).pop();
  if (!sessionId) throw new Error("Checkout URL did not include a payment session.");
  const path = checkoutUrl.includes("/manual/") ? `/api/payments/manual/${sessionId}/submit` : `/api/payments/upi/${sessionId}/submit`;
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ utr: reference }).toString()
  });
  if (!response.ok) throw new Error(`POST ${path} failed: ${response.status}`);
  return sessionId;
}

async function registerUser(prefix, industry) {
  const stamp = `${Date.now()}${Math.random().toString(36).slice(2, 8)}`;
  const data = await request("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({
      businessName: `${prefix} ${stamp}`,
      email: `${prefix.toLowerCase().replace(/\s+/g, ".")}.${stamp}@example.com`,
      password: "Password123!",
      industry
    })
  });
  created.users.push(data.user.id);
  if (data.verificationToken) {
    await request("/api/auth/verify-email", {
      method: "POST",
      body: JSON.stringify({ token: data.verificationToken })
    });
  }
  return data;
}

async function cleanup() {
  if (process.env.SKIP_SMOKE_CLEANUP === "1") return;
  await mongoose.connect(mongoUri);
  const users = await User.find({
    $or: [
      { _id: { $in: created.users } },
      { businessName: /^Smoke (Buyer|Expert) / },
      { email: /^smoke\.(buyer|expert)\./ }
    ]
  }).select("_id").lean();
  const userIds = users.map(user => user._id);
  const briefs = await AdBrief.find({ $or: [{ _id: { $in: created.briefs } }, { user: { $in: userIds } }, { brandName: /^Smoke Brand/ }] }).select("_id").lean();
  const briefIds = briefs.map(brief => brief._id);
  const quotes = await Quote.find({ $or: [{ _id: { $in: created.quotes } }, { user: { $in: userIds } }, { brief: { $in: briefIds } }] }).select("_id").lean();
  const quoteIds = quotes.map(quote => quote._id);
  const contracts = await Contract.find({ $or: [{ _id: { $in: created.contracts } }, { user: { $in: userIds } }, { recipientBusinessName: /^Smoke Expert / }] }).select("_id").lean();
  const contractIds = contracts.map(contract => contract._id);
  const conversations = await Conversation.find({ participants: { $in: userIds } }).select("_id").lean();
  const conversationIds = conversations.map(conversation => conversation._id);

  await Promise.all([
    ConversationMessage.deleteMany({ conversation: { $in: conversationIds } }),
    Conversation.deleteMany({ _id: { $in: conversationIds } }),
    Notification.deleteMany({ $or: [{ user: { $in: userIds } }, { linkId: { $in: briefIds.map(String) } }] }),
    Message.deleteMany({ $or: [{ user: { $in: userIds } }, { contract: { $in: contractIds } }, { brief: { $in: briefIds } }, { quote: { $in: quoteIds } }] }),
    Payment.deleteMany({ $or: [{ _id: { $in: created.payments } }, { user: { $in: userIds } }, { contract: { $in: contractIds } }, { brief: { $in: briefIds } }, { quote: { $in: quoteIds } }] }),
    Contract.deleteMany({ _id: { $in: contractIds } }),
    Quote.deleteMany({ _id: { $in: quoteIds } }),
    AdBrief.deleteMany({ _id: { $in: briefIds } }),
    Shortlist.deleteMany({ user: { $in: userIds } }),
    AuditLog.deleteMany({ $or: [{ user: { $in: userIds } }, { entityId: { $in: [...briefIds, ...quoteIds, ...contractIds].map(String) } }] }),
    User.deleteMany({ _id: { $in: userIds } })
  ]);
  await mongoose.disconnect();
}

async function main() {
  const health = await request("/api/health");
  if (!health.ok) throw new Error("Health check did not return ok=true");

  const buyer = await registerUser("Smoke Buyer", "Retail");
  const expert = await registerUser("Smoke Expert", "Creator Marketing");
  const admin = await registerUser("Smoke Admin", "Operations");
  await mongoose.connect(mongoUri);
  await User.findByIdAndUpdate(admin.user.id, { role: "admin" });
  await mongoose.disconnect();

  await request("/api/profile", {
    method: "PATCH",
    token: expert.token,
    body: JSON.stringify({
      ...expert.user,
      accountMode: "expert",
      expertise: "Social Media Ads Expert",
      instagram: "@smokeexpert",
      upiId: "smokeexpert@upi",
      availability: "available",
      minBudget: 100,
      turnaroundDays: 1,
      serviceLanguages: ["English"],
      serviceCatalog: [{ platform: "Instagram", service: "Reel promotion", startingPrice: "INR 500", deliveryDays: 1, portfolioLink: "" }]
    })
  });

  const briefData = await request("/api/ad-briefs/social-media", {
    method: "POST",
    token: buyer.token,
    body: JSON.stringify({
      platform: "Instagram",
      format: "Reel",
      socialHandle: "@smokebrand",
      brandName: "Smoke Brand",
      goal: "Drive test traffic through a creator reel.",
      targetAudience: "Local shoppers",
      city: "Mumbai",
      language: "English",
      budget: "INR 500",
      budgetMin: 500,
      budgetMax: 500,
      currency: "inr",
      creativeLink: "https://example.com/creative",
      notes: "Temporary smoke test brief"
    })
  });
  created.briefs.push(briefData.brief._id);

  await request(`/api/ad-briefs/${briefData.brief._id}/quotes`, {
    method: "POST",
    token: expert.token,
    body: JSON.stringify({
      expertName: expert.user.businessName,
      amount: "INR 500",
      timeline: "24 hours",
      message: "I will publish the reel and submit analytics proof."
    })
  });

  const briefList = await request("/api/ad-briefs", { token: buyer.token });
  const brief = briefList.briefs.find(item => item._id === briefData.brief._id);
  const quote = brief?.quotes?.[0];
  if (!quote) throw new Error("Quote was not returned on buyer brief.");
  created.quotes.push(quote._id);

  await request(`/api/ad-briefs/${brief._id}/quotes/${quote._id}/accept`, {
    method: "PATCH",
    token: buyer.token
  });

  const escrow = await request(`/api/ad-briefs/${brief._id}/escrow`, {
    method: "POST",
    token: buyer.token,
    body: JSON.stringify({ payerUpiId: "smokebuyer@upi" })
  });
  created.contracts.push(escrow.contract._id);
  created.payments.push(escrow.payment._id);

  await submitPaymentReference(escrow.checkoutUrl, "SMOKE123456");
  await request(`/api/admin/payments/${escrow.payment._id}/verify`, {
    method: "PATCH",
    token: admin.token,
    body: JSON.stringify({ note: "Smoke test payment verification." })
  });

  await request(`/api/ad-briefs/${brief._id}/proof`, {
    method: "PATCH",
    token: expert.token,
    body: JSON.stringify({
      proofLink: "https://example.com/proof",
      proofNotes: "Temporary smoke test proof.",
      proofReach: 1000,
      proofClicks: 25,
      proofMetrics: { impressions: 1200 }
    })
  });

  await request(`/api/ad-briefs/${brief._id}/proof-review`, {
    method: "PATCH",
    token: buyer.token,
    body: JSON.stringify({ decision: "approved" })
  });

  await request(`/api/ad-briefs/${brief._id}/rating`, {
    method: "PATCH",
    token: buyer.token,
    body: JSON.stringify({ rating: 5, reviewText: "Temporary smoke flow completed." })
  });

  console.log(`API smoke flow passed and cleaned up: ${health.database}`);
}

main()
  .catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await cleanup();
    } catch (error) {
      console.error(`Smoke cleanup failed: ${error.message}`);
      process.exitCode = 1;
    }
  });
