import bcrypt from "bcryptjs";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import fs from "fs";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import path from "path";
import Stripe from "stripe";
import { AdBrief } from "./models/AdBrief.js";
import { AuditLog } from "./models/AuditLog.js";
import { Conversation } from "./models/Conversation.js";
import { ConversationMessage } from "./models/ConversationMessage.js";
import { Connection } from "./models/Connection.js";
import { Contract } from "./models/Contract.js";
import { Draft } from "./models/Draft.js";
import { Message } from "./models/Message.js";
import { Notification } from "./models/Notification.js";
import { PartnerRequest } from "./models/PartnerRequest.js";
import { Payment } from "./models/Payment.js";
import { Promotion } from "./models/Promotion.js";
import { Quote } from "./models/Quote.js";
import { Shortlist } from "./models/Shortlist.js";
import { User } from "./models/User.js";
import { WebhookEvent } from "./models/WebhookEvent.js";
import { requireAuth } from "./middleware/auth.js";

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 5050);
const isProduction = process.env.NODE_ENV === "production";
const mongoUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/connectpro_nexus";
const jwtSecret = process.env.JWT_SECRET || "development-only-change-me";
const clientOrigin = process.env.CLIENT_ORIGIN || "http://127.0.0.1:5174";
const devOriginPattern = /^https?:\/\/(localhost|127\.0\.0\.1|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3})(:\d+)?$/;
const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "";
const enableLocalCheckout = !isProduction && process.env.ENABLE_LOCAL_CHECKOUT === "true";
const enableDevAuthTokens = !isProduction && process.env.ENABLE_DEV_AUTH_TOKENS === "true";
const upiMerchantVpa = String(process.env.UPI_MERCHANT_VPA || "").trim();
const upiMerchantName = String(process.env.UPI_MERCHANT_NAME || "Parasara").trim();
const upiQrEnabled = Boolean(upiMerchantVpa);
const emailFrom = process.env.EMAIL_FROM || "Parasara <no-reply@example.com>";
const uploadDir = path.join(process.cwd(), "uploads");
const distDir = path.join(process.cwd(), "dist");
const exposeDevTokens = enableDevAuthTokens && !process.env.RESEND_API_KEY;

process.env.JWT_SECRET = jwtSecret;
fs.mkdirSync(uploadDir, { recursive: true });

function assertProductionConfig() {
  if (!isProduction) return;
  const missing = [
    jwtSecret === "development-only-change-me" ? "JWT_SECRET" : "",
    !process.env.MONGODB_URI ? "MONGODB_URI" : "",
    !process.env.CLIENT_ORIGIN ? "CLIENT_ORIGIN" : "",
    stripe && !process.env.STRIPE_WEBHOOK_SECRET ? "STRIPE_WEBHOOK_SECRET" : "",
    !process.env.RESEND_API_KEY ? "RESEND_API_KEY" : ""
  ].filter(Boolean);
  if (missing.length) {
    throw new Error(`Production configuration is incomplete: ${missing.join(", ")}.`);
  }
}

assertProductionConfig();

function paged(query, { defaultLimit = 50, maxLimit = 100 } = {}) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = Math.min(maxLimit, Math.max(1, Number.parseInt(query.limit, 10) || defaultLimit));
  return { page, limit, skip: (page - 1) * limit };
}

function isAllowedOrigin(origin) {
  if (!origin) return true;
  if (origin === clientOrigin) return true;
  return !isProduction && devOriginPattern.test(origin);
}

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      baseUri: ["'self'"],
      connectSrc: ["'self'", clientOrigin],
      frameAncestors: ["'none'"],
      imgSrc: ["'self'", "data:", "blob:", "https:"],
      mediaSrc: ["'self'", "data:", "blob:"],
      objectSrc: ["'none'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"]
    }
  }
}));
app.use(cors({
  origin(origin, callback) {
    callback(isAllowedOrigin(origin) ? null : new Error("Origin is not allowed by CORS."), true);
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  maxAge: 600
}));
app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  if (!stripe || !stripeWebhookSecret) return res.status(503).json({ message: "Stripe webhook is not configured." });

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, req.headers["stripe-signature"], stripeWebhookSecret);
  } catch {
    return res.status(400).json({ message: "Invalid Stripe webhook signature." });
  }

  if (event.type === "checkout.session.completed") {
    const webhookEvent = await WebhookEvent.findOneAndUpdate(
      { provider: "stripe", eventId: event.id },
      { provider: "stripe", eventId: event.id, type: event.type, summary: "Checkout session completed." },
      { upsert: true, new: true }
    );
    if (webhookEvent.processed) return res.json({ received: true, duplicate: true });
    const session = event.data.object;
    if (session.payment_status === "paid") {
      const payment = await Payment.findOne({
        _id: session.metadata?.paymentId,
        contract: session.metadata?.contractId,
        providerSessionId: session.id
      });
      if (payment) {
        payment.status = "paid";
        await payment.save();
        await Contract.findOneAndUpdate(
          { _id: payment.contract, user: payment.user },
          { paymentStatus: "paid", status: "offered" }
        );
        if (session.metadata?.briefId) {
          await AdBrief.findOneAndUpdate(
            { _id: session.metadata.briefId, user: payment.user },
            { status: "paid" }
          );
          await Notification.create({
            user: payment.user,
            title: "Escrow payment completed",
            body: "Your accepted quote is now paid and ready for execution.",
            type: "payment",
            linkType: "brief",
            linkId: session.metadata.briefId
          });
        }
      }
    }
    webhookEvent.processed = true;
    await webhookEvent.save();
  }

  res.json({ received: true });
});
app.use(express.json({ limit: "30mb" }));
app.use(express.urlencoded({ extended: false }));
app.use("/uploads", express.static(uploadDir));
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.RATE_LIMIT || 1000),
  standardHeaders: true,
  legacyHeaders: false,
  skip: req => req.path === "/api/health" || process.env.NODE_ENV === "test"
}));

const cleanText = (value, max = 160) => String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
const socialHandlePattern = /^(@?[a-z0-9._ -]{2,80}|https?:\/\/\S+\.\S+)$/i;
const currencyAmountPattern = /(\d+([,.]\d+)*(\.\d+)?)/;
const promotionTypes = new Set([
  "Search Engine Marketing",
  "Social Media Ads",
  "OTT Platform Ads",
  "Display & Banner Ads",
  "Video Ads",
  "Native Advertising",
  "Email Marketing",
  "In-App Ads",
  "Television Commercials",
  "TV Channel Ads",
  "Radio Ads",
  "Podcast Ads",
  "Newspaper Ads",
  "Magazine Ads",
  "Direct Mail",
  "Flyers & Pamphlets",
  "Traditional Billboards",
  "Digital Billboards",
  "Transit Ads",
  "Street Furniture Ads",
  "Product Placement",
  "Influencer Marketing",
  "Sponsorships",
  "Point-of-Purchase Displays",
  "Telemarketing",
  "SMS Marketing"
]);
const promotionStatuses = new Set(["Online", "Offline", "Scheduled"]);
const paymentCurrencies = new Set(["usd", "inr", "eur", "gbp"]);
const contractStatuses = new Set(["awaiting_payment", "offered", "accepted", "declined", "closed"]);
const socialPlatforms = new Set(["Instagram", "Facebook", "YouTube", "OTT Platform", "TV Channel", "LinkedIn", "X / Twitter", "TikTok", "Snapchat", "Pinterest", "WhatsApp", "Telegram", "Other"]);
const availabilityOptions = new Set(["available", "busy", "offline"]);
const briefTransitions = {
  open: ["quotes_received", "disputed"],
  quotes_received: ["expert_selected", "disputed"],
  expert_selected: ["paid", "disputed"],
  paid: ["in_progress", "proof_submitted", "disputed"],
  in_progress: ["proof_submitted", "disputed"],
  proof_submitted: ["completed", "in_progress", "disputed"],
  completed: ["closed", "disputed"],
  closed: [],
  disputed: ["in_progress", "closed"]
};
const urgencyOptions = new Set(["standard", "fast", "urgent"]);
const platformFormats = {
  Instagram: ["Story", "Reel", "Feed Post", "Carousel", "Live Mention"],
  Facebook: ["Page Post", "Story", "Reel", "Group Share", "Event Promotion"],
  YouTube: ["Short", "Video Mention", "Community Post", "Channel Sponsorship"],
  "OTT Platform": ["Pre-roll Ad", "Mid-roll Ad", "Banner Placement", "Sponsored Tile", "Show Sponsorship"],
  "TV Channel": ["TV Spot", "Ticker Ad", "Program Sponsorship", "Product Placement", "Channel Promo"],
  LinkedIn: ["Post", "Newsletter Mention", "Thought Leader Promotion", "Company Page Post"],
  "X / Twitter": ["Post", "Thread", "Space Mention", "Repost Campaign"],
  TikTok: ["Video", "Story", "Live Mention", "Creator Spark Ad"],
  Snapchat: ["Story", "Spotlight", "Creator Mention"],
  Pinterest: ["Pin", "Idea Pin", "Board Placement"],
  WhatsApp: ["Channel Broadcast", "Group Share", "Status Promotion"],
  Telegram: ["Channel Post", "Group Share", "Pinned Promotion"],
  Other: ["Post", "Story", "Video", "Channel Promotion"]
};

function envWarnings() {
  return [
    jwtSecret === "development-only-change-me" ? "JWT_SECRET is using the development fallback." : "",
    !process.env.MONGODB_URI ? "MONGODB_URI is using the local fallback." : "",
    !process.env.CLIENT_ORIGIN ? "CLIENT_ORIGIN is using the local fallback." : "",
    !stripe ? "Manual payment checkout is active. Card payments are optional." : "",
    upiQrEnabled ? "UPI QR checkout is enabled for INR payments. Admin verification is required after UTR submission." : "",
    !upiQrEnabled ? "Manual UPI checkout is enabled for INR payments without an API. Add user or recipient UPI IDs before checkout." : "",
    enableLocalCheckout ? "ENABLE_LOCAL_CHECKOUT is enabled. Payments can be marked paid without Stripe in this local environment." : "",
    stripe && !stripeWebhookSecret ? "STRIPE_WEBHOOK_SECRET is not configured, so webhook confirmation is disabled." : "",
    !process.env.RESEND_API_KEY ? "RESEND_API_KEY is not configured, so real email delivery is disabled." : "",
    exposeDevTokens ? "ENABLE_DEV_AUTH_TOKENS is enabled. Verification/reset tokens are returned by auth endpoints in this local environment." : ""
  ].filter(Boolean);
}

function systemStatus() {
  return {
    environment: process.env.NODE_ENV || "development",
    database: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    auth: jwtSecret === "development-only-change-me" ? "development secret" : "configured",
    clientOrigin,
    payments: [stripe ? "stripe" : "", upiQrEnabled ? "upi qr" : "manual upi", enableLocalCheckout ? "local checkout" : ""].filter(Boolean).join(", "),
    email: process.env.RESEND_API_KEY ? "resend configured" : (exposeDevTokens ? "development tokens enabled" : "not configured"),
    warnings: envWarnings()
  };
}

function emailDeliveryReady() {
  return Boolean(process.env.RESEND_API_KEY || enableDevAuthTokens);
}

function inferDeliveryDays(value = "") {
  const text = String(value).toLowerCase();
  const match = text.match(/(\d+)/);
  if (!match) return 0;
  const amount = Number(match[1]);
  if (text.includes("hour")) return Math.max(1, Math.ceil(amount / 24));
  if (text.includes("week")) return amount * 7;
  return amount;
}

function platformKey(platform = "") {
  const normalized = String(platform).toLowerCase();
  if (normalized.includes("twitter") || normalized === "x") return "twitter";
  return normalized.replace(/[^a-z]/g, "");
}

function socialFieldsForUser(user = {}) {
  return [
    user.instagram ? "Instagram" : "",
    user.facebook ? "Facebook" : "",
    user.youtube ? "YouTube" : "",
    user.linkedin ? "LinkedIn" : "",
    user.twitter ? "X / Twitter" : "",
    user.tiktok ? "TikTok" : "",
    user.snapchat ? "Snapchat" : "",
    user.pinterest ? "Pinterest" : "",
    user.whatsapp ? "WhatsApp" : "",
    user.telegram ? "Telegram" : "",
    ...(user.serviceCatalog || []).map(service => service.platform)
  ].filter(Boolean);
}

function calculateExpertMatch(expert = {}, brief = {}) {
  let score = 25;
  const platform = platformKey(brief.platform);
  const expertise = `${expert.expertise || ""} ${expert.industry || ""}`.toLowerCase();
  if (platform && expert[platform]) score += 35;
  if ((expert.serviceCatalog || []).some(service => platformKey(service.platform) === platform)) score += 15;
  if (expertise.includes("social")) score += 15;
  if (expertise.includes("influencer") || expertise.includes("creator")) score += 10;
  if (brief.city && expert.location && String(expert.location).toLowerCase().includes(String(brief.city).toLowerCase())) score += 10;
  if (expert.availability === "available") score += 8;
  if (expert.availability === "busy") score -= 8;
  if (expert.availability === "offline") score -= 20;
  if (expert.minBudget && quoteAmountToMinorUnits(brief.budget) && expert.minBudget * 100 <= quoteAmountToMinorUnits(brief.budget)) score += 5;
  if (expert.turnaroundDays && expert.turnaroundDays <= 3) score += 5;
  if (expert.averageRating) score += Math.min(10, Math.round(expert.averageRating * 2));
  score += Math.min(5, Math.floor((expert.profileStrength || 0) / 20));
  return Math.max(0, Math.min(100, score));
}

function feeBreakdown(amount) {
  const platformFee = Math.round(amount * 0.05);
  const escrowFee = Math.max(100, Math.round(amount * 0.02));
  return { platformFee, escrowFee, totalAmount: amount + platformFee + escrowFee };
}

function invoiceNumber() {
  return `INV-${Date.now().toString(36).toUpperCase()}`;
}

function localCheckoutUrl(sessionId) {
  return `${clientOrigin}/?payment=success&session_id=${encodeURIComponent(sessionId)}`;
}

function canUseUpi(currency = "") {
  return upiQrEnabled && String(currency).toLowerCase() === "inr";
}

function canUseManualUpi(currency = "") {
  return String(currency).toLowerCase() === "inr";
}

function hasPaymentProvider(currency = "") {
  return Boolean(stripe || canUseUpi(currency) || canUseManualUpi(currency) || enableLocalCheckout || currency);
}

function upiReference(payment) {
  return `PARASARA${payment._id.toString().slice(-10).toUpperCase()}`;
}

function upiCheckoutUrl(sessionId) {
  return `/api/payments/upi/${encodeURIComponent(sessionId)}`;
}

function manualCheckoutUrl(sessionId) {
  return `/api/payments/manual/${encodeURIComponent(sessionId)}`;
}

function validUpiId(value = "") {
  return /^[a-z0-9.\-_]{2,}@[a-z0-9.\-_]{2,}$/i.test(String(value).trim());
}

function upiPaymentUri(payment) {
  const params = new URLSearchParams({
    pa: payment.upiVpa,
    pn: payment.upiPayeeName,
    am: (Number(payment.totalAmount || payment.amount || 0) / 100).toFixed(2),
    cu: "INR",
    tn: payment.upiReference || payment.invoiceNumber || "Parasara payment"
  });
  return `upi://pay?${params.toString()}`;
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  }[char]));
}

function recipientListFromBody(body) {
  const source = Array.isArray(body.recipientBusinessNames)
    ? body.recipientBusinessNames
    : String(body.recipientBusinessName || "").split(/[\n,]+/);
  return [...new Set(source.map(item => cleanText(item, 120)).filter(Boolean))].slice(0, 25);
}

function recipientPaymentEntries(body) {
  const source = Array.isArray(body.recipientBusinessNames)
    ? body.recipientBusinessNames
    : String(body.recipientBusinessName || "").split(/\n+/);
  return source.map(item => {
    const raw = cleanText(item, 180);
    const [namePart, upiPart = ""] = raw.split("|").map(part => cleanText(part, 120));
    return {
      businessName: namePart,
      upiId: upiPart.toLowerCase()
    };
  }).filter(item => item.businessName).slice(0, 25);
}

function sanitizeServices(value) {
  const items = Array.isArray(value) ? value : [];
  return items.slice(0, 8).map(item => ({
    platform: cleanText(item.platform, 40),
    service: cleanText(item.service, 120),
    startingPrice: cleanText(item.startingPrice, 80),
    deliveryDays: Math.max(0, Number.parseInt(item.deliveryDays, 10) || 0),
    portfolioLink: cleanText(item.portfolioLink, 220)
  })).filter(item => item.platform && item.service);
}

function sanitizeCaseStudies(value) {
  const items = Array.isArray(value) ? value : [];
  return items.slice(0, 8).map(item => ({
    title: cleanText(item.title, 120),
    platform: cleanText(item.platform, 40),
    summary: cleanText(item.summary, 700),
    resultMetric: cleanText(item.resultMetric, 120),
    proofLink: cleanText(item.proofLink, 220)
  })).filter(item => item.title && item.platform);
}

function signUser(user) {
  return jwt.sign(
    { id: user._id.toString(), email: user.email, businessName: user.businessName },
    jwtSecret,
    { expiresIn: "8h" }
  );
}

function randomToken() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
}

async function issueRefreshToken(user) {
  const token = randomToken();
  user.refreshTokens = [...(user.refreshTokens || []).filter(item => !item.revokedAt).slice(-4), { token }];
  await user.save();
  return token;
}

function publicUser(user) {
  return {
    id: user._id,
    businessName: user.businessName,
    email: user.email,
    accountMode: user.accountMode || "buyer",
    profileStrength: user.profileStrength,
    industry: user.industry,
    description: user.description,
    website: user.website,
    location: user.location,
    phone: user.phone,
    upiId: user.upiId || "",
    expertise: user.expertise,
    instagram: user.instagram,
    youtube: user.youtube,
    linkedin: user.linkedin,
    facebook: user.facebook,
    twitter: user.twitter,
    tiktok: user.tiktok,
    snapchat: user.snapchat,
    pinterest: user.pinterest,
    whatsapp: user.whatsapp,
    telegram: user.telegram,
    availability: user.availability,
    minBudget: user.minBudget,
    turnaroundDays: user.turnaroundDays,
    followerCount: user.followerCount || 0,
    serviceLanguages: user.serviceLanguages || [],
    serviceCatalog: user.serviceCatalog || [],
    caseStudies: user.caseStudies || [],
    averageRating: user.averageRating || 0,
    reviewCount: user.reviewCount || 0,
    emailVerified: Boolean(user.emailVerified),
    role: user.role || "member"
  };
}

function canManageBrief(userId, brief) {
  return brief?.user?.toString() === userId;
}

function canWorkOnBrief(userId, brief, quote) {
  return canManageBrief(userId, brief) || quote?.user?.toString() === userId || (brief.invitedExperts || []).some(id => id.toString() === userId);
}

function calculateProfileStrength(user) {
  const fields = [user.businessName, user.email, user.accountMode, user.industry, user.description, user.website, user.location, user.phone, user.upiId, user.expertise, user.instagram, user.youtube, user.linkedin, user.facebook, user.twitter, user.tiktok, user.snapchat, user.pinterest, user.whatsapp, user.telegram, user.availability, user.minBudget, user.turnaroundDays, user.followerCount, ...(user.serviceCatalog || [])];
  return Math.min(100, 20 + fields.filter(Boolean).length * 10);
}

function quoteAmountToMinorUnits(value) {
  const match = String(value || "").match(currencyAmountPattern);
  if (!match) return 0;
  const amount = Number(match[1].replace(/,/g, ""));
  return Number.isFinite(amount) ? Math.round(amount * 100) : 0;
}

function budgetRange(value = "") {
  const nums = String(value).replace(/,/g, "").match(/\d+(\.\d+)?/g) || [];
  const parsed = nums.map(Number).filter(Number.isFinite);
  if (!parsed.length) return { budgetMin: 0, budgetMax: 0 };
  if (parsed.length === 1) return { budgetMin: parsed[0], budgetMax: parsed[0] };
  return { budgetMin: Math.min(...parsed), budgetMax: Math.max(...parsed) };
}

function auctionEndDate(value, urgency = "fast") {
  const parsed = value ? new Date(value) : null;
  if (parsed && parsed.getTime() > Date.now()) return parsed;
  const hours = urgency === "urgent" ? 6 : 24;
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

async function audit(req, action, entityType, entityId, summary = "") {
  try {
    await AuditLog.create({
      user: req.user?.id,
      action,
      entityType,
      entityId: String(entityId || ""),
      summary,
      ip: req.ip
    });
  } catch {
    // Audit failures should never block the user flow.
  }
}

function saveDataImage(dataUrl = "", prefix = "asset") {
  const match = String(dataUrl).match(/^data:image\/(png|jpeg|jpg);base64,(.+)$/i);
  if (!match) return "";
  const ext = match[1].toLowerCase() === "jpeg" ? "jpg" : match[1].toLowerCase();
  const buffer = Buffer.from(match[2], "base64");
  if (buffer.length > 2 * 1024 * 1024) throw new Error("Image upload must be 2MB or smaller.");
  const fileName = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  fs.writeFileSync(path.join(uploadDir, fileName), buffer);
  return `/uploads/${fileName}`;
}

function saveDataAttachment(attachment = {}, prefix = "message") {
  if (!attachment?.dataUrl) return null;
  const match = String(attachment.dataUrl).match(/^data:([a-z0-9.+-]+\/[a-z0-9.+-]+);base64,(.+)$/i);
  if (!match) throw new Error("Attachment format is not supported.");
  const mimeType = match[1].toLowerCase();
  const allowedTypes = new Set([
    "image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp",
    "video/mp4", "video/webm", "video/quicktime",
    "audio/mpeg", "audio/mp3", "audio/wav", "audio/webm",
    "application/pdf", "text/plain", "application/zip",
    "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-powerpoint", "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  ]);
  if (!allowedTypes.has(mimeType)) throw new Error("That file type is not allowed.");
  const buffer = Buffer.from(match[2], "base64");
  if (buffer.length > 20 * 1024 * 1024) throw new Error("File upload must be 20MB or smaller.");
  const extensionByType = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/gif": "gif",
    "image/webp": "webp",
    "video/mp4": "mp4",
    "video/webm": "webm",
    "video/quicktime": "mov",
    "audio/mpeg": "mp3",
    "audio/mp3": "mp3",
    "audio/wav": "wav",
    "audio/webm": "webm",
    "application/pdf": "pdf",
    "text/plain": "txt",
    "application/zip": "zip",
    "application/msword": "doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "application/vnd.ms-powerpoint": "ppt",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
    "application/vnd.ms-excel": "xls",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx"
  };
  const fileName = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}.${extensionByType[mimeType] || "bin"}`;
  fs.writeFileSync(path.join(uploadDir, fileName), buffer);
  return {
    url: `/uploads/${fileName}`,
    name: cleanText(attachment.name || fileName, 180),
    type: cleanText(mimeType, 120),
    size: buffer.length
  };
}

function setBriefStatus(brief, nextStatus) {
  const current = brief.status || "open";
  if (current === nextStatus) return;
  if (!briefTransitions[current]?.includes(nextStatus)) {
    throw new Error(`Cannot move brief from ${current} to ${nextStatus}.`);
  }
  brief.status = nextStatus;
}

function conversationForUser(conversation, userId) {
  const item = conversation.toObject ? conversation.toObject() : conversation;
  return {
    ...item,
    unreadCount: (item.unreadBy || []).find(entry => entry.user?.toString?.() === userId || String(entry.user) === userId)?.count || 0
  };
}

function markConversationRead(conversation, userId) {
  conversation.unreadBy = (conversation.unreadBy || []).filter(entry => entry.user?.toString() !== userId);
}

function incrementConversationUnread(conversation, senderId) {
  const sender = senderId.toString();
  for (const participant of conversation.participants || []) {
    const participantId = participant.toString();
    if (participantId === sender) continue;
    const current = (conversation.unreadBy || []).find(entry => entry.user?.toString() === participantId);
    if (current) current.count = (current.count || 0) + 1;
    else conversation.unreadBy.push({ user: participant, count: 1 });
  }
}

async function sendEmailNotification(to, subject, body) {
  if (process.env.RESEND_API_KEY) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: emailFrom,
        to,
        subject,
        text: body
      })
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.message || "Email provider rejected the message.");
    }
    return;
  }
  if (!enableDevAuthTokens) throw new Error("Email provider is not configured.");
  await audit({ user: null, ip: "system" }, "email.queue", "email", to, `${subject}: ${body}`.slice(0, 280));
}

function contractDocument({ brief, quote, amount, currency }) {
  return [
    `Campaign Agreement: ${brief.brandName}`,
    `Platform: ${brief.platform}`,
    `Format: ${brief.format}`,
    `Profile: ${brief.socialHandle || brief.instagramHandle}`,
    `Goal: ${brief.goal}`,
    `Expert: ${quote.expertName}`,
    `Amount: ${formatMinorForDocument(amount, currency)}`,
    `Timeline: ${quote.timeline}`,
    `Proof required: link, notes, reach/click metrics, and screenshot where applicable.`,
    `Status flow: quote accepted, escrow paid, work delivered, proof reviewed, then closed.`
  ].join("\n");
}

function formatMinorForDocument(amount, currency = "inr") {
  return `${currency.toUpperCase()} ${(Number(amount || 0) / 100).toFixed(2)}`;
}

function renderUpiCheckoutPage(payment, { submitted = false, error = "" } = {}) {
  const upiUri = upiPaymentUri(payment);
  const amount = formatMinorForDocument(payment.totalAmount || payment.amount, "inr");
  const statusText = submitted
    ? "Reference submitted. Parasara will verify it against the UPI/bank statement before marking this payment paid."
    : "Pay to the UPI ID below with Google Pay, PhonePe, Paytm, BHIM, or any UPI app. After paying, enter the UTR/reference number.";
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>UPI Payment - Parasara</title>
  <style>
    body{font-family:Inter,Arial,sans-serif;background:#f6f7fb;color:#111827;margin:0;display:grid;min-height:100vh;place-items:center;padding:24px}
    main{width:min(440px,100%);background:white;border:1px solid #e5e7eb;border-radius:12px;padding:24px;box-shadow:0 18px 45px rgba(15,23,42,.12)}
    h1{font-size:24px;margin:0 0 6px} p{line-height:1.5;color:#4b5563}.upi-box{display:grid;gap:6px;margin:18px 0;padding:16px;border:1px dashed #94a3b8;border-radius:10px;background:#f8fafc;text-align:center}
    .upi-box b{font-size:22px;word-break:break-word}.upi-box span{color:#64748b;font-size:13px}
    dl{display:grid;grid-template-columns:110px 1fr;gap:8px;margin:18px 0} dt{color:#6b7280} dd{margin:0;font-weight:700;word-break:break-word}
    input{box-sizing:border-box;width:100%;padding:12px;border:1px solid #d1d5db;border-radius:8px;font:inherit;text-transform:uppercase}
    button,a.pay{display:inline-flex;align-items:center;justify-content:center;width:100%;box-sizing:border-box;margin-top:12px;border:0;border-radius:8px;padding:12px 14px;background:#111827;color:white;font-weight:700;text-decoration:none;cursor:pointer}
    .secondary{background:#eef2ff;color:#312e81}.ok{background:#ecfdf5;color:#065f46;border-radius:8px;padding:10px}.err{background:#fef2f2;color:#991b1b;border-radius:8px;padding:10px}
  </style>
</head>
<body>
  <main>
    <h1>Pay with UPI QR</h1>
    <p class="${submitted ? "ok" : ""}">${escapeHtml(statusText)}</p>
    ${error ? `<p class="err">${escapeHtml(error)}</p>` : ""}
    <div class="upi-box"><span>Send payment to</span><b>${escapeHtml(payment.upiVpa)}</b><span>Use exact amount and reference below</span></div>
    <dl>
      <dt>Amount</dt><dd>${escapeHtml(amount)}</dd>
      <dt>Payee</dt><dd>${escapeHtml(payment.upiPayeeName)}</dd>
      <dt>UPI ID</dt><dd>${escapeHtml(payment.upiVpa)}</dd>
      <dt>Payer UPI</dt><dd>${escapeHtml(payment.payerUpiId || "Not saved")}</dd>
      <dt>Reference</dt><dd>${escapeHtml(payment.upiReference)}</dd>
    </dl>
    <a class="pay secondary" href="${escapeHtml(upiUri)}">Open UPI App</a>
    <form method="post" action="/api/payments/upi/${encodeURIComponent(payment.providerSessionId)}/submit">
      <p><label>UTR / transaction reference<input name="utr" maxlength="80" required value="${escapeHtml(payment.upiUtr || "")}"></label></p>
      <button type="submit">Submit Reference</button>
    </form>
  </main>
</body>
</html>`;
}

function renderManualCheckoutPage(payment, { submitted = false, error = "" } = {}) {
  const amount = formatMinorForDocument(payment.totalAmount || payment.amount, payment.currency || "inr");
  const statusText = submitted
    ? "Reference submitted. Parasara will verify it before marking this payment paid."
    : "Complete this payment manually with the recipient, then enter the transaction/reference number here.";
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Manual Payment - Parasara</title>
  <style>
    body{font-family:Inter,Arial,sans-serif;background:#f6f7fb;color:#111827;margin:0;display:grid;min-height:100vh;place-items:center;padding:24px}
    main{width:min(440px,100%);background:white;border:1px solid #e5e7eb;border-radius:12px;padding:24px;box-shadow:0 18px 45px rgba(15,23,42,.12)}
    h1{font-size:24px;margin:0 0 6px}p{line-height:1.5;color:#4b5563}.box{display:grid;gap:8px;margin:18px 0;padding:16px;border:1px dashed #94a3b8;border-radius:10px;background:#f8fafc}
    dl{display:grid;grid-template-columns:110px 1fr;gap:8px;margin:18px 0}dt{color:#6b7280}dd{margin:0;font-weight:700;word-break:break-word}
    input{box-sizing:border-box;width:100%;padding:12px;border:1px solid #d1d5db;border-radius:8px;font:inherit;text-transform:uppercase}
    button{display:inline-flex;align-items:center;justify-content:center;width:100%;box-sizing:border-box;margin-top:12px;border:0;border-radius:8px;padding:12px 14px;background:#111827;color:white;font-weight:700;cursor:pointer}
    .ok{background:#ecfdf5;color:#065f46;border-radius:8px;padding:10px}.err{background:#fef2f2;color:#991b1b;border-radius:8px;padding:10px}
  </style>
</head>
<body>
  <main>
    <h1>Manual Payment</h1>
    <p class="${submitted ? "ok" : ""}">${escapeHtml(statusText)}</p>
    ${error ? `<p class="err">${escapeHtml(error)}</p>` : ""}
    <div class="box">
      <strong>Payee: ${escapeHtml(payment.upiPayeeName || payment.recipientBusinessName)}</strong>
      <span>Amount: ${escapeHtml(amount)}</span>
      <span>Reference: ${escapeHtml(payment.upiReference || payment.invoiceNumber)}</span>
    </div>
    <dl>
      <dt>Amount</dt><dd>${escapeHtml(amount)}</dd>
      <dt>Recipient</dt><dd>${escapeHtml(payment.recipientBusinessName)}</dd>
      <dt>Reference</dt><dd>${escapeHtml(payment.upiReference || payment.invoiceNumber)}</dd>
    </dl>
    <form method="post" action="/api/payments/manual/${encodeURIComponent(payment.providerSessionId)}/submit">
      <p><label>Transaction reference<input name="utr" maxlength="80" required value="${escapeHtml(payment.upiUtr || "")}"></label></p>
      <button type="submit">Submit Reference</button>
    </form>
  </main>
</body>
</html>`;
}

function validatePromotion(body, { partial = false } = {}) {
  const payload = {
    title: cleanText(body.title, 90),
    description: cleanText(body.description, 600),
    type: cleanText(body.type, 80),
    audience: cleanText(body.audience, 80),
    partner: cleanText(body.partner, 120),
    image: cleanText(body.image, 600)
  };

  if (!partial && payload.title.length < 4) throw new Error("Add a clearer promotion title.");
  if (!partial && payload.description.length < 20) throw new Error("Description needs at least 20 characters.");
  if (payload.type && !promotionTypes.has(payload.type)) throw new Error("Choose a valid promotion type.");

  return payload;
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, database: mongoose.connection.readyState === 1 ? "connected" : "disconnected", warnings: envWarnings() });
});

app.get("/api/payments/upi/:sessionId", async (req, res) => {
  const sessionId = cleanText(req.params.sessionId, 200);
  const payment = await Payment.findOne({ provider: { $in: ["upi", "manual_upi"] }, providerSessionId: sessionId });
  if (!payment) return res.status(404).send("UPI payment session not found.");
  res.type("html").send(renderUpiCheckoutPage(payment));
});

app.post("/api/payments/upi/:sessionId/submit", async (req, res) => {
  const sessionId = cleanText(req.params.sessionId, 200);
  const utr = cleanText(req.body.utr, 80).toUpperCase();
  const payment = await Payment.findOne({ provider: { $in: ["upi", "manual_upi"] }, providerSessionId: sessionId });
  if (!payment) return res.status(404).send("UPI payment session not found.");
  if (!/^[A-Z0-9 -]{6,80}$/.test(utr)) {
    return res.status(400).type("html").send(renderUpiCheckoutPage(payment, { error: "Enter a valid UPI UTR or transaction reference." }));
  }
  payment.upiUtr = utr;
  payment.upiSubmittedAt = new Date();
  await payment.save();
  await audit({ user: { id: payment.user }, ip: req.ip }, "payment.upi_submitted", "payment", payment._id, `UPI reference submitted: ${utr}`);
  res.type("html").send(renderUpiCheckoutPage(payment, { submitted: true }));
});

app.get("/api/payments/manual/:sessionId", async (req, res) => {
  const sessionId = cleanText(req.params.sessionId, 200);
  const payment = await Payment.findOne({ provider: "manual", providerSessionId: sessionId });
  if (!payment) return res.status(404).send("Manual payment session not found.");
  res.type("html").send(renderManualCheckoutPage(payment));
});

app.post("/api/payments/manual/:sessionId/submit", async (req, res) => {
  const sessionId = cleanText(req.params.sessionId, 200);
  const utr = cleanText(req.body.utr, 80).toUpperCase();
  const payment = await Payment.findOne({ provider: "manual", providerSessionId: sessionId });
  if (!payment) return res.status(404).send("Manual payment session not found.");
  if (!/^[A-Z0-9 -]{4,80}$/.test(utr)) {
    return res.status(400).type("html").send(renderManualCheckoutPage(payment, { error: "Enter a valid transaction reference." }));
  }
  payment.upiUtr = utr;
  payment.upiSubmittedAt = new Date();
  await payment.save();
  await audit({ user: { id: payment.user }, ip: req.ip }, "payment.manual_submitted", "payment", payment._id, `Manual reference submitted: ${utr}`);
  res.type("html").send(renderManualCheckoutPage(payment, { submitted: true }));
});

app.post("/api/auth/register", async (req, res) => {
  try {
    const businessName = cleanText(req.body.businessName, 120);
    const email = cleanText(req.body.email, 160).toLowerCase();
    const industry = cleanText(req.body.industry, 80);
    const password = String(req.body.password || "");

    if (!businessName) return res.status(400).json({ message: "Business name is required." });
    if (!industry) return res.status(400).json({ message: "Industry is required." });
    if (!emailPattern.test(email)) return res.status(400).json({ message: "Use a valid business email." });
    if (password.length < 8 || password.length > 128) return res.status(400).json({ message: "Password must be 8 to 128 characters." });
    if (!emailDeliveryReady()) return res.status(503).json({ message: "Email provider is not configured. Add RESEND_API_KEY to enable real account verification." });

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ businessName, email, passwordHash, industry, profileStrength: 30, emailVerificationToken: randomToken() });
    const token = signUser(user);
    const refreshToken = await issueRefreshToken(user);
    await sendEmailNotification(user.email, "Verify your Parasara account", `Verification token: ${user.emailVerificationToken}`);
    return res.status(201).json({ token, refreshToken, user: publicUser(user), ...(exposeDevTokens ? { verificationToken: user.emailVerificationToken } : {}) });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: "That email is already registered." });
    return res.status(500).json({ message: "Could not create profile." });
  }
});

app.post("/api/auth/login", async (req, res) => {
  const email = cleanText(req.body.email, 160).toLowerCase();
  const password = String(req.body.password || "");

  if (!emailPattern.test(email) || password.length < 8) {
    return res.status(400).json({ message: "Use a valid email and password." });
  }

  const user = await User.findOne({ email });
  const valid = user ? await bcrypt.compare(password, user.passwordHash) : false;
  if (!valid) return res.status(401).json({ message: "Invalid email or password." });

  const refreshToken = await issueRefreshToken(user);
  return res.json({ token: signUser(user), refreshToken, user: publicUser(user) });
});

app.post("/api/auth/refresh", async (req, res) => {
  const refreshToken = cleanText(req.body.refreshToken, 240);
  const user = await User.findOne({ "refreshTokens.token": refreshToken, "refreshTokens.revokedAt": { $exists: false } });
  if (!user) return res.status(401).json({ message: "Invalid refresh token." });
  user.refreshTokens = (user.refreshTokens || []).map(item => item.token === refreshToken ? { ...item.toObject(), revokedAt: new Date() } : item);
  const nextRefreshToken = await issueRefreshToken(user);
  res.json({ token: signUser(user), refreshToken: nextRefreshToken, user: publicUser(user) });
});

app.post("/api/auth/logout", requireAuth, async (req, res) => {
  const refreshToken = cleanText(req.body.refreshToken, 240);
  if (refreshToken) await User.updateOne({ _id: req.user.id, "refreshTokens.token": refreshToken }, { $set: { "refreshTokens.$.revokedAt": new Date() } });
  res.json({ ok: true });
});

app.post("/api/auth/verify-email", async (req, res) => {
  const token = cleanText(req.body.token, 240);
  if (!token) return res.status(400).json({ message: "Verification token is required." });
  const user = await User.findOne({ emailVerificationToken: token });
  if (!user) return res.status(400).json({ message: "Invalid verification token." });
  user.emailVerified = true;
  user.emailVerificationToken = "";
  await user.save();
  res.json({ ok: true });
});

app.post("/api/auth/forgot-password", async (req, res) => {
  const email = cleanText(req.body.email, 160).toLowerCase();
  if (!emailPattern.test(email)) return res.status(400).json({ message: "Use a valid business email." });
  if (!emailDeliveryReady()) return res.status(503).json({ message: "Email provider is not configured. Add RESEND_API_KEY to enable password reset emails." });
  const user = await User.findOne({ email });
  if (user) {
    user.passwordResetToken = randomToken();
    user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000);
    await user.save();
    await sendEmailNotification(user.email, "Parasara password reset", `Reset token: ${user.passwordResetToken}`);
  }
  return res.json({ ok: true, message: "If the account exists, a reset link will be sent.", ...(exposeDevTokens && user ? { resetToken: user.passwordResetToken } : {}) });
});

app.post("/api/auth/reset-password", async (req, res) => {
  const resetToken = cleanText(req.body.token, 240);
  const password = String(req.body.password || "");
  if (password.length < 8 || password.length > 128) return res.status(400).json({ message: "Password must be 8 to 128 characters." });
  const user = await User.findOne({ passwordResetToken: resetToken, passwordResetExpires: { $gt: new Date() } });
  if (!user) return res.status(400).json({ message: "Invalid or expired reset token." });
  user.passwordHash = await bcrypt.hash(password, 12);
  user.passwordResetToken = "";
  user.passwordResetExpires = undefined;
  user.refreshTokens = [];
  await user.save();
  res.json({ ok: true });
});

app.post("/api/auth/:provider", async (req, res) => {
  return res.status(501).json({
    message: `${req.params.provider} sign-in is not configured. Add a real OAuth provider before enabling this route.`
  });
});

app.get("/api/auth/me", requireAuth, async (req, res) => {
  const user = await User.findById(req.user.id).lean();
  if (!user) return res.status(401).json({ message: "Session account no longer exists." });
  return res.json({ user: publicUser(user) });
});

app.patch("/api/profile", requireAuth, async (req, res) => {
  const payload = {
    businessName: cleanText(req.body.businessName, 120),
    industry: cleanText(req.body.industry, 80),
    description: cleanText(req.body.description, 700),
    website: cleanText(req.body.website, 180),
    location: cleanText(req.body.location, 120),
    phone: cleanText(req.body.phone, 40),
    upiId: cleanText(req.body.upiId, 120).toLowerCase(),
    accountMode: cleanText(req.body.accountMode, 20),
    expertise: cleanText(req.body.expertise, 120),
    instagram: cleanText(req.body.instagram, 120),
    youtube: cleanText(req.body.youtube, 120),
    linkedin: cleanText(req.body.linkedin, 120),
    facebook: cleanText(req.body.facebook, 120),
    twitter: cleanText(req.body.twitter, 120),
    tiktok: cleanText(req.body.tiktok, 120),
    snapchat: cleanText(req.body.snapchat, 120),
    pinterest: cleanText(req.body.pinterest, 120),
    whatsapp: cleanText(req.body.whatsapp, 120),
    telegram: cleanText(req.body.telegram, 120),
    availability: cleanText(req.body.availability || "available", 20),
    minBudget: Math.max(0, Number(req.body.minBudget) || 0),
    turnaroundDays: Math.max(0, Number.parseInt(req.body.turnaroundDays, 10) || 0),
    followerCount: Math.max(0, Number.parseInt(req.body.followerCount, 10) || 0),
    serviceLanguages: Array.isArray(req.body.serviceLanguages) ? req.body.serviceLanguages.slice(0, 8).map(item => cleanText(item, 40)).filter(Boolean) : [],
    serviceCatalog: sanitizeServices(req.body.serviceCatalog),
    caseStudies: sanitizeCaseStudies(req.body.caseStudies)
  };

  if (!payload.businessName) return res.status(400).json({ message: "Business name is required." });
  if (!payload.industry) return res.status(400).json({ message: "Industry is required." });
  if (!["buyer", "expert", "both"].includes(payload.accountMode)) payload.accountMode = "buyer";
  if (!availabilityOptions.has(payload.availability)) payload.availability = "available";
  if (payload.website && !/^https?:\/\/[\w.-]+\.[a-z]{2,}/i.test(payload.website)) return res.status(400).json({ message: "Website must start with http:// or https://." });
  if (payload.upiId && !validUpiId(payload.upiId)) return res.status(400).json({ message: "Enter a valid UPI ID like name@bank." });
  if (payload.serviceCatalog.some(service => service.portfolioLink && !/^https?:\/\/\S+\.\S+/i.test(service.portfolioLink))) return res.status(400).json({ message: "Portfolio links must start with http:// or https://." });
  if (payload.caseStudies.some(study => study.proofLink && !/^https?:\/\/\S+\.\S+/i.test(study.proofLink))) return res.status(400).json({ message: "Case study proof links must start with http:// or https://." });

  const user = await User.findById(req.user.id);
  if (!user) return res.status(401).json({ message: "Session account no longer exists." });

  Object.assign(user, payload);
  user.profileStrength = calculateProfileStrength(user);
  await user.save();
  await audit(req, "profile.update", "user", user._id, "Profile settings updated.");

  res.json({ user: publicUser(user) });
});

app.get("/api/dashboard", requireAuth, async (req, res) => {
  const [activePromotions, newRequests, briefsPosted, quotesReceived, completedBriefs, escrowPayments] = await Promise.all([
    Promotion.countDocuments({ status: "Online" }),
    PartnerRequest.countDocuments({ user: req.user.id, status: "new" }),
    AdBrief.countDocuments({ user: req.user.id }),
    AdBrief.countDocuments({ user: req.user.id, status: { $in: ["quotes_received", "expert_selected", "paid", "in_progress", "completed", "closed"] } }),
    AdBrief.countDocuments({ user: req.user.id, status: { $in: ["completed", "closed"] } }),
    Payment.aggregate([
      { $match: { user: new mongoose.Types.ObjectId(req.user.id), status: { $in: ["pending", "paid"] } } },
      { $group: { _id: "$currency", amount: { $sum: "$amount" }, count: { $sum: 1 } } }
    ])
  ]);

  const user = await User.findById(req.user.id).lean();
  if (!user) return res.status(401).json({ message: "Session account no longer exists." });
  res.json({ profileStrength: user.profileStrength, activePromotions, newRequests, briefsPosted, quotesReceived, completedBriefs, escrowPayments });
});

app.get("/api/promotions", async (req, res) => {
  const { page, limit, skip } = paged(req.query, { defaultLimit: 50, maxLimit: 100 });
  const query = cleanText(req.query.q, 80);
  const filter = {};
  if (req.query.status) {
    const status = cleanText(req.query.status, 20);
    if (!promotionStatuses.has(status)) return res.status(400).json({ message: "Choose a valid promotion status." });
    filter.status = status;
  }
  if (req.query.type) {
    const type = cleanText(req.query.type, 80);
    if (!promotionTypes.has(type)) return res.status(400).json({ message: "Choose a valid promotion type." });
    filter.type = type;
  }
  if (query) filter.$text = { $search: query };

  const [promotions, total] = await Promise.all([
    Promotion.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Promotion.countDocuments(filter)
  ]);
  res.json({ promotions, pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 } });
});

app.post("/api/promotions", requireAuth, async (req, res) => {
  try {
    const payload = validatePromotion({ ...req.body, image: String(req.body.image || "").startsWith("data:image/") ? saveDataImage(req.body.image, "promotion") : req.body.image });
    const promotion = await Promotion.create({ ...payload, owner: req.user.id });
    await audit(req, "promotion.create", "promotion", promotion._id, promotion.title);
    res.status(201).json({ promotion });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.get("/api/drafts/promotion", requireAuth, async (req, res) => {
  const draft = await Draft.findOne({ user: req.user.id }).lean();
  res.json({ draft });
});

app.put("/api/drafts/promotion", requireAuth, async (req, res) => {
  try {
    const payload = validatePromotion(req.body, { partial: true });
    const draft = await Draft.findOneAndUpdate({ user: req.user.id }, { ...payload, user: req.user.id }, { upsert: true, new: true });
    res.json({ draft });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.delete("/api/drafts/promotion", requireAuth, async (req, res) => {
  await Draft.deleteOne({ user: req.user.id });
  res.json({ ok: true });
});

app.get("/api/experts", requireAuth, async (_req, res) => {
  const experts = await User.find({ expertise: { $exists: true, $ne: "" } })
    .select("businessName industry expertise instagram youtube linkedin facebook twitter tiktok snapchat pinterest whatsapp telegram location website profileStrength availability minBudget turnaroundDays followerCount serviceLanguages serviceCatalog averageRating reviewCount")
    .sort({ profileStrength: -1, createdAt: -1 })
    .limit(80)
    .lean();
  res.json({ experts });
});

app.get("/api/experts/:id/public", requireAuth, async (req, res) => {
  const expert = await User.findById(req.params.id)
    .select("businessName industry description website location expertise instagram youtube linkedin facebook twitter tiktok snapchat pinterest whatsapp telegram profileStrength availability minBudget turnaroundDays followerCount serviceLanguages serviceCatalog caseStudies averageRating reviewCount")
    .lean();
  if (!expert || !expert.expertise) return res.status(404).json({ message: "Expert not found." });
  const quotes = await Quote.find({ user: expert._id, status: "accepted" }).select("_id").lean();
  const quoteIds = quotes.map(quote => quote._id);
  const reviews = quoteIds.length ? await AdBrief.find({ selectedQuote: { $in: quoteIds }, rating: { $gt: 0 } }).select("brandName platform rating reviewText updatedAt").sort({ updatedAt: -1 }).limit(10).lean() : [];
  res.json({ expert, reviews });
});

app.get("/api/shortlists", requireAuth, async (req, res) => {
  const items = await Shortlist.find({ user: req.user.id }).populate("expert", "businessName expertise platform profileStrength averageRating availability followerCount").sort({ createdAt: -1 }).lean();
  res.json({ shortlists: items });
});

app.post("/api/shortlists", requireAuth, async (req, res) => {
  const name = cleanText(req.body.name || "Default Shortlist", 120);
  const expertId = cleanText(req.body.expertId, 80);
  const briefId = cleanText(req.body.briefId, 80);
  const expert = await User.findById(expertId);
  if (!expert || !expert.expertise) return res.status(404).json({ message: "Expert not found." });
  const shortlist = await Shortlist.findOneAndUpdate(
    { user: req.user.id, name, expert: expert._id },
    { user: req.user.id, name, expert: expert._id, ...(briefId ? { brief: briefId } : {}) },
    { upsert: true, new: true }
  );
  await audit(req, "shortlist.save", "expert", expert._id, `${expert.businessName} saved to ${name}.`);
  res.status(201).json({ shortlist });
});

app.post("/api/shortlists/:name/invite", requireAuth, async (req, res) => {
  const brief = await AdBrief.findOne({ _id: cleanText(req.body.briefId, 80), user: req.user.id });
  if (!brief) return res.status(404).json({ message: "Brief not found." });
  const items = await Shortlist.find({ user: req.user.id, name: cleanText(req.params.name, 120) }).populate("expert").lean();
  for (const item of items) {
    if (!brief.invitedExperts.some(id => id.toString() === item.expert._id.toString())) brief.invitedExperts.push(item.expert._id);
    if (!brief.invitations.some(invite => invite.expert?.toString() === item.expert._id.toString())) brief.invitations.push({ expert: item.expert._id, status: "invited" });
    await Notification.create({
      user: item.expert._id,
      title: "Brief invitation",
      body: `${req.user.businessName} invited you to quote on ${brief.brandName}.`,
      type: "invite",
      linkType: "brief",
      linkId: brief._id.toString(),
      actionLabel: "Send quote",
      actionView: "expert"
    });
  }
  await brief.save();
  await audit(req, "shortlist.invite", "brief", brief._id, `Invited ${items.length} experts.`);
  res.json({ brief, invited: items.length });
});

app.get("/api/experts/matches/:briefId", requireAuth, async (req, res) => {
  const brief = await AdBrief.findOne({ _id: req.params.briefId, user: req.user.id }).lean();
  if (!brief) return res.status(404).json({ message: "Brief not found." });
  const experts = await User.find({ expertise: { $exists: true, $ne: "" }, _id: { $ne: req.user.id } })
    .select("businessName industry expertise instagram youtube linkedin facebook twitter tiktok snapchat pinterest whatsapp telegram location website profileStrength availability minBudget turnaroundDays followerCount serviceLanguages serviceCatalog averageRating reviewCount")
    .limit(80)
    .lean();
  const matches = experts
    .map(expert => ({ ...expert, matchScore: calculateExpertMatch(expert, brief) }))
    .sort((a, b) => b.matchScore - a.matchScore || (b.profileStrength || 0) - (a.profileStrength || 0));
  res.json({ matches });
});

app.get("/api/notifications", requireAuth, async (req, res) => {
  const notifications = await Notification.find({ user: req.user.id }).sort({ createdAt: -1 }).limit(50).lean();
  const unread = notifications.filter(item => !item.read).length;
  res.json({ notifications, unread });
});

app.patch("/api/notifications/read", requireAuth, async (req, res) => {
  await Notification.updateMany({ user: req.user.id, read: false }, { read: true });
  res.json({ ok: true });
});

app.get("/api/ad-briefs", requireAuth, async (req, res) => {
  const { page, limit, skip } = paged(req.query, { defaultLimit: 50, maxLimit: 100 });
  const filter = { user: req.user.id };
  const [briefs, total] = await Promise.all([
    AdBrief.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    AdBrief.countDocuments(filter)
  ]);
  const quotes = await Quote.find({ brief: { $in: briefs.map(brief => brief._id) } }).sort({ createdAt: -1 }).lean();
  const quoteMap = quotes.reduce((map, quote) => {
    const key = quote.brief.toString();
    map[key] = map[key] || [];
    map[key].push(quote);
    return map;
  }, {});
  res.json({ briefs: briefs.map(brief => ({ ...brief, quotes: quoteMap[brief._id.toString()] || [] })), pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 } });
});

app.get("/api/ad-briefs/open", requireAuth, async (req, res) => {
  const { page, limit, skip } = paged(req.query, { defaultLimit: 30, maxLimit: 80 });
  const filter = { status: { $in: ["open", "quotes_received"] }, user: { $ne: req.user.id }, isAuction: { $ne: true } };
  const platform = cleanText(req.query.platform, 40);
  const language = cleanText(req.query.language, 80);
  const city = cleanText(req.query.city, 100);
  if (platform && socialPlatforms.has(platform)) filter.platform = platform;
  if (language) filter.language = language;
  if (city) filter.city = new RegExp(city.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  const budgetMin = Number(req.query.budgetMin) || 0;
  const budgetMax = Number(req.query.budgetMax) || 0;
  if (budgetMin) filter.budgetMax = { $gte: budgetMin };
  if (budgetMax) filter.budgetMin = { ...(filter.budgetMin || {}), $lte: budgetMax };
  const [briefs, total] = await Promise.all([
    AdBrief.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    AdBrief.countDocuments(filter)
  ]);
  res.json({ briefs, pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 } });
});

app.get("/api/ad-briefs/:id/workspace", requireAuth, async (req, res) => {
  const brief = await AdBrief.findById(req.params.id).lean();
  if (!brief) return res.status(404).json({ message: "Brief not found." });
  const quotes = await Quote.find({ brief: brief._id }).sort({ createdAt: -1 }).lean();
  const selectedQuote = brief.selectedQuote ? quotes.find(quote => quote._id.toString() === brief.selectedQuote.toString()) : null;
  const allowed =
    brief.user.toString() === req.user.id ||
    quotes.some(quote => quote.user.toString() === req.user.id) ||
    (brief.invitedExperts || []).some(id => id.toString() === req.user.id);
  if (!allowed) return res.status(403).json({ message: "You do not have access to this brief workspace." });
  const messages = await Message.find({ user: req.user.id, brief: brief._id }).sort({ createdAt: 1 }).limit(100).lean();
  const payments = selectedQuote ? await Payment.find({ user: brief.user }).sort({ createdAt: -1 }).limit(20).lean() : [];
  res.json({ brief, quotes, selectedQuote, messages, payments });
});

app.get("/api/expert/inbox", requireAuth, async (req, res) => {
  const user = await User.findById(req.user.id).lean();
  if (!user) return res.status(401).json({ message: "Session account no longer exists." });
  const platformFilters = socialFieldsForUser(user);
  const [invited, quoted, accepted, matching] = await Promise.all([
    AdBrief.find({ invitedExperts: req.user.id, status: { $in: ["open", "quotes_received"] } }).sort({ createdAt: -1 }).limit(40).lean(),
    Quote.find({ user: req.user.id }).sort({ updatedAt: -1 }).limit(80).lean(),
    Quote.find({ user: req.user.id, status: "accepted" }).sort({ updatedAt: -1 }).limit(40).lean(),
    AdBrief.find({ status: { $in: ["open", "quotes_received"] }, platform: { $in: platformFilters.length ? platformFilters : [...socialPlatforms] } }).sort({ createdAt: -1 }).limit(40).lean()
  ]);
  res.json({ invited, quoted, accepted, matching });
});

async function createSocialMediaBrief(req, res) {
  const range = budgetRange(req.body.budget);
  const payload = {
    user: req.user.id,
    platform: cleanText(req.body.platform || "Instagram", 40),
    format: cleanText(req.body.format || "Social Media Promotion", 80),
    socialHandle: cleanText(req.body.socialHandle || req.body.instagramHandle, 120),
    instagramHandle: cleanText(req.body.socialHandle || req.body.instagramHandle, 120),
    brandName: cleanText(req.body.brandName, 120),
    goal: cleanText(req.body.goal, 240),
    targetAudience: cleanText(req.body.targetAudience, 160),
    ageMin: Math.max(0, Math.min(120, Number(req.body.ageMin) || 0)),
    ageMax: Math.max(0, Math.min(120, Number(req.body.ageMax) || 0)),
    city: cleanText(req.body.city, 100),
    language: cleanText(req.body.language || "English", 80),
    budget: cleanText(req.body.budget, 80),
    budgetMin: Math.max(0, Number(req.body.budgetMin) || range.budgetMin),
    budgetMax: Math.max(0, Number(req.body.budgetMax) || range.budgetMax),
    currency: cleanText(req.body.currency || "inr", 8).toLowerCase(),
    preferredDate: cleanText(req.body.preferredDate, 40),
    creativeLink: cleanText(req.body.creativeLink, 220),
    notes: cleanText(req.body.notes, 700),
    isAuction: Boolean(req.body.isAuction),
    urgency: cleanText(req.body.urgency || (req.body.isAuction ? "fast" : "standard"), 20)
  };
  if (!urgencyOptions.has(payload.urgency)) payload.urgency = payload.isAuction ? "fast" : "standard";
  if (payload.isAuction) {
    payload.auctionStatus = "live";
    payload.auctionEndsAt = auctionEndDate(req.body.auctionEndsAt, payload.urgency);
  }

  if (!socialPlatforms.has(payload.platform)) return res.status(400).json({ message: "Choose a valid social media platform." });
  if (!platformFormats[payload.platform].includes(payload.format)) return res.status(400).json({ message: `Choose a valid ${payload.platform} format.` });
  if (!socialHandlePattern.test(payload.socialHandle)) return res.status(400).json({ message: "Add a valid social handle or profile URL." });
  if (payload.brandName.length < 2) return res.status(400).json({ message: "Brand or person name is required." });
  if (payload.goal.length < 8) return res.status(400).json({ message: "Explain the promotion goal." });
  if (payload.targetAudience.length < 4) return res.status(400).json({ message: "Target audience is required." });
  if (payload.ageMin && payload.ageMax && payload.ageMin > payload.ageMax) return res.status(400).json({ message: "Minimum age cannot be greater than maximum age." });
  if (payload.budget.length < 2) return res.status(400).json({ message: "Budget is required." });
  if (!paymentCurrencies.has(payload.currency)) return res.status(400).json({ message: "Choose a valid currency." });
  if (payload.creativeLink && !/^https?:\/\/\S+\.\S+/i.test(payload.creativeLink)) return res.status(400).json({ message: "Creative link must start with http:// or https://." });

  if (!payload.socialHandle.startsWith("@") && !/^https?:\/\//i.test(payload.socialHandle)) payload.socialHandle = `@${payload.socialHandle}`;
  payload.instagramHandle = payload.socialHandle;

  const brief = await AdBrief.create(payload);
  await audit(req, "brief.create", "brief", brief._id, `${brief.platform} brief for ${brief.brandName}`);
  await Notification.create({
    user: req.user.id,
    title: payload.isAuction ? "Fast auction started" : `${payload.platform} brief posted`,
    body: payload.isAuction ? "Experts can now place bids on your urgent campaign." : "Your brief is now open for social media experts to quote.",
    type: "brief",
    linkType: "brief",
    linkId: brief._id.toString()
  });
  res.status(201).json({ brief });
}

app.post("/api/ad-briefs/social-media", requireAuth, createSocialMediaBrief);
app.post("/api/ad-briefs/instagram-story", requireAuth, createSocialMediaBrief);

app.get("/api/auctions/open", requireAuth, async (req, res) => {
  const now = new Date();
  await AdBrief.updateMany({ isAuction: true, auctionStatus: "live", auctionEndsAt: { $lte: now } }, { auctionStatus: "ended" });
  const auctions = await AdBrief.find({
    isAuction: true,
    auctionStatus: "live",
    status: { $in: ["open", "quotes_received"] },
    user: { $ne: req.user.id }
  }).sort({ auctionEndsAt: 1, createdAt: -1 }).limit(50).lean();
  const quotes = await Quote.find({ brief: { $in: auctions.map(brief => brief._id) } }).sort({ amountMinor: 1, deliveryDays: 1 }).lean();
  const quoteMap = quotes.reduce((map, quote) => {
    const key = quote.brief.toString();
    map[key] = map[key] || [];
    map[key].push(quote);
    return map;
  }, {});
  res.json({ auctions: auctions.map(brief => ({ ...brief, quotes: quoteMap[brief._id.toString()] || [] })) });
});

app.post("/api/ad-briefs/:id/invite", requireAuth, async (req, res) => {
  const brief = await AdBrief.findOne({ _id: req.params.id, user: req.user.id });
  if (!brief) return res.status(404).json({ message: "Brief not found." });
  const expert = await User.findById(cleanText(req.body.expertId, 80));
  if (!expert || !expert.expertise) return res.status(404).json({ message: "Expert not found." });
  if (!brief.invitedExperts.some(id => id.toString() === expert._id.toString())) brief.invitedExperts.push(expert._id);
  const existingInvite = brief.invitations.find(item => item.expert?.toString() === expert._id.toString());
  if (!existingInvite) brief.invitations.push({ expert: expert._id, status: "invited" });
  await brief.save();
  await audit(req, "brief.invite", "brief", brief._id, `Invited ${expert.businessName}.`);
  await Notification.create({
    user: expert._id,
    title: "Brief invitation",
    body: `${req.user.businessName} invited you to quote on ${brief.brandName}.`,
    type: "invite",
    linkType: "brief",
    linkId: brief._id.toString(),
    actionLabel: "Send quote",
    actionView: "marketplace"
  });
  res.json({ brief });
});

app.patch("/api/ad-briefs/:id/invite/respond", requireAuth, async (req, res) => {
  const status = cleanText(req.body.status, 20);
  if (!["accepted", "declined"].includes(status)) return res.status(400).json({ message: "Choose accepted or declined." });
  const brief = await AdBrief.findOne({ _id: req.params.id, invitedExperts: req.user.id });
  if (!brief) return res.status(404).json({ message: "Invitation not found." });
  const invite = brief.invitations.find(item => item.expert?.toString() === req.user.id);
  if (invite) {
    invite.status = status;
    invite.respondedAt = new Date();
  } else {
    brief.invitations.push({ expert: req.user.id, status, respondedAt: new Date() });
  }
  await brief.save();
  await audit(req, `brief.invite.${status}`, "brief", brief._id, `Invitation ${status}.`);
  await Notification.create({
    user: brief.user,
    title: `Invitation ${status}`,
    body: `${req.user.businessName} ${status} your invitation for ${brief.brandName}.`,
    type: "invite",
    linkType: "brief",
    linkId: brief._id.toString(),
    actionLabel: "Open workspace",
    actionView: "marketplace"
  });
  res.json({ brief });
});

app.post("/api/ad-briefs/:id/quotes", requireAuth, async (req, res) => {
  const brief = await AdBrief.findById(req.params.id);
  if (!brief) return res.status(404).json({ message: "Brief not found." });
  if (brief.user.toString() === req.user.id) return res.status(403).json({ message: "Buyers cannot quote their own brief." });
  if (!["open", "quotes_received"].includes(brief.status)) return res.status(400).json({ message: "This brief is not accepting new quotes." });
  if (brief.isAuction && brief.auctionEndsAt && brief.auctionEndsAt.getTime() <= Date.now()) {
    brief.auctionStatus = "ended";
    await brief.save();
    return res.status(400).json({ message: "This auction has ended." });
  }

  const payload = {
    brief: brief._id,
    user: req.user.id,
    expertName: cleanText(req.body.expertName || req.user.businessName, 120),
    amount: cleanText(req.body.amount, 80),
    amountMinor: quoteAmountToMinorUnits(req.body.amount),
    timeline: cleanText(req.body.timeline, 120),
    deliveryDays: inferDeliveryDays(req.body.timeline),
    message: cleanText(req.body.message, 700)
  };

  if (!payload.expertName) return res.status(400).json({ message: "Expert name is required." });
  if (payload.amount.length < 2) return res.status(400).json({ message: "Quote amount is required." });
  if (payload.amountMinor < 100) return res.status(400).json({ message: "Quote amount must include a valid number." });
  if (payload.timeline.length < 2) return res.status(400).json({ message: "Timeline is required." });
  if (payload.message.length < 10) return res.status(400).json({ message: "Add a useful quote message." });

  const expert = await User.findById(req.user.id).lean();
  const quote = await Quote.create({ ...payload, matchScore: calculateExpertMatch(expert, brief), isBid: Boolean(brief.isAuction), bidExpiresAt: brief.auctionEndsAt });
  await audit(req, brief.isAuction ? "bid.create" : "quote.create", "quote", quote._id, `Quote for ${brief.brandName}.`);
  if (brief.status === "open") {
    setBriefStatus(brief, "quotes_received");
    await brief.save();
  }
  await Notification.create({
    user: brief.user,
    title: brief.isAuction ? "New auction bid received" : "New quote received",
    body: `${payload.expertName} ${brief.isAuction ? "bid" : "quoted"} ${payload.amount} for ${brief.brandName}.`,
    type: "quote",
    linkType: "brief",
    linkId: brief._id.toString(),
    actionLabel: "Compare quotes",
    actionView: "marketplace"
  });

  res.status(201).json({ quote, brief });
});

app.patch("/api/ad-briefs/:id/quotes/:quoteId/shortlist", requireAuth, async (req, res) => {
  const brief = await AdBrief.findOne({ _id: req.params.id, user: req.user.id });
  if (!brief) return res.status(404).json({ message: "Brief not found." });
  const quote = await Quote.findOne({ _id: req.params.quoteId, brief: brief._id });
  if (!quote) return res.status(404).json({ message: "Bid not found." });
  quote.shortlisted = Boolean(req.body.shortlisted ?? true);
  await quote.save();
  await Notification.create({
    user: quote.user,
    title: quote.shortlisted ? "Bid shortlisted" : "Bid removed from shortlist",
    body: quote.shortlisted ? `${brief.brandName} shortlisted your bid.` : `${brief.brandName} updated its bid shortlist.`,
    type: "quote",
    linkType: "brief",
    linkId: brief._id.toString(),
    actionLabel: "Open workspace",
    actionView: "expert"
  });
  res.json({ quote });
});

app.patch("/api/ad-briefs/:id/quotes/:quoteId/withdraw", requireAuth, async (req, res) => {
  const quote = await Quote.findOne({ _id: req.params.quoteId, brief: req.params.id, user: req.user.id });
  const brief = await AdBrief.findById(req.params.id);
  if (!quote || !brief) return res.status(404).json({ message: "Bid not found." });
  if (quote.status !== "submitted") return res.status(400).json({ message: "Only submitted bids can be withdrawn." });
  quote.status = "withdrawn";
  await quote.save();
  await Notification.create({
    user: brief.user,
    title: "Bid withdrawn",
    body: `${quote.expertName} withdrew a bid for ${brief.brandName}.`,
    type: "quote",
    linkType: "brief",
    linkId: brief._id.toString(),
    actionLabel: "Compare bids",
    actionView: "marketplace"
  });
  res.json({ quote });
});

app.patch("/api/ad-briefs/:id/auction/close", requireAuth, async (req, res) => {
  const brief = await AdBrief.findOne({ _id: req.params.id, user: req.user.id, isAuction: true });
  if (!brief) return res.status(404).json({ message: "Auction not found." });
  if (!["open", "quotes_received"].includes(brief.status)) return res.status(400).json({ message: "Auction cannot be closed after awarding." });
  brief.auctionStatus = "ended";
  await brief.save();
  await audit(req, "auction.close", "brief", brief._id, `Auction closed for ${brief.brandName}.`);
  res.json({ brief });
});

app.patch("/api/ad-briefs/:id/quotes/:quoteId/revise", requireAuth, async (req, res) => {
  const brief = await AdBrief.findOne({ _id: req.params.id, user: req.user.id });
  const quote = await Quote.findOne({ _id: req.params.quoteId, brief: req.params.id });
  if (!brief || !quote) return res.status(404).json({ message: "Quote not found." });

  const revisionNote = cleanText(req.body.revisionNote, 700);
  if (revisionNote.length < 8) return res.status(400).json({ message: "Add a useful revision note." });

  quote.revisionNote = revisionNote;
  quote.revisionCount += 1;
  await quote.save();
  await Notification.create({
    user: quote.user,
    title: "Quote revision requested",
    body: `${req.user.businessName} requested a quote revision for ${brief.brandName}.`,
    type: "quote_revision",
    linkType: "brief",
    linkId: brief._id.toString(),
    actionLabel: "Revise quote",
    actionView: "marketplace"
  });
  res.json({ quote });
});

app.patch("/api/ad-briefs/:id/quotes/:quoteId/counter", requireAuth, async (req, res) => {
  const brief = await AdBrief.findOne({ _id: req.params.id, user: req.user.id });
  const quote = await Quote.findOne({ _id: req.params.quoteId, brief: req.params.id });
  if (!brief || !quote) return res.status(404).json({ message: "Quote not found." });
  quote.counterAmount = cleanText(req.body.counterAmount, 80);
  quote.counterTimeline = cleanText(req.body.counterTimeline, 120);
  quote.counterMessage = cleanText(req.body.counterMessage, 700);
  quote.counterStatus = "proposed";
  if (quoteAmountToMinorUnits(quote.counterAmount) < 100) return res.status(400).json({ message: "Counter amount must include a valid number." });
  await quote.save();
  await audit(req, "quote.counter", "quote", quote._id, `Counteroffer for ${brief.brandName}.`);
  await Notification.create({
    user: quote.user,
    title: "Counteroffer received",
    body: `${req.user.businessName} proposed ${quote.counterAmount} for ${brief.brandName}.`,
    type: "counteroffer",
    linkType: "brief",
    linkId: brief._id.toString(),
    actionLabel: "Review counter",
    actionView: "marketplace"
  });
  res.json({ quote });
});

app.patch("/api/ad-briefs/:id/quotes/:quoteId/counter/respond", requireAuth, async (req, res) => {
  const status = cleanText(req.body.status, 20);
  if (!["accepted", "declined"].includes(status)) return res.status(400).json({ message: "Choose accepted or declined." });
  const quote = await Quote.findOne({ _id: req.params.quoteId, brief: req.params.id, user: req.user.id });
  const brief = await AdBrief.findById(req.params.id);
  if (!quote || !brief) return res.status(404).json({ message: "Counteroffer not found." });
  quote.counterStatus = status;
  if (status === "accepted") {
    quote.amount = quote.counterAmount;
    quote.amountMinor = quoteAmountToMinorUnits(quote.counterAmount);
    quote.timeline = quote.counterTimeline || quote.timeline;
    quote.deliveryDays = inferDeliveryDays(quote.timeline);
    quote.message = quote.counterMessage || quote.message;
  }
  await quote.save();
  await audit(req, `quote.counter.${status}`, "quote", quote._id, `Counteroffer ${status}.`);
  await Notification.create({
    user: brief.user,
    title: `Counteroffer ${status}`,
    body: `${quote.expertName} ${status} your counteroffer for ${brief.brandName}.`,
    type: "counteroffer",
    linkType: "brief",
    linkId: brief._id.toString(),
    actionLabel: "Compare quotes",
    actionView: "marketplace"
  });
  res.json({ quote });
});

app.patch("/api/ad-briefs/:id/quotes/:quoteId/resubmit", requireAuth, async (req, res) => {
  const quote = await Quote.findOne({ _id: req.params.quoteId, brief: req.params.id, user: req.user.id });
  const brief = await AdBrief.findById(req.params.id);
  if (!quote || !brief) return res.status(404).json({ message: "Quote not found." });

  quote.amount = cleanText(req.body.amount || quote.amount, 80);
  quote.amountMinor = quoteAmountToMinorUnits(quote.amount);
  quote.timeline = cleanText(req.body.timeline || quote.timeline, 120);
  quote.deliveryDays = inferDeliveryDays(quote.timeline);
  quote.message = cleanText(req.body.message || quote.message, 700);
  quote.revisionNote = "";
  quote.status = "submitted";
  if (quote.amountMinor < 100) return res.status(400).json({ message: "Quote amount must include a valid number." });
  await quote.save();
  await Notification.create({
    user: brief.user,
    title: "Quote revised",
    body: `${quote.expertName} submitted a revised quote for ${brief.brandName}.`,
    type: "quote",
    linkType: "brief",
    linkId: brief._id.toString(),
    actionLabel: "Compare quotes",
    actionView: "marketplace"
  });
  res.json({ quote });
});

app.patch("/api/ad-briefs/:id/quotes/:quoteId/accept", requireAuth, async (req, res) => {
  const brief = await AdBrief.findOne({ _id: req.params.id, user: req.user.id });
  if (!brief) return res.status(404).json({ message: "Brief not found." });

  const quote = await Quote.findOneAndUpdate({ _id: req.params.quoteId, brief: brief._id, status: "submitted" }, { status: "accepted" }, { new: true });
  if (!quote) return res.status(404).json({ message: "Quote not found." });

  await Quote.updateMany({ brief: brief._id, _id: { $ne: quote._id }, status: "submitted" }, { status: "declined" });
  brief.selectedQuote = quote._id;
  if (brief.isAuction) brief.auctionStatus = "awarded";
  setBriefStatus(brief, "expert_selected");
  await brief.save();
  await audit(req, "quote.accept", "quote", quote._id, `Accepted quote for ${brief.brandName}.`);
  await Notification.create({
    user: quote.user,
    title: "Quote accepted",
    body: `Your quote for ${brief.brandName} was accepted.`,
    type: "quote",
    linkType: "brief",
    linkId: brief._id.toString()
  });

  res.json({ brief, quote });
});

app.post("/api/ad-briefs/:id/escrow", requireAuth, async (req, res) => {
  const brief = await AdBrief.findOne({ _id: req.params.id, user: req.user.id });
  if (!brief) return res.status(404).json({ message: "Brief not found." });
  if (!brief.selectedQuote) return res.status(400).json({ message: "Accept a quote before starting escrow." });

  const quote = await Quote.findOne({ _id: brief.selectedQuote, brief: brief._id, status: "accepted" });
  if (!quote) return res.status(404).json({ message: "Accepted quote not found." });

  const amount = quoteAmountToMinorUnits(quote.amount);
  if (!Number.isInteger(amount) || amount < 100) return res.status(400).json({ message: "Accepted quote amount must include a valid number." });
  const currency = brief.currency || "inr";
  if (!hasPaymentProvider(currency)) return res.status(503).json({ message: "Manual checkout is available. Choose a valid payment currency." });
  const fees = feeBreakdown(amount);
  const payer = await User.findById(req.user.id).lean();
  const expert = quote.user ? await User.findById(quote.user).lean() : null;
  const payerUpiId = cleanText(req.body.payerUpiId || payer?.upiId || "", 120).toLowerCase();
  const payeeUpiId = (upiMerchantVpa || expert?.upiId || "").toLowerCase();
  const payeeName = upiMerchantVpa ? upiMerchantName : (expert?.businessName || quote.expertName || "Campaign expert");
  if (canUseManualUpi(currency)) {
    if (!validUpiId(payerUpiId)) return res.status(400).json({ message: "Add your UPI ID before starting INR escrow, for example name@bank." });
    if (!validUpiId(payeeUpiId)) return res.status(400).json({ message: "The selected expert needs a UPI ID, or set UPI_MERCHANT_VPA for platform escrow." });
  }

  const contract = await Contract.create({
    user: req.user.id,
    recipientBusinessName: quote.expertName,
    promotionTitle: `${brief.platform || "Social Media"} Promotion - ${brief.brandName}`,
    amount: fees.totalAmount,
    currency,
    documentText: contractDocument({ brief, quote, amount: fees.totalAmount, currency })
  });

  const payment = await Payment.create({
    user: req.user.id,
    recipientBusinessName: quote.expertName,
    contract: contract._id,
    brief: brief._id,
    quote: quote._id,
    amount,
    ...fees,
    invoiceNumber: invoiceNumber(),
    currency,
    provider: canUseManualUpi(currency) ? (canUseUpi(currency) ? "upi" : "manual_upi") : (stripe ? "stripe" : "manual"),
    payerUpiId
  });

  if (canUseManualUpi(currency)) {
    payment.providerSessionId = `upi_${payment._id}_${randomToken().slice(0, 8)}`;
    payment.upiVpa = payeeUpiId;
    payment.upiPayeeName = payeeName;
    payment.upiReference = upiReference(payment);
    await payment.save();
    await audit(req, payment.provider === "upi" ? "escrow.upi_qr" : "escrow.manual_upi", "brief", brief._id, `Manual UPI escrow started for ${brief.brandName}.`);
    return res.status(201).json({ contract, payment, checkoutUrl: upiCheckoutUrl(payment.providerSessionId), upiCheckout: true });
  }

  if (!stripe) {
    if (payment.provider === "manual") {
      payment.providerSessionId = `manual_${payment._id}_${randomToken().slice(0, 8)}`;
      payment.upiPayeeName = quote.expertName;
      payment.upiReference = upiReference(payment);
      await payment.save();
      await audit(req, "escrow.manual_checkout", "brief", brief._id, `Manual escrow checkout started for ${brief.brandName}.`);
      return res.status(201).json({ contract, payment, checkoutUrl: manualCheckoutUrl(payment.providerSessionId), manualCheckout: true });
    }
    payment.provider = "manual";
    payment.providerSessionId = `manual_${payment._id}_${randomToken().slice(0, 8)}`;
    payment.upiPayeeName = quote.expertName;
    payment.upiReference = upiReference(payment);
    await payment.save();
    await audit(req, "escrow.manual_checkout", "brief", brief._id, `Manual escrow checkout started for ${brief.brandName}.`);
    return res.status(201).json({ contract, payment, checkoutUrl: manualCheckoutUrl(payment.providerSessionId), manualCheckout: true });
  }

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    customer_email: req.user.email,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: brief.currency || "inr",
          unit_amount: fees.totalAmount,
          product_data: {
            name: `Escrow: ${brief.brandName}`,
            description: `${brief.platform || "Social media"} promotion escrow for ${quote.expertName}. Includes platform and escrow fees.`
          }
        }
      }
    ],
    metadata: {
      contractId: contract._id.toString(),
      paymentId: payment._id.toString(),
      userId: req.user.id,
      briefId: brief._id.toString(),
      quoteId: quote._id.toString(),
      recipientBusinessName: quote.expertName
    },
    success_url: `${clientOrigin}/?payment=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${clientOrigin}/?payment=cancelled`
  });

  if (!session.url) return res.status(502).json({ message: "Stripe did not return a checkout URL." });
  payment.providerSessionId = session.id;
  await payment.save();
  await audit(req, "escrow.start", "brief", brief._id, `Escrow started for ${brief.brandName}.`);

  res.status(201).json({ contract, payment, checkoutUrl: session.url });
});

app.patch("/api/ad-briefs/:id/proof", requireAuth, async (req, res) => {
  const proofLink = cleanText(req.body.proofLink, 220);
  const proofNotes = cleanText(req.body.proofNotes, 700);
  let proofScreenshot = cleanText(req.body.proofScreenshot, 300000);
  if (proofScreenshot.startsWith("data:image/")) proofScreenshot = saveDataImage(proofScreenshot, "proof");
  const proofMetrics = typeof req.body.proofMetrics === "object" && req.body.proofMetrics ? req.body.proofMetrics : {};
  const proofReach = Math.max(0, Number.parseInt(req.body.proofReach, 10) || 0);
  const proofClicks = Math.max(0, Number.parseInt(req.body.proofClicks, 10) || 0);
  if (!/^https?:\/\/\S+\.\S+/i.test(proofLink)) return res.status(400).json({ message: "Proof link must start with http:// or https://." });
  if (proofScreenshot && !proofScreenshot.startsWith("/uploads/") && !/^data:image\/(png|jpeg|jpg);base64,/i.test(proofScreenshot) && !/^https?:\/\/\S+\.\S+/i.test(proofScreenshot)) {
    return res.status(400).json({ message: "Proof screenshot must be an image upload or a valid URL." });
  }

  const brief = await AdBrief.findById(req.params.id);
  if (!brief) return res.status(404).json({ message: "Brief not found." });
  const selectedQuote = brief.selectedQuote ? await Quote.findById(brief.selectedQuote).lean() : null;
  if (!canWorkOnBrief(req.user.id, brief, selectedQuote)) return res.status(403).json({ message: "Only the buyer or selected expert can upload proof." });
  if (!["paid", "in_progress", "proof_submitted"].includes(brief.status)) return res.status(400).json({ message: "Proof can be uploaded after escrow is paid." });

  brief.proofLink = proofLink;
  brief.proofNotes = proofNotes;
  brief.proofReach = proofReach;
  brief.proofClicks = proofClicks;
  brief.proofMetrics = proofMetrics;
  brief.proofScreenshot = proofScreenshot;
  brief.proofStatus = "submitted";
  setBriefStatus(brief, "proof_submitted");
  await brief.save();
  await audit(req, "proof.upload", "brief", brief._id, `Proof uploaded for ${brief.brandName}.`);
  await Notification.create({
    user: brief.user,
    title: "Promotion proof uploaded",
    body: `Proof has been added for ${brief.brandName}.`,
    type: "proof",
    linkType: "brief",
    linkId: brief._id.toString(),
    actionLabel: "Review proof",
    actionView: "marketplace"
  });
  res.json({ brief });
});

app.patch("/api/ad-briefs/:id/proof-review", requireAuth, async (req, res) => {
  const brief = await AdBrief.findOne({ _id: req.params.id, user: req.user.id });
  if (!brief) return res.status(404).json({ message: "Brief not found." });
  const decision = cleanText(req.body.decision, 30);
  const note = cleanText(req.body.note, 700);
  if (!["approved", "revision_requested"].includes(decision)) return res.status(400).json({ message: "Choose approve or request revision." });
  brief.proofStatus = decision;
  brief.proofRevisionNote = note;
  setBriefStatus(brief, decision === "approved" ? "completed" : "in_progress");
  await brief.save();
  await audit(req, `proof.${decision}`, "brief", brief._id, `Proof ${decision}.`);
  if (brief.selectedQuote) {
    const quote = await Quote.findById(brief.selectedQuote).lean();
    if (quote) {
      await Notification.create({
        user: quote.user,
        title: decision === "approved" ? "Proof approved" : "Proof revision requested",
        body: decision === "approved" ? `${brief.brandName} has been approved.` : note || `Please revise proof for ${brief.brandName}.`,
        type: "proof",
        linkType: "brief",
        linkId: brief._id.toString(),
        actionLabel: decision === "approved" ? "View brief" : "Upload proof",
        actionView: "marketplace"
      });
    }
  }
  res.json({ brief });
});

app.patch("/api/ad-briefs/:id/dispute", requireAuth, async (req, res) => {
  const brief = await AdBrief.findOne({ _id: req.params.id, user: req.user.id });
  if (!brief) return res.status(404).json({ message: "Brief not found." });
  const disputeReason = cleanText(req.body.disputeReason, 700);
  if (disputeReason.length < 10) return res.status(400).json({ message: "Add a clear dispute reason." });
  brief.disputeReason = disputeReason;
  setBriefStatus(brief, "disputed");
  await brief.save();
  await audit(req, "brief.dispute", "brief", brief._id, disputeReason);
  res.json({ brief });
});

app.post("/api/ad-briefs/:id/dispute/evidence", requireAuth, async (req, res) => {
  const brief = await AdBrief.findById(req.params.id);
  if (!brief || brief.status !== "disputed") return res.status(404).json({ message: "Dispute not found." });
  const selectedQuote = brief.selectedQuote ? await Quote.findById(brief.selectedQuote).lean() : null;
  if (!canWorkOnBrief(req.user.id, brief, selectedQuote)) return res.status(403).json({ message: "You cannot add evidence to this dispute." });
  let file = cleanText(req.body.file, 300000);
  if (file.startsWith("data:image/")) file = saveDataImage(file, "dispute");
  brief.disputeEvidence.push({
    user: req.user.id,
    role: canManageBrief(req.user.id, brief) ? "buyer" : "expert",
    note: cleanText(req.body.note, 700),
    file,
    requestedResolution: cleanText(req.body.requestedResolution, 160)
  });
  await brief.save();
  await audit(req, "dispute.evidence", "brief", brief._id, "Dispute evidence added.");
  res.json({ brief });
});

app.patch("/api/ad-briefs/:id/rating", requireAuth, async (req, res) => {
  const rating = Number(req.body.rating);
  const reviewText = cleanText(req.body.reviewText, 700);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return res.status(400).json({ message: "Rating must be between 1 and 5." });

  const brief = await AdBrief.findOneAndUpdate({ _id: req.params.id, user: req.user.id }, { rating, reviewText }, { new: true });
  if (!brief) return res.status(404).json({ message: "Brief not found." });
  await audit(req, "brief.review", "brief", brief._id, `${rating} stars.`);
  if (brief.selectedQuote) {
    const quote = await Quote.findById(brief.selectedQuote).lean();
    if (quote?.user) {
      const reviewed = await AdBrief.find({ selectedQuote: { $exists: true }, rating: { $gt: 0 } }).lean();
      const expertQuoteIds = await Quote.find({ user: quote.user }).select("_id").lean();
      const ids = new Set(expertQuoteIds.map(item => item._id.toString()));
      const ratings = reviewed.filter(item => ids.has(String(item.selectedQuote))).map(item => item.rating);
      const averageRating = ratings.length ? ratings.reduce((sum, value) => sum + value, 0) / ratings.length : rating;
      await User.findByIdAndUpdate(quote.user, { averageRating, reviewCount: ratings.length || 1 });
    }
  }
  res.json({ brief });
});

app.get("/api/connections", requireAuth, async (req, res) => {
  const connections = await Connection.find({ user: req.user.id }).sort({ createdAt: -1 }).lean();
  res.json({ connections });
});

app.post("/api/connections", requireAuth, async (req, res) => {
  const businessName = cleanText(req.body.businessName, 120);
  if (!businessName) return res.status(400).json({ message: "Business name is required." });

  const connection = await Connection.findOneAndUpdate(
    { user: req.user.id, businessName },
    { user: req.user.id, businessName, status: "pending" },
    { upsert: true, new: true }
  );
  res.status(201).json({ connection });
});

app.get("/api/requests", requireAuth, async (req, res) => {
  const requests = await PartnerRequest.find({ user: req.user.id }).sort({ createdAt: -1 }).lean();
  res.json({ requests });
});

app.patch("/api/requests/:id", requireAuth, async (req, res) => {
  const status = cleanText(req.body.status, 20);
  if (!["accepted", "declined"].includes(status)) return res.status(400).json({ message: "Invalid request status." });

  const request = await PartnerRequest.findOneAndUpdate({ _id: req.params.id, user: req.user.id }, { status }, { new: true });
  if (!request) return res.status(404).json({ message: "Request not found." });
  res.json({ request });
});

app.get("/api/contracts", requireAuth, async (req, res) => {
  const { page, limit, skip } = paged(req.query, { defaultLimit: 80, maxLimit: 100 });
  const filter = { user: req.user.id };
  const [contracts, total] = await Promise.all([
    Contract.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Contract.countDocuments(filter)
  ]);
  res.json({ contracts, pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 } });
});

app.patch("/api/contracts/:id/status", requireAuth, async (req, res) => {
  const status = cleanText(req.body.status, 24);
  if (!contractStatuses.has(status)) return res.status(400).json({ message: "Choose a valid contract status." });

  const contract = await Contract.findOneAndUpdate({ _id: req.params.id, user: req.user.id }, { status }, { new: true });
  if (!contract) return res.status(404).json({ message: "Contract not found." });
  res.json({ contract });
});

app.post("/api/contracts", requireAuth, async (req, res) => {
  const recipientEntries = recipientPaymentEntries(req.body);
  const recipients = recipientEntries.map(item => item.businessName);
  const promotionTitle = cleanText(req.body.promotionTitle, 120);
  const promotionId = cleanText(req.body.promotionId, 80);
  const currency = cleanText(req.body.currency || "usd", 8).toLowerCase();
  const amount = Number(req.body.amount);

  if (!recipients.length) return res.status(400).json({ message: "At least one recipient is required." });
  if (!paymentCurrencies.has(currency)) return res.status(400).json({ message: "Choose a valid payment currency." });
  if (!Number.isInteger(amount) || amount < 100 || amount > 100000000) return res.status(400).json({ message: "Contract payment amount must be between 1 and 1,000,000 in the selected currency." });
  if (!hasPaymentProvider(currency)) return res.status(503).json({ message: "Manual checkout is available. Choose a valid payment currency." });
  const payer = await User.findById(req.user.id).lean();
  const payerUpiId = cleanText(req.body.payerUpiId || payer?.upiId || "", 120).toLowerCase();
  if (canUseManualUpi(currency) && !validUpiId(payerUpiId)) return res.status(400).json({ message: "Add your UPI ID before starting INR payments, for example name@bank." });

  const contracts = [];
  const payments = [];
  const checkoutUrls = [];
  const fees = feeBreakdown(amount);

  for (const recipientEntry of recipientEntries) {
    const recipientBusinessName = recipientEntry.businessName;
    const recipientUser = await User.findOne({ businessName: recipientBusinessName }).lean();
    const payeeUpiId = (recipientEntry.upiId || recipientUser?.upiId || upiMerchantVpa || "").toLowerCase();
    const payeeName = upiMerchantVpa && !recipientEntry.upiId && !recipientUser?.upiId ? upiMerchantName : recipientBusinessName;
    if (canUseManualUpi(currency) && !validUpiId(payeeUpiId)) {
      return res.status(400).json({ message: `Add a UPI ID for ${recipientBusinessName}. Use "Business Name | upi@bank" in the recipients box.` });
    }
    const contract = await Contract.create({
      user: req.user.id,
      recipientBusinessName,
      promotionTitle,
      amount: fees.totalAmount,
      currency,
      documentText: [
        `Contract Offer: ${promotionTitle || recipientBusinessName}`,
        `Recipient: ${recipientBusinessName}`,
        `Amount: ${formatMinorForDocument(fees.totalAmount, currency)}`,
        "Payment must complete before work begins.",
        "Proof, delivery, and acceptance terms should be confirmed in messages."
      ].join("\n"),
      ...(promotionId ? { promotion: promotionId } : {})
    });

    const payment = await Payment.create({
      user: req.user.id,
      recipientBusinessName,
      contract: contract._id,
      amount,
      ...fees,
      invoiceNumber: invoiceNumber(),
      currency,
      provider: canUseManualUpi(currency) ? (canUseUpi(currency) ? "upi" : "manual_upi") : (stripe ? "stripe" : "manual"),
      payerUpiId
    });

    let checkoutUrl = "";
    if (canUseManualUpi(currency)) {
      payment.providerSessionId = `upi_${payment._id}_${randomToken().slice(0, 8)}`;
      payment.upiVpa = payeeUpiId;
      payment.upiPayeeName = payeeName;
      payment.upiReference = upiReference(payment);
      checkoutUrl = upiCheckoutUrl(payment.providerSessionId);
      await audit(req, payment.provider === "upi" ? "contract.upi_qr" : "contract.manual_upi", "contract", contract._id, `Manual UPI checkout started for ${recipientBusinessName}.`);
    } else if (!stripe) {
      if (payment.provider === "manual") {
        payment.providerSessionId = `manual_${payment._id}_${randomToken().slice(0, 8)}`;
        payment.upiPayeeName = recipientBusinessName;
        payment.upiReference = upiReference(payment);
        checkoutUrl = manualCheckoutUrl(payment.providerSessionId);
        await audit(req, "contract.manual_checkout", "contract", contract._id, `Manual checkout started for ${recipientBusinessName}.`);
      } else {
        payment.provider = "manual";
        payment.providerSessionId = `manual_${payment._id}_${randomToken().slice(0, 8)}`;
        payment.upiPayeeName = recipientBusinessName;
        payment.upiReference = upiReference(payment);
        checkoutUrl = manualCheckoutUrl(payment.providerSessionId);
        await audit(req, "contract.manual_checkout", "contract", contract._id, `Manual checkout started for ${recipientBusinessName}.`);
      }
    } else {
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        payment_method_types: ["card"],
        customer_email: req.user.email,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency,
              unit_amount: fees.totalAmount,
              product_data: {
                name: promotionTitle ? `Contract: ${promotionTitle}` : `Contract: ${recipientBusinessName}`,
                description: `Contract payment to ${recipientBusinessName}`
              }
            }
          }
        ],
        metadata: {
          contractId: contract._id.toString(),
          paymentId: payment._id.toString(),
          userId: req.user.id,
          recipientBusinessName
        },
        success_url: `${clientOrigin}/?payment=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${clientOrigin}/?payment=cancelled`
      });

      if (!session.url) return res.status(502).json({ message: "Stripe did not return a checkout URL." });
      payment.providerSessionId = session.id;
      checkoutUrl = session.url;
    }

    await payment.save();
    contracts.push(contract);
    payments.push(payment);
    checkoutUrls.push({ recipientBusinessName, checkoutUrl, paymentId: payment._id });
  }

  res.status(201).json({
    contract: contracts[0],
    payment: payments[0],
    checkoutUrl: checkoutUrls[0]?.checkoutUrl,
    contracts,
    payments,
    checkoutUrls,
    multiRecipient: recipients.length > 1,
    upiCheckout: canUseManualUpi(currency),
    localCheckout: !stripe && !canUseManualUpi(currency),
    manualCheckout: !stripe && !canUseManualUpi(currency)
  });
});

app.post("/api/payments/confirm", requireAuth, async (req, res) => {
  const sessionId = cleanText(req.body.sessionId, 200);
  if (!sessionId) return res.status(400).json({ message: "Checkout session is required." });

  if (sessionId.startsWith("local_")) {
    if (!enableLocalCheckout) return res.status(403).json({ message: "Local checkout confirmation is disabled." });
    const payment = await Payment.findOne({ providerSessionId: sessionId, user: req.user.id });
    if (!payment) return res.status(404).json({ message: "Payment record not found." });
    payment.status = "paid";
    await payment.save();

    const contract = await Contract.findOneAndUpdate(
      { _id: payment.contract, user: req.user.id },
      { paymentStatus: "paid", status: "offered" },
      { new: true }
    );
    if (!contract) return res.status(404).json({ message: "Contract not found." });

    if (payment.brief) {
      const brief = await AdBrief.findOne({ _id: payment.brief, user: req.user.id });
      if (brief && brief.status === "expert_selected") {
        setBriefStatus(brief, "paid");
        await brief.save();
        await audit(req, "brief.paid", "brief", brief._id, "Local escrow payment confirmed.");
      }
    }

    const existing = await Message.findOne({ user: req.user.id, contract: contract._id });
    const message = existing || await Message.create({
      user: req.user.id,
      recipientBusinessName: contract.recipientBusinessName,
      contract: contract._id,
      body: contract.promotionTitle
        ? `Payment completed. Contract offered for ${contract.promotionTitle}. Please review and share any questions here.`
        : "Payment completed. Contract offered. Please review and share any questions here."
    });
    await audit(req, "payment.local_confirm", "payment", payment._id, "Local checkout confirmed.");
    return res.json({ contract, payment, message });
  }

  if (!stripe) {
    const payment = await Payment.findOne({ providerSessionId: sessionId, user: req.user.id });
    if (!payment) return res.status(404).json({ message: "Payment record not found." });
    const contract = await Contract.findOne({ _id: payment.contract, user: req.user.id });
    if (!contract) return res.status(404).json({ message: "Contract not found." });
    return res.json({
      contract,
      payment,
      manualPending: ["upi", "manual_upi", "manual"].includes(payment.provider),
      message: null
    });
  }

  const session = await stripe.checkout.sessions.retrieve(sessionId);
  const payment = await Payment.findOne({ providerSessionId: session.id, user: req.user.id });
  if (!payment) return res.status(404).json({ message: "Payment record not found." });
  if (
    session.metadata?.paymentId !== payment._id.toString() ||
    session.metadata?.contractId !== payment.contract.toString() ||
    session.metadata?.userId !== req.user.id
  ) {
    return res.status(409).json({ message: "Payment metadata does not match the stored contract." });
  }

  if (session.payment_status !== "paid") {
    payment.status = session.status === "expired" ? "cancelled" : "pending";
    await payment.save();
    return res.status(402).json({ message: "Payment has not been completed." });
  }

  payment.status = "paid";
  await payment.save();

  const contract = await Contract.findOneAndUpdate(
    { _id: payment.contract, user: req.user.id },
    { paymentStatus: "paid", status: "offered" },
    { new: true }
  );
  if (session.metadata?.briefId) {
    const brief = await AdBrief.findOne({ _id: session.metadata.briefId, user: req.user.id });
    if (brief && brief.status === "expert_selected") {
      setBriefStatus(brief, "paid");
      await brief.save();
      await audit(req, "brief.paid", "brief", brief._id, "Escrow payment confirmed.");
    }
  }

  const existing = await Message.findOne({ user: req.user.id, contract: contract._id });
  const message = existing || await Message.create({
    user: req.user.id,
    recipientBusinessName: contract.recipientBusinessName,
    contract: contract._id,
    body: contract.promotionTitle
      ? `Payment completed. Contract offered for ${contract.promotionTitle}. Please review and share any questions here.`
      : "Payment completed. Contract offered. Please review and share any questions here."
  });

  res.json({ contract, payment, message });
});

app.get("/api/payments", requireAuth, async (req, res) => {
  const { page, limit, skip } = paged(req.query, { defaultLimit: 80, maxLimit: 100 });
  const filter = { user: req.user.id };
  const [payments, total] = await Promise.all([
    Payment.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Payment.countDocuments(filter)
  ]);
  res.json({ payments, pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 } });
});

app.get("/api/analytics/campaigns", requireAuth, async (req, res) => {
  const [briefs, payments] = await Promise.all([
    AdBrief.find({ user: req.user.id }).lean(),
    Payment.find({ user: req.user.id }).lean()
  ]);
  const spend = payments.filter(payment => ["paid", "pending"].includes(payment.status)).reduce((sum, payment) => sum + (payment.totalAmount || payment.amount || 0), 0);
  const reach = briefs.reduce((sum, brief) => sum + (brief.proofReach || 0), 0);
  const clicks = briefs.reduce((sum, brief) => sum + (brief.proofClicks || 0), 0);
  const ratings = briefs.filter(brief => brief.rating).map(brief => brief.rating);
  const auctionBriefs = briefs.filter(brief => brief.isAuction);
  const auctionQuotes = auctionBriefs.length ? await Quote.find({ brief: { $in: auctionBriefs.map(brief => brief._id) } }).lean() : [];
  res.json({
    totalBriefs: briefs.length,
    completed: briefs.filter(brief => ["completed", "closed"].includes(brief.status)).length,
    disputed: briefs.filter(brief => brief.status === "disputed").length,
    spend,
    reach,
    clicks,
    cpm: reach ? spend / (reach / 1000) : 0,
    cpc: clicks ? spend / clicks : 0,
    averageRating: ratings.length ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length : 0,
    auctions: auctionBriefs.length,
    liveAuctions: auctionBriefs.filter(brief => brief.auctionStatus === "live").length,
    auctionBids: auctionQuotes.length,
    averageBidsPerAuction: auctionBriefs.length ? auctionQuotes.length / auctionBriefs.length : 0
  });
});

app.get("/api/contracts/:id/document", requireAuth, async (req, res) => {
  const contract = await Contract.findOne({ _id: req.params.id, user: req.user.id }).lean();
  if (!contract) return res.status(404).json({ message: "Contract not found." });
  res.json({ documentText: contract.documentText || `Contract: ${contract.promotionTitle || contract.recipientBusinessName}\nAmount: ${formatMinorForDocument(contract.amount, contract.currency)}\nStatus: ${contract.status}` });
});

async function requireAdmin(req, res, next) {
  const user = await User.findById(req.user.id).lean();
  if (!user || user.role !== "admin") return res.status(403).json({ message: "Admin access required." });
  req.adminUser = user;
  return next();
}

app.get("/api/admin/summary", requireAuth, requireAdmin, async (_req, res) => {
  const [users, briefs, disputedBriefs, proofPending, payments, contracts] = await Promise.all([
    User.countDocuments(),
    AdBrief.countDocuments(),
    AdBrief.countDocuments({ status: "disputed" }),
    AdBrief.countDocuments({ status: "proof_submitted" }),
    Payment.countDocuments(),
    Contract.countDocuments()
  ]);
  res.json({ users, briefs, disputedBriefs, proofPending, payments, contracts, readinessWarnings: envWarnings() });
});

app.get("/api/admin/system-status", requireAuth, requireAdmin, async (_req, res) => {
  res.json({ status: systemStatus() });
});

app.get("/api/admin/review-queue", requireAuth, requireAdmin, async (_req, res) => {
  const [briefs, payments] = await Promise.all([
    AdBrief.find({ status: { $in: ["disputed", "proof_submitted"] } }).sort({ updatedAt: -1 }).limit(50).lean(),
    Payment.find({ status: { $in: ["pending", "failed", "cancelled"] } }).sort({ updatedAt: -1 }).limit(50).lean()
  ]);
  res.json({ briefs, payments });
});

app.patch("/api/admin/payments/:id/release", requireAuth, requireAdmin, async (req, res) => {
  const payment = await Payment.findById(req.params.id);
  if (!payment) return res.status(404).json({ message: "Payment not found." });
  if (payment.status !== "paid") return res.status(400).json({ message: "Only paid escrow can be released." });
  payment.releaseStatus = "released";
  payment.releaseNote = cleanText(req.body.note, 700);
  payment.releasedAt = new Date();
  await payment.save();
  await audit(req, "payment.release", "payment", payment._id, payment.releaseNote || "Escrow released.");
  res.json({ payment });
});

app.patch("/api/admin/payments/:id/verify", requireAuth, requireAdmin, async (req, res) => {
  const payment = await Payment.findById(req.params.id);
  if (!payment) return res.status(404).json({ message: "Payment not found." });
  if (!["upi", "manual_upi", "manual"].includes(payment.provider)) return res.status(400).json({ message: "Only manual payments require verification." });
  if (!payment.upiUtr) return res.status(400).json({ message: "Buyer must submit the transaction reference before verification." });
  if (payment.status !== "pending") return res.status(400).json({ message: "Only pending manual payments can be verified." });

  payment.status = "paid";
  payment.upiVerifiedAt = new Date();
  await payment.save();

  const contract = await Contract.findOneAndUpdate(
    { _id: payment.contract, user: payment.user },
    { paymentStatus: "paid", status: "offered" },
    { new: true }
  );
  if (payment.brief) {
    const brief = await AdBrief.findOne({ _id: payment.brief, user: payment.user });
    if (brief && brief.status === "expert_selected") {
      setBriefStatus(brief, "paid");
      await brief.save();
      await Notification.create({
        user: payment.user,
        title: "Payment verified",
        body: "Your escrow payment is verified and ready for execution.",
        type: "payment",
        linkType: "brief",
        linkId: brief._id.toString()
      });
    }
  }

  if (contract) {
    const existing = await Message.findOne({ user: payment.user, contract: contract._id });
    if (!existing) {
      await Message.create({
        user: payment.user,
        recipientBusinessName: contract.recipientBusinessName,
        contract: contract._id,
        body: contract.promotionTitle
          ? `Payment verified. Contract offered for ${contract.promotionTitle}. Please review and share any questions here.`
          : "Payment verified. Contract offered. Please review and share any questions here."
      });
    }
  }

  await audit(req, "payment.manual_verify", "payment", payment._id, `Manual payment verified with reference ${payment.upiUtr}.`);
  res.json({ payment, contract });
});

app.patch("/api/admin/payments/:id/refund", requireAuth, requireAdmin, async (req, res) => {
  const payment = await Payment.findById(req.params.id);
  if (!payment) return res.status(404).json({ message: "Payment not found." });
  if (!["paid", "pending"].includes(payment.status)) return res.status(400).json({ message: "Payment cannot be refunded from its current state." });
  payment.status = "refunded";
  payment.releaseStatus = "refunded";
  payment.releaseNote = cleanText(req.body.note, 700);
  payment.refundedAt = new Date();
  await payment.save();
  await Contract.findByIdAndUpdate(payment.contract, { paymentStatus: "cancelled", status: "closed" });
  await audit(req, "payment.refund", "payment", payment._id, payment.releaseNote || "Payment refunded.");
  res.json({ payment });
});

app.patch("/api/admin/disputes/:briefId/resolve", requireAuth, requireAdmin, async (req, res) => {
  const brief = await AdBrief.findById(req.params.briefId);
  if (!brief || brief.status !== "disputed") return res.status(404).json({ message: "Dispute not found." });
  const resolution = cleanText(req.body.resolution, 30);
  if (!["reopen", "close"].includes(resolution)) return res.status(400).json({ message: "Choose reopen or close." });
  setBriefStatus(brief, resolution === "reopen" ? "in_progress" : "closed");
  brief.proofRevisionNote = cleanText(req.body.note, 700);
  await brief.save();
  await audit(req, `dispute.${resolution}`, "brief", brief._id, brief.proofRevisionNote || `Dispute ${resolution}.`);
  res.json({ brief });
});

app.get("/api/admin/audit-logs", requireAuth, requireAdmin, async (req, res) => {
  const { limit, skip, page } = paged(req.query, { defaultLimit: 80, maxLimit: 200 });
  const [logs, total] = await Promise.all([
    AuditLog.find({}).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    AuditLog.countDocuments()
  ]);
  res.json({ logs, pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 } });
});

app.post("/api/jobs/run", requireAuth, requireAdmin, async (req, res) => {
  const staleDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const auctionEndingSoon = new Date(Date.now() + 2 * 60 * 60 * 1000);
  const expiringAuctions = await AdBrief.find({ isAuction: true, auctionStatus: "live", auctionEndsAt: { $gt: new Date(), $lte: auctionEndingSoon } }).limit(50).lean();
  for (const auction of expiringAuctions) {
    await Notification.create({
      user: auction.user,
      title: "Auction ending soon",
      body: `${auction.brandName} is ending soon. Review bids and award the best expert.`,
      type: "auction",
      linkType: "brief",
      linkId: auction._id.toString(),
      actionLabel: "Review bids",
      actionView: "marketplace"
    });
  }
  const staleBriefs = await AdBrief.find({ status: { $in: ["open", "quotes_received", "in_progress"] }, updatedAt: { $lt: staleDate } }).limit(50).lean();
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
  const archiveDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const abandonedPaymentDate = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const [readNotifications, staleDrafts, abandonedPayments] = await Promise.all([
    Notification.deleteMany({ read: true, updatedAt: { $lt: archiveDate } }),
    Draft.deleteMany({ updatedAt: { $lt: archiveDate } }),
    Payment.updateMany({ status: "pending", createdAt: { $lt: abandonedPaymentDate } }, { status: "cancelled" })
  ]);
  await audit(req, "jobs.run", "job", "maintenance", `${staleBriefs.length} reminders queued. ${expiringAuctions.length} auction reminders queued. ${readNotifications.deletedCount} notifications removed.`);
  res.json({
    remindersQueued: staleBriefs.length,
    auctionRemindersQueued: expiringAuctions.length,
    notificationsRemoved: readNotifications.deletedCount || 0,
    draftsRemoved: staleDrafts.deletedCount || 0,
    paymentsCancelled: abandonedPayments.modifiedCount || 0
  });
});

app.get("/api/messages", requireAuth, async (req, res) => {
  const { page, limit, skip } = paged(req.query, { defaultLimit: 100, maxLimit: 300 });
  const filter = { user: req.user.id };
  const messages = await Message.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean();
  const threads = Array.from(messages.reduce((map, message) => {
    const key = message.recipientBusinessName;
    const current = map.get(key) || { recipientBusinessName: key, count: 0, lastMessage: null, updatedAt: null };
    current.count += 1;
    if (!current.lastMessage || message.createdAt > current.updatedAt) {
      current.lastMessage = message.body || message.attachment?.name || "Attachment";
      current.updatedAt = message.createdAt;
      current.direction = message.direction;
    }
    map.set(key, current);
    return map;
  }, new Map()).values());

  res.json({ threads });
});

app.get("/api/conversations", requireAuth, async (req, res) => {
  const conversations = await Conversation.find({ participants: req.user.id }).sort({ updatedAt: -1 }).limit(100);
  res.json({ conversations: conversations.map(conversation => conversationForUser(conversation, req.user.id)) });
});

app.get("/api/conversations/:id", requireAuth, async (req, res) => {
  const conversation = await Conversation.findOne({ _id: req.params.id, participants: req.user.id });
  if (!conversation) return res.status(404).json({ message: "Conversation not found." });
  markConversationRead(conversation, req.user.id);
  await conversation.save();
  const messages = await ConversationMessage.find({ conversation: conversation._id }).sort({ createdAt: 1 }).limit(200).lean();
  res.json({ conversation: conversationForUser(conversation, req.user.id), messages });
});

app.post("/api/conversations", requireAuth, async (req, res) => {
  const participantId = cleanText(req.body.participantId, 80);
  const body = cleanText(req.body.body, 1000);
  let attachment = null;
  try {
    attachment = saveDataAttachment(req.body.attachment, "conversation");
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
  const other = await User.findById(participantId);
  const current = await User.findById(req.user.id);
  if (!other || !current) return res.status(404).json({ message: "Participant not found." });
  if (!body && !attachment) return res.status(400).json({ message: "Message cannot be empty." });
  const lastMessage = body || attachment.name || "Attachment";
  const participants = [current._id, other._id].sort((a, b) => a.toString().localeCompare(b.toString()));
  const lookup = { participants: { $all: participants, $size: 2 } };
  if (req.body.brief) lookup.brief = req.body.brief;
  else lookup.brief = { $exists: false };
  const conversation = await Conversation.findOneAndUpdate(
    lookup,
    {
      participants,
      participantNames: [current.businessName, other.businessName],
      ...(req.body.brief ? { brief: req.body.brief } : {}),
      ...(req.body.quote ? { quote: req.body.quote } : {}),
      ...(req.body.contract ? { contract: req.body.contract } : {}),
      lastMessage,
      lastMessageAt: new Date()
    },
    { upsert: true, new: true }
  );
  incrementConversationUnread(conversation, current._id);
  await conversation.save();
  const message = await ConversationMessage.create({ conversation: conversation._id, sender: current._id, senderName: current.businessName, body, ...(attachment ? { attachment } : {}) });
  res.status(201).json({ conversation: conversationForUser(conversation, req.user.id), message });
});

app.post("/api/conversations/:id/messages", requireAuth, async (req, res) => {
  const body = cleanText(req.body.body, 1000);
  let attachment = null;
  try {
    attachment = saveDataAttachment(req.body.attachment, "conversation");
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
  if (!body && !attachment) return res.status(400).json({ message: "Message cannot be empty." });
  const conversation = await Conversation.findOne({ _id: req.params.id, participants: req.user.id });
  const current = await User.findById(req.user.id);
  if (!conversation || !current) return res.status(404).json({ message: "Conversation not found." });
  conversation.lastMessage = body || attachment.name || "Attachment";
  conversation.lastMessageAt = new Date();
  incrementConversationUnread(conversation, current._id);
  await conversation.save();
  const message = await ConversationMessage.create({
    conversation: conversation._id,
    sender: current._id,
    senderName: current.businessName,
    body,
    ...(attachment ? { attachment } : {})
  });
  res.status(201).json({ conversation: conversationForUser(conversation, req.user.id), message });
});

app.get("/api/messages/:recipientBusinessName", requireAuth, async (req, res) => {
  const { page, limit, skip } = paged(req.query, { defaultLimit: 100, maxLimit: 100 });
  const recipientBusinessName = cleanText(req.params.recipientBusinessName, 120);
  if (!recipientBusinessName) return res.status(400).json({ message: "Recipient business is required." });

  const filter = { user: req.user.id, recipientBusinessName };
  const [messages, total] = await Promise.all([
    Message.find(filter).sort({ createdAt: 1 }).skip(skip).limit(limit).lean(),
    Message.countDocuments(filter)
  ]);
  res.json({ messages, pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 } });
});

app.post("/api/messages", requireAuth, async (req, res) => {
  const recipientBusinessName = cleanText(req.body.recipientBusinessName, 120);
  const body = cleanText(req.body.body, 1000);
  let attachment = null;
  try {
    attachment = saveDataAttachment(req.body.attachment, "message");
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
  const contract = cleanText(req.body.contract, 80);
  const brief = cleanText(req.body.brief, 80);
  const quote = cleanText(req.body.quote, 80);

  if (!recipientBusinessName) return res.status(400).json({ message: "Recipient business is required." });
  if (body.length < 1 && !attachment) return res.status(400).json({ message: "Message cannot be empty." });

  const message = await Message.create({
    user: req.user.id,
    recipientBusinessName,
    body,
    ...(attachment ? { attachment } : {}),
    ...(contract ? { contract } : {}),
    ...(brief ? { brief } : {}),
    ...(quote ? { quote } : {})
  });

  res.status(201).json({ message });
});

if (isProduction) {
  app.use(express.static(distDir));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api/")) return next();
    res.sendFile(path.join(distDir, "index.html"));
  });
}

mongoose
  .connect(mongoUri)
  .then(() => {
    app.listen(port, () => {
      console.log(`Parasara running on port ${port}`);
    });
  })
  .catch(error => {
    console.error("MongoDB connection failed:", error.message);
    process.exit(1);
  });
