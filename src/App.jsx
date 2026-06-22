import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { signInWithPopup } from "firebase/auth";
import { auth, googleProvider, isFirebaseAvailable } from "./firebase";

const LOGO_SRC = "/assets/parasara-logo.jpg";
const LOGO_MARK_SRC = "/assets/parasara-mark.jpg";
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/+$/, "");
const LOCAL_AUTH_ENABLED = import.meta.env.VITE_LOCAL_AUTH !== "false";
const LOCAL_AUTH_KEY = "parasara_local_accounts";
const FIREBASE_UI_VERSION = "6.0.1";
const FIREBASE_SDK_VERSION = "10.12.5";
const FIREBASE_AUTH_PROVIDERS = (import.meta.env.VITE_FIREBASE_SIGN_IN_PROVIDERS || "google,email")
  .split(",")
  .map(provider => provider.trim().toLowerCase())
  .filter(Boolean);
const FIREBASE_CONFIG = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || ""
};
const FIREBASE_AUTH_ENABLED = Boolean(FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.authDomain && FIREBASE_CONFIG.projectId && FIREBASE_CONFIG.appId);
const SESSION_KEYS = {
  token: "parasara_token",
  refresh: "parasara_refresh",
  user: "parasara_user"
};
const LEGACY_SESSION_KEYS = {
  token: "connectpro_token",
  refresh: "connectpro_refresh",
  user: "connectpro_user"
};

const promotionTypes = [
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
];

const audienceOptions = [
  "500 - 2k Local Visitors",
  "2k - 10k Weekly Audience",
  "10k - 50k Monthly Active",
  "50k - 100k Monthly Active",
  "100k+ Regional Reach",
  "500k+ Enterprise Reach"
];

const partnerOptions = [
  "SaaS Founders",
  "Fintech Executives",
  "Retail Brands",
  "Agency Owners",
  "Hospitality Operators",
  "Health & Wellness Businesses",
  "Logistics & Supply Chain Teams",
  "TV Channel Ad Experts",
  "Social Media Influencers",
  "YouTube Creators",
  "Social Media Ad Buyers",
  "Media Planning Agencies"
];

const socialPlatformOptions = ["Instagram", "Facebook", "YouTube", "OTT Platform", "TV Channel", "LinkedIn", "X / Twitter", "TikTok", "Snapchat", "Pinterest", "WhatsApp", "Telegram", "Other"];
const platformFormatOptions = {
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
const socialFields = [
  ["instagram", "Instagram"],
  ["youtube", "YouTube"],
  ["linkedin", "LinkedIn"],
  ["facebook", "Facebook"],
  ["twitter", "X / Twitter"],
  ["tiktok", "TikTok"],
  ["snapchat", "Snapchat"],
  ["pinterest", "Pinterest"],
  ["whatsapp", "WhatsApp"],
  ["telegram", "Telegram"]
];

const expertiseOptions = [
  "Digital & Online Ads Expert",
  "Search Engine Marketing Expert",
  "Social Media Ads Expert",
  "Display & Banner Ads Expert",
  "Video Ads Expert",
  "Broadcast Ads Expert",
  "Television Commercials Expert",
  "Radio Ads Expert",
  "Podcast Ads Expert",
  "Print Ads Expert",
  "Outdoor & OOH Ads Expert",
  "Influencer Marketing Expert",
  "Sponsorships Expert",
  "In-Store & Direct Ads Expert",
  "Media Buying Agency"
];

const statusOptions = ["Online", "Offline", "Scheduled"];
const currencyOptions = [
  ["usd", "USD"],
  ["inr", "INR"],
  ["eur", "EUR"],
  ["gbp", "GBP"]
];
const regionOptions = [
  ["in", "India"],
  ["us", "United States"],
  ["gb", "United Kingdom"],
  ["eu", "Europe"],
  ["ae", "United Arab Emirates"],
  ["sg", "Singapore"],
  ["global", "Global"]
];
const dateFormatOptions = [
  ["en-IN", "India format"],
  ["en-US", "US format"],
  ["en-GB", "UK format"]
];
const sortOptions = [
  ["newest", "Newest first"],
  ["name", "Business name"],
  ["type", "Promotion type"],
  ["audience", "Largest audience"],
  ["price", "Lowest price"]
];
const contractStatusOptions = [
  ["awaiting_payment", "Awaiting Payment"],
  ["offered", "Offered"],
  ["accepted", "Accepted"],
  ["declined", "Declined"],
  ["closed", "Closed"]
];
const languageOptions = ["English", "Hindi", "Hinglish", "Punjabi", "Marathi", "Gujarati", "Tamil", "Telugu", "Kannada", "Malayalam", "Bengali"];
const accountModeOptions = [
  ["buyer", "I want to advertise"],
  ["expert", "I provide advertising services"],
  ["both", "Both buyer and expert"]
];
const budgetFilterOptions = [
  ["all", "Any budget"],
  ["under100", "Under $100"],
  ["100to500", "$100 - $500"],
  ["500plus", "$500+"]
];
const deliveryFilterOptions = [
  ["all", "Any delivery"],
  ["fast", "Fast delivery"],
  ["scheduled", "Scheduled work"],
  ["verified", "Verified/online"]
];

const emptyDraft = {
  title: "",
  description: "",
  type: "Newsletter Ad",
  audience: "",
  partner: "",
  image: ""
};

const emptyStoryBrief = {
  platform: "Instagram",
  format: "Story",
  socialHandle: "",
  brandName: "",
  goal: "",
  targetAudience: "",
  ageMin: "",
  ageMax: "",
  city: "",
  language: "English",
  budget: "",
  budgetMin: "",
  budgetMax: "",
  currency: "inr",
  preferredDate: "",
  creativeLink: "",
  notes: "",
  isAuction: false,
  urgency: "standard",
  auctionEndsAt: ""
};

const briefTemplates = [
  {
    name: "Instagram Reel",
    patch: { platform: "Instagram", format: "Reel", goal: "Drive profile visits and product interest with a short creator-led reel.", targetAudience: "Instagram users interested in lifestyle, local shopping, and offers.", notes: "Include brand tag, CTA in caption, and proof screenshot after posting." }
  },
  {
    name: "YouTube Short",
    patch: { platform: "YouTube", format: "Short", goal: "Create awareness with a short video mention and tracked link.", targetAudience: "YouTube viewers interested in the product category.", notes: "Mention brand clearly in first 5 seconds and share views/click proof." }
  },
  {
    name: "OTT Ad",
    patch: { platform: "OTT Platform", format: "Pre-roll Ad", goal: "Run a video ad placement on an OTT platform for awareness and reach.", targetAudience: "OTT viewers matching the campaign category, city, and language.", notes: "Confirm slot, duration, estimated impressions, and proof report after delivery." }
  },
  {
    name: "TV Channel",
    patch: { platform: "TV Channel", format: "TV Spot", goal: "Book a TV channel placement for broad regional campaign awareness.", targetAudience: "TV viewers in the selected region and language segment.", notes: "Share channel name, time band, ad duration, schedule, and telecast proof." }
  },
  {
    name: "LinkedIn Post",
    patch: { platform: "LinkedIn", format: "Post", goal: "Reach decision makers with a professional post and clear business CTA.", targetAudience: "Founders, managers, and professionals in the target industry.", notes: "Use professional copy, tag company page, and report impressions/reactions." }
  },
  {
    name: "WhatsApp Channel",
    patch: { platform: "WhatsApp", format: "Channel Broadcast", goal: "Promote an offer through a channel broadcast with response tracking.", targetAudience: "Warm local or category-specific WhatsApp subscribers.", notes: "Include offer link, publish time, delivered/open proof where available." }
  },
  {
    name: "TikTok Campaign",
    patch: { platform: "TikTok", format: "Video", goal: "Generate discovery and engagement with a creator-style short video.", targetAudience: "TikTok users matching the campaign niche and city.", notes: "Use native-feeling creative, brand mention, hashtag, and analytics proof." }
  }
];

function compactList(items = []) {
  return items.filter(Boolean).join(" ");
}

function campaignArchetype(brief = {}) {
  const text = `${brief.platform || ""} ${brief.format || ""} ${brief.goal || ""} ${brief.targetAudience || ""} ${brief.notes || ""}`.toLowerCase();
  if (/sale|order|shop|commerce|product|coupon|offer|discount|lead|booking/.test(text)) return "conversion";
  if (/event|webinar|launch|opening|registration|ticket/.test(text)) return "event";
  if (/app|saas|software|b2b|founder|professional|linkedin/.test(text)) return "business";
  if (/food|cafe|restaurant|hotel|travel|local/.test(text)) return "local";
  return "awareness";
}

function aiCampaignIntelligence(brief = {}) {
  const platform = brief.platform || "Instagram";
  const format = brief.format || platformFormatOptions[platform]?.[0] || "Post";
  const brand = brief.brandName?.trim() || "the brand";
  const city = brief.city?.trim() || "the target region";
  const audience = brief.targetAudience?.trim() || `${city} buyers interested in ${brand}`;
  const language = brief.language || "English";
  const archetype = campaignArchetype(brief);
  const cta = archetype === "conversion" ? "Shop now" : archetype === "event" ? "Register today" : archetype === "business" ? "Book a demo" : archetype === "local" ? "Visit today" : "Learn more";
  const hook = archetype === "conversion"
    ? `Show the offer in the first 3 seconds and end with ${cta}.`
    : archetype === "event"
      ? `Lead with date, place, and the one reason ${audience} should attend.`
      : archetype === "business"
        ? `Open with the business pain point, then show the outcome ${brand} creates.`
        : archetype === "local"
          ? `Make the creative feel local to ${city}, with a clear place-based CTA.`
          : `Start with the strongest proof point and make ${brand} easy to remember.`;
  const goal = brief.goal?.trim() || `${format} campaign on ${platform} to reach ${audience} and drive ${cta.toLowerCase()} action.`;
  const targetAudience = brief.targetAudience?.trim() || audience;
  const notes = [
    brief.notes?.trim(),
    `AI plan: ${hook}`,
    `Creative direction: mention ${brand} naturally, show product/use case, include ${language} caption text, and use one clear CTA: ${cta}.`,
    `Delivery proof: screenshot, publish link, timestamp, reach/views, clicks/replies, and caption proof.`
  ].filter(Boolean).join("\n\n");
  const captions = [
    `${brand} is ready for ${audience}. ${cta}.`,
    `Looking for a better option in ${city}? Try ${brand} and see the difference.`,
    `${platform} ${format} idea: quick hook, one benefit, one proof point, then ${cta}.`
  ];
  const riskFlags = [
    !brief.socialHandle && "Add the exact handle or URL so experts do not promote the wrong profile.",
    !brief.budget && !brief.budgetMin && "Add a budget range so quotes are comparable.",
    !brief.preferredDate && "Add a preferred date to avoid missed publishing windows.",
    !brief.creativeLink && "Attach a creative link if the expert must use approved assets.",
    !brief.city && "Add a city or region if the campaign is not global."
  ].filter(Boolean);
  const proofChecklist = [
    "Public post/story/video link",
    "Screenshot with date and handle visible",
    "Reach, views, clicks, replies, or saves",
    "Caption/CTA proof",
    "Final delivery note from expert"
  ];
  const readiness = Math.round(([
    brief.platform,
    brief.format,
    brief.socialHandle,
    brief.brandName,
    brief.budget || brief.budgetMin,
    brief.targetAudience,
    brief.goal,
    brief.language
  ].filter(Boolean).length / 8) * 100);
  return { brand, platform, format, goal, targetAudience, notes, captions, riskFlags, proofChecklist, readiness, cta, hook };
}

function aiQuotePlan(target = {}, quote = {}) {
  const intelligence = aiCampaignIntelligence(target);
  const amount = quote.amount || target.budget || "the agreed campaign budget";
  const timeline = quote.timeline || (target.isAuction ? "within the auction deadline" : "within 24-48 hours after asset approval");
  return compactList([
    `I can deliver this ${intelligence.platform} ${intelligence.format} for ${target.brandName || "your brand"} at ${amount}.`,
    `Plan: ${intelligence.hook}`,
    `Timeline: ${timeline}.`,
    `I will confirm the handle, creative asset, caption/CTA, publish window, and submit proof with link, screenshot, reach/views, and engagement metrics.`
  ]);
}

function getBriefHandle(brief = {}) {
  return brief.socialHandle || brief.instagramHandle || "";
}

function getBriefLabel(brief = {}) {
  return `${brief.platform || "Social Media"} - ${getBriefHandle(brief) || "Profile pending"}`;
}

function renderSocialStrip(entity = {}) {
  const links = socialFields.filter(([key]) => entity[key]);
  return <div className="social-strip">{links.map(([key, label]) => <span key={key}>{label}: {entity[key]}</span>)}</div>;
}

function messagePreview(item = {}) {
  return item.body || item.attachment?.name || "Attachment";
}

function attachmentKind(type = "") {
  if (type.startsWith("image/")) return "Image";
  if (type.startsWith("video/")) return "Video";
  if (type.startsWith("audio/")) return "Audio";
  if (type.includes("pdf")) return "PDF";
  return "File";
}

function formatFileSize(size = 0) {
  if (!size) return "";
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function readAttachmentFile(file) {
  return new Promise((resolve, reject) => {
    if (!file) return resolve(null);
    if (file.size > 20 * 1024 * 1024) return reject(new Error("File must be 20MB or smaller."));
    const reader = new FileReader();
    reader.onload = () => resolve({
      name: file.name,
      type: file.type || "application/octet-stream",
      size: file.size,
      dataUrl: reader.result
    });
    reader.onerror = () => reject(new Error("Could not read that file."));
    reader.readAsDataURL(file);
  });
}

const emptyQuote = {
  expertName: "",
  amount: "",
  timeline: "",
  message: ""
};

function timeLeftLabel(value) {
  if (!value) return "Ends soon";
  const diff = new Date(value).getTime() - Date.now();
  if (diff <= 0) return "Ended";
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  if (hours >= 24) return `${Math.ceil(hours / 24)}d left`;
  if (hours) return `${hours}h ${minutes}m left`;
  return `${Math.max(1, minutes)}m left`;
}

const emptyProof = {
  proofLink: "",
  proofNotes: "",
  proofReach: "",
  proofClicks: "",
  proofScreenshot: "",
  proofMetrics: {}
};

const emptyService = { platform: "Instagram", service: "", startingPrice: "", deliveryDays: "", portfolioLink: "" };
const emptyCaseStudy = { title: "", platform: "Instagram", summary: "", resultMetric: "", proofLink: "" };
const proofMetricFields = {
  Instagram: [["impressions", "Impressions"], ["replies", "Replies"], ["profileTaps", "Profile taps"]],
  YouTube: [["views", "Views"], ["retention", "Retention %"], ["clicks", "Clicks"]],
  LinkedIn: [["impressions", "Impressions"], ["reactions", "Reactions"], ["comments", "Comments"]],
  WhatsApp: [["delivered", "Delivered"], ["opens", "Opens"], ["clicks", "Clicks"]],
  Telegram: [["views", "Views"], ["forwards", "Forwards"], ["clicks", "Clicks"]],
  Other: [["reach", "Reach"], ["engagements", "Engagements"], ["clicks", "Clicks"]]
};

function readSessionJson(key) {
  try {
    const value = sessionStorage.getItem(key);
    return value ? JSON.parse(value) : null;
  } catch {
    sessionStorage.removeItem(key);
    return null;
  }
}

function readSessionValue(key, legacyKey = "") {
  const value = sessionStorage.getItem(key);
  if (value || !legacyKey) return value || "";
  const legacyValue = sessionStorage.getItem(legacyKey) || "";
  if (legacyValue) sessionStorage.setItem(key, legacyValue);
  return legacyValue;
}

function readSessionUser() {
  return readSessionJson(SESSION_KEYS.user) || readSessionJson(LEGACY_SESSION_KEYS.user);
}

function saveSession(data) {
  if (data.token) sessionStorage.setItem(SESSION_KEYS.token, data.token);
  if (data.refreshToken) sessionStorage.setItem(SESSION_KEYS.refresh, data.refreshToken);
  if (data.user) sessionStorage.setItem(SESSION_KEYS.user, JSON.stringify(data.user));
}

function clearSession() {
  Object.values(SESSION_KEYS).forEach(key => sessionStorage.removeItem(key));
  Object.values(LEGACY_SESSION_KEYS).forEach(key => sessionStorage.removeItem(key));
}

function apiUrl(path) {
  return `${API_BASE_URL}${path}`;
}

function readLocalAccounts() {
  try {
    const accounts = JSON.parse(localStorage.getItem(LOCAL_AUTH_KEY) || "[]");
    return Array.isArray(accounts) ? accounts : [];
  } catch {
    localStorage.removeItem(LOCAL_AUTH_KEY);
    return [];
  }
}

function saveLocalAccounts(accounts) {
  localStorage.setItem(LOCAL_AUTH_KEY, JSON.stringify(accounts));
}

function publicLocalUser(account = {}) {
  return {
    id: account.id,
    businessName: account.businessName,
    email: account.email,
    accountMode: account.accountMode || "buyer",
    profileStrength: account.profileStrength || 30,
    industry: account.industry,
    description: account.description || "",
    website: account.website || "",
    location: account.location || "",
    phone: account.phone || "",
    upiId: account.upiId || "",
    expertise: account.expertise || "",
    instagram: account.instagram || "",
    youtube: account.youtube || "",
    linkedin: account.linkedin || "",
    facebook: account.facebook || "",
    twitter: account.twitter || "",
    tiktok: account.tiktok || "",
    snapchat: account.snapchat || "",
    pinterest: account.pinterest || "",
    whatsapp: account.whatsapp || "",
    telegram: account.telegram || "",
    availability: account.availability || "available",
    minBudget: account.minBudget || 0,
    turnaroundDays: account.turnaroundDays || 0,
    followerCount: account.followerCount || 0,
    serviceLanguages: account.serviceLanguages || [],
    serviceCatalog: account.serviceCatalog || [],
    caseStudies: account.caseStudies || [],
    averageRating: account.averageRating || 0,
    reviewCount: account.reviewCount || 0,
    emailVerified: true,
    role: account.role || "member",
    localOnly: true
  };
}

function localSessionForUser(user) {
  return {
    token: `local-${user.id}-${Date.now()}`,
    refreshToken: "",
    user
  };
}

function publicFirebaseUser(firebaseUser = {}) {
  const email = firebaseUser.email || "";
  const name = firebaseUser.displayName || email.split("@")[0] || "Firebase User";
  return {
    id: firebaseUser.uid,
    businessName: name,
    email,
    accountMode: "buyer",
    profileStrength: email ? 45 : 30,
    industry: "Media & Advertising",
    description: "",
    website: "",
    location: "",
    phone: firebaseUser.phoneNumber || "",
    upiId: "",
    expertise: "",
    instagram: "",
    youtube: "",
    linkedin: "",
    facebook: "",
    twitter: "",
    tiktok: "",
    snapchat: "",
    pinterest: "",
    whatsapp: "",
    telegram: "",
    availability: "available",
    minBudget: 0,
    turnaroundDays: 0,
    followerCount: 0,
    serviceLanguages: [],
    serviceCatalog: [],
    caseStudies: [],
    averageRating: 0,
    reviewCount: 0,
    emailVerified: Boolean(firebaseUser.emailVerified),
    role: "member",
    localOnly: true,
    firebaseOnly: true
  };
}

function firebaseSessionForUser(firebaseUser) {
  return {
    token: `firebase-${firebaseUser.uid}-${Date.now()}`,
    refreshToken: "",
    user: publicFirebaseUser(firebaseUser)
  };
}

function loadScriptOnce(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing?.dataset.loaded === "true") return resolve();
    if (existing) {
      existing.addEventListener("load", resolve, { once: true });
      existing.addEventListener("error", reject, { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => {
      script.dataset.loaded = "true";
      resolve();
    };
    script.onerror = () => reject(new Error(`Could not load ${src}`));
    document.head.appendChild(script);
  });
}

function loadStylesheetOnce(href) {
  if (document.querySelector(`link[href="${href}"]`)) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.type = "text/css";
  link.href = href;
  document.head.appendChild(link);
}

async function loadFirebaseUi() {
  loadStylesheetOnce(`https://www.gstatic.com/firebasejs/ui/${FIREBASE_UI_VERSION}/firebase-ui-auth.css`);
  await loadScriptOnce(`https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-app-compat.js`);
  await loadScriptOnce(`https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-auth-compat.js`);
  await loadScriptOnce(`https://www.gstatic.com/firebasejs/ui/${FIREBASE_UI_VERSION}/firebase-ui-auth.js`);
  return { firebase: window.firebase, firebaseui: window.firebaseui };
}

function firebaseSignInOptions(firebase) {
  const providerMap = {
    google: firebase.auth.GoogleAuthProvider.PROVIDER_ID,
    facebook: firebase.auth.FacebookAuthProvider.PROVIDER_ID,
    twitter: firebase.auth.TwitterAuthProvider.PROVIDER_ID,
    github: firebase.auth.GithubAuthProvider.PROVIDER_ID,
    email: firebase.auth.EmailAuthProvider.PROVIDER_ID,
    phone: firebase.auth.PhoneAuthProvider.PROVIDER_ID
  };
  return FIREBASE_AUTH_PROVIDERS.map(provider => providerMap[provider]).filter(Boolean);
}

async function signOutFirebaseAuth() {
  if (!window.firebase?.apps?.length) return;
  await window.firebase.auth().signOut();
}

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <main className="login-shell">
        <section className="login-panel glass">
          <Brand large />
          <div className="login-copy">
            <h1>Something went wrong</h1>
            <p>Refresh the page to reload Parasara. Your saved data remains in the backend.</p>
          </div>
          <button className="btn primary" onClick={() => window.location.reload()} type="button">Reload App</button>
        </section>
      </main>
    );
  }
}

function FirebaseAuthPanel({ onSession, setToast }) {
  const [status, setStatus] = useState(FIREBASE_AUTH_ENABLED ? "loading" : "disabled");
  const uiRef = useRef(null);

  const signInWithGoogle = useCallback(async () => {
    if (!FIREBASE_AUTH_ENABLED || !isFirebaseAvailable || !FIREBASE_AUTH_PROVIDERS.includes("google")) {
      setToast("Google sign-in is not configured or Firebase is not available.");
      return;
    }

    if (!auth || !googleProvider) {
      setToast("Firebase authentication is unavailable.");
      return;
    }

    try {
      const result = await signInWithPopup(auth, googleProvider);
      const session = firebaseSessionForUser(result.user);
      onSession(session);
    } catch (error) {
      setToast(error.message || "Google sign-in failed.");
    }
  }, [onSession, setToast]);

  useEffect(() => {
    if (!FIREBASE_AUTH_ENABLED || !isFirebaseAvailable) return undefined;
    let cancelled = false;

    async function startFirebaseUi() {
      try {
        const { firebase, firebaseui } = await loadFirebaseUi();
        if (cancelled) return;
        if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
        const signInOptions = firebaseSignInOptions(firebase);
        if (!signInOptions.length) throw new Error("No Firebase sign-in providers are enabled.");
        const ui = firebaseui.auth.AuthUI.getInstance() || new firebaseui.auth.AuthUI(firebase.auth());
        uiRef.current = ui;
        ui.start("#firebaseui-auth-container", {
          callbacks: {
            signInSuccessWithAuthResult: authResult => {
              const session = firebaseSessionForUser(authResult.user);
              onSession(session);
              return false;
            },
            uiShown: () => {
              if (!cancelled) setStatus("ready");
            }
          },
          signInFlow: "popup",
          signInOptions,
          tosUrl: "#",
          privacyPolicyUrl: "#"
        });
      } catch (error) {
        if (!cancelled) {
          setStatus("error");
          setToast(error.message);
        }
      }
    }

    startFirebaseUi();
    return () => {
      cancelled = true;
      uiRef.current?.reset();
    };
  }, [onSession, setToast]);

  if (!FIREBASE_AUTH_ENABLED) return null;

  return (
    <div className="firebase-auth-panel">
      <div className="divider"><span>Or continue with Firebase</span></div>
      <div id="firebaseui-auth-container" />
      {FIREBASE_AUTH_PROVIDERS.includes("google") && isFirebaseAvailable ? (
        <button className="btn secondary firebase-google-button" type="button" onClick={signInWithGoogle}>
          Continue with Google
        </button>
      ) : null}
      {status === "loading" ? <div className="firebase-loader">Loading sign-in options...</div> : null}
      {!isFirebaseAvailable && FIREBASE_AUTH_ENABLED ? (
        <div className="firebase-error">Firebase is configured, but initialization failed. Check your project keys and authorized domains.</div>
      ) : null}
    </div>
  );
}

function audienceRank(value = "") {
  const compact = String(value).toLowerCase().replace(/,/g, "");
  const match = compact.match(/(\d+(\.\d+)?)(k|m)?/);
  if (!match) return 0;
  const amount = Number(match[1]);
  const suffix = match[3];
  if (suffix === "m") return amount * 1000000;
  if (suffix === "k") return amount * 1000;
  return amount;
}

function priceRank(value = "") {
  const match = String(value).replace(/,/g, "").match(/\$?(\d+(\.\d+)?)/);
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
}

function quoteRank(quote = {}) {
  return Number(quote.amountMinor) || (priceRank(quote.amount) === Number.MAX_SAFE_INTEGER ? 0 : priceRank(quote.amount) * 100);
}

function deliveryRank(quote = {}) {
  const dayMatch = String(quote.timeline || "").toLowerCase().match(/(\d+(\.\d+)?)/);
  if (Number.isFinite(Number(quote.deliveryDays)) && Number(quote.deliveryDays) > 0) return Number(quote.deliveryDays);
  if (dayMatch) return Number(dayMatch[1]);
  if (/hour|today|same day|urgent|fast/.test(String(quote.timeline || "").toLowerCase())) return 0.5;
  return 30;
}

function recommendedQuoteId(quotes = []) {
  const submitted = quotes.filter(quote => ["submitted", "accepted"].includes(quote.status));
  if (!submitted.length) return "";
  return [...submitted].sort((a, b) => {
    const aScore = (Number(a.matchScore) || 0) - Math.min(30, (Number(a.deliveryDays) || 14) * 2) - Math.min(30, quoteRank(a) / 10000);
    const bScore = (Number(b.matchScore) || 0) - Math.min(30, (Number(b.deliveryDays) || 14) * 2) - Math.min(30, quoteRank(b) / 10000);
    return bScore - aScore;
  })[0]?._id || "";
}

function quoteAwardLabels(quotes = []) {
  const submitted = quotes.filter(quote => ["submitted", "accepted"].includes(quote.status));
  if (!submitted.length) return {};
  const lowest = [...submitted].sort((a, b) => quoteRank(a) - quoteRank(b))[0]?._id;
  const fastest = [...submitted].sort((a, b) => deliveryRank(a) - deliveryRank(b))[0]?._id;
  const best = recommendedQuoteId(submitted);
  return submitted.reduce((labels, quote) => {
    const quoteLabels = [];
    if (quote._id === best) quoteLabels.push("Best Value");
    if (quote._id === fastest) quoteLabels.push("Fastest");
    if (quote._id === lowest) quoteLabels.push("Lowest Price");
    if (quoteLabels.length) labels[quote._id] = quoteLabels;
    return labels;
  }, {});
}

function quoteInboxItems(briefs = []) {
  return briefs.flatMap(brief => (brief.quotes || []).map(quote => ({ brief, quote })));
}

function listingQuality(draft = {}, assetPreview = "") {
  const items = [
    ["Title", draft.title.trim().length >= 8],
    ["Description", draft.description.trim().length >= 80],
    ["Audience", Boolean(draft.audience.trim())],
    ["Partner", Boolean(draft.partner.trim())],
    ["Media", Boolean(assetPreview || draft.image)]
  ];
  const done = items.filter(([, ok]) => ok).length;
  return { score: Math.round((done / items.length) * 100), items };
}

function expertBadges(expert = {}) {
  const badges = [];
  if ((expert.profileStrength || 0) >= 80) badges.push("Verified");
  if (Number(expert.turnaroundDays) && Number(expert.turnaroundDays) <= 2) badges.push("Fast Responder");
  if ((expert.averageRating || 0) >= 4) badges.push("Top Rated");
  if (expert.caseStudies?.length) badges.push("Proof Ready");
  if (expert.serviceCatalog?.length) badges.push("Service Menu");
  return badges.length ? badges : ["Profile Active"];
}

function isBlueTickExpert(expert = {}) {
  return (expert.profileStrength || 0) >= 80 || (expert.averageRating || 0) >= 4 || Boolean(expert.caseStudies?.length);
}

function ageLabel(brief = {}) {
  if (brief.ageMin && brief.ageMax) return `Age ${brief.ageMin}-${brief.ageMax}`;
  if (brief.ageMin) return `Age ${brief.ageMin}+`;
  if (brief.ageMax) return `Up to age ${brief.ageMax}`;
  return "All eligible ages";
}

function followerLabel(value = 0) {
  const count = Number(value) || 0;
  if (!count) return "";
  if (count >= 1000000) return `${(count / 1000000).toFixed(count >= 10000000 ? 0 : 1)}M followers`;
  if (count >= 1000) return `${(count / 1000).toFixed(count >= 10000 ? 0 : 1)}K followers`;
  return `${count} followers`;
}

function workKey(type, id) {
  return `${type}:${id}`;
}

function userInitials(user = {}) {
  const source = user.businessName || user.email || "Parasara";
  const words = source
    .replace(/[^a-z0-9\s]/gi, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return "PR";
  return words.slice(0, 2).map(word => word[0]).join("").toUpperCase();
}

function reminderLabel(value) {
  if (!value) return "No reminder";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No reminder";
  return date.toLocaleString();
}

function localExpertMatch(expert = {}, brief = {}) {
  let score = 25;
  const normalized = String(brief.platform || "").toLowerCase();
  const platform = normalized.includes("twitter") || normalized === "x" ? "twitter" : normalized.replace(/[^a-z]/g, "");
  const expertise = `${expert.expertise || ""} ${expert.industry || ""}`.toLowerCase();
  if (platform && expert[platform]) score += 35;
  if (expertise.includes("social")) score += 15;
  if (expertise.includes("influencer") || expertise.includes("creator")) score += 10;
  if (brief.city && expert.location && String(expert.location).toLowerCase().includes(String(brief.city).toLowerCase())) score += 10;
  score += Math.min(5, Math.floor((expert.profileStrength || 0) / 20));
  return Math.min(100, score);
}

function BriefTimeline({ status }) {
  const active = String(status || "open");
  const steps = [
    ["open", "Brief"],
    ["quotes_received", "Quotes"],
    ["expert_selected", "Expert"],
    ["paid", "Paid"],
    ["completed", "Proof"],
    ["closed", "Done"]
  ];
  const statusIndex = active === "proof_submitted" ? 4 : active === "disputed" ? 3 : steps.findIndex(([value]) => value === active);
  const index = Math.max(0, statusIndex);
  return <div className="contract-timeline brief-timeline">{steps.map(([value, label], stepIndex) => <span key={value} className={stepIndex <= index ? "done" : ""}>{label}</span>)}</div>;
}

function QuoteComparison({ brief, acceptQuote, requestQuoteRevision, proposeCounter, respondCounter, shortlistQuote, withdrawQuote, actionBusy = "" }) {
  const quotes = brief.quotes || [];
  const recommendedId = recommendedQuoteId(quotes);
  const awardLabels = quoteAwardLabels(quotes);
  if (!quotes.length) return <small>No quotes yet.</small>;
  return (
    <div className="quote-comparison">
      {quotes.map(quote => (
        <article className={`quote-card ${quote._id === recommendedId ? "recommended" : ""}`} key={quote._id}>
          <div className="badge-row">
            {(awardLabels[quote._id] || []).map(label => <span className="rating-pill" key={label}>{label}</span>)}
          </div>
          {quote.isBid ? <span className="rating-pill">Auction bid</span> : null}
          <strong>{quote.expertName}</strong>
          <p>{quote.message}</p>
          <div className="quote-metrics">
            <span>{quote.amount}</span>
            <span>{quote.timeline}</span>
            <span>{quote.matchScore || 0}% match</span>
          </div>
          <em>{quote.status}</em>
          {quote.revisionNote ? <small>Revision requested: {quote.revisionNote}</small> : null}
          {quote.counterStatus === "proposed" ? <small>Counter: {quote.counterAmount} / {quote.counterTimeline || "timeline open"}</small> : null}
          {quote.shortlisted ? <small>Shortlisted</small> : null}
          {quote.status === "submitted" ? <div className="quote-actions"><button className="btn secondary" disabled={actionBusy === `accept-${quote._id}`} onClick={() => acceptQuote(brief._id, quote._id)} type="button">{quote.isBid ? "Award Bid" : "Accept"}</button><button className="btn outline" onClick={() => requestQuoteRevision(brief._id, quote._id)} type="button">Revise</button><button className="btn outline" onClick={() => proposeCounter(brief._id, quote._id)} type="button">Counter</button>{shortlistQuote ? <button className="btn outline" onClick={() => shortlistQuote(brief._id, quote._id, !quote.shortlisted)} type="button">{quote.shortlisted ? "Unshortlist" : "Shortlist"}</button> : null}{withdrawQuote ? <button className="btn outline" onClick={() => withdrawQuote(brief._id, quote._id)} type="button">Withdraw</button> : null}{quote.counterStatus === "proposed" ? <button className="btn secondary" onClick={() => respondCounter(brief._id, quote._id, "accepted")} type="button">Accept Counter</button> : null}</div> : null}
        </article>
      ))}
    </div>
  );
}

function readStringArray(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(value) ? value.filter(item => typeof item === "string") : [];
  } catch {
    localStorage.removeItem(key);
    return [];
  }
}

function readJsonArray(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    localStorage.removeItem(key);
    return [];
  }
}

function readAppSettings() {
  try {
    const value = JSON.parse(localStorage.getItem("parasara_app_settings") || "{}");
    return {
      theme: value.theme === "dark" ? "dark" : "light",
      currency: currencyOptions.some(([key]) => key === value.currency) ? value.currency : "inr",
      region: regionOptions.some(([key]) => key === value.region) ? value.region : "in",
      dateFormat: dateFormatOptions.some(([key]) => key === value.dateFormat) ? value.dateFormat : "en-IN",
      compactMode: Boolean(value.compactMode)
    };
  } catch {
    localStorage.removeItem("parasara_app_settings");
    return { theme: "light", currency: "inr", region: "in", dateFormat: "en-IN", compactMode: false };
  }
}

function App() {
  const [token, setToken] = useState(() => readSessionValue(SESSION_KEYS.token, LEGACY_SESSION_KEYS.token));
  const [user, setUser] = useState(readSessionUser);
  const [view, setView] = useState("dashboard");
  const [toast, setToast] = useState("");
  const [modal, setModal] = useState(null);
  const [promotions, setPromotions] = useState([]);
  const [connections, setConnections] = useState([]);
  const [requests, setRequests] = useState([]);
  const [filter, setFilter] = useState({ kind: "all", value: "All" });
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState(emptyDraft);
  const [assetPreview, setAssetPreview] = useState("");
  const [authMode, setAuthMode] = useState("login");
  const [authForm, setAuthForm] = useState({ email: "", password: "" });
  const [registerForm, setRegisterForm] = useState({ businessName: "", email: "", password: "", industry: "" });
  const [verifyForm, setVerifyForm] = useState({ token: "" });
  const [resetForm, setResetForm] = useState({ token: "", password: "" });
  const [dashboard, setDashboard] = useState({ profileStrength: 84, activePromotions: 0, newRequests: 0, briefsPosted: 0, quotesReceived: 0, completedBriefs: 0, escrowPayments: [] });
  const [loading, setLoading] = useState(false);
  const [sort, setSort] = useState("newest");
  const [chat, setChat] = useState(null);
  const [chatMessage, setChatMessage] = useState("");
  const [chatAttachment, setChatAttachment] = useState(null);
  const [conversationChat, setConversationChat] = useState(null);
  const [conversationMessage, setConversationMessage] = useState("");
  const [conversationAttachment, setConversationAttachment] = useState(null);
  const [actionBusy, setActionBusy] = useState("");
  const [conversationInbox, setConversationInbox] = useState([]);
  const [paymentDraft, setPaymentDraft] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState("50.00");
  const [paymentRecipients, setPaymentRecipients] = useState("");
  const [paymentCurrency, setPaymentCurrency] = useState(() => readAppSettings().currency);
  const [paymentUpiId, setPaymentUpiId] = useState(() => user?.upiId || "");
  const [multiCheckout, setMultiCheckout] = useState(null);
  const [appSettings, setAppSettings] = useState(readAppSettings);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [threads, setThreads] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [payments, setPayments] = useState([]);
  const [profileForm, setProfileForm] = useState({ businessName: "", industry: "", accountMode: "buyer", description: "", website: "", location: "", phone: "", upiId: "", expertise: "", instagram: "", youtube: "", linkedin: "", facebook: "", twitter: "", tiktok: "", snapchat: "", pinterest: "", whatsapp: "", telegram: "", availability: "available", minBudget: "", turnaroundDays: "", followerCount: "", serviceLanguages: [], serviceCatalog: [] });
  const [marketFilters, setMarketFilters] = useState({ budget: "all", delivery: "all", language: "all", platform: "all", city: "", rating: "all", savedOnly: false });
  const [savedItems, setSavedItems] = useState(() => readStringArray("parasara_saved_items"));
  const [savedSearches, setSavedSearches] = useState(() => readJsonArray("parasara_saved_searches"));
  const [pinnedWork, setPinnedWork] = useState(() => readJsonArray("parasara_pinned_work"));
  const [adBriefs, setAdBriefs] = useState([]);
  const [openBriefs, setOpenBriefs] = useState([]);
  const [openAuctions, setOpenAuctions] = useState([]);
  const [experts, setExperts] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [notificationCenterOpen, setNotificationCenterOpen] = useState(false);
  const [notificationFilter, setNotificationFilter] = useState("all");
  const [adminSummary, setAdminSummary] = useState(null);
  const [adminReviewQueue, setAdminReviewQueue] = useState({ briefs: [], payments: [] });
  const [adminSystemStatus, setAdminSystemStatus] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [shortlists, setShortlists] = useState([]);
  const [expertInbox, setExpertInbox] = useState({ invited: [], quoted: [], accepted: [], matching: [] });
  const [briefWorkspace, setBriefWorkspace] = useState(null);
  const [storyBriefOpen, setStoryBriefOpen] = useState(false);
  const [storyBrief, setStoryBrief] = useState(emptyStoryBrief);
  const [quoteTarget, setQuoteTarget] = useState(null);
  const [quoteForm, setQuoteForm] = useState(emptyQuote);
  const [proofTarget, setProofTarget] = useState(null);
  const [proofForm, setProofForm] = useState(emptyProof);
  const [globalSearch, setGlobalSearch] = useState("");
  const [promptModal, setPromptModal] = useState(null);
  const promptResolver = useRef(null);

  const authed = Boolean(token && user);
  const handleFirebaseSession = useCallback(session => {
    saveSession(session);
    setToken(session.token);
    setUser(session.user);
    setView("dashboard");
    setToast("Signed in with Firebase.");
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(""), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

    const windowOpen = Boolean(modal || promptModal || chat || conversationChat || notificationCenterOpen || paymentDraft || multiCheckout || assistantOpen || storyBriefOpen || quoteTarget || proofTarget || briefWorkspace);

  useEffect(() => {
    document.body.style.overflow = windowOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [windowOpen]);

  useEffect(() => {
    function closeTopWindow(event) {
      if (event.key !== "Escape") return;
      if (assistantOpen) setAssistantOpen(false);
      else if (storyBriefOpen) setStoryBriefOpen(false);
      else if (quoteTarget) setQuoteTarget(null);
      else if (proofTarget) setProofTarget(null);
      else if (briefWorkspace) setBriefWorkspace(null);
      else if (paymentDraft) setPaymentDraft(null);
      else if (multiCheckout) setMultiCheckout(null);
      else if (notificationCenterOpen) setNotificationCenterOpen(false);
      else if (conversationChat) setConversationChat(null);
      else if (chat) setChat(null);
      else if (promptModal) closePrompt("");
      else if (modal) setModal(null);
    }

    window.addEventListener("keydown", closeTopWindow);
    return () => window.removeEventListener("keydown", closeTopWindow);
  }, [assistantOpen, storyBriefOpen, quoteTarget, proofTarget, briefWorkspace, paymentDraft, multiCheckout, notificationCenterOpen, conversationChat, chat, promptModal, modal]);

  useEffect(() => {
    if (!authed) return;
    if (user?.localOnly) return;
    loadApiData();
    confirmReturnedPayment();
  }, [authed, user?.localOnly]);

  useEffect(() => {
    if (!user) return;
    setProfileForm({
      businessName: user.businessName || "",
      industry: user.industry || "",
      accountMode: user.accountMode || "buyer",
      description: user.description || "",
      website: user.website || "",
      location: user.location || "",
      phone: user.phone || "",
      upiId: user.upiId || "",
      expertise: user.expertise || "",
      instagram: user.instagram || "",
      youtube: user.youtube || "",
      linkedin: user.linkedin || "",
      facebook: user.facebook || "",
      twitter: user.twitter || "",
      tiktok: user.tiktok || "",
      snapchat: user.snapchat || "",
      pinterest: user.pinterest || "",
      whatsapp: user.whatsapp || "",
      telegram: user.telegram || "",
      availability: user.availability || "available",
      minBudget: user.minBudget || "",
      turnaroundDays: user.turnaroundDays || "",
      followerCount: user.followerCount || "",
      serviceLanguages: user.serviceLanguages || [],
      serviceCatalog: user.serviceCatalog?.length ? user.serviceCatalog : [],
      caseStudies: user.caseStudies || []
    });
    setPaymentUpiId(user.upiId || "");
  }, [user]);

  useEffect(() => {
    localStorage.setItem("parasara_saved_items", JSON.stringify(savedItems));
  }, [savedItems]);

  useEffect(() => {
    localStorage.setItem("parasara_saved_searches", JSON.stringify(savedSearches));
  }, [savedSearches]);

  useEffect(() => {
    localStorage.setItem("parasara_pinned_work", JSON.stringify(pinnedWork));
  }, [pinnedWork]);

  useEffect(() => {
    localStorage.setItem("parasara_app_settings", JSON.stringify(appSettings));
    document.body.classList.toggle("dark-mode", appSettings.theme === "dark");
    document.body.classList.toggle("compact-mode", appSettings.compactMode);
    setPaymentCurrency(appSettings.currency);
    setStoryBrief(previous => ({ ...previous, currency: appSettings.currency }));
  }, [appSettings]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = Date.now();
      const due = pinnedWork.find(item => item.reminderAt && !item.notifiedAt && new Date(item.reminderAt).getTime() <= now);
      if (!due) return;
      setToast(`Reminder: ${due.title}`);
      setPinnedWork(previous => previous.map(item => item.key === due.key ? { ...item, notifiedAt: new Date().toISOString() } : item));
    }, 30000);
    return () => window.clearInterval(timer);
  }, [pinnedWork]);

  async function request(path, options = {}, retrying = false) {
    const authToken = readSessionValue(SESSION_KEYS.token, LEGACY_SESSION_KEYS.token) || token;
    let response;
    try {
      response = await fetch(apiUrl(path), {
        ...options,
        headers: {
          "Content-Type": "application/json",
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
          ...(options.headers || {})
        }
      });
    } catch {
      throw new Error("API server is not reachable. Check that the backend is deployed and VITE_API_BASE_URL is set.");
    }
    const rawBody = await response.text();
    let data = {};
    try {
      data = rawBody ? JSON.parse(rawBody) : {};
    } catch {
      data = {};
    }
    if (response.status === 401 && !retrying && !path.startsWith("/api/auth/")) {
      const refreshToken = readSessionValue(SESSION_KEYS.refresh, LEGACY_SESSION_KEYS.refresh);
      if (refreshToken) {
        const refreshResponse = await fetch(apiUrl("/api/auth/refresh"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken })
        });
        const refreshData = await refreshResponse.json().catch(() => ({}));
        if (refreshResponse.ok && refreshData.token) {
          saveSession(refreshData);
          setToken(refreshData.token);
          if (refreshData.user) setUser(refreshData.user);
          return request(path, options, true);
        }
      }
    }
    if (!response.ok) {
      const text = rawBody.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
      throw new Error(data.message || text || `Request failed with status ${response.status}.`);
    }
    return data;
  }

  function askText({ title, label, initialValue = "", multiline = false, required = false }) {
    return new Promise(resolve => {
      promptResolver.current = resolve;
      setPromptModal({ title, label, value: initialValue, multiline, required });
    });
  }

  function closePrompt(value = "") {
    const resolver = promptResolver.current;
    promptResolver.current = null;
    setPromptModal(null);
    if (resolver) resolver(value);
  }

  async function loadApiData() {
    setLoading(true);
    try {
      const [sessionData, promotionData, connectionData, requestData, draftData, dashboardData, threadData, contractData, paymentData, briefData, expertData, openBriefData, auctionData, notificationData, expertInboxData, analyticsData, shortlistData, conversationData] = await Promise.all([
        request("/api/auth/me"),
        request("/api/promotions"),
        request("/api/connections"),
        request("/api/requests"),
        request("/api/drafts/promotion"),
        request("/api/dashboard"),
        request("/api/messages"),
        request("/api/contracts"),
        request("/api/payments"),
        request("/api/ad-briefs"),
        request("/api/experts"),
        request("/api/ad-briefs/open"),
        request("/api/auctions/open"),
        request("/api/notifications"),
        request("/api/expert/inbox"),
        request("/api/analytics/campaigns"),
        request("/api/shortlists"),
        request("/api/conversations")
      ]);
      setUser(sessionData.user);
      saveSession({ user: sessionData.user });
      setPromotions(promotionData.promotions || []);
      setConnections(connectionData.connections || []);
      setRequests(requestData.requests || []);
      setDashboard(dashboardData);
      setThreads(threadData.threads || []);
      setContracts(contractData.contracts || []);
      setPayments(paymentData.payments || []);
      setAdBriefs(briefData.briefs || []);
      setExperts(expertData.experts || []);
      setOpenBriefs(openBriefData.briefs || []);
      setOpenAuctions(auctionData.auctions || []);
      setNotifications(notificationData.notifications || []);
      setUnreadNotifications(notificationData.unread || 0);
      setExpertInbox(expertInboxData || { invited: [], quoted: [], accepted: [], matching: [] });
      setAnalytics(analyticsData);
      setShortlists(shortlistData.shortlists || []);
      setConversationInbox(conversationData.conversations || []);
      if (sessionData.user?.role === "admin") {
        const [adminData, queueData, statusData] = await Promise.all([
          request("/api/admin/summary"),
          request("/api/admin/review-queue"),
          request("/api/admin/system-status")
        ]);
        setAdminSummary(adminData);
        setAdminReviewQueue(queueData);
        setAdminSystemStatus(statusData.status || null);
      } else {
        setAdminSummary(null);
        setAdminReviewQueue({ briefs: [], payments: [] });
        setAdminSystemStatus(null);
      }
      if (draftData.draft) setDraft({ ...emptyDraft, ...draftData.draft });
    } catch (error) {
      if (error.message.toLowerCase().includes("session")) {
        clearSession();
        setToken("");
        setUser(null);
      }
      setToast(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function login(event) {
    event.preventDefault();
    const email = authForm.email.trim().toLowerCase();
    try {
      if (LOCAL_AUTH_ENABLED) {
        const account = readLocalAccounts().find(item => item.email === email);
        if (account) {
          if (account.password !== authForm.password) throw new Error("Invalid email or password.");
          const data = localSessionForUser(publicLocalUser(account));
          saveSession(data);
          setToken(data.token);
          setUser(data.user);
          setView("dashboard");
          setToast("Signed in successfully.");
          return;
        }
      }
      const data = await request("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ ...authForm, email })
      });
      saveSession(data);
      setToken(data.token);
      setUser(data.user);
      setView("dashboard");
      setToast("Signed in successfully.");
    } catch (error) {
      setToast(error.message);
    }
  }

  async function saveProfile(event) {
    event.preventDefault();
    try {
      if (user?.localOnly) {
        const nextUser = {
          ...user,
          ...profileForm,
          minBudget: Number(profileForm.minBudget) || 0,
          turnaroundDays: Number(profileForm.turnaroundDays) || 0,
          followerCount: Number(profileForm.followerCount) || 0,
          profileStrength: 84,
          localOnly: true
        };
        const accounts = readLocalAccounts();
        saveLocalAccounts(accounts.map(account => account.id === user.id ? { ...account, ...nextUser, password: account.password } : account));
        setUser(nextUser);
        saveSession({ user: nextUser });
        setDashboard(previous => ({ ...previous, profileStrength: nextUser.profileStrength }));
        setToast("Profile settings saved.");
        return;
      }
      const data = await request("/api/profile", {
        method: "PATCH",
        body: JSON.stringify(profileForm)
      });
      setUser(data.user);
      saveSession({ user: data.user });
      setDashboard(previous => ({ ...previous, profileStrength: data.user.profileStrength }));
      setToast("Profile settings saved.");
    } catch (error) {
      setToast(error.message);
    }
  }

  async function submitStoryBrief(event) {
    event.preventDefault();
    try {
      const normalizedBrief = {
        ...storyBrief,
        format: platformFormatOptions[storyBrief.platform]?.includes(storyBrief.format)
          ? storyBrief.format
          : platformFormatOptions[storyBrief.platform]?.[0] || "Post"
      };
      const data = await request("/api/ad-briefs/social-media", {
        method: "POST",
        body: JSON.stringify(normalizedBrief)
      });
      setAdBriefs(previous => [data.brief, ...previous]);
      setStoryBrief(emptyStoryBrief);
      setStoryBriefOpen(false);
      setView("marketplace");
      await loadApiData();
      setToast(storyBrief.isAuction ? "Fast auction is live for expert bids." : `${storyBrief.platform} brief posted for experts.`);
    } catch (error) {
      setToast(error.message);
    }
  }

  async function showNotifications() {
    setNotificationCenterOpen(true);
    if (!unreadNotifications) return;
    try {
      await request("/api/notifications/read", { method: "PATCH" });
      setNotifications(previous => previous.map(item => ({ ...item, read: true })));
      setUnreadNotifications(0);
    } catch (error) {
      setToast(error.message);
    }
  }

  function openNotificationAction(item) {
    setNotificationCenterOpen(false);
    if (item.actionView) setView(item.actionView);
    if (item.linkType === "brief" && item.linkId) openBriefWorkspace(item.linkId);
    if (!item.actionView && ["quote", "proof", "brief"].includes(item.type || item.linkType)) setView("marketplace");
    if (!item.actionView && ["payment", "contract"].includes(item.type || item.linkType)) setView("contracts");
    if (!item.actionView && ["invite"].includes(item.type || item.linkType)) setView("expert");
    if (!item.actionView && ["auction", "bid"].includes(item.type || item.linkType)) setView("auction");
    if (!item.actionView && ["message", "conversation"].includes(item.type || item.linkType)) setView("messages");
  }

  async function submitQuote(event) {
    event.preventDefault();
    if (!quoteTarget) return;
    try {
      await request(`/api/ad-briefs/${quoteTarget._id}/quotes`, {
        method: "POST",
        body: JSON.stringify(quoteForm)
      });
      setQuoteTarget(null);
      setQuoteForm(emptyQuote);
      await loadApiData();
      setToast("Quote submitted.");
    } catch (error) {
      setToast(error.message);
    }
  }

  async function acceptQuote(briefId, quoteId) {
    const key = `accept-${quoteId}`;
    setActionBusy(key);
    try {
      await request(`/api/ad-briefs/${briefId}/quotes/${quoteId}/accept`, { method: "PATCH" });
      await loadApiData();
      setToast("Quote accepted. Expert selected.");
    } catch (error) {
      setToast(error.message);
    } finally {
      setActionBusy("");
    }
  }

  async function payEscrow(briefId) {
    try {
      let payerUpiId = user?.upiId || paymentUpiId;
      if (!payerUpiId) {
        payerUpiId = await askText({ title: "Your UPI ID", label: "Enter your UPI ID for manual escrow (example: name@bank)", required: true });
      }
      if (!payerUpiId) return;
      const data = await request(`/api/ad-briefs/${briefId}/escrow`, {
        method: "POST",
        body: JSON.stringify({ payerUpiId })
      });
      setPaymentUpiId(payerUpiId);
      window.location.href = data.checkoutUrl;
    } catch (error) {
      setToast(error.message);
    }
  }

  async function inviteExpert(briefId, expertId) {
    const key = `invite-${expertId}`;
    setActionBusy(key);
    try {
      await request(`/api/ad-briefs/${briefId}/invite`, {
        method: "POST",
        body: JSON.stringify({ expertId })
      });
      await loadApiData();
      setToast("Expert invited to quote.");
    } catch (error) {
      setToast(error.message);
    } finally {
      setActionBusy("");
    }
  }

  async function requestQuoteRevision(briefId, quoteId) {
    const revisionNote = await askText({ title: "Request Quote Revision", label: "What should the expert revise?", multiline: true, required: true });
    if (!revisionNote) return;
    try {
      await request(`/api/ad-briefs/${briefId}/quotes/${quoteId}/revise`, {
        method: "PATCH",
        body: JSON.stringify({ revisionNote })
      });
      await loadApiData();
      setToast("Quote revision requested.");
    } catch (error) {
      setToast(error.message);
    }
  }

  async function proposeCounter(briefId, quoteId) {
    const counterAmount = await askText({ title: "Counteroffer", label: "Counter amount", required: true });
    if (!counterAmount) return;
    const counterTimeline = await askText({ title: "Counteroffer Timeline", label: "Counter timeline" }) || "";
    const counterMessage = await askText({ title: "Counteroffer Message", label: "Counter message", multiline: true }) || "";
    try {
      await request(`/api/ad-briefs/${briefId}/quotes/${quoteId}/counter`, {
        method: "PATCH",
        body: JSON.stringify({ counterAmount, counterTimeline, counterMessage })
      });
      await loadApiData();
      setToast("Counteroffer sent.");
    } catch (error) {
      setToast(error.message);
    }
  }

  async function respondCounter(briefId, quoteId, status) {
    try {
      await request(`/api/ad-briefs/${briefId}/quotes/${quoteId}/counter/respond`, {
        method: "PATCH",
        body: JSON.stringify({ status })
      });
      await loadApiData();
      setToast(`Counteroffer ${status}.`);
    } catch (error) {
      setToast(error.message);
    }
  }

  async function shortlistQuote(briefId, quoteId, shortlisted) {
    try {
      await request(`/api/ad-briefs/${briefId}/quotes/${quoteId}/shortlist`, {
        method: "PATCH",
        body: JSON.stringify({ shortlisted })
      });
      await loadApiData();
      setToast(shortlisted ? "Bid shortlisted." : "Bid removed from shortlist.");
    } catch (error) {
      setToast(error.message);
    }
  }

  async function withdrawQuote(briefId, quoteId) {
    try {
      await request(`/api/ad-briefs/${briefId}/quotes/${quoteId}/withdraw`, { method: "PATCH" });
      await loadApiData();
      setToast("Bid withdrawn.");
    } catch (error) {
      setToast(error.message);
    }
  }

  async function closeAuction(briefId) {
    try {
      await request(`/api/ad-briefs/${briefId}/auction/close`, { method: "PATCH" });
      await loadApiData();
      setToast("Auction closed.");
    } catch (error) {
      setToast(error.message);
    }
  }

  async function respondInvitation(briefId, status) {
    try {
      await request(`/api/ad-briefs/${briefId}/invite/respond`, {
        method: "PATCH",
        body: JSON.stringify({ status })
      });
      await loadApiData();
      setToast(`Invitation ${status}.`);
    } catch (error) {
      setToast(error.message);
    }
  }

  async function openBriefWorkspace(briefId) {
    try {
      const data = await request(`/api/ad-briefs/${briefId}/workspace`);
      setBriefWorkspace(data);
    } catch (error) {
      setToast(error.message);
    }
  }

  async function viewExpertProfile(expertId) {
    try {
      const data = await request(`/api/experts/${expertId}/public`);
      setModal({
        title: data.expert.businessName,
        paragraphs: [data.expert.description || data.expert.expertise || "Expert profile", `${data.expert.averageRating || 0} average rating from ${data.expert.reviewCount || 0} review${data.expert.reviewCount === 1 ? "" : "s"}.`],
        items: [
          ...(data.expert.followerCount ? [`Audience: ${followerLabel(data.expert.followerCount)}`] : []),
          ...(data.expert.serviceCatalog || []).map(service => `${service.platform}: ${service.service} - ${service.startingPrice || "Price on request"}`),
          ...(data.reviews || []).map(review => `${review.brandName}: ${review.rating} stars${review.reviewText ? ` - ${review.reviewText}` : ""}`)
        ]
      });
    } catch (error) {
      setToast(error.message);
    }
  }

  async function saveExpertToShortlist(expertId) {
    try {
      await request("/api/shortlists", {
        method: "POST",
        body: JSON.stringify({ expertId, name: "Campaign Shortlist" })
      });
      await loadApiData();
      setToast("Expert saved to shortlist.");
    } catch (error) {
      setToast(error.message);
    }
  }

  async function viewContractDocument(contractId) {
    try {
      const data = await request(`/api/contracts/${contractId}/document`);
      setModal({ title: "Contract Document", paragraphs: [data.documentText] });
    } catch (error) {
      setToast(error.message);
    }
  }

  async function adminPaymentAction(paymentId, action) {
    const note = await askText({ title: `${action} Payment`, label: "Admin note", multiline: true }) || "";
    try {
      await request(`/api/admin/payments/${paymentId}/${action}`, {
        method: "PATCH",
        body: JSON.stringify({ note })
      });
      await loadApiData();
      setToast(`Payment ${action} complete.`);
    } catch (error) {
      setToast(error.message);
    }
  }

  async function runAdminJobs() {
    try {
      const data = await request("/api/jobs/run", { method: "POST", body: JSON.stringify({}) });
      setToast(`${data.remindersQueued} reminder${data.remindersQueued === 1 ? "" : "s"} and ${data.auctionRemindersQueued || 0} auction alert${data.auctionRemindersQueued === 1 ? "" : "s"} queued.`);
    } catch (error) {
      setToast(error.message);
    }
  }

  async function resolveAdminDispute(briefId, resolution) {
    const note = await askText({ title: "Resolve Dispute", label: resolution === "reopen" ? "Note for reopening work" : "Note for closing dispute", multiline: true }) || "";
    try {
      await request(`/api/admin/disputes/${briefId}/resolve`, {
        method: "PATCH",
        body: JSON.stringify({ resolution, note })
      });
      await loadApiData();
      setToast("Dispute updated.");
    } catch (error) {
      setToast(error.message);
    }
  }

  async function saveCurrentSearch() {
    const name = await askText({ title: "Save Search", label: "Search name", required: true }) || "";
    if (!name.trim()) return;
    const item = { id: Date.now().toString(36), name: name.trim().slice(0, 60), search, sort, filter, marketFilters };
    setSavedSearches(previous => [item, ...previous.filter(saved => saved.name !== item.name)].slice(0, 8));
    setToast("Search saved.");
  }

  function applySavedSearch(item) {
    setSearch(item.search || "");
    setSort(item.sort || "newest");
    setFilter(item.filter || { kind: "all", value: "All" });
    setMarketFilters(item.marketFilters || { budget: "all", delivery: "all", language: "all", platform: "all", city: "", rating: "all", savedOnly: false });
    setView("marketplace");
  }

  async function submitProof(event) {
    event.preventDefault();
    if (!proofTarget) return;
    try {
      await request(`/api/ad-briefs/${proofTarget._id}/proof`, {
        method: "PATCH",
        body: JSON.stringify(proofForm)
      });
      setProofTarget(null);
      setProofForm(emptyProof);
      await loadApiData();
      setToast("Proof uploaded.");
    } catch (error) {
      setToast(error.message);
    }
  }

  async function reviewProof(briefId, decision) {
    const note = decision === "revision_requested" ? await askText({ title: "Request Proof Revision", label: "What should be revised?", multiline: true, required: true }) : "";
    if (decision === "revision_requested" && !note) return;
    try {
      await request(`/api/ad-briefs/${briefId}/proof-review`, {
        method: "PATCH",
        body: JSON.stringify({ decision, note })
      });
      await loadApiData();
      setToast(decision === "approved" ? "Proof approved." : "Proof revision requested.");
    } catch (error) {
      setToast(error.message);
    }
  }

  async function disputeBrief(briefId) {
    const disputeReason = await askText({ title: "Open Dispute", label: "Describe the dispute", multiline: true, required: true });
    if (!disputeReason) return;
    try {
      await request(`/api/ad-briefs/${briefId}/dispute`, {
        method: "PATCH",
        body: JSON.stringify({ disputeReason })
      });
      await loadApiData();
      setToast("Dispute opened.");
    } catch (error) {
      setToast(error.message);
    }
  }

  async function rateBrief(briefId, rating) {
    if (!rating) return;
    const reviewText = await askText({ title: "Rate Expert", label: "Add a short review", multiline: true }) || "";
    try {
      await request(`/api/ad-briefs/${briefId}/rating`, {
        method: "PATCH",
        body: JSON.stringify({ rating, reviewText })
      });
      await loadApiData();
      setToast("Rating saved.");
    } catch (error) {
      setToast(error.message);
    }
  }

  async function register(event) {
    event.preventDefault();
    const email = registerForm.email.trim().toLowerCase();
    try {
      if (LOCAL_AUTH_ENABLED) {
        if (registerForm.password.length < 8 || registerForm.password.length > 128) throw new Error("Password must be 8 to 128 characters.");
        const accounts = readLocalAccounts();
        if (accounts.some(item => item.email === email)) throw new Error("That email is already registered.");
        const account = {
          id: `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
          businessName: registerForm.businessName.trim(),
          industry: registerForm.industry.trim(),
          email,
          password: registerForm.password,
          profileStrength: 30,
          createdAt: new Date().toISOString()
        };
        saveLocalAccounts([account, ...accounts]);
        const data = localSessionForUser(publicLocalUser(account));
        saveSession(data);
        setToken(data.token);
        setUser(data.user);
        setAuthMode("login");
        setRegisterForm({ businessName: "", email: "", password: "", industry: "" });
        setToast("Business profile created.");
        setView("profile");
        return;
      }
      const data = await request("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ ...registerForm, email })
      });
      saveSession(data);
      setToken(data.token);
      setUser(data.user);
      setAuthMode("login");
      setRegisterForm({ businessName: "", email: "", password: "", industry: "" });
      if (data.verificationToken) {
        setVerifyForm({ token: data.verificationToken });
        setModal({
          title: "Development Verification Token",
          paragraphs: ["Email delivery is not configured, so Parasara returned this token for local testing.", data.verificationToken]
        });
      }
      setToast(data.verificationToken ? "Business profile created. Verification token is ready." : "Business profile created.");
      setView("profile");
    } catch (error) {
      setToast(error.message);
    }
  }

  async function forgotPassword(event) {
    event.preventDefault();
    try {
      const data = await request("/api/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email: authForm.email })
      });
      if (data.resetToken) {
        setResetForm(previous => ({ ...previous, token: data.resetToken }));
        setModal({
          title: "Development Reset Token",
          paragraphs: ["Email delivery is not configured, so Parasara returned this token for local testing.", data.resetToken]
        });
      }
      setToast(data.resetToken ? "Reset token is ready." : "Password reset link sent if the account exists.");
      setAuthMode("reset");
    } catch (error) {
      setToast(error.message);
    }
  }

  async function verifyEmail(event) {
    event.preventDefault();
    try {
      await request("/api/auth/verify-email", {
        method: "POST",
        body: JSON.stringify(verifyForm)
      });
      setVerifyForm({ token: "" });
      setAuthMode("login");
      setToast("Email verified. You can sign in.");
    } catch (error) {
      setToast(error.message);
    }
  }

  async function resetPassword(event) {
    event.preventDefault();
    try {
      await request("/api/auth/reset-password", {
        method: "POST",
        body: JSON.stringify(resetForm)
      });
      setResetForm({ token: "", password: "" });
      setAuthMode("login");
      setToast("Password reset. Sign in with your new password.");
    } catch (error) {
      setToast(error.message);
    }
  }

  async function publishPromotion(event) {
    event.preventDefault();
    try {
      const data = await request("/api/promotions", {
        method: "POST",
        body: JSON.stringify({ ...draft, image: assetPreview })
      });
      setPromotions(previous => [data.promotion, ...previous]);
      setDraft(emptyDraft);
      setAssetPreview("");
      await request("/api/drafts/promotion", { method: "DELETE" });
      setView("marketplace");
      setToast("Promotion published.");
    } catch (error) {
      setToast(error.message);
    }
  }

  async function saveDraft() {
    try {
      await request("/api/drafts/promotion", {
        method: "PUT",
        body: JSON.stringify(draft)
      });
      setToast("Draft saved to MongoDB.");
    } catch (error) {
      setToast(error.message);
    }
  }

  async function connectBusiness(businessName) {
    try {
      const data = await request("/api/connections", {
        method: "POST",
        body: JSON.stringify({ businessName })
      });
      setConnections(previous => {
        const next = previous.filter(item => item.businessName !== businessName);
        return [data.connection, ...next];
      });
      setToast(`Connection request sent to ${businessName}.`);
    } catch (error) {
      setToast(error.message);
    }
  }

  async function openMessageBox(recipientBusinessName) {
    try {
      const data = await request(`/api/messages/${encodeURIComponent(recipientBusinessName)}`);
      setChat({ recipientBusinessName, messages: data.messages || [], contract: null });
      setChatAttachment(null);
    } catch (error) {
      setToast(error.message);
    }
  }

  async function openConversationBox(conversationId) {
    try {
      const data = await request(`/api/conversations/${conversationId}`);
      setConversationChat({ conversation: data.conversation, messages: data.messages || [] });
      setConversationInbox(previous => previous.map(item => item._id === data.conversation._id ? data.conversation : item));
      setConversationAttachment(null);
    } catch (error) {
      setToast(error.message);
    }
  }

  async function sendConversationMessage(event) {
    event.preventDefault();
    if (!conversationChat || (!conversationMessage.trim() && !conversationAttachment)) return;
    try {
      const data = await request(`/api/conversations/${conversationChat.conversation._id}/messages`, {
        method: "POST",
        body: JSON.stringify({ body: conversationMessage, attachment: conversationAttachment })
      });
      setConversationChat(previous => ({
        ...previous,
        conversation: data.conversation,
        messages: [...previous.messages, data.message]
      }));
      setConversationInbox(previous => previous.map(item => item._id === data.conversation._id ? data.conversation : item));
      setConversationMessage("");
      setConversationAttachment(null);
    } catch (error) {
      setToast(error.message);
    }
  }

  async function confirmReturnedPayment() {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("session_id");
    const paymentStatus = params.get("payment");

    if (paymentStatus === "cancelled") {
      window.history.replaceState({}, "", window.location.pathname);
      setToast("Payment cancelled. Contract was not offered.");
      return;
    }

    if (!sessionId) return;

    try {
      const data = await request("/api/payments/confirm", {
        method: "POST",
        body: JSON.stringify({ sessionId })
      });
      setChat({
        recipientBusinessName: data.contract.recipientBusinessName,
        contract: data.contract,
        messages: data.message ? [data.message] : []
      });
      setToast(data.manualPending ? "Payment reference submitted. Admin verification is pending." : "Payment complete. Contract offered.");
    } catch (error) {
      setToast(error.message);
    } finally {
      window.history.replaceState({}, "", window.location.pathname);
    }
  }

  function startContractPayment(promotion) {
    const amount = priceRank(promotion.price);
    setPaymentAmount(Number.isFinite(amount) && amount !== Number.MAX_SAFE_INTEGER ? amount.toFixed(2) : "50.00");
    setPaymentRecipients(promotion.title || "");
    setPaymentUpiId(user?.upiId || paymentUpiId || "");
    setPaymentDraft(promotion);
  }

  async function offerContract(event) {
    event.preventDefault();
    if (!paymentDraft) return;
    const amount = Number(paymentAmount);
    const recipients = paymentRecipients.split(/[\n,]+/).map(item => item.trim()).filter(Boolean);

    if (!Number.isFinite(amount) || amount < 1) {
      setToast("Enter a valid contract payment amount.");
      return;
    }
    if (!recipients.length) {
      setToast("Add at least one person or business to pay.");
      return;
    }
    if (paymentCurrency === "inr" && !paymentUpiId.trim()) {
      setToast("Enter your UPI ID before starting INR payment.");
      return;
    }

    try {
      const data = await request("/api/contracts", {
        method: "POST",
        body: JSON.stringify({
          recipientBusinessName: recipients[0],
          recipientBusinessNames: recipients,
          promotionTitle: paymentDraft.title,
          promotionId: paymentDraft._id,
          amount: Math.round(amount * 100),
          currency: paymentCurrency,
          payerUpiId: paymentUpiId
        })
      });
      setPaymentDraft(null);
      if (data.checkoutUrls?.length > 1) {
        setMultiCheckout(data);
        await loadApiData();
      } else if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        await loadApiData();
        setToast("Contracts created.");
      }
    } catch (error) {
      setToast(error.message);
    }
  }

  async function sendChatMessage(event) {
    event.preventDefault();
    if (!chat || (!chatMessage.trim() && !chatAttachment)) return;

    try {
      const data = await request("/api/messages", {
        method: "POST",
        body: JSON.stringify({
          recipientBusinessName: chat.recipientBusinessName,
          body: chatMessage,
          attachment: chatAttachment,
          contract: chat.contract?._id
        })
      });
      setChat(previous => ({ ...previous, messages: [...previous.messages, data.message] }));
      setChatMessage("");
      setChatAttachment(null);
      loadApiData();
    } catch (error) {
      setToast(error.message);
    }
  }

  async function updateContractStatus(id, status) {
    try {
      const data = await request(`/api/contracts/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status })
      });
      setContracts(previous => previous.map(item => (item._id === id ? data.contract : item)));
      setToast("Contract status updated.");
    } catch (error) {
      setToast(error.message);
    }
  }

  async function updateRequest(id, status) {
    try {
      const data = await request(`/api/requests/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status })
      });
      setRequests(previous => previous.map(item => (item._id === id ? data.request : item)));
      setToast(`Request ${status}.`);
    } catch (error) {
      setToast(error.message);
    }
  }

  function handleAsset(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!["image/png", "image/jpeg"].includes(file.type)) {
      setToast("Upload a PNG or JPG asset.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setToast("Asset must be 10MB or smaller.");
      return;
    }
    setAssetPreview(URL.createObjectURL(file));
    setToast("Asset preview ready.");
  }

  async function logout() {
    const refreshToken = readSessionValue(SESSION_KEYS.refresh, LEGACY_SESSION_KEYS.refresh);
    try {
      if (token) {
        await request("/api/auth/logout", {
          method: "POST",
          body: JSON.stringify({ refreshToken })
        });
      }
    } catch {
      // Local logout still completes when the server session has already expired.
    }
    try {
      await signOutFirebaseAuth();
    } catch {
      // Firebase sign-out is best-effort because the widget may not have been loaded.
    }
    clearSession();
    setToken("");
    setUser(null);
    setConnections([]);
    setRequests([]);
    setThreads([]);
    setContracts([]);
    setPayments([]);
    setAdBriefs([]);
    setOpenBriefs([]);
    setOpenAuctions([]);
    setExperts([]);
    setNotifications([]);
    setUnreadNotifications(0);
    setDraft(emptyDraft);
    setAssetPreview("");
    setView("dashboard");
    setToast("Signed out.");
  }

  function improveDraftLocally() {
    const nextTitle = draft.title.trim() || `${user?.industry || "Business"} Partner Campaign`;
    const nextPartner = draft.partner.trim() || partnerOptions[0];
    const nextAudience = draft.audience.trim() || audienceOptions[2];
    const nextDescription = draft.description.trim() || `${nextTitle} connects ${nextPartner.toLowerCase()} with a qualified audience through a ${draft.type.toLowerCase()} placement. The campaign is designed for measurable reach, clear co-branding, and a fast partner handoff.`;

    setDraft(previous => ({
      ...previous,
      title: nextTitle,
      partner: nextPartner,
      audience: nextAudience,
      description: nextDescription
    }));
    setView("post");
    setToast("Smart draft fields prepared.");
  }

  function showAssistantSummary() {
    const activeCount = promotions.filter(item => item.status === "Online").length;
    const bestNextStep = draft.title || draft.description ? "finish and publish your saved promotion draft" : "create a promotion listing";
    setModal({
      title: "Smart Business Summary",
      paragraphs: [
        `${user.businessName} has ${promotions.length} promotion listing${promotions.length === 1 ? "" : "s"}, ${connections.length} partner connection${connections.length === 1 ? "" : "s"}, and ${newRequests.length} new request${newRequests.length === 1 ? "" : "s"}.`,
        `Recommended next step: ${bestNextStep}, then message the strongest marketplace match before offering a paid contract.`
      ],
      items: [
        `${activeCount} listing${activeCount === 1 ? "" : "s"} currently online.`,
        `${dashboard.profileStrength}% profile strength.`,
        `${filteredPromotions.length} marketplace result${filteredPromotions.length === 1 ? "" : "s"} in the current filter.`
      ]
    });
  }

  function runAssistantAction(action) {
    if (action === "dashboard") setView("dashboard");
    if (action === "marketplace") {
      setView("marketplace");
      setFilter({ kind: "all", value: "All" });
      setSearch("");
      setSort("audience");
    }
    if (action === "auction") setView("auction");
    if (action === "post") setView("post");
    if (action === "profile") setView("profile");
    if (action === "settings") setView("settings");
    if (action === "messages") setView("messages");
    if (action === "contracts") setView("contracts");
    if (action === "tools") setView("tools");
    if (action === "online") {
      setView("post");
      setFilter({ kind: "status", value: "Online" });
      setSearch("");
      setSort("audience");
    }
    if (action === "lowest-price") {
      setView("post");
      setFilter({ kind: "all", value: "All" });
      setSearch("");
      setSort("price");
    }
    if (action === "story-brief") setStoryBriefOpen(true);
    if (action === "open-briefs") {
      setView("marketplace");
      setSearch("social");
      setFilter({ kind: "all", value: "All" });
    }
    if (action === "experts") {
      setView("marketplace");
      setSearch("expert");
      setFilter({ kind: "all", value: "All" });
    }
    if (action === "quotes") {
      setView("marketplace");
      setSearch("quote");
      setFilter({ kind: "all", value: "All" });
    }
    if (action === "notifications") showNotifications();
    if (action === "complete-draft") improveDraftLocally();
    if (action === "summary") showAssistantSummary();
    if (action === "message") {
      const target = promotions[0]?.title || connections[0]?.businessName || user.businessName;
      openMessageBox(target);
    }
    setAssistantOpen(false);
  }

  const connectedNames = useMemo(() => new Set(connections.map(item => item.businessName)), [connections]);
  const newRequests = useMemo(() => requests.filter(item => item.status === "new"), [requests]);
  const searchResults = useMemo(() => {
    const query = globalSearch.trim().toLowerCase();
    if (!query) return [];

    const records = [
      ...promotions.map(item => ({ type: "Promotion", title: item.title, detail: `${item.type} - ${item.audience}`, view: "post", search: item.title, haystack: [item.title, item.type, item.partner, item.audience, item.status, item.description].join(" ") })),
      ...experts.map(item => ({ type: "Expert", title: item.businessName, detail: item.expertise || item.industry, view: "marketplace", search: item.businessName, haystack: [item.businessName, item.expertise, item.industry, item.location, ...socialFields.map(([key]) => item[key])].join(" ") })),
      ...adBriefs.map(item => ({ type: item.isAuction ? "My Auction" : "My Brief", title: item.brandName, detail: `${getBriefLabel(item)} - ${item.status}`, view: item.isAuction ? "auction" : "marketplace", search: item.brandName, haystack: [item.brandName, item.platform, item.format, getBriefHandle(item), item.goal, item.targetAudience, item.city, item.language, item.status, item.isAuction ? "auction bid urgent fast" : ""].join(" ") })),
      ...openBriefs.map(item => ({ type: "Open Brief", title: item.brandName, detail: `${getBriefLabel(item)} - ${item.budget}`, view: "marketplace", search: item.brandName, haystack: [item.brandName, item.platform, item.format, getBriefHandle(item), item.goal, item.targetAudience, item.city, item.language, item.budget].join(" ") })),
      ...openAuctions.map(item => ({ type: "Live Auction", title: item.brandName, detail: `${getBriefLabel(item)} - ${item.budget}`, view: "auction", search: item.brandName, haystack: [item.brandName, item.platform, item.format, getBriefHandle(item), item.goal, item.targetAudience, item.city, item.language, item.budget, item.urgency, "auction bid"].join(" ") })),
      ...threads.map(item => ({ type: "Inbox", title: item.recipientBusinessName, detail: item.lastMessage || "Conversation", view: "messages", search: item.recipientBusinessName, haystack: [item.recipientBusinessName, item.lastMessage].join(" ") })),
      ...contracts.map(item => ({ type: "Deal", title: item.recipientBusinessName, detail: `${item.status} - ${item.paymentStatus}`, view: "contracts", search: item.recipientBusinessName, haystack: [item.recipientBusinessName, item.promotionTitle, item.status, item.paymentStatus].join(" ") })),
      ...payments.map(item => ({ type: "Payment", title: item.recipientBusinessName, detail: `${item.status} - ${item.currency}`, view: "contracts", search: item.recipientBusinessName, haystack: [item.recipientBusinessName, item.status, item.currency, item.providerSessionId].join(" ") })),
      ...notifications.map(item => ({ type: "Notification", title: item.title, detail: item.body, view: "dashboard", search: item.title, haystack: [item.title, item.body, item.type].join(" ") }))
    ];

    return records
      .filter(item => item.haystack.toLowerCase().includes(query))
      .slice(0, 8);
  }, [adBriefs, contracts, experts, globalSearch, notifications, openAuctions, openBriefs, payments, promotions, threads]);

  function openSearchResult(result) {
    setView(result.view);
    if (result.view === "marketplace") {
      setFilter({ kind: "all", value: "All" });
      setSearch(result.search || globalSearch);
    }
    if (result.view === "post") {
      setFilter({ kind: "all", value: "All" });
      setSearch(result.search || globalSearch);
    }
    setGlobalSearch("");
  }
  function toggleSavedItem(id) {
    setSavedItems(previous => previous.includes(id) ? previous.filter(item => item !== id) : [id, ...previous]);
  }

  function isPinnedWork(type, id) {
    return pinnedWork.some(item => item.key === workKey(type, id));
  }

  function togglePinnedWork(item) {
    const key = workKey(item.type, item.id);
    setPinnedWork(previous => previous.some(entry => entry.key === key)
      ? previous.filter(entry => entry.key !== key)
      : [{ ...item, key, pinnedAt: new Date().toISOString() }, ...previous]);
  }

  async function setWorkReminder(item) {
    const initialValue = new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 16);
    const reminderAt = await askText({ title: "Set Reminder", label: "Reminder time (YYYY-MM-DDTHH:mm)", initialValue, required: true });
    if (!reminderAt) return;
    const due = new Date(reminderAt);
    if (Number.isNaN(due.getTime())) {
      setToast("Use a valid reminder time.");
      return;
    }
    const key = workKey(item.type, item.id);
    setPinnedWork(previous => {
      const nextItem = { ...item, key, reminderAt: due.toISOString(), notifiedAt: "" };
      return previous.some(entry => entry.key === key)
        ? previous.map(entry => entry.key === key ? { ...entry, ...nextItem } : entry)
        : [nextItem, ...previous];
    });
    setToast("Reminder set.");
  }

  function removePinnedWork(key) {
    setPinnedWork(previous => previous.filter(item => item.key !== key));
  }

  function openPinnedWork(item) {
    if (item.view) setView(item.view);
    else if (item.type === "auction") setView("auction");
    else setView("marketplace");
  }

  const filteredPromotions = useMemo(() => promotions.filter(item => {
    const matchesFilter =
      filter.kind === "all" ||
      (filter.kind === "status" && item.status === filter.value) ||
      (filter.kind === "type" && item.type === filter.value);
    const price = priceRank(item.price);
    const matchesBudget =
      marketFilters.budget === "all" ||
      (marketFilters.budget === "under100" && price < 100) ||
      (marketFilters.budget === "100to500" && price >= 100 && price <= 500) ||
      (marketFilters.budget === "500plus" && price > 500) ||
      price === Number.MAX_SAFE_INTEGER;
    const deliveryText = [item.title, item.partner, item.audience, item.type, item.status, item.description].join(" ").toLowerCase();
    const matchesDelivery =
      marketFilters.delivery === "all" ||
      (marketFilters.delivery === "fast" && /(fast|24|48|instant|quick|weekly)/.test(deliveryText)) ||
      (marketFilters.delivery === "scheduled" && /(scheduled|date|event|monthly|quarterly)/.test(deliveryText)) ||
      (marketFilters.delivery === "verified" && item.status === "Online");
    const matchesLanguage = marketFilters.language === "all" || deliveryText.includes(marketFilters.language.toLowerCase());
    const matchesSaved = !marketFilters.savedOnly || savedItems.includes(item._id);
    const matchesSearch = deliveryText.includes(search.toLowerCase());
    return matchesFilter && matchesBudget && matchesDelivery && matchesLanguage && matchesSaved && matchesSearch;
  }).sort((a, b) => {
    if (sort === "audience") return audienceRank(b.audience) - audienceRank(a.audience);
    if (sort === "price") return priceRank(a.price) - priceRank(b.price);
    if (sort === "name") return a.title.localeCompare(b.title);
    if (sort === "type") return a.type.localeCompare(b.type);
    return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
  }), [filter, marketFilters, promotions, savedItems, search, sort]);

  if (!authed) {
    return (
      <>
        <Toast message={toast} />
        <InfoModal modal={modal} close={() => setModal(null)} />
        <main className="login-shell">
          <section className="login-panel glass">
            <Brand large />
            <div className="login-copy">
              <h1>Welcome Back</h1>
              <p>Sign in to your professional account to continue networking.</p>
            </div>
            {authMode === "login" ? (
              <form className="form-stack" onSubmit={login}>
                <label>
                  <span>Business email address</span>
                  <input type="email" value={authForm.email} onChange={event => setAuthForm({ ...authForm, email: event.target.value })} maxLength="160" required />
                </label>
                <label>
                  <span>Password <a href="#" onClick={forgotPassword}>Forgot password?</a></span>
                  <input type="password" value={authForm.password} onChange={event => setAuthForm({ ...authForm, password: event.target.value })} minLength="8" maxLength="128" required />
                </label>
                <button className="btn primary" type="submit">Sign In to Parasara -&gt;</button>
              </form>
            ) : authMode === "register" ? (
              <form className="form-stack" onSubmit={register}>
                <label>
                  <span>Business name</span>
                  <input value={registerForm.businessName} onChange={event => setRegisterForm({ ...registerForm, businessName: event.target.value })} maxLength="120" required />
                </label>
                <label>
                  <span>Industry</span>
                  <input value={registerForm.industry} onChange={event => setRegisterForm({ ...registerForm, industry: event.target.value })} maxLength="80" required />
                </label>
                <label>
                  <span>Business email address</span>
                  <input type="email" value={registerForm.email} onChange={event => setRegisterForm({ ...registerForm, email: event.target.value })} maxLength="160" required />
                </label>
                <label>
                  <span>Password</span>
                  <input type="password" value={registerForm.password} onChange={event => setRegisterForm({ ...registerForm, password: event.target.value })} minLength="8" maxLength="128" required />
                </label>
                <button className="btn primary" type="submit">Create Business Profile</button>
              </form>
            ) : authMode === "verify" ? (
              <form className="form-stack" onSubmit={verifyEmail}>
                <label>
                  <span>Email verification token</span>
                  <input value={verifyForm.token} onChange={event => setVerifyForm({ token: event.target.value })} maxLength="240" required />
                </label>
                <button className="btn primary" type="submit">Verify Email</button>
              </form>
            ) : (
              <form className="form-stack" onSubmit={resetPassword}>
                <label>
                  <span>Password reset token</span>
                  <input value={resetForm.token} onChange={event => setResetForm({ ...resetForm, token: event.target.value })} maxLength="240" required />
                </label>
                <label>
                  <span>New password</span>
                  <input type="password" value={resetForm.password} onChange={event => setResetForm({ ...resetForm, password: event.target.value })} minLength="8" maxLength="128" required />
                </label>
                <button className="btn primary" type="submit">Reset Password</button>
              </form>
            )}
            <FirebaseAuthPanel onSession={handleFirebaseSession} setToast={setToast} />
            <p className="signup-line">
              {authMode === "login" ? "New to Parasara? " : "Already have an account? "}
              <button onClick={() => setAuthMode(authMode === "login" ? "register" : "login")} type="button">{authMode === "login" ? "Create a business profile" : "Sign in"}</button>
              <button onClick={() => setAuthMode("verify")} type="button">Verify email</button>
              <button onClick={() => setAuthMode("reset")} type="button">Reset password</button>
            </p>
            <footer className="login-links">
              <a href="#" onClick={event => showInfo(event, setModal, "privacy")}>Privacy Policy</a>
              <a href="#" onClick={event => showInfo(event, setModal, "terms")}>Terms of Service</a>
              <a href="#" onClick={event => showInfo(event, setModal, "support")}>Support</a>
            </footer>
          </section>
        </main>
      </>
    );
  }

  return (
    <>
      <Toast message={toast} />
      <InfoModal modal={modal} close={() => setModal(null)} />
      <PromptModal modal={promptModal} setModal={setPromptModal} close={closePrompt} />
      <NotificationCenter open={notificationCenterOpen} close={() => setNotificationCenterOpen(false)} notifications={notifications} filter={notificationFilter} setFilter={setNotificationFilter} openAction={openNotificationAction} />
      <MessageBox chat={chat} close={() => setChat(null)} message={chatMessage} setMessage={setChatMessage} attachment={chatAttachment} setAttachment={setChatAttachment} send={sendChatMessage} setToast={setToast} />
      <ConversationBox chat={conversationChat} close={() => setConversationChat(null)} message={conversationMessage} setMessage={setConversationMessage} attachment={conversationAttachment} setAttachment={setConversationAttachment} send={sendConversationMessage} setToast={setToast} />
      <PaymentModal promotion={paymentDraft} amount={paymentAmount} setAmount={setPaymentAmount} recipients={paymentRecipients} setRecipients={setPaymentRecipients} currency={paymentCurrency} setCurrency={setPaymentCurrency} payerUpiId={paymentUpiId} setPayerUpiId={setPaymentUpiId} close={() => setPaymentDraft(null)} submit={offerContract} />
      <MultiCheckoutModal checkout={multiCheckout} close={() => setMultiCheckout(null)} />
      <StoryBriefModal open={storyBriefOpen} close={() => setStoryBriefOpen(false)} brief={storyBrief} setBrief={setStoryBrief} submit={submitStoryBrief} />
      <QuoteModal target={quoteTarget} close={() => setQuoteTarget(null)} quote={quoteForm} setQuote={setQuoteForm} submit={submitQuote} />
      <ProofModal target={proofTarget} close={() => setProofTarget(null)} proof={proofForm} setProof={setProofForm} submit={submitProof} />
      <BriefWorkspaceModal workspace={briefWorkspace} close={() => setBriefWorkspace(null)} acceptQuote={acceptQuote} requestQuoteRevision={requestQuoteRevision} proposeCounter={proposeCounter} />
      <SmartAssistant
        open={assistantOpen}
        close={() => setAssistantOpen(false)}
        view={view}
        promotions={promotions}
        connections={connections}
        newRequests={newRequests}
        draft={draft}
        profileStrength={dashboard.profileStrength}
        adBriefs={adBriefs}
        openBriefs={openBriefs}
        experts={experts}
        notifications={notifications}
        unreadNotifications={unreadNotifications}
        runAction={runAssistantAction}
      />
      <div className="app-shell">
        <header className="topbar glass">
          <button className="avatar" onClick={() => setView("profile")} type="button">{userInitials(user)}</button>
          <button className="brand-lockup compact" onClick={() => setView("dashboard")} type="button" aria-label="Parasara dashboard"><img className="brand-logo mark" src={LOGO_MARK_SRC} alt="" /><span>Parasara</span></button>
          <div className="global-search">
            <input value={globalSearch} onChange={event => setGlobalSearch(event.target.value)} placeholder="Search experts, briefs, deals..." type="search" />
            {searchResults.length ? (
              <div className="search-results glass">
                {searchResults.map(result => (
                  <button key={`${result.type}-${result.title}-${result.detail}`} onClick={() => openSearchResult(result)} type="button">
                    <span>{result.type}</span>
                    <strong>{result.title}</strong>
                    <small>{result.detail}</small>
                  </button>
                ))}
              </div>
            ) : globalSearch.trim() ? <div className="search-results glass empty-search">No matches</div> : null}
          </div>
          <span className="session-user">{user.businessName}</span>
          <button className="btn ai-nav-btn" onClick={() => setAssistantOpen(true)} type="button">AI Guide</button>
          <button className="icon-btn notify-btn" onClick={showNotifications} type="button">!{unreadNotifications ? <span>{unreadNotifications}</span> : null}</button>
          <button className="btn outline logout-btn" onClick={logout} type="button">Logout</button>
        </header>
        <div className="desktop-layout">
          <Nav view={view} setView={setView} desktop />
          <div className="content-frame">
            {view === "dashboard" && (
              <Dashboard
                profileStrength={dashboard.profileStrength}
                promotions={promotions}
                activePromotions={dashboard.activePromotions}
                dashboard={dashboard}
                adminSummary={adminSummary}
                adminReviewQueue={adminReviewQueue}
                adminSystemStatus={adminSystemStatus}
                analytics={analytics}
                shortlists={shortlists}
                runAdminJobs={runAdminJobs}
                resolveAdminDispute={resolveAdminDispute}
                newRequests={newRequests}
                connectedNames={connectedNames}
                setView={setView}
                connectBusiness={connectBusiness}
                updateRequest={updateRequest}
                loading={loading}
                user={user}
                openStoryBrief={() => setStoryBriefOpen(true)}
              />
            )}
            {view === "post" && (
              <PostPromotion
                draft={draft}
                setDraft={setDraft}
                publishPromotion={publishPromotion}
                saveDraft={saveDraft}
                handleAsset={handleAsset}
                assetPreview={assetPreview}
                promotions={filteredPromotions}
                filter={filter}
                setFilter={setFilter}
                marketFilters={marketFilters}
                setMarketFilters={setMarketFilters}
                search={search}
                setSearch={setSearch}
                sort={sort}
                setSort={setSort}
                setView={setView}
                connectBusiness={connectBusiness}
                connectedNames={connectedNames}
                offerContract={startContractPayment}
                openMessageBox={openMessageBox}
                savedItems={savedItems}
                savedSearches={savedSearches}
                pinnedWork={pinnedWork}
                shortlists={shortlists}
                saveCurrentSearch={saveCurrentSearch}
                applySavedSearch={applySavedSearch}
                removeSavedSearch={id => setSavedSearches(previous => previous.filter(item => item.id !== id))}
                toggleSavedItem={toggleSavedItem}
                openStoryBrief={() => setStoryBriefOpen(true)}
                adBriefs={adBriefs}
                acceptQuote={acceptQuote}
                requestQuoteRevision={requestQuoteRevision}
                proposeCounter={proposeCounter}
                respondCounter={respondCounter}
                shortlistQuote={shortlistQuote}
                actionBusy={actionBusy}
                payEscrow={payEscrow}
                openProof={brief => {
                  setProofTarget(brief);
                  setProofForm({
                    proofLink: brief.proofLink || "",
                    proofNotes: brief.proofNotes || "",
                    proofReach: brief.proofReach || "",
                    proofClicks: brief.proofClicks || "",
                    proofScreenshot: brief.proofScreenshot || "",
                    proofMetrics: brief.proofMetrics || {}
                  });
                }}
                reviewProof={reviewProof}
                disputeBrief={disputeBrief}
                rateBrief={rateBrief}
              />
            )}
            {view === "marketplace" && (
              <Marketplace
                promotions={filteredPromotions}
                filter={filter}
                setFilter={setFilter}
                marketFilters={marketFilters}
                setMarketFilters={setMarketFilters}
                search={search}
                setSearch={setSearch}
                sort={sort}
                setSort={setSort}
                setView={setView}
                connectBusiness={connectBusiness}
                connectedNames={connectedNames}
                offerContract={startContractPayment}
                openMessageBox={openMessageBox}
                savedItems={savedItems}
                savedSearches={savedSearches}
                pinnedWork={pinnedWork}
                saveCurrentSearch={saveCurrentSearch}
                applySavedSearch={applySavedSearch}
                removeSavedSearch={id => setSavedSearches(previous => previous.filter(item => item.id !== id))}
                toggleSavedItem={toggleSavedItem}
                isPinnedWork={isPinnedWork}
                togglePinnedWork={togglePinnedWork}
                setWorkReminder={setWorkReminder}
                removePinnedWork={removePinnedWork}
                openPinnedWork={openPinnedWork}
                adBriefs={adBriefs}
                openBriefs={openBriefs}
                experts={experts}
                viewExpertProfile={viewExpertProfile}
                saveExpertToShortlist={saveExpertToShortlist}
                openStoryBrief={() => setStoryBriefOpen(true)}
                openQuote={brief => {
                  setQuoteTarget(brief);
                  setQuoteForm({ ...emptyQuote, expertName: user.businessName || "" });
                }}
                inviteExpert={inviteExpert}
                requestQuoteRevision={requestQuoteRevision}
                proposeCounter={proposeCounter}
                respondCounter={respondCounter}
                shortlistQuote={shortlistQuote}
                actionBusy={actionBusy}
                acceptQuote={acceptQuote}
                payEscrow={payEscrow}
                openProof={brief => {
                  setProofTarget(brief);
                  setProofForm({
                    proofLink: brief.proofLink || "",
                    proofNotes: brief.proofNotes || "",
                    proofReach: brief.proofReach || "",
                    proofClicks: brief.proofClicks || "",
                    proofScreenshot: brief.proofScreenshot || "",
                    proofMetrics: brief.proofMetrics || {}
                  });
                }}
                reviewProof={reviewProof}
                disputeBrief={disputeBrief}
                rateBrief={rateBrief}
              />
            )}
            {view === "auction" && (
              <AuctionCenter
                openAuctions={openAuctions}
                adBriefs={adBriefs}
                isPinnedWork={isPinnedWork}
                togglePinnedWork={togglePinnedWork}
                setWorkReminder={setWorkReminder}
                openStoryBrief={() => setStoryBriefOpen(true)}
                openQuote={brief => {
                  setQuoteTarget(brief);
                  setQuoteForm({ ...emptyQuote, expertName: user.businessName || "" });
                }}
                requestQuoteRevision={requestQuoteRevision}
                proposeCounter={proposeCounter}
                respondCounter={respondCounter}
                shortlistQuote={shortlistQuote}
                closeAuction={closeAuction}
                actionBusy={actionBusy}
                acceptQuote={acceptQuote}
                payEscrow={payEscrow}
                openProof={brief => {
                  setProofTarget(brief);
                  setProofForm({
                    proofLink: brief.proofLink || "",
                    proofNotes: brief.proofNotes || "",
                    proofReach: brief.proofReach || "",
                    proofClicks: brief.proofClicks || "",
                    proofScreenshot: brief.proofScreenshot || "",
                    proofMetrics: brief.proofMetrics || {}
                  });
                }}
                reviewProof={reviewProof}
                disputeBrief={disputeBrief}
                rateBrief={rateBrief}
              />
            )}
            {view === "tools" && (
              <GrowthTools
                setView={setView}
                openStoryBrief={() => setStoryBriefOpen(true)}
                openMessageBox={openMessageBox}
                dashboard={dashboard}
                analytics={analytics}
                promotions={promotions}
                experts={experts}
                adBriefs={adBriefs}
                openBriefs={openBriefs}
                notifications={notifications}
                threads={threads}
                user={user}
              />
            )}
            {view === "messages" && <MessageCenter threads={threads} conversations={conversationInbox} openMessageBox={openMessageBox} openConversationBox={openConversationBox} />}
            {view === "expert" && <ExpertInbox inbox={expertInbox} openQuote={brief => { setQuoteTarget(brief); setQuoteForm({ ...emptyQuote, expertName: user.businessName || "" }); }} respondInvitation={respondInvitation} openBriefWorkspace={openBriefWorkspace} withdrawQuote={withdrawQuote} />}
            {view === "contracts" && <ContractsCenter contracts={contracts} payments={payments} adBriefs={adBriefs} updateContractStatus={updateContractStatus} openMessageBox={openMessageBox} viewContractDocument={viewContractDocument} adminPaymentAction={adminPaymentAction} isAdmin={user.role === "admin"} />}
            {view === "profile" && <Profile setModal={setModal} user={user} connections={connections} promotions={promotions} savedItems={savedItems} openMessageBox={openMessageBox} profileForm={profileForm} setProfileForm={setProfileForm} saveProfile={saveProfile} />}
            {view === "settings" && <AppSettings settings={appSettings} setSettings={setAppSettings} user={user} />}
          </div>
        </div>
        <Nav view={view} setView={setView} />
      </div>
    </>
  );
}

function SmartAssistant({ open, close, view, promotions, connections, newRequests, draft, profileStrength, adBriefs, openBriefs, experts, notifications, unreadNotifications, runAction }) {
  const [assistantSearch, setAssistantSearch] = useState("");

  if (!open) return null;

  const viewNames = {
    dashboard: "Dashboard",
    marketplace: "Marketplace",
    auction: "Auction",
    post: "Create Promotion",
    messages: "Message Center",
    contracts: "Contracts",
    profile: "Profile",
    settings: "Settings",
    tools: "Growth Tools",
  };
  const draftReady = Boolean(draft.title && draft.description && draft.audience && draft.partner);
  const primaryTip = draftReady
    ? "Your promotion draft has the core fields ready. Review the media asset and publish when the offer is clear."
    : "Complete a promotion draft first, then use marketplace filters to find the strongest paid contract match.";

  const actions = [
    ["post", "How to post an advertisement?", "Create a listing with ad type, audience, media, and ideal partner details."],
    ["story-brief", "Promote on Social Media", "Post a requirement so social media experts can send prices and timelines."],
    ["tools", "AI toolkit", "Open AI Studio, campaign launch, Auto-DMs, influencer matching, and insights."],
    ["auction", "Fast auction room", "Open live urgent campaigns where experts can place bids and buyers can award work."],
    ["experts", "Find ad experts", "Search verified experts for TV, Instagram, YouTube, TikTok, outdoor, print, and digital ads."],
    ["quotes", "How do quotes work?", "Review buyer briefs, receive quotes, accept one expert, then pay through escrow."],
    ["messages", "Messages and contracts", "Open conversations, continue deal discussions, and track payment status."],
    ["profile", "Profile setup", "Add your social handles, ad expertise, location, and business details."],
    ["settings", "App settings", "Change dark mode, default currency, region, date format, and compact display."],
    ["notifications", "Notifications", "Check new quote, proof, payment, and contract updates."],
    ["marketplace", "Find Best Partners", "Open marketplace with largest audience sorting."],
    ["open-briefs", "Open Buyer Briefs", "Show requirements experts can quote on."],
    ["online", "Show Online Listings", "Filter to partners currently available."],
    ["lowest-price", "Lowest Price First", "Find contract options with the lowest listed cost."],
    ["complete-draft", "Prepare Promotion Draft", "Fill missing draft fields with a polished local suggestion."],
    ["message", "Open Message Box", "Start or continue a partner conversation."],
    ["messages", "Message Center", "Review all partner conversations."],
    ["contracts", "Track Contracts", "Review contract and payment status."],
    ["summary", "Account Summary", "Show a quick local summary of current progress."]
  ];
  const assistantQuery = assistantSearch.trim().toLowerCase();
  const filteredActions = actions.filter(([, title, detail]) => {
    if (!assistantQuery) return true;
    return `${title} ${detail}`.toLowerCase().includes(assistantQuery);
  });
  const smartAnswer = assistantQuery
    ? getAssistantAnswer(assistantQuery, filteredActions.length)
    : "Search an action or choose a shortcut below. I can guide posting, expert discovery, social media briefs, contracts, payments, and profile setup.";

  return (
    <div className="modal" role="dialog" aria-modal="true" onClick={close}>
      <section className="modal-card glass assistant-panel" onClick={event => event.stopPropagation()}>
        <button className="round ghost modal-close" onClick={close} type="button" aria-label="Close smart guide">x</button>
        <span className="assistant-kicker">Local AI Navigation</span>
        <h2>Smart Guide</h2>
        <p>{primaryTip}</p>
        <div className="assistant-stats">
          <article><strong>{viewNames[view]}</strong><span>Current view</span></article>
          <article><strong>{experts.length}</strong><span>Experts</span></article>
          <article><strong>{openBriefs.length}</strong><span>Open briefs</span></article>
          <article><strong>{profileStrength}%</strong><span>Profile</span></article>
        </div>
        {newRequests.length ? <p className="assistant-alert">{newRequests.length} partner request{newRequests.length === 1 ? "" : "s"} need your review.</p> : null}
        {unreadNotifications ? <p className="assistant-alert">{unreadNotifications} unread notification{unreadNotifications === 1 ? "" : "s"} from quotes, briefs, payments, or proof uploads.</p> : null}
        <div className="assistant-insights">
          <article><strong>{adBriefs.length}</strong><span>Your social briefs</span></article>
          <article><strong>{promotions.length}</strong><span>Promotion listings</span></article>
          <article><strong>{connections.length}</strong><span>Connections</span></article>
          <article><strong>{notifications.length}</strong><span>Total updates</span></article>
        </div>
        <div className="assistant-actions">
          <button className={`assistant-route ${view === "dashboard" ? "active" : ""}`} onClick={() => runAction("dashboard")} type="button">Dashboard</button>
          <button className={`assistant-route ${view === "marketplace" ? "active" : ""}`} onClick={() => runAction("marketplace")} type="button">Market</button>
          <button className={`assistant-route ${view === "post" ? "active" : ""}`} onClick={() => runAction("post")} type="button">Post</button>
          <button className={`assistant-route ${view === "messages" ? "active" : ""}`} onClick={() => runAction("messages")} type="button">Inbox</button>
          <button className={`assistant-route ${view === "contracts" ? "active" : ""}`} onClick={() => runAction("contracts")} type="button">Deals</button>
          <button className={`assistant-route ${view === "tools" ? "active" : ""}`} onClick={() => runAction("tools")} type="button">Tools</button>
          <button className={`assistant-route ${view === "profile" ? "active" : ""}`} onClick={() => runAction("profile")} type="button">Profile</button>
          <button className={`assistant-route ${view === "settings" ? "active" : ""}`} onClick={() => runAction("settings")} type="button">Settings</button>
        </div>
        <label className="assistant-search">
          <span>Search AI options</span>
          <input value={assistantSearch} onChange={event => setAssistantSearch(event.target.value)} placeholder="Search posting, social media, experts, messages..." type="search" />
        </label>
        <p className="assistant-answer">{smartAnswer}</p>
        <div className="assistant-grid">
          {filteredActions.length ? filteredActions.map(([id, title, detail]) => (
            <button className="assistant-card" key={`${id}-${title}`} onClick={() => runAction(id)} type="button">
              <strong>{title}</strong>
              <span>{detail}</span>
            </button>
          )) : <article className="assistant-empty">No AI option matches that search.</article>}
        </div>
      </section>
    </div>
  );
}

function getAssistantAnswer(query, count) {
  if (/instagram|facebook|youtube|linkedin|twitter|tiktok|snapchat|pinterest|whatsapp|telegram|story|reel|social/.test(query)) return "For social media promotion, choose Promote on Social Media. Pick the platform, add a handle or URL, budget, audience, language, date, and creative link so experts can quote.";
  if (/post|advertisement|ad|listing|publish/.test(query)) return "To post an advertisement, open Post, fill core details, select ad type and audience, upload media, then publish or save as draft.";
  if (/expert|tv|channel|creator|agency|buyer/.test(query)) return "To find experts, open Market and use filters for ad type, budget, delivery, language, and saved listings.";
  if (/contract|payment|deal|escrow/.test(query)) return "Contract flow is: choose partner, offer contract, pay checkout, message partner, track timeline, upload proof, then rate the work.";
  if (/settings|dark|currency|region|compact|date/.test(query)) return "Use Settings to change dark mode, default currency, region, date format, and compact display.";
  if (/profile|mode|buyer|service/.test(query)) return "Use Profile to choose Buyer, Expert, or Both mode and add your ad expertise plus social handles.";
  return count ? `${count} matching AI option${count === 1 ? "" : "s"} found. Choose one to jump to the right screen.` : "No direct match yet. Try words like social, post, expert, contract, payment, profile, or message.";
}

function Brand({ large = false }) {
  return <div className={`brand-lockup ${large ? "large" : "compact"}`}><img className="brand-logo" src={LOGO_SRC} alt="Parasara Media Marketplace" /></div>;
}

function Toast({ message }) {
  return <div className={`toast ${message ? "show" : ""}`} role="status">{message}</div>;
}

function InfoModal({ modal, close }) {
  if (!modal) return null;
  return (
    <div className="modal" role="dialog" aria-modal="true" onClick={close}>
      <section className="modal-card glass" onClick={event => event.stopPropagation()}>
        <button className="round ghost modal-close" onClick={close} type="button" aria-label="Close window">x</button>
        <h2>{modal.title}</h2>
        {modal.paragraphs?.map(text => <p key={text}>{text}</p>)}
        {modal.items?.length ? (
          <ul>
            {modal.items.map(item => {
              const normalized = typeof item === "string" ? { key: item, label: item } : item;
              return (
                <li key={normalized.key || normalized.label}>
                  <span>{normalized.label}</span>
                  {normalized.onClick ? <button className="inline-action" onClick={() => { close(); normalized.onClick(); }} type="button">{normalized.actionLabel || "Open"}</button> : null}
                </li>
              );
            })}
          </ul>
        ) : null}
      </section>
    </div>
  );
}

function PromptModal({ modal, setModal, close }) {
  if (!modal) return null;
  function submit(event) {
    event.preventDefault();
    const value = modal.value.trim();
    if (modal.required && !value) return;
    close(value);
  }

  return (
    <div className="modal" role="dialog" aria-modal="true" onClick={() => close("")}>
      <form className="modal-card glass payment-box" onSubmit={submit} onClick={event => event.stopPropagation()}>
        <button className="round ghost modal-close" onClick={() => close("")} type="button" aria-label="Close input">x</button>
        <h2>{modal.title}</h2>
        <label className="prompt-field">
          <span>{modal.label}</span>
          {modal.multiline ? (
            <textarea value={modal.value} onChange={event => setModal({ ...modal, value: event.target.value })} rows="5" maxLength="700" autoFocus required={modal.required} />
          ) : (
            <input value={modal.value} onChange={event => setModal({ ...modal, value: event.target.value })} maxLength="160" autoFocus required={modal.required} />
          )}
        </label>
        <div className="quote-actions">
          <button className="btn outline" onClick={() => close("")} type="button">Cancel</button>
          <button className="btn primary" type="submit">Continue</button>
        </div>
      </form>
    </div>
  );
}

function NotificationCenter({ open, close, notifications, filter, setFilter, openAction }) {
  if (!open) return null;
  const tabs = [
    ["all", "All"],
    ["unread", "Unread"],
    ["brief", "Briefs"],
    ["quote", "Quotes"],
    ["payment", "Payments"],
    ["proof", "Proof"],
    ["invite", "Invites"]
  ];
  const filtered = notifications.filter(item => {
    if (filter === "all") return true;
    if (filter === "unread") return !item.read;
    return item.type === filter || item.linkType === filter;
  });

  return (
    <div className="modal" role="dialog" aria-modal="true" onClick={close}>
      <section className="modal-card glass notification-panel" onClick={event => event.stopPropagation()}>
        <button className="round ghost modal-close" onClick={close} type="button" aria-label="Close notifications">x</button>
        <h2>Notifications</h2>
        <div className="tab-row">
          {tabs.map(([id, label]) => <button key={id} className={filter === id ? "active" : ""} onClick={() => setFilter(id)} type="button">{label}</button>)}
        </div>
        <div className="notification-list">
          {filtered.length ? filtered.map(item => (
            <article className={`notification-item ${item.read ? "" : "unread"}`} key={item._id}>
              <div>
                <span>{item.type || "activity"}</span>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
                <small>{item.createdAt ? new Date(item.createdAt).toLocaleString() : ""}</small>
              </div>
              {item.actionLabel || item.linkType === "brief" || item.actionView ? <button className="btn outline" onClick={() => openAction(item)} type="button">{item.actionLabel || "Open"}</button> : null}
            </article>
          )) : <article className="market-empty">No notifications in this filter.</article>}
        </div>
      </section>
    </div>
  );
}

function AttachmentLink({ attachment }) {
  if (!attachment?.url) return null;
  return (
    <a className="attachment-link" href={attachment.url} target="_blank" rel="noreferrer">
      <strong>{attachmentKind(attachment.type)}</strong>
      <span>{attachment.name || "Attached file"}{attachment.size ? ` - ${formatFileSize(attachment.size)}` : ""}</span>
    </a>
  );
}

async function pickMessageAttachment(event, setAttachment, setToast) {
  const file = event.target.files?.[0];
  event.target.value = "";
  if (!file) return;
  try {
    setAttachment(await readAttachmentFile(file));
  } catch (error) {
    setToast(error.message);
  }
}

function AttachmentDraft({ attachment, setAttachment }) {
  if (!attachment) return null;
  return (
    <div className="attachment-draft">
      <span>{attachmentKind(attachment.type)}: {attachment.name} {attachment.size ? `(${formatFileSize(attachment.size)})` : ""}</span>
      <button className="btn outline" onClick={() => setAttachment(null)} type="button">Remove</button>
    </div>
  );
}

function MessageBox({ chat, close, message, setMessage, attachment, setAttachment, send, setToast }) {
  if (!chat) return null;

  return (
    <div className="modal" role="dialog" aria-modal="true" onClick={close}>
      <section className="modal-card glass message-box" onClick={event => event.stopPropagation()}>
        <button className="round ghost modal-close" onClick={close} type="button" aria-label="Close message window">x</button>
        <h2>Message {chat.recipientBusinessName}</h2>
        <p>{chat.contract ? "Contract discussion is open for this partner." : "Send a message to this partner."}</p>
        <div className="message-thread">
          {chat.messages.length ? chat.messages.map(item => (
            <article className={`message-bubble ${item.direction}`} key={item._id}>
              {item.body ? <p>{item.body}</p> : null}
              <AttachmentLink attachment={item.attachment} />
              <span>{new Date(item.createdAt).toLocaleString()}</span>
            </article>
          )) : <article className="market-empty">No messages yet. Start the conversation below.</article>}
        </div>
        <form className="message-form" onSubmit={send}>
          <textarea value={message} onChange={event => setMessage(event.target.value)} rows="4" maxLength="1000" placeholder="Write your message..." required={!attachment} />
          <AttachmentDraft attachment={attachment} setAttachment={setAttachment} />
          <label className="file-picker">
            <span>Attach file</span>
            <input type="file" accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.zip" onChange={event => pickMessageAttachment(event, setAttachment, setToast)} />
          </label>
          <button className="btn primary" type="submit">Send Message</button>
        </form>
      </section>
    </div>
  );
}

function ConversationBox({ chat, close, message, setMessage, attachment, setAttachment, send, setToast }) {
  if (!chat) return null;
  const title = chat.conversation?.participantNames?.join(" / ") || "Conversation";

  return (
    <div className="modal" role="dialog" aria-modal="true" onClick={close}>
      <section className="modal-card glass message-box" onClick={event => event.stopPropagation()}>
        <button className="round ghost modal-close" onClick={close} type="button" aria-label="Close conversation">x</button>
        <h2>{title}</h2>
        <p>Shared campaign conversation with brief, quote, or contract context.</p>
        <div className="message-thread">
          {chat.messages.length ? chat.messages.map(item => (
            <article className="message-bubble" key={item._id}>
              <strong>{item.senderName}</strong>
              {item.body ? <p>{item.body}</p> : null}
              <AttachmentLink attachment={item.attachment} />
              <span>{new Date(item.createdAt).toLocaleString()}</span>
            </article>
          )) : <article className="market-empty">No shared messages yet. Start the conversation below.</article>}
        </div>
        <form className="message-form" onSubmit={send}>
          <textarea value={message} onChange={event => setMessage(event.target.value)} rows="4" maxLength="1000" placeholder="Write a shared message..." required={!attachment} />
          <AttachmentDraft attachment={attachment} setAttachment={setAttachment} />
          <label className="file-picker">
            <span>Attach file</span>
            <input type="file" accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.zip" onChange={event => pickMessageAttachment(event, setAttachment, setToast)} />
          </label>
          <button className="btn primary" type="submit">Send Message</button>
        </form>
      </section>
    </div>
  );
}

function PaymentModal({ promotion, amount, setAmount, recipients, setRecipients, currency, setCurrency, payerUpiId, setPayerUpiId, close, submit }) {
  if (!promotion) return null;
  const amountMinor = Math.max(0, Math.round((Number(amount) || 0) * 100));
  const platformFee = Math.round(amountMinor * 0.05);
  const escrowFee = Math.max(100, Math.round(amountMinor * 0.02));
  const totalAmount = amountMinor + platformFee + escrowFee;

  return (
    <div className="modal" role="dialog" aria-modal="true" onClick={close}>
      <section className="modal-card glass payment-box" onClick={event => event.stopPropagation()}>
        <button className="round ghost modal-close" onClick={close} type="button" aria-label="Close payment window">x</button>
        <h2>Pay to Offer Contract</h2>
        <p>The contract giver must complete payment before the contract is offered. INR uses manual UPI checkout with UTR verification, no payment API needed.</p>
        <article className="payment-summary">
          <strong>{promotion.title}</strong>
          <span>{promotion.type} - {promotion.audience}</span>
        </article>
        <article className="payment-fee-preview">
          <span><b>Base</b>{formatMoney(amountMinor, currency)}</span>
          <span><b>Platform fee</b>{formatMoney(platformFee, currency)}</span>
          <span><b>Escrow fee</b>{formatMoney(escrowFee, currency)}</span>
          <span className="total"><b>Total</b>{formatMoney(totalAmount, currency)}</span>
        </article>
        <form className="message-form" onSubmit={submit}>
          <label>
            <span>People or businesses to pay</span>
            <textarea value={recipients} onChange={event => setRecipients(event.target.value)} rows="4" maxLength="1200" placeholder="One per line. Use: Business Name | upi@bank" required />
          </label>
          {currency === "inr" ? (
            <label>
              <span>Your UPI ID</span>
              <input value={payerUpiId} onChange={event => setPayerUpiId(event.target.value)} placeholder="yourname@bank" maxLength="120" required />
            </label>
          ) : null}
          <label>
            <span>Currency</span>
            <select value={currency} onChange={event => setCurrency(event.target.value)}>
              {currencyOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label>
            <span>Contract payment amount</span>
            <input type="number" min="1" step="0.01" value={amount} onChange={event => setAmount(event.target.value)} required />
          </label>
          {currency === "inr" ? <p className="form-note">The checkout page shows the payee UPI ID, exact amount, and reference. After payment, submit the UTR; admin verification marks escrow paid.</p> : null}
          <button className="btn primary" type="submit">Pay & Offer Contract</button>
        </form>
      </section>
    </div>
  );
}

function MultiCheckoutModal({ checkout, close }) {
  if (!checkout) return null;
  const links = checkout.checkoutUrls || [];
  return (
    <div className="modal" role="dialog" aria-modal="true" onClick={close}>
      <section className="modal-card glass payment-box" onClick={event => event.stopPropagation()}>
        <button className="round ghost modal-close" onClick={close} type="button" aria-label="Close payment links">x</button>
        <h2>Payment Links Created</h2>
        <p>Open each payment link and complete payment for each person. UPI payments stay pending until the UTR is submitted and verified.</p>
        <div className="workspace-list compact-list">
          {links.map(item => (
            <article className="workspace-card glass" key={item.paymentId || item.recipientBusinessName}>
              <div>
                <h3>{item.recipientBusinessName}</h3>
                <p>{checkout.upiCheckout ? "UPI QR checkout" : "Payment checkout"}</p>
              </div>
              <a className="btn primary" href={item.checkoutUrl} target="_blank" rel="noreferrer">Open Payment</a>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function BriefWorkspaceModal({ workspace, close, acceptQuote, requestQuoteRevision, proposeCounter }) {
  if (!workspace) return null;
  const brief = workspace.brief;
  return (
    <div className="modal" role="dialog" aria-modal="true" onClick={close}>
      <section className="modal-card glass story-brief-box" onClick={event => event.stopPropagation()}>
        <button className="round ghost modal-close" onClick={close} type="button" aria-label="Close brief workspace">x</button>
        <h2>{brief.brandName}</h2>
        <p>{getBriefLabel(brief)} - {brief.budget} - {brief.status}</p>
        <BriefTimeline status={brief.status} />
        <div className="workspace-tabs">
          <article><strong>Overview</strong><p>{brief.goal}</p><small>{brief.targetAudience} - {brief.city || "Any city"} - {brief.language}</small></article>
          <article><strong>Payment</strong><p>{workspace.payments?.[0] ? formatMoney(workspace.payments[0].totalAmount || workspace.payments[0].amount, workspace.payments[0].currency) : "No payment yet"}</p></article>
          <article><strong>Proof</strong><p>{brief.proofStatus || "none"}</p><small>{brief.proofNotes || "No proof notes"}</small></article>
          <article><strong>Review</strong><p>{brief.rating ? `${brief.rating} stars` : "Not rated"}</p><small>{brief.reviewText || "No written review"}</small></article>
        </div>
        <QuoteComparison brief={{ ...brief, quotes: workspace.quotes || [] }} acceptQuote={acceptQuote} requestQuoteRevision={requestQuoteRevision} proposeCounter={proposeCounter} respondCounter={() => {}} />
      </section>
    </div>
  );
}

function StoryBriefModal({ open, close, brief, setBrief, submit }) {
  if (!open) return null;
  const formats = platformFormatOptions[brief.platform] || platformFormatOptions.Other;
  const ai = aiCampaignIntelligence(brief);
  function applyAiBrief() {
    setBrief({
      ...brief,
      goal: ai.goal,
      targetAudience: ai.targetAudience,
      notes: ai.notes
    });
  }
  function addAiCaptions() {
    const captionBlock = `AI caption ideas:\n${ai.captions.map((caption, index) => `${index + 1}. ${caption}`).join("\n")}`;
    setBrief({ ...brief, notes: [brief.notes, captionBlock].filter(Boolean).join("\n\n") });
  }
  function addAiProofChecklist() {
    const checklist = `AI proof checklist:\n${ai.proofChecklist.map(item => `- ${item}`).join("\n")}`;
    setBrief({ ...brief, notes: [brief.notes, checklist].filter(Boolean).join("\n\n") });
  }
  function fixAiTargeting() {
    setBrief({
      ...brief,
      targetAudience: ai.targetAudience,
      ageMin: brief.ageMin || "18",
      ageMax: brief.ageMax || "45",
      notes: [brief.notes, `AI targeting note: prioritize ${ai.targetAudience}; keep creative language ${brief.language || "English"} and use one CTA: ${ai.cta}.`].filter(Boolean).join("\n\n")
    });
  }

  return (
    <div className="modal" role="dialog" aria-modal="true" onClick={close}>
      <section className="modal-card glass story-brief-box" onClick={event => event.stopPropagation()}>
        <button className="round ghost modal-close" onClick={close} type="button" aria-label="Close social media brief">x</button>
        <h2>Social Media Promotion Brief</h2>
        <p>Add a campaign for any social media platform with the exact handle or profile URL experts must promote.</p>
        <article className="ai-brief-panel">
          <div>
            <span className="assistant-kicker">Original local AI</span>
            <h3>Campaign Intelligence</h3>
            <p>{ai.hook}</p>
          </div>
          <strong className="ai-score">{ai.readiness}% ready</strong>
          <div className="ai-actions">
            <button className="btn primary" onClick={applyAiBrief} type="button">Generate Brief</button>
            <button className="btn secondary" onClick={addAiCaptions} type="button">Caption Ideas</button>
            <button className="btn secondary" onClick={fixAiTargeting} type="button">Fix Targeting</button>
            <button className="btn outline" onClick={addAiProofChecklist} type="button">Proof Checklist</button>
          </div>
          <div className="ai-suggestion-grid">
            {ai.captions.slice(0, 2).map(caption => <span key={caption}>{caption}</span>)}
            {(ai.riskFlags.length ? ai.riskFlags.slice(0, 2) : ["No major missing fields detected yet."]).map(flag => <span className="ai-risk" key={flag}>{flag}</span>)}
          </div>
        </article>
        <div className="template-row">
          {briefTemplates.map(template => (
            <button key={template.name} className="chip" onClick={() => setBrief({ ...brief, ...template.patch, format: template.patch.format || platformFormatOptions[template.patch.platform]?.[0] || "Post" })} type="button">{template.name}</button>
          ))}
        </div>
        <form className="message-form" onSubmit={submit}>
          <div className="auction-switch">
            <label><input type="checkbox" checked={brief.isAuction} onChange={event => setBrief({ ...brief, isAuction: event.target.checked, urgency: event.target.checked ? "fast" : "standard" })} /> <span>Run as fast auction</span></label>
            {brief.isAuction ? <small>Experts bid against your deadline. You choose the best price, timeline, and plan.</small> : null}
          </div>
          <div className="settings-grid">
            <label><span>Platform</span><select value={brief.platform} onChange={event => {
              const platform = event.target.value;
              setBrief({ ...brief, platform, format: platformFormatOptions[platform]?.[0] || "Post" });
            }}>{socialPlatformOptions.map(platform => <option key={platform} value={platform}>{platform}</option>)}</select></label>
            <label><span>Handle / channel / platform URL</span><input value={brief.socialHandle} onChange={event => setBrief({ ...brief, socialHandle: event.target.value })} placeholder="@profile, channel name, or https://platform.com/profile" maxLength="120" required /></label>
            <label><span>Promotion format</span><select value={brief.format} onChange={event => setBrief({ ...brief, format: event.target.value })}>{formats.map(format => <option key={format} value={format}>{format}</option>)}</select></label>
            <label><span>Name / brand</span><input value={brief.brandName} onChange={event => setBrief({ ...brief, brandName: event.target.value })} maxLength="120" required /></label>
            <label><span>Budget</span><input value={brief.budget} onChange={event => setBrief({ ...brief, budget: event.target.value })} placeholder="e.g. INR 2,000 - 5,000" maxLength="80" required /></label>
            <label><span>Budget min</span><input type="number" min="0" value={brief.budgetMin} onChange={event => setBrief({ ...brief, budgetMin: event.target.value })} placeholder="2000" /></label>
            <label><span>Budget max</span><input type="number" min="0" value={brief.budgetMax} onChange={event => setBrief({ ...brief, budgetMax: event.target.value })} placeholder="5000" /></label>
            <label><span>Currency</span><select value={brief.currency} onChange={event => setBrief({ ...brief, currency: event.target.value })}>{currencyOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label><span>Preferred date</span><input type="date" value={brief.preferredDate} onChange={event => setBrief({ ...brief, preferredDate: event.target.value })} /></label>
            {brief.isAuction ? <label><span>Urgency</span><select value={brief.urgency} onChange={event => setBrief({ ...brief, urgency: event.target.value })}><option value="fast">Fast - 24h auction</option><option value="urgent">Urgent - 6h auction</option></select></label> : null}
            {brief.isAuction ? <label><span>Auction end time</span><input type="datetime-local" value={brief.auctionEndsAt} onChange={event => setBrief({ ...brief, auctionEndsAt: event.target.value })} /></label> : null}
            <label><span>Target audience</span><input value={brief.targetAudience} onChange={event => setBrief({ ...brief, targetAudience: event.target.value })} placeholder="e.g. Delhi students, fashion buyers" maxLength="160" required /></label>
            <label><span>Minimum age</span><input type="number" min="0" max="120" value={brief.ageMin} onChange={event => setBrief({ ...brief, ageMin: event.target.value })} placeholder="e.g. 18" /></label>
            <label><span>Maximum age</span><input type="number" min="0" max="120" value={brief.ageMax} onChange={event => setBrief({ ...brief, ageMax: event.target.value })} placeholder="e.g. 35" /></label>
            <label><span>City / region</span><input value={brief.city} onChange={event => setBrief({ ...brief, city: event.target.value })} placeholder="e.g. Mumbai, India" maxLength="100" /></label>
            <label><span>Campaign language</span><select value={brief.language} onChange={event => setBrief({ ...brief, language: event.target.value })}>{languageOptions.map(language => <option key={language} value={language}>{language}</option>)}</select></label>
            <label className="wide"><span>Promotion goal</span><input value={brief.goal} onChange={event => setBrief({ ...brief, goal: event.target.value })} placeholder="e.g. Drive profile visits, sales, event registrations" maxLength="240" required /></label>
            <label className="wide"><span>Creative link</span><input value={brief.creativeLink} onChange={event => setBrief({ ...brief, creativeLink: event.target.value })} placeholder="https://drive.google.com/..." maxLength="220" /></label>
            <label className="wide"><span>Extra notes</span><textarea value={brief.notes} onChange={event => setBrief({ ...brief, notes: event.target.value })} rows="4" maxLength="700" placeholder="Duration, caption, link sticker, tags, language, do/don't, etc." /></label>
          </div>
          <button className="btn primary" type="submit">{brief.isAuction ? "Start Auction" : "Post Social Brief"}</button>
        </form>
      </section>
    </div>
  );
}

function QuoteModal({ target, close, quote, setQuote, submit }) {
  if (!target) return null;
  function generateQuotePlan() {
    setQuote({
      ...quote,
      timeline: quote.timeline || (target.isAuction ? "Within the auction deadline" : "24-48 hours after asset approval"),
      message: aiQuotePlan(target, quote)
    });
  }

  return (
    <div className="modal" role="dialog" aria-modal="true" onClick={close}>
      <section className="modal-card glass payment-box" onClick={event => event.stopPropagation()}>
        <button className="round ghost modal-close" onClick={close} type="button" aria-label="Close quote window">x</button>
        <h2>Send Quote</h2>
        <p>{target.isAuction ? "Place a competitive bid with your fastest realistic timeline." : `Submit a price, timeline, and execution plan for ${target.brandName}'s ${target.platform || "social media"} brief.`}</p>
        <button className="btn secondary ai-inline-action" onClick={generateQuotePlan} type="button">Generate AI Quote Plan</button>
        <form className="message-form" onSubmit={submit}>
          <label><span>Expert / agency name</span><input value={quote.expertName} onChange={event => setQuote({ ...quote, expertName: event.target.value })} maxLength="120" required /></label>
          <label><span>Quote amount</span><input value={quote.amount} onChange={event => setQuote({ ...quote, amount: event.target.value })} placeholder="e.g. INR 3,500" maxLength="80" required /></label>
          <label><span>Timeline</span><input value={quote.timeline} onChange={event => setQuote({ ...quote, timeline: event.target.value })} placeholder="e.g. Story live within 24 hours" maxLength="120" required /></label>
          <label><span>Plan</span><textarea value={quote.message} onChange={event => setQuote({ ...quote, message: event.target.value })} rows="4" maxLength="700" required /></label>
          <button className="btn primary" type="submit">{target.isAuction ? "Place Bid" : "Submit Quote"}</button>
        </form>
      </section>
    </div>
  );
}

function ProofModal({ target, close, proof, setProof, submit }) {
  if (!target) return null;

  function handleScreenshot(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => setProof({ ...proof, proofScreenshot: String(reader.result || "") });
    reader.readAsDataURL(file);
  }
  const metricFields = proofMetricFields[target.platform] || proofMetricFields.Other;

  return (
    <div className="modal" role="dialog" aria-modal="true" onClick={close}>
      <section className="modal-card glass payment-box" onClick={event => event.stopPropagation()}>
        <button className="round ghost modal-close" onClick={close} type="button" aria-label="Close proof window">x</button>
        <h2>Upload Proof</h2>
        <p>Add a story screenshot, analytics screenshot, invoice, or public proof link for {target.brandName}.</p>
        <form className="message-form" onSubmit={submit}>
          <label><span>Proof link</span><input value={proof.proofLink} onChange={event => setProof({ ...proof, proofLink: event.target.value })} placeholder="https://drive.google.com/..." maxLength="220" required /></label>
          <label><span>Reach / views</span><input type="number" min="0" value={proof.proofReach} onChange={event => setProof({ ...proof, proofReach: event.target.value })} placeholder="e.g. 12000" /></label>
          <label><span>Clicks / responses</span><input type="number" min="0" value={proof.proofClicks} onChange={event => setProof({ ...proof, proofClicks: event.target.value })} placeholder="e.g. 340" /></label>
          {metricFields.map(([key, label]) => <label key={key}><span>{label}</span><input value={proof.proofMetrics?.[key] || ""} onChange={event => setProof({ ...proof, proofMetrics: { ...(proof.proofMetrics || {}), [key]: event.target.value } })} maxLength="80" /></label>)}
          <label><span>Proof screenshot</span><input type="file" accept="image/png,image/jpeg" onChange={handleScreenshot} /></label>
          <label><span>Proof notes</span><textarea value={proof.proofNotes} onChange={event => setProof({ ...proof, proofNotes: event.target.value })} rows="4" maxLength="700" placeholder="Summarize placements, timing, reach, and any follow-up." /></label>
          <button className="btn primary" type="submit">Save Proof</button>
        </form>
      </section>
    </div>
  );
}

function Nav({ view, setView, desktop = false }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const items = [
    ["dashboard", "D", "Dashboard"],
    ["marketplace", "M", "Market"],
    ["post", "P", "Post"],
    ["tools", "T", "Tools"],
    ["profile", "U", "Profile"],
    ["auction", "A", "Auction"],
    ["expert", "E", "Expert"],
    ["messages", "I", "Inbox"],
    ["contracts", "C", "Deals"],
    ["settings", "S", "Settings"]
  ];
  const primaryItems = desktop ? items : items.slice(0, 5);
  const moreItems = desktop ? [] : items.slice(5);
  const moreActive = moreItems.some(([id]) => id === view);

  function selectView(id) {
    setView(id);
    setMoreOpen(false);
  }

  return (
    <nav className={desktop ? "side-nav glass" : "bottom-nav glass"} aria-label="Main navigation">
      {primaryItems.map(([id, icon, label]) => (
        <button key={id} className={`nav-item ${view === id ? "active" : ""}`} onClick={() => selectView(id)} type="button">
          {icon}
          <span>{label}</span>
        </button>
      ))}
      {moreItems.length ? (
        <div className="more-nav">
          <button className={`nav-item ${moreActive || moreOpen ? "active" : ""}`} onClick={() => setMoreOpen(open => !open)} type="button" aria-expanded={moreOpen}>
            +
            <span>More</span>
          </button>
          {moreOpen ? (
            <div className="more-menu glass">
              {moreItems.map(([id, icon, label]) => (
                <button key={id} className={view === id ? "active" : ""} onClick={() => selectView(id)} type="button">
                  <b>{icon}</b>
                  <span>{label}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </nav>
  );
}

function ProgressBar({ value }) {
  const width = `${Math.max(0, Math.min(100, Number(value) || 0))}%`;
  return <div className="progress dynamic-progress"><i style={{ width }} /></div>;
}

function Dashboard({ profileStrength, activePromotions, newRequests, promotions, connectedNames, setView, connectBusiness, updateRequest, loading, dashboard, user, adminSummary, adminReviewQueue, adminSystemStatus, analytics, shortlists, runAdminJobs, resolveAdminDispute, openStoryBrief }) {
  const activeCards = promotions.slice(0, 2);
  const escrowTotal = (dashboard.escrowPayments || []).reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const escrowCurrency = dashboard.escrowPayments?.[0]?._id || "inr";
  return (
    <section className="view active">
      <div className="page-heading"><h1>Overview</h1><p>Track your networking reach and active partnership metrics.</p>{loading ? <span className="sync-pill">Syncing MongoDB data...</span> : <span className="sync-pill ready">MongoDB live</span>}</div>
      <div className="metric-grid">
        <article className="metric-card glass"><span>Profile Strength</span><strong>{profileStrength}%</strong><small>+5% this week</small><ProgressBar value={profileStrength} /></article>
        <article className="metric-card glass"><span>Active Promotions</span><strong>{String(activePromotions).padStart(2, "0")}</strong><em>AD</em></article>
        <article className="metric-card glass"><span>New Requests</span><strong>{String(newRequests.length).padStart(2, "0")}</strong><em className="rose">RQ</em></article>
        <article className="metric-card glass"><span>Briefs Posted</span><strong>{String(dashboard.briefsPosted || 0).padStart(2, "0")}</strong><small>{dashboard.quotesReceived || 0} with quotes</small></article>
        <article className="metric-card glass"><span>Escrow Value</span><strong>{formatMoney(escrowTotal, escrowCurrency)}</strong><small>{dashboard.escrowPayments?.length || 0} currency bucket{dashboard.escrowPayments?.length === 1 ? "" : "s"}</small></article>
        <article className="metric-card glass"><span>Completed</span><strong>{String(dashboard.completedBriefs || 0).padStart(2, "0")}</strong><small>proof uploaded</small></article>
        <article className="metric-card glass"><span>Campaign Spend</span><strong>{formatMoney(analytics?.spend || 0, "inr")}</strong><small>{analytics?.reach || 0} reach</small></article>
        <article className="metric-card glass"><span>Auction Bids</span><strong>{String(analytics?.auctionBids || 0).padStart(2, "0")}</strong><small>{analytics?.liveAuctions || 0} live auction{analytics?.liveAuctions === 1 ? "" : "s"}</small></article>
      </div>
      <div className="quick-actions glass">
        <button className="btn primary" onClick={() => setView("post")} type="button">Post Ad</button>
        <button className="btn secondary" onClick={openStoryBrief} type="button">Post Social Work</button>
        <button className="btn growth" onClick={() => setView("auction")} type="button">Start Auction</button>
        <button className="btn outline" onClick={() => setView("marketplace")} type="button">Find Experts</button>
        <button className="btn outline" onClick={() => setView("marketplace")} type="button">Review Quotes</button>
        <button className="btn outline" onClick={() => setView("contracts")} type="button">Check Payments</button>
      </div>
      <ExpertChecklist user={user} setView={setView} />
      <div className="workspace-grid role-dashboard">
        <article className="glass info-card"><h2>Buyer Work</h2><p>{dashboard.briefsPosted || 0} briefs posted, {dashboard.quotesReceived || 0} with quotes, {dashboard.completedBriefs || 0} completed.</p><button className="btn primary" onClick={() => setView("marketplace")} type="button">Review Briefs</button></article>
        <article className="glass info-card"><h2>Expert Work</h2><p>{user?.availability || "available"} availability, {user?.turnaroundDays || 0} day turnaround, {user?.averageRating || 0} average rating.</p><button className="btn secondary" onClick={() => setView("profile")} type="button">Update Services</button></article>
        <article className="glass info-card"><h2>Shortlists</h2><p>{shortlists?.length || 0} saved expert{shortlists?.length === 1 ? "" : "s"} for campaign outreach.</p><button className="btn secondary" onClick={() => setView("marketplace")} type="button">Find Experts</button></article>
        {adminSummary ? <article className="glass info-card"><h2>Admin Queue</h2><p>{adminSummary.disputedBriefs} disputes, {adminSummary.proofPending} proofs pending, {adminSummary.payments} payments.</p><small>{adminSummary.users} users - {adminSummary.briefs} briefs - {adminSummary.contracts} contracts</small><button className="btn outline" onClick={runAdminJobs} type="button">Run Jobs</button></article> : null}
      </div>
      {adminSummary ? <AdminSystemStatus status={adminSystemStatus} /> : null}
      {adminSummary ? <AdminReviewQueue queue={adminReviewQueue} resolveAdminDispute={resolveAdminDispute} adminPaymentAction={adminPaymentAction} /> : null}
      <div className="section-title"><h2>Active Promotions</h2><button onClick={() => setView("post")} type="button">View All</button></div>
      <div className="promotion-grid">
        {activeCards.length ? activeCards.map(item => (
          <PromoCard key={item._id} title={item.title} sub={item.partner} status={item.status} image={item.image} />
        )) : <article className="market-empty glass">No promotions yet. Create your first listing to start matching with partners.</article>}
      </div>
      <div className="section-title"><h2>Partner Requests</h2></div>
      {newRequests.length ? newRequests.map(request => (
        <article key={request._id} className="request-card glass">
          <div className="request-logo">{request.businessName.slice(0, 2).toUpperCase()}</div>
          <div><strong>{request.businessName}</strong><p>{request.note}</p></div>
          <button className="round ghost" onClick={() => updateRequest(request._id, "declined")} type="button">x</button>
          <button className="round ok" onClick={() => updateRequest(request._id, "accepted")} type="button">ok</button>
        </article>
      )) : <article className="market-empty glass">No new partner requests.</article>}
      <div className="section-title"><h2>Recommended for You</h2></div>
      {promotions.length ? (
        <div className="recommend-card glass">
          {promotions.slice(0, 2).map(item => (
            <Recommendation key={item._id} item={item} connectedNames={connectedNames} connectBusiness={connectBusiness} />
          ))}
        </div>
      ) : <article className="market-empty glass">Recommendations appear after marketplace listings are available.</article>}
    </section>
  );
}

function GrowthTools({ setView, openStoryBrief, openMessageBox, dashboard, analytics, promotions, experts, adBriefs, openBriefs, notifications, threads, user }) {
  const [activeTool, setActiveTool] = useState("studio");
  const toolTabs = [
    ["studio", "AI Studio"],
    ["automations", "Auto-DMs"],
    ["campaigns", "Campaigns"],
    ["influencers", "Influencers"],
    ["insights", "Insights"]
  ];
  const livePromotionCount = promotions.length;
  const liveExpertCount = experts.length;
  const liveBriefCount = adBriefs.length + openBriefs.length;
  const unreadCount = notifications.filter(item => !item.read).length;
  const activePromotions = promotions.filter(item => item.status === "Online").length;
  const liveThreads = threads.length;
  const stats = [
    ["Messages", String(liveThreads).padStart(2, "0")],
    ["Notifications", String(unreadCount).padStart(2, "0")],
    ["Live listings", String(activePromotions).padStart(2, "0")],
    ["Tracked reach", String(analytics?.reach || 0)]
  ];
  const campaignCards = promotions.slice(0, 3).map(item => [
    item.title,
    item.status || "Draft",
    item.price || item.budget || "Budget pending",
    `${item.type || "Campaign"} | ${item.audience || "Audience pending"}`
  ]);
  const influencers = experts.slice(0, 4).map(item => [
    item.businessName,
    item.location || "Location pending",
    item.expertise || item.industry || "Expertise pending",
    followerLabel(item.followerCount) || `${item.profileStrength || 0}% profile`,
    String(item.averageRating || 0)
  ]);
  const aiFeatureCards = [
    ["Brief Generator", "Turns rough campaign details into goals, audience, notes, CTA, and delivery proof requirements."],
    ["Caption Lab", "Creates platform-aware caption and CTA ideas for reels, posts, stories, shorts, broadcasts, and TV spots."],
    ["Risk Scanner", "Flags missing handle, budget, date, creative link, city, and other details before experts quote."],
    ["Quote Planner", "Helps experts convert buyer requirements into a clear price, timeline, proof, and execution plan."]
  ];
  const revenuePlans = [
    ["Free", "₹0", "Publish starter listings and use manual UPI escrow tracking.", "Start Posting", "campaigns"],
    ["Creator Pro", "₹499/mo", "Featured profile, faster quote visibility, and saved campaign templates.", "Upgrade Creator", "insights"],
    ["Business Plus", "₹1,499/mo", "More briefs, priority partner discovery, and advanced contract tracking.", "Upgrade Business", "campaigns"],
    ["Agency", "₹2,999/mo", "Bulk campaign workflow, managed lead list, and team-ready payment tracking.", "Talk to Sales", "automations"]
  ];
  const revenueAddOns = [
    ["Featured Listing", "₹299", "Push one promotion or creator profile higher in discovery for a campaign cycle.", "Find Partners", "influencers"],
    ["Verified Badge", "₹199", "Review profile, UPI ID, proof links, and social handles before showing a trust badge.", "Verify Profile", "insights"],
    ["Managed Campaign", "from ₹2,000", "You manage creator search, negotiation, proof collection, and payment follow-up.", "Request Help", "automations"],
    ["Premium Lead Access", "₹499", "Unlock buyer briefs and high-intent campaign leads for experts and agencies.", "Open Briefs", "influencers"]
  ];

  function runToolAction(id) {
    if (id === "studio") openStoryBrief();
    if (id === "automations") openMessageBox("Automation Assistant");
    if (id === "campaigns") setView("post");
    if (id === "influencers") setView("marketplace");
    if (id === "insights") setView("profile");
  }

  return (
    <section className="view active growth-tools-page">
      <div className="tools-hero">
        <div>
          <span className="sync-pill ready">Creator marketplace toolkit</span>
          <h1>Bring businesses and creators together in one spot.</h1>
          <p>Launch campaigns, find influencers, automate follow-ups, and review performance from a mobile-first workspace.</p>
          <div className="tools-hero-stats">
            <span><b>{liveExpertCount}</b> Live experts</span>
            <span><b>{liveBriefCount}</b> Active briefs</span>
            <span><b>{dashboard?.profileStrength || user?.profileStrength || 0}%</b> Profile strength</span>
          </div>
          <div className="tools-hero-actions">
            <button className="btn primary" onClick={openStoryBrief} type="button">AI Campaign Builder</button>
            <button className="btn outline" onClick={() => setView("marketplace")} type="button">Discover Influencers</button>
          </div>
        </div>
        <PhonePreview mode={activeTool} stats={stats} campaignCards={campaignCards} influencers={influencers} user={user} />
      </div>

      <div className="tool-tabs" aria-label="Growth tools">
        {toolTabs.map(([id, label]) => <button key={id} className={activeTool === id ? "active" : ""} onClick={() => setActiveTool(id)} type="button">{label}</button>)}
      </div>

      <div className="tool-feature-grid">
        <ToolFeature title="Discover the right match" text="Browse, filter, shortlist, and select the best partners for every campaign." action="Find Partners" onClick={() => runToolAction("influencers")} />
        <ToolFeature title="Launch campaigns in minutes" text="Choose advanced mode, AI builder, or managed campaign support for faster briefs." action="Create Campaign" onClick={() => runToolAction("campaigns")} />
        <ToolFeature title="Automate DMs. Grow faster." text="Resume conversations, reply to campaign interest, and keep every lead moving." action="Open Auto-DMs" onClick={() => runToolAction("automations")} />
        <ToolFeature title="Smart insights. Stronger partnerships." text="Track reach, engagement, follower growth, proof, and creator quality signals." action="View Insights" onClick={() => runToolAction("insights")} />
      </div>

      <div className="section-title"><h2>Original AI Features</h2></div>
      <div className="ai-feature-grid">
        {aiFeatureCards.map(([title, text]) => (
          <article className="glass ai-feature-card" key={title}>
            <strong>{title}</strong>
            <p>{text}</p>
          </article>
        ))}
      </div>

      <div className="section-title"><h2>Earning Features</h2></div>
      <div className="revenue-grid">
        {revenuePlans.map(([name, price, text, action, target]) => (
          <article className="glass revenue-card" key={name}>
            <span>{name}</span>
            <strong>{price}</strong>
            <p>{text}</p>
            <button className="btn secondary" onClick={() => runToolAction(target)} type="button">{action}</button>
          </article>
        ))}
      </div>

      <div className="section-title"><h2>Paid Add-ons</h2></div>
      <div className="addon-grid">
        {revenueAddOns.map(([name, price, text, action, target]) => (
          <article className="glass addon-card" key={name}>
            <div>
              <h3>{name}</h3>
              <p>{text}</p>
            </div>
            <strong>{price}</strong>
            <button className="btn outline" onClick={() => runToolAction(target)} type="button">{action}</button>
          </article>
        ))}
      </div>
    </section>
  );
}

function ToolFeature({ title, text, action, onClick }) {
  return (
    <article className="glass tool-feature-card">
      <span className="tool-feature-icon">{title.slice(0, 1)}</span>
      <h2>{title}</h2>
      <p>{text}</p>
      <button className="btn secondary" onClick={onClick} type="button">{action}</button>
    </article>
  );
}

function PhonePreview({ mode, stats, campaignCards, influencers, user }) {
  const businessName = user?.businessName || "Your profile";
  return (
    <div className="phone-frame" aria-hidden="true">
      <div className="phone-speaker" />
      <div className="phone-status"><span>9:41</span><span>93%</span></div>
      <div className="phone-screen">
        {mode === "studio" ? (
          <div className="phone-panel studio-panel">
            <h2>InTools</h2>
            <p>Live tools connected to your Parasara account activity.</p>
            <div className="mini-tool-grid">
              <span>{influencers.length} experts</span>
              <span>{campaignCards.length} campaigns</span>
              <span className="wide">{stats[1][1]} unread updates</span>
            </div>
          </div>
        ) : null}
        {mode === "automations" ? (
          <div className="phone-panel">
            <h2>Auto-DMs</h2>
            <div className="phone-metrics">{stats.map(([label, value]) => <span key={label}><b>{value}</b>{label}</span>)}</div>
            <div className="dm-preview"><p>Hi! Thanks for texting. Here is the campaign link.</p><b>Thanks</b></div>
            <span className="phone-action">Create automation</span>
          </div>
        ) : null}
        {mode === "campaigns" ? (
          <div className="phone-panel campaign-builder-panel">
            <h2>Create Campaign</h2>
            <strong>Let Influencers Reach Out to You</strong>
            <span className="phone-action">Advanced Campaign Builder</span>
            <span className="phone-action">AI Campaign Builder</span>
            <span className="phone-action">Want us to manage?</span>
            <div className="campaign-list-mini">
              {campaignCards.length ? campaignCards.slice(0, 2).map(([name, type, value, progress]) => <article key={name}><b>{name}</b><small>{type} | {value}</small><span>{progress}</span></article>) : <article><b>No live campaigns</b><small>Create or publish a campaign first.</small><span>Waiting for real data</span></article>}
            </div>
          </div>
        ) : null}
        {mode === "influencers" ? (
          <div className="phone-panel">
            <h2>All Influencer</h2>
            <div className="phone-search">Search</div>
            {influencers.length ? influencers.map(([name, city, niche, followers, rating]) => (
              <article className="phone-influencer" key={name}>
                <span>{name.slice(0, 1)}</span>
                <div><b>{name}</b><small>{city} | {niche}</small><small>{rating} star | {followers}</small></div>
              </article>
            )) : <article className="phone-empty">No live experts yet.</article>}
          </div>
        ) : null}
        {mode === "insights" ? (
          <div className="phone-panel insights-panel">
            <h2>My Influence</h2>
            <strong>{businessName}</strong>
            {stats.map(([label, value]) => <article key={label}><span>{label}</span><b>{value}</b></article>)}
          </div>
        ) : null}
        <div className="phone-nav"><i /> <i /> <i /> <i /> <i /></div>
      </div>
    </div>
  );
}

function AdminSystemStatus({ status }) {
  if (!status) return null;
  const rows = [
    ["Environment", status.environment],
    ["Database", status.database],
    ["Auth", status.auth],
    ["Payments", status.payments],
    ["Email", status.email],
    ["Client", status.clientOrigin]
  ];
  return (
    <article className="glass system-status-card">
      <div className="section-title"><h2>System Status</h2></div>
      <div className="system-status-grid">
        {rows.map(([label, value]) => <span key={label}><b>{label}</b>{value}</span>)}
      </div>
      {status.warnings?.length ? <p>{status.warnings.join(" ")}</p> : null}
    </article>
  );
}

function ExpertChecklist({ user, setView }) {
  const items = [
    ["Mode", ["expert", "both"].includes(user?.accountMode)],
    ["Expertise", Boolean(user?.expertise)],
    ["Service catalog", Boolean(user?.serviceCatalog?.length)],
    ["Case studies", Boolean(user?.caseStudies?.length)],
    ["Social handles", socialFields.some(([key]) => user?.[key])],
    ["Budget", Boolean(user?.minBudget)],
    ["Languages", Boolean(user?.serviceLanguages?.length)]
  ];
  const done = items.filter(([, ok]) => ok).length;
  if (done === items.length) return null;

  return (
    <article className="glass checklist-card">
      <div>
        <span>Expert onboarding</span>
        <h2>{done}/{items.length} complete</h2>
      </div>
      <div className="checklist-items">
        {items.map(([label, ok]) => <span key={label} className={ok ? "done" : ""}>{ok ? "Done" : "Need"} {label}</span>)}
      </div>
      <button className="btn secondary" onClick={() => setView("profile")} type="button">Complete Profile</button>
    </article>
  );
}

function AdminReviewQueue({ queue, resolveAdminDispute, adminPaymentAction }) {
  const briefs = queue?.briefs || [];
  const payments = queue?.payments || [];
  if (!briefs.length && !payments.length) return null;
  return (
    <>
      <div className="section-title"><h2>Admin Moderation</h2></div>
      <div className="trust-grid moderation-grid">
        <article className="glass info-card"><h2>Proof Reviews</h2><strong className="big-number">{briefs.filter(brief => brief.status === "proof_submitted").length}</strong><p>Campaign proof records waiting for buyer or admin attention.</p></article>
        <article className="glass info-card"><h2>Disputes</h2><strong className="big-number">{briefs.filter(brief => brief.status === "disputed").length}</strong><p>Buyer and expert workspaces that need resolution.</p></article>
        <article className="glass info-card"><h2>Payment Checks</h2><strong className="big-number">{payments.length}</strong><p>Payment records available for release, refund, or review.</p></article>
      </div>
      <div className="workspace-list compact-list">
        {briefs.slice(0, 5).map(brief => (
          <article className="workspace-card brief-card glass" key={brief._id}>
            <div>
              <h3>{brief.brandName} - {brief.platform}</h3>
              <p>{brief.status === "disputed" ? brief.disputeReason || "Dispute needs review." : brief.proofNotes || "Proof waiting for buyer review."}</p>
              <small>{brief.budget} - {brief.proofLink || "No proof link"}</small>
            </div>
            <div className="brief-actions">
              <span className={`status ${String(brief.status).replace("_", "-")}`}>{String(brief.status).replace("_", " ")}</span>
              {brief.status === "disputed" ? <button className="btn secondary" onClick={() => resolveAdminDispute(brief._id, "reopen")} type="button">Reopen</button> : null}
              {brief.status === "disputed" ? <button className="btn outline" onClick={() => resolveAdminDispute(brief._id, "close")} type="button">Close</button> : null}
              {brief.proofLink ? <a href={brief.proofLink} target="_blank" rel="noreferrer">Proof</a> : null}
            </div>
          </article>
        ))}
        {payments.slice(0, 5).map(payment => (
          <article className="workspace-card brief-card glass" key={payment._id}>
            <div>
              <h3>{payment.recipientBusinessName || "Payment Review"}</h3>
              <p>{payment.status || "Payment status pending"}</p>
              <small>{formatMoney(payment.totalAmount || payment.amount || 0, payment.currency || "inr")} - {payment.upiVpa ? `payee ${payment.upiVpa}` : payment.providerSessionId || "checkout pending"}{payment.upiUtr ? ` - UTR ${payment.upiUtr}` : ""}</small>
            </div>
            <div className="brief-actions">
              <span className={`status ${String(payment.status || "pending").replace("_", "-")}`}>{String(payment.status || "pending").replace("_", " ")}</span>
              {["upi", "manual_upi", "manual"].includes(payment.provider) && payment.status === "pending" && payment.upiUtr ? <button className="btn growth" onClick={() => adminPaymentAction(payment._id, "verify")} type="button">Verify Payment</button> : null}
            </div>
          </article>
        ))}
      </div>
    </>
  );
}

function PromoCard({ title, sub, status, image, action }) {
  return (
    <article className="promo-card glass">
      <img src={image} alt={title} />
      <div><div className="card-row"><h3>{title}</h3><span className={`status ${status.toLowerCase()}`}>{status}</span></div><p>{sub}</p>{action ? <button className="text-cta" onClick={action} type="button">Promote</button> : <div className="mini-stats"><span /><span /><span /><b>842 Impressions</b></div>}</div>
    </article>
  );
}

function ConnectBlock({ name, detail, connectedNames, connectBusiness }) {
  const connected = connectedNames.has(name);
  return <div><strong>{name}</strong><p>{detail}</p><button className={`btn secondary ${connected ? "connected" : ""}`} onClick={() => connectBusiness(name)} type="button">{connected ? "Connected" : "Connect"}</button></div>;
}

function Recommendation({ item, connectedNames, connectBusiness }) {
  return (
    <>
      <img src={item.image} alt={`${item.title} workspace`} />
      <ConnectBlock name={item.title} detail={`${item.type} - ${item.audience}`} connectedNames={connectedNames} connectBusiness={connectBusiness} />
    </>
  );
}

function PostPromotion({ draft, setDraft, publishPromotion, saveDraft, handleAsset, assetPreview, promotions, filter, setFilter, marketFilters, setMarketFilters, search, setSearch, sort, setSort, setView, connectBusiness, connectedNames, offerContract, openMessageBox, savedItems, savedSearches, saveCurrentSearch, applySavedSearch, removeSavedSearch, toggleSavedItem, openStoryBrief, adBriefs, acceptQuote, requestQuoteRevision, proposeCounter, respondCounter, shortlistQuote, actionBusy, payEscrow, openProof, reviewProof, disputeBrief, rateBrief }) {
  const [postTab, setPostTab] = useState("create");
  const myListings = promotions.filter(item => ["online", "scheduled", "offline"].includes(String(item.status || "").toLowerCase()));
  const savedListings = promotions.filter(item => savedItems.includes(item._id));
  const socialBriefs = adBriefs.filter(brief => !brief.isAuction);
  return (
    <section className="view active">
      <div className="page-heading"><h1>Post & Promotion Marketplace</h1><p>Create advertisement listings, post social media promotion work, and find partner opportunities from one section.</p></div>
      <div className="tab-row post-tabs">
        <button className={postTab === "create" ? "active" : ""} onClick={() => setPostTab("create")} type="button">Create Listing</button>
        <button className={postTab === "social" ? "active" : ""} onClick={() => setPostTab("social")} type="button">Social Media Post</button>
        <button className={postTab === "mine" ? "active" : ""} onClick={() => setPostTab("mine")} type="button">My Listings</button>
        <button className={postTab === "saved" ? "active" : ""} onClick={() => setPostTab("saved")} type="button">Saved</button>
      </div>
      {postTab === "create" ? (
        <>
          <form className="post-layout" onSubmit={publishPromotion}>
            <fieldset className="glass"><legend>Core Details</legend><label><span>Promotion title</span><input value={draft.title} onChange={event => setDraft({ ...draft, title: event.target.value })} maxLength="90" required /></label><label><span>Description</span><textarea value={draft.description} onChange={event => setDraft({ ...draft, description: event.target.value })} rows="5" maxLength="600" required /></label></fieldset>
            <fieldset className="glass"><legend>Reach & Targeting</legend><label><span>Promotion type</span><select value={draft.type} onChange={event => setDraft({ ...draft, type: event.target.value })}>{promotionTypes.map(type => <option key={type} value={type}>{type}</option>)}</select></label><label><span>Audience size</span><input value={draft.audience} onChange={event => setDraft({ ...draft, audience: event.target.value })} list="audienceOptions" maxLength="80" /></label><label><span>Ideal partner profile</span><input value={draft.partner} onChange={event => setDraft({ ...draft, partner: event.target.value })} list="partnerOptions" maxLength="120" /></label><datalist id="audienceOptions">{audienceOptions.map(item => <option key={item} value={item} />)}</datalist><datalist id="partnerOptions">{partnerOptions.map(item => <option key={item} value={item} />)}</datalist></fieldset>
            <fieldset className="glass"><legend>Media & Branding</legend><label className={`upload-zone ${assetPreview ? "has-file" : ""}`}><input type="file" accept="image/png,image/jpeg" onChange={handleAsset} />{assetPreview ? <img className="upload-preview" src={assetPreview} alt="Uploaded promotion asset preview" /> : <b>Upload</b>}<span>{assetPreview ? "Asset ready" : "Click to upload assets"}</span><small>PNG, JPG up to 10MB</small></label></fieldset>
            <aside className="preview-card glass"><span>Live Preview</span><h3>{draft.title || "Draft Listing"}</h3><p>Your promotion will be visible to verified business partners in the marketplace.</p><div><span className="pill">Staging</span><small>0 Views</small></div></aside>
            <button className="btn primary publish" type="submit">Publish Promotion</button>
            <button className="btn outline" onClick={saveDraft} type="button">Save as Draft</button>
          </form>
          <ListingQualityScore draft={draft} assetPreview={assetPreview} />
          <TrustSection />
        </>
      ) : null}
      {postTab === "social" ? (
        <SocialMediaPostSection
          openStoryBrief={openStoryBrief}
          socialBriefs={socialBriefs}
          acceptQuote={acceptQuote}
          requestQuoteRevision={requestQuoteRevision}
          proposeCounter={proposeCounter}
          respondCounter={respondCounter}
          shortlistQuote={shortlistQuote}
          actionBusy={actionBusy}
          payEscrow={payEscrow}
          openProof={openProof}
          reviewProof={reviewProof}
          disputeBrief={disputeBrief}
          rateBrief={rateBrief}
        />
      ) : null}
      {postTab === "mine" ? <ListingCollection title="My Listings" items={myListings} connectedNames={connectedNames} savedItems={savedItems} toggleSavedItem={toggleSavedItem} connectBusiness={connectBusiness} offerContract={offerContract} openMessageBox={openMessageBox} emptyText="Publish a promotion listing to see it here." /> : null}
      {postTab === "saved" ? <ListingCollection title="Saved Promotion Listings" items={savedListings} connectedNames={connectedNames} savedItems={savedItems} toggleSavedItem={toggleSavedItem} connectBusiness={connectBusiness} offerContract={offerContract} openMessageBox={openMessageBox} emptyText="Save listings from the promotion marketplace to compare them here." /> : null}
    </section>
  );
}

function ListingQualityScore({ draft, assetPreview }) {
  const quality = listingQuality(draft, assetPreview);
  return (
    <article className="glass quality-card">
      <div>
        <span>Listing quality</span>
        <h2>{quality.score}% ready</h2>
        <ProgressBar value={quality.score} />
      </div>
      <div className="checklist-items">
        {quality.items.map(([label, ok]) => <span key={label} className={ok ? "done" : ""}>{ok ? "Done" : "Need"} {label}</span>)}
      </div>
    </article>
  );
}

function TrustSection() {
  const items = [
    ["Escrow Protection", "Payments stay tracked before work begins."],
    ["Money Back Guarantee", "If paid campaign work is not delivered with acceptable proof, the buyer can dispute and request refund review."],
    ["Proof Required", "Campaigns can collect proof links, reach, clicks, and platform metrics."],
    ["Dispute Support", "Buyers can request revision, dispute, or approve proof after delivery."],
    ["Verified Signals", "Profiles show strength, services, case studies, ratings, and social handles."]
  ];
  return (
    <section className="trust-grid">
      {items.map(([title, copy]) => <article className="glass info-card" key={title}><h2>{title}</h2><p>{copy}</p></article>)}
    </section>
  );
}

function SocialMediaPostSection({ openStoryBrief, socialBriefs, acceptQuote, requestQuoteRevision, proposeCounter, respondCounter, shortlistQuote, actionBusy, payEscrow, openProof, reviewProof, disputeBrief, rateBrief }) {
  return (
    <div className="post-marketplace">
      <article className="story-flow glass">
        <div>
          <span>Social Media Posting</span>
          <h2>Post a requirement for any platform</h2>
          <p>Create a social media promotion brief for reels, stories, posts, shorts, channel broadcasts, or creator mentions. Experts can quote with price, timeline, and proof plan.</p>
          <div className="auction-benefits"><span>All platforms</span><span>Quote comparison</span><span>Escrow ready</span><span>Proof tracking</span></div>
        </div>
        <button className="btn primary" onClick={openStoryBrief} type="button">Post Social Media Work</button>
      </article>

      <div className="section-title"><h2>Your Social Media Posts</h2></div>
      <div className="workspace-list compact-list">
        {socialBriefs.length ? socialBriefs.map(brief => (
          <article className="workspace-card brief-card glass" key={brief._id}>
            <div>
              <h3>{brief.brandName} - {getBriefLabel(brief)}</h3>
              <p>{brief.goal}</p>
              <small>{brief.budget} - {brief.targetAudience} - {ageLabel(brief)}{brief.city ? ` - ${brief.city}` : ""} - {brief.language || "English"}</small>
              <BriefTimeline status={brief.status} />
              <QuoteComparison brief={brief} acceptQuote={acceptQuote} requestQuoteRevision={requestQuoteRevision} proposeCounter={proposeCounter} respondCounter={respondCounter} shortlistQuote={shortlistQuote} actionBusy={actionBusy} />
            </div>
            <div className="brief-actions">
              <span className={`status ${String(brief.status).replace("_", "-")}`}>{String(brief.status).replace("_", " ")}</span>
              {brief.rating ? <span className="rating-pill">{brief.rating} star review</span> : null}
              {brief.status === "expert_selected" ? <button className="btn growth" onClick={() => payEscrow(brief._id)} type="button">Pay Escrow</button> : null}
              {["paid", "in_progress", "proof_submitted"].includes(brief.status) ? <button className="btn secondary" onClick={() => openProof(brief)} type="button">Upload Proof</button> : null}
              {brief.status === "proof_submitted" ? <button className="btn primary" onClick={() => reviewProof(brief._id, "approved")} type="button">Approve Proof</button> : null}
              {brief.status === "proof_submitted" ? <button className="btn outline" onClick={() => reviewProof(brief._id, "revision_requested")} type="button">Request Revision</button> : null}
              {["paid", "in_progress", "proof_submitted"].includes(brief.status) ? <button className="btn outline" onClick={() => disputeBrief(brief._id)} type="button">Dispute</button> : null}
              {brief.proofLink ? <a href={brief.proofLink} target="_blank" rel="noreferrer">View proof</a> : null}
              {brief.proofReach ? <span className="rating-pill">{brief.proofReach} reach</span> : null}
              {brief.proofClicks ? <span className="rating-pill">{brief.proofClicks} clicks</span> : null}
              <select value={brief.rating || 0} onChange={event => rateBrief(brief._id, Number(event.target.value))}>
                <option value="0">Rate</option>
                {[1, 2, 3, 4, 5].map(value => <option key={value} value={value}>{value} stars</option>)}
              </select>
            </div>
          </article>
        )) : <article className="market-empty glass">No social media posts yet. Post one when you want creators or experts to promote your campaign.</article>}
      </div>
    </div>
  );
}

function ListingCollection({ title, items, connectedNames, savedItems, toggleSavedItem, connectBusiness, offerContract, openMessageBox, emptyText }) {
  return (
    <div className="post-marketplace">
      <div className="section-title"><h2>{title}</h2></div>
      <div className="market-list">
        {items.length ? items.map(item => (
          <MarketCard key={item._id} item={item} connected={connectedNames.has(item.title)} saved={savedItems.includes(item._id)} toggleSavedItem={toggleSavedItem} connectBusiness={connectBusiness} offerContract={offerContract} openMessageBox={openMessageBox} />
        )) : <article className="market-empty glass">{emptyText}</article>}
      </div>
    </div>
  );
}

function PromotionMarketplaceSection({ promotions, filter, setFilter, marketFilters, setMarketFilters, search, setSearch, sort, setSort, setView, connectBusiness, connectedNames, offerContract, openMessageBox, savedItems, savedSearches, saveCurrentSearch, applySavedSearch, removeSavedSearch, toggleSavedItem, isPinnedWork = () => false, togglePinnedWork = () => {}, setWorkReminder = () => {} }) {
  const chips = [
    ["all", "All", "All"],
    ...statusOptions.map(status => ["status", status, status])
  ];
  const selectedType = filter.kind === "type" ? filter.value : "";

  return (
    <div className="post-marketplace">
      <div className="market-hero">
        <div>
          <h1>Promotion Marketplace</h1>
          <p>Find verified partners, compare promotion spaces, and start contract conversations.</p>
        </div>
        <div className="market-hero-actions">
          <button className="btn outline" onClick={() => setView("post")} type="button">Create Listing</button>
        </div>
      </div>

      <div className="market-tools glass">
        <div className="market-search-row">
          <input type="search" value={search} onChange={event => setSearch(event.target.value)} maxLength="80" placeholder="Search businesses, audience, type, or status" />
          <strong>{promotions.length} match{promotions.length === 1 ? "" : "es"}</strong>
        </div>
        <div className="tool-row">
          <label>
            <span>Sort</span>
            <select value={sort} onChange={event => setSort(event.target.value)}>
              {sortOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label>
            <span>Promotion type</span>
            <select value={selectedType} onChange={event => setFilter(event.target.value ? { kind: "type", value: event.target.value } : { kind: "all", value: "All" })}>
              <option value="">All promotion types</option>
              {promotionTypes.map(type => <option key={type} value={type}>{type}</option>)}
            </select>
          </label>
          <label>
            <span>Platform</span>
            <select value={marketFilters.platform} onChange={event => setMarketFilters({ ...marketFilters, platform: event.target.value })}>
              <option value="all">Any platform</option>
              {socialPlatformOptions.map(platform => <option key={platform} value={platform}>{platform}</option>)}
            </select>
          </label>
          <label>
            <span>City</span>
            <input value={marketFilters.city} onChange={event => setMarketFilters({ ...marketFilters, city: event.target.value })} placeholder="Any city" maxLength="80" />
          </label>
          <label>
            <span>Budget</span>
            <select value={marketFilters.budget} onChange={event => setMarketFilters({ ...marketFilters, budget: event.target.value })}>
              {budgetFilterOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label>
            <span>Delivery</span>
            <select value={marketFilters.delivery} onChange={event => setMarketFilters({ ...marketFilters, delivery: event.target.value })}>
              {deliveryFilterOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label>
            <span>Language</span>
            <select value={marketFilters.language} onChange={event => setMarketFilters({ ...marketFilters, language: event.target.value })}>
              <option value="all">Any language</option>
              {languageOptions.map(language => <option key={language} value={language}>{language}</option>)}
            </select>
          </label>
        </div>
        <div className="chips">
          {chips.map(([kind, value, label]) => (
            <button key={`${kind}-${value}`} className={`chip ${filter.kind === kind && filter.value === value ? "active" : ""}`} onClick={() => setFilter({ kind, value })} type="button">{label}</button>
          ))}
          <button className={`chip ${marketFilters.savedOnly ? "active" : ""}`} onClick={() => setMarketFilters({ ...marketFilters, savedOnly: !marketFilters.savedOnly })} type="button">Saved only</button>
        </div>
        <div className="saved-search-row">
          <button className="btn outline" onClick={saveCurrentSearch} type="button">Save Search</button>
          {savedSearches.map(item => (
            <span className="saved-search-pill" key={item.id}>
              <button onClick={() => applySavedSearch(item)} type="button">{item.name}</button>
              <button onClick={() => removeSavedSearch(item.id)} type="button" aria-label={`Remove ${item.name}`}>x</button>
            </span>
          ))}
        </div>
        <button className="btn outline clear-filters" onClick={() => { setSearch(""); setFilter({ kind: "all", value: "All" }); setMarketFilters({ budget: "all", delivery: "all", language: "all", platform: "all", city: "", rating: "all", savedOnly: false }); setSort("newest"); }} type="button">Clear Filters</button>
      </div>

      <div className="market-list">
        {promotions.length ? promotions.map(item => (
          <MarketCard key={item._id} item={item} connected={connectedNames.has(item.title)} saved={savedItems.includes(item._id)} pinned={isPinnedWork("listing", item._id)} togglePinnedWork={togglePinnedWork} setWorkReminder={setWorkReminder} toggleSavedItem={toggleSavedItem} connectBusiness={connectBusiness} offerContract={offerContract} openMessageBox={openMessageBox} />
        )) : (
          <article className="market-empty glass">
            <h3>No matching partners</h3>
            <p>Clear filters or publish a new listing to create more marketplace activity.</p>
            <button className="btn primary" onClick={() => setView("post")} type="button">Create Listing</button>
          </article>
        )}
      </div>

      {promotions[0] ? (
        <article className="spotlight glass">
          <span>Best Current Match</span>
          <h2>{promotions[0].title}</h2>
          <p>{promotions[0].description}</p>
          <div>
            <button className="btn light" onClick={() => openMessageBox(promotions[0].title)} type="button">Message Partner</button>
            <button className="btn dark" onClick={() => offerContract(promotions[0])} type="button">Offer Contract</button>
          </div>
        </article>
      ) : null}
    </div>
  );
}

function AuctionCenter({ openAuctions, adBriefs, isPinnedWork, togglePinnedWork, setWorkReminder, openStoryBrief, openQuote, requestQuoteRevision, proposeCounter, respondCounter, shortlistQuote, closeAuction, actionBusy, acceptQuote, payEscrow, openProof, reviewProof, disputeBrief, rateBrief }) {
  const [auctionTab, setAuctionTab] = useState("live");
  const [auctionSort, setAuctionSort] = useState("ending");
  const [auctionSearch, setAuctionSearch] = useState("");
  const [auctionDetail, setAuctionDetail] = useState(null);
  const myAuctions = adBriefs.filter(brief => brief.isAuction);
  const liveOwned = myAuctions.filter(brief => ["open", "quotes_received"].includes(brief.status) && brief.auctionStatus === "live").length;
  const bidTotal = myAuctions.reduce((sum, brief) => sum + (brief.quotes?.length || 0), 0);
  const bidAuctions = myAuctions.filter(brief => (brief.quotes || []).length);
  const wonWork = myAuctions.filter(brief => ["expert_selected", "paid", "in_progress", "proof_submitted", "completed"].includes(brief.status));
  const closedAuctions = myAuctions.filter(brief => brief.auctionStatus === "closed" || ["completed", "closed"].includes(brief.status));
  const searchedOpenAuctions = openAuctions.filter(auction => {
    const query = auctionSearch.trim().toLowerCase();
    if (!query) return true;
    return [auction.brandName, auction.platform, auction.format, auction.socialHandle, auction.goal, auction.targetAudience, auction.city, auction.language, auction.budget, auction.urgency].join(" ").toLowerCase().includes(query);
  });
  const sortedOpenAuctions = [...searchedOpenAuctions].sort((a, b) => {
    if (auctionSort === "budget") return priceRank(b.budget) - priceRank(a.budget);
    if (auctionSort === "bids") return (b.quotes?.length || 0) - (a.quotes?.length || 0);
    if (auctionSort === "urgent") return (b.urgency === "urgent" ? 1 : 0) - (a.urgency === "urgent" ? 1 : 0);
    if (auctionSort === "platform") return String(a.platform || "").localeCompare(String(b.platform || ""));
    return new Date(a.auctionEndsAt || a.createdAt || 0) - new Date(b.auctionEndsAt || b.createdAt || 0);
  });

  return (
    <section className="view active">
      <div className="market-hero">
        <div>
          <h1>Auction Center</h1>
          <p>Launch urgent ad and social media work, collect bids from experts, shortlist the best offer, and award through escrow.</p>
        </div>
        <div className="market-hero-actions">
          <button className="btn primary" onClick={openStoryBrief} type="button">Create Auction</button>
        </div>
      </div>

      <article className="story-flow glass">
        <div>
          <span>Fast Campaign Auction</span>
          <h2>Need a reel, post, or ad promoted fast?</h2>
          <p>Use auction mode when speed matters. Experts place bids with price, timeline, proof plan, and platform fit while you keep control of who wins.</p>
          <div className="auction-benefits"><span>Escrow protected</span><span>Proof required</span><span>Fast bids</span><span>Buyer chooses winner</span></div>
        </div>
        <button className="btn growth" onClick={openStoryBrief} type="button">Start Fast Auction</button>
      </article>

      <div className="workspace-grid">
        <article className="glass info-card"><h2>Live Auctions</h2><strong className="big-number">{openAuctions.length}</strong><p>Available urgent jobs experts can bid on now.</p></article>
        <article className="glass info-card"><h2>Your Auctions</h2><strong className="big-number">{myAuctions.length}</strong><p>{liveOwned} still accepting bids.</p></article>
        <article className="glass info-card"><h2>Total Bids</h2><strong className="big-number">{bidTotal}</strong><p>Quotes received across your auction campaigns.</p></article>
      </div>
      <div className="tab-row option-tabs">
        {[
          ["live", "Live Auctions"],
          ["mine", "My Auctions"],
          ["bids", "Bids Received"],
          ["won", "Won Work"],
          ["closed", "Closed Auctions"]
        ].map(([id, label]) => <button key={id} className={auctionTab === id ? "active" : ""} onClick={() => setAuctionTab(id)} type="button">{label}</button>)}
      </div>

      {auctionTab === "live" ? <><div className="section-title"><h2>Live Auction Marketplace</h2></div>
      <div className="market-tools glass compact-tools">
        <label>
          <span>Search specific auction</span>
          <input value={auctionSearch} onChange={event => setAuctionSearch(event.target.value)} placeholder="Brand, platform, handle, city, budget" maxLength="100" />
        </label>
        <label>
          <span>Sort auctions</span>
          <select value={auctionSort} onChange={event => setAuctionSort(event.target.value)}>
            <option value="ending">Ending soon</option>
            <option value="budget">Highest budget</option>
            <option value="bids">Most bids</option>
            <option value="urgent">Urgent first</option>
            <option value="platform">Platform</option>
          </select>
        </label>
      </div>
      <div className="auction-grid">
        {sortedOpenAuctions.length ? sortedOpenAuctions.map(auction => {
          const lowestBid = [...(auction.quotes || [])].sort((a, b) => quoteRank(a) - quoteRank(b))[0];
          return (
            <article className="auction-card glass" key={auction._id}>
              <span className={`urgency ${auction.urgency}`}>{auction.urgency}</span>
              <h3>{auction.brandName}</h3>
              <p>{auction.goal}</p>
              <small>{getBriefLabel(auction)} - {auction.budget} - {auction.language || "English"} - {timeLeftLabel(auction.auctionEndsAt)}</small>
              <div className="auction-stats"><span>{auction.quotes?.length || 0} bids</span><span>{lowestBid ? `Lowest ${lowestBid.amount}` : "No bids yet"}</span></div>
              <button className="btn growth" onClick={() => openQuote(auction)} type="button">Place Bid</button>
              <button className="btn outline" onClick={() => setAuctionDetail(auction)} type="button">Details</button>
              <button className="btn outline" onClick={() => togglePinnedWork({ type: "auction", id: auction._id, title: auction.brandName, detail: `${getBriefLabel(auction)} - ${timeLeftLabel(auction.auctionEndsAt)}`, view: "auction", timeLimit: auction.auctionEndsAt })} type="button">{isPinnedWork("auction", auction._id) ? "Unpin" : "Pin"}</button>
              <button className="btn outline" onClick={() => setWorkReminder({ type: "auction", id: auction._id, title: auction.brandName, detail: `${getBriefLabel(auction)} - ${timeLeftLabel(auction.auctionEndsAt)}`, view: "auction", timeLimit: auction.auctionEndsAt })} type="button">Remind</button>
            </article>
          );
        }) : <article className="market-empty glass">No live auctions right now. Create one when you need fast bids.</article>}
      </div></> : null}

      {auctionTab === "mine" || auctionTab === "bids" || auctionTab === "won" || auctionTab === "closed" ? <><div className="section-title"><h2>{auctionTab === "bids" ? "Bids Received" : auctionTab === "won" ? "Won Work" : auctionTab === "closed" ? "Closed Auctions" : "Your Auction Campaigns"}</h2></div>
      <div className="workspace-list compact-list">
        {(auctionTab === "bids" ? bidAuctions : auctionTab === "won" ? wonWork : auctionTab === "closed" ? closedAuctions : myAuctions).length ? (auctionTab === "bids" ? bidAuctions : auctionTab === "won" ? wonWork : auctionTab === "closed" ? closedAuctions : myAuctions).map(brief => (
          <article className="workspace-card brief-card glass" key={brief._id}>
            <div>
              <h3>{brief.brandName} - {getBriefLabel(brief)}</h3>
              <p>{brief.goal}</p>
              <small>{brief.budget} - {brief.targetAudience} - {ageLabel(brief)}{brief.city ? ` - ${brief.city}` : ""} - {brief.language || "English"} - {timeLeftLabel(brief.auctionEndsAt)}</small>
              <BriefTimeline status={brief.status} />
              <QuoteComparison brief={brief} acceptQuote={acceptQuote} requestQuoteRevision={requestQuoteRevision} proposeCounter={proposeCounter} respondCounter={respondCounter} shortlistQuote={shortlistQuote} actionBusy={actionBusy} />
            </div>
            <div className="brief-actions">
              <span className={`status ${String(brief.status).replace("_", "-")}`}>{String(brief.status).replace("_", " ")}</span>
              <span className={`urgency ${brief.urgency}`}>{brief.urgency || "auction"}</span>
              {brief.rating ? <span className="rating-pill">{brief.rating} star review</span> : null}
              {brief.status === "expert_selected" ? <button className="btn growth" onClick={() => payEscrow(brief._id)} type="button">Pay Escrow</button> : null}
              {["open", "quotes_received"].includes(brief.status) && brief.auctionStatus === "live" ? <button className="btn outline" onClick={() => closeAuction(brief._id)} type="button">Close Auction</button> : null}
              <button className="btn outline" onClick={() => setAuctionDetail(brief)} type="button">Details</button>
              <button className="btn outline" onClick={() => togglePinnedWork({ type: "auction", id: brief._id, title: brief.brandName, detail: `${getBriefLabel(brief)} - ${timeLeftLabel(brief.auctionEndsAt)}`, view: "auction", timeLimit: brief.auctionEndsAt })} type="button">{isPinnedWork("auction", brief._id) ? "Unpin" : "Pin"}</button>
              <button className="btn outline" onClick={() => setWorkReminder({ type: "auction", id: brief._id, title: brief.brandName, detail: `${getBriefLabel(brief)} - ${timeLeftLabel(brief.auctionEndsAt)}`, view: "auction", timeLimit: brief.auctionEndsAt })} type="button">Remind</button>
              {["paid", "in_progress", "proof_submitted"].includes(brief.status) ? <button className="btn secondary" onClick={() => openProof(brief)} type="button">Upload Proof</button> : null}
              {brief.status === "proof_submitted" ? <button className="btn primary" onClick={() => reviewProof(brief._id, "approved")} type="button">Approve Proof</button> : null}
              {brief.status === "proof_submitted" ? <button className="btn outline" onClick={() => reviewProof(brief._id, "revision_requested")} type="button">Request Revision</button> : null}
              {["paid", "in_progress", "proof_submitted"].includes(brief.status) ? <button className="btn outline" onClick={() => disputeBrief(brief._id)} type="button">Dispute</button> : null}
              {brief.proofLink ? <a href={brief.proofLink} target="_blank" rel="noreferrer">View proof</a> : null}
              {brief.proofReach ? <span className="rating-pill">{brief.proofReach} reach</span> : null}
              {brief.proofClicks ? <span className="rating-pill">{brief.proofClicks} clicks</span> : null}
              <select value={brief.rating || 0} onChange={event => rateBrief(brief._id, Number(event.target.value))}>
                <option value="0">Rate</option>
                {[1, 2, 3, 4, 5].map(value => <option key={value} value={value}>{value} stars</option>)}
              </select>
            </div>
          </article>
        )) : <article className="market-empty glass">No auction campaigns in this option yet.</article>}
      </div></> : null}
      {auctionDetail ? <AuctionDetailPanel auction={auctionDetail} close={() => setAuctionDetail(null)} openQuote={openQuote} closeAuction={closeAuction} /> : null}
    </section>
  );
}

function AuctionDetailPanel({ auction, close, openQuote, closeAuction }) {
  const quotes = auction.quotes || [];
  const lowestBid = [...quotes].sort((a, b) => quoteRank(a) - quoteRank(b))[0];
  return (
    <article className="glass detail-panel">
      <div className="section-title"><h2>{auction.brandName}</h2><button onClick={close} type="button">Close</button></div>
      <p>{auction.goal}</p>
      <dl>
        <dt>Platform</dt><dd>{getBriefLabel(auction)}</dd>
        <dt>Budget</dt><dd>{auction.budget || "Budget open"}</dd>
        <dt>Countdown</dt><dd>{timeLeftLabel(auction.auctionEndsAt)}</dd>
        <dt>Bids</dt><dd>{quotes.length}</dd>
        <dt>Best price</dt><dd>{lowestBid ? lowestBid.amount : "No bids yet"}</dd>
        <dt>Status</dt><dd>{auction.status || auction.auctionStatus || "live"}</dd>
      </dl>
      <div className="quote-comparison">
        {quotes.length ? quotes.map(quote => (
          <article className="quote-card" key={quote._id}>
            <strong>{quote.expertName}</strong>
            <p>{quote.message}</p>
            <div className="quote-metrics"><span>{quote.amount}</span><span>{quote.timeline}</span><span>{quote.matchScore || 0}% match</span></div>
            <em>{quote.status}</em>
          </article>
        )) : <small>No bids yet.</small>}
      </div>
      <div className="quote-actions">
        <button className="btn growth" onClick={() => openQuote(auction)} type="button">Place Bid</button>
        {["open", "quotes_received"].includes(auction.status) && auction.auctionStatus === "live" ? <button className="btn outline" onClick={() => closeAuction(auction._id)} type="button">Close Auction</button> : null}
      </div>
    </article>
  );
}

function Marketplace({ promotions, filter, setFilter, marketFilters, setMarketFilters, search, setSearch, sort, setSort, setView, connectBusiness, connectedNames, offerContract, openMessageBox, savedItems, savedSearches, pinnedWork, shortlists, saveCurrentSearch, applySavedSearch, removeSavedSearch, toggleSavedItem, isPinnedWork, togglePinnedWork, setWorkReminder, removePinnedWork, openPinnedWork, adBriefs, openBriefs, experts, viewExpertProfile, saveExpertToShortlist, openStoryBrief, openQuote, inviteExpert, requestQuoteRevision, proposeCounter, respondCounter, shortlistQuote, actionBusy, acceptQuote, payEscrow, openProof, reviewProof, disputeBrief, rateBrief }) {
  const [marketTab, setMarketTab] = useState("ads");
  const socialBriefs = adBriefs.filter(brief => !brief.isAuction);
  const quoteItems = quoteInboxItems(adBriefs);
  const topBrief = socialBriefs.find(brief => ["open", "quotes_received"].includes(brief.status)) || openBriefs[0];
  const scoredExperts = experts.map(expert => ({ ...expert, matchScore: topBrief ? localExpertMatch(expert, topBrief) : expert.profileStrength || 30 })).sort((a, b) => b.matchScore - a.matchScore);
  const filteredOpenBriefs = openBriefs.filter(brief => {
    const platformMatch = marketFilters.platform === "all" || brief.platform === marketFilters.platform;
    const languageMatch = marketFilters.language === "all" || brief.language === marketFilters.language;
    const cityMatch = !marketFilters.city || String(brief.city || "").toLowerCase().includes(marketFilters.city.toLowerCase());
    return platformMatch && languageMatch && cityMatch;
  }).sort((a, b) => {
    const urgencyScore = value => value === "urgent" ? 2 : value === "fast" ? 1 : 0;
    return urgencyScore(b.urgency) - urgencyScore(a.urgency) || new Date(a.auctionEndsAt || a.createdAt || 0) - new Date(b.auctionEndsAt || b.createdAt || 0);
  });

  return (
    <section className="view active">
      <div className="market-hero">
        <div>
          <h1>Expert Marketplace</h1>
          <p>Browse all advertisements, find verified ad experts, review open buyer briefs, and manage social media campaign work.</p>
        </div>
        <div className="market-hero-actions">
          <button className="btn growth" onClick={() => { openStoryBrief(); }} type="button">Post Social Brief</button>
          <button className="btn outline" onClick={() => setView("auction")} type="button">Open Auction</button>
        </div>
      </div>
      <div className="tab-row option-tabs">
        {[
          ["ads", "All Advertisements"],
          ["experts", "Experts"],
          ["briefs", "Open Briefs"],
          ["quotes", "Quote Inbox"],
          ["pinned", "Pinned & Reminders"],
          ["saved", "Saved Experts"],
          ["mine", "My Social Briefs"]
        ].map(([id, label]) => <button key={id} className={marketTab === id ? "active" : ""} onClick={() => setMarketTab(id)} type="button">{label}</button>)}
      </div>

      {marketTab === "ads" ? <PromotionMarketplaceSection
        promotions={promotions}
        filter={filter}
        setFilter={setFilter}
        marketFilters={marketFilters}
        setMarketFilters={setMarketFilters}
        search={search}
        setSearch={setSearch}
        sort={sort}
        setSort={setSort}
        setView={setView}
        connectBusiness={connectBusiness}
        connectedNames={connectedNames}
        offerContract={offerContract}
        openMessageBox={openMessageBox}
        savedItems={savedItems}
        savedSearches={savedSearches}
        saveCurrentSearch={saveCurrentSearch}
        applySavedSearch={applySavedSearch}
        removeSavedSearch={removeSavedSearch}
        toggleSavedItem={toggleSavedItem}
        isPinnedWork={isPinnedWork}
        togglePinnedWork={togglePinnedWork}
        setWorkReminder={setWorkReminder}
      /> : null}

      {marketTab === "experts" ? <><div className="section-title"><h2>Ad Expert Directory</h2></div>
      <div className="expert-directory">
        {scoredExperts.length ? scoredExperts.slice(0, 4).map(expert => (
          <article className="expert-card glass" key={expert._id}>
            <span className="expertise-badge">{expert.expertise}</span>
            <h3>{expert.businessName}{isBlueTickExpert(expert) ? <span className="blue-tick" title="Verified expert">✓</span> : null}</h3>
            <p>{expert.industry}{expert.location ? ` - ${expert.location}` : ""}</p>
            {expert.followerCount ? <p className="follower-line">{followerLabel(expert.followerCount)}</p> : null}
            {renderSocialStrip(expert)}
            <div className="badge-row">{expertBadges(expert).map(badge => <span className="rating-pill" key={badge}>{badge}</span>)}</div>
            <div className="expert-score"><strong>{expert.matchScore}%</strong><span>Match</span></div>
            <div className="quote-actions"><button className="btn secondary" onClick={() => viewExpertProfile(expert._id)} type="button">Profile</button><button className="btn outline" onClick={() => saveExpertToShortlist(expert._id)} type="button">Shortlist</button></div>
            {topBrief?._id && adBriefs.some(brief => brief._id === topBrief._id) ? <button className="btn outline" disabled={actionBusy === `invite-${expert._id}`} onClick={() => inviteExpert(topBrief._id, expert._id)} type="button">Invite</button> : null}
            <small>Profile strength {expert.profileStrength || 30}%{expert.followerCount ? ` - ${followerLabel(expert.followerCount)}` : ""} - Payment protected</small>
            {(expert.serviceCatalog || []).length ? <div className="service-list">{expert.serviceCatalog.slice(0, 3).map(service => <span key={`${expert._id}-${service.service}`}>{service.platform}: {service.service} / {service.startingPrice}</span>)}</div> : null}
          </article>
        )) : <article className="market-empty glass">No expert profiles yet. Add ad expertise in Profile Settings to appear here.</article>}
      </div></> : null}

      {marketTab === "saved" ? <SavedExperts shortlists={shortlists} viewExpertProfile={viewExpertProfile} /> : null}

      {marketTab === "briefs" ? <><div className="section-title"><h2>Open Brief Marketplace</h2></div>
      <div className="workspace-list compact-list">
        {filteredOpenBriefs.length ? filteredOpenBriefs.slice(0, 5).map(brief => (
          <article className="workspace-card brief-card glass" key={brief._id}>
            <div>
              <h3>{brief.brandName} - {getBriefLabel(brief)}</h3>
              <p>{brief.goal}</p>
              <small>{brief.budget} - {brief.targetAudience} - {ageLabel(brief)}{brief.city ? ` - ${brief.city}` : ""} - {brief.language || "English"}</small>
            </div>
            <div className="brief-actions">
              <span className={`status ${String(brief.status).replace("_", "-")}`}>{String(brief.status).replace("_", " ")}</span>
              <button className="btn growth" onClick={() => openQuote(brief)} type="button">Send Quote</button>
              <button className="btn outline" onClick={() => togglePinnedWork({ type: "brief", id: brief._id, title: brief.brandName, detail: `${getBriefLabel(brief)} - ${brief.budget}`, view: "marketplace" })} type="button">{isPinnedWork("brief", brief._id) ? "Unpin" : "Pin"}</button>
              <button className="btn outline" onClick={() => setWorkReminder({ type: "brief", id: brief._id, title: brief.brandName, detail: `${getBriefLabel(brief)} - ${brief.budget}`, view: "marketplace" })} type="button">Remind</button>
            </div>
          </article>
        )) : <article className="market-empty glass">No open buyer briefs right now. New social media requirements will appear here for experts.</article>}
      </div></> : null}

      {marketTab === "quotes" ? <QuoteInbox items={quoteItems} acceptQuote={acceptQuote} requestQuoteRevision={requestQuoteRevision} proposeCounter={proposeCounter} respondCounter={respondCounter} shortlistQuote={shortlistQuote} actionBusy={actionBusy} /> : null}
      {marketTab === "pinned" ? <PinnedWorkPanel items={pinnedWork} openPinnedWork={openPinnedWork} removePinnedWork={removePinnedWork} setWorkReminder={setWorkReminder} /> : null}

      {marketTab === "mine" ? <><div className="section-title"><h2>Your Social Media Briefs</h2></div>
      <div className="workspace-list compact-list">
        {socialBriefs.length ? socialBriefs.map(brief => (
          <article className="workspace-card brief-card glass" key={brief._id}>
            <div>
              <h3>{brief.brandName} - {getBriefLabel(brief)}</h3>
              <p>{brief.goal}</p>
              <small>{brief.budget} - {brief.targetAudience} - {ageLabel(brief)}{brief.city ? ` - ${brief.city}` : ""} - {brief.language || "English"}</small>
              <BriefTimeline status={brief.status} />
              <QuoteComparison brief={brief} acceptQuote={acceptQuote} requestQuoteRevision={requestQuoteRevision} proposeCounter={proposeCounter} respondCounter={respondCounter} shortlistQuote={shortlistQuote} actionBusy={actionBusy} />
            </div>
            <div className="brief-actions">
              <span className={`status ${String(brief.status).replace("_", "-")}`}>{String(brief.status).replace("_", " ")}</span>
              {brief.rating ? <span className="rating-pill">{brief.rating} star review</span> : null}
              {brief.status === "expert_selected" ? <button className="btn growth" onClick={() => payEscrow(brief._id)} type="button">Pay Escrow</button> : null}
              <button className="btn outline" onClick={() => togglePinnedWork({ type: "brief", id: brief._id, title: brief.brandName, detail: `${getBriefLabel(brief)} - ${brief.status}`, view: "marketplace" })} type="button">{isPinnedWork("brief", brief._id) ? "Unpin" : "Pin"}</button>
              <button className="btn outline" onClick={() => setWorkReminder({ type: "brief", id: brief._id, title: brief.brandName, detail: `${getBriefLabel(brief)} - ${brief.status}`, view: "marketplace" })} type="button">Remind</button>
              {["paid", "in_progress", "proof_submitted"].includes(brief.status) ? <button className="btn secondary" onClick={() => openProof(brief)} type="button">Upload Proof</button> : null}
              {brief.status === "proof_submitted" ? <button className="btn primary" onClick={() => reviewProof(brief._id, "approved")} type="button">Approve Proof</button> : null}
              {brief.status === "proof_submitted" ? <button className="btn outline" onClick={() => reviewProof(brief._id, "revision_requested")} type="button">Request Revision</button> : null}
              {["paid", "in_progress", "proof_submitted"].includes(brief.status) ? <button className="btn outline" onClick={() => disputeBrief(brief._id)} type="button">Dispute</button> : null}
              {brief.proofLink ? <a href={brief.proofLink} target="_blank" rel="noreferrer">View proof</a> : null}
              {brief.proofReach ? <span className="rating-pill">{brief.proofReach} reach</span> : null}
              {brief.proofClicks ? <span className="rating-pill">{brief.proofClicks} clicks</span> : null}
              <select value={brief.rating || 0} onChange={event => rateBrief(brief._id, Number(event.target.value))}>
                <option value="0">Rate</option>
                {[1, 2, 3, 4, 5].map(value => <option key={value} value={value}>{value} stars</option>)}
              </select>
            </div>
          </article>
        )) : <article className="market-empty glass">No social media briefs yet. Post one when you want creators or experts to promote your campaign.</article>}
      </div></> : null}
    </section>
  );
}

function SavedExperts({ shortlists = [], viewExpertProfile }) {
  const saved = shortlists.filter(item => item.expert);
  return (
    <>
      <div className="section-title"><h2>Saved Experts</h2></div>
      <div className="expert-directory saved-experts">
        {saved.length ? saved.slice(0, 4).map(item => (
          <article className="expert-card glass" key={item._id}>
            <span className="expertise-badge">{item.name || "Shortlist"}</span>
            <h3>{item.expert.businessName}{isBlueTickExpert(item.expert) ? <span className="blue-tick" title="Verified expert">✓</span> : null}</h3>
            <p>{item.expert.expertise || "Advertising expert"}</p>
            {item.expert.followerCount ? <p className="follower-line">{followerLabel(item.expert.followerCount)}</p> : null}
            <div className="badge-row">{expertBadges(item.expert).map(badge => <span className="rating-pill" key={badge}>{badge}</span>)}</div>
            <small>{item.expert.availability || "available"} - {item.expert.averageRating || 0} rating</small>
            <button className="btn secondary" onClick={() => viewExpertProfile(item.expert._id)} type="button">Profile</button>
          </article>
        )) : <article className="market-empty glass">No saved experts yet. Shortlist experts from the directory to compare them here.</article>}
      </div>
    </>
  );
}

function QuoteInbox({ items, acceptQuote, requestQuoteRevision, proposeCounter, respondCounter, shortlistQuote, actionBusy }) {
  const [quoteFilter, setQuoteFilter] = useState("all");
  const filtered = items.filter(({ quote }) => quoteFilter === "all" || quote.status === quoteFilter || (quoteFilter === "bids" && quote.isBid));
  return (
    <>
      <div className="section-title"><h2>Quote Inbox</h2></div>
      <div className="tab-row option-tabs">
        {[
          ["all", "All"],
          ["submitted", "Submitted"],
          ["bids", "Auction Bids"],
          ["accepted", "Accepted"],
          ["withdrawn", "Withdrawn"]
        ].map(([id, label]) => <button key={id} className={quoteFilter === id ? "active" : ""} onClick={() => setQuoteFilter(id)} type="button">{label}</button>)}
      </div>
      <div className="workspace-list compact-list">
        {filtered.length ? filtered.map(({ brief, quote }) => (
          <article className="workspace-card brief-card glass" key={`${brief._id}-${quote._id}`}>
            <div>
              <h3>{quote.expertName} - {quote.isBid ? "Auction bid" : "Quote"}</h3>
              <p>{quote.message}</p>
              <small>{brief.brandName} - {getBriefLabel(brief)} - {quote.amount} - {quote.timeline}</small>
              <QuoteComparison brief={{ ...brief, quotes: [quote] }} acceptQuote={acceptQuote} requestQuoteRevision={requestQuoteRevision} proposeCounter={proposeCounter} respondCounter={respondCounter} shortlistQuote={shortlistQuote} actionBusy={actionBusy} />
            </div>
            <div className="brief-actions">
              <span className={`status ${String(quote.status).replace("_", "-")}`}>{String(quote.status).replace("_", " ")}</span>
              {quote.shortlisted ? <span className="rating-pill">Shortlisted</span> : null}
            </div>
          </article>
        )) : <article className="market-empty glass">No quotes in this option yet.</article>}
      </div>
    </>
  );
}

function PinnedWorkPanel({ items = [], openPinnedWork, removePinnedWork, setWorkReminder }) {
  return (
    <>
      <div className="section-title"><h2>Pinned & Reminders</h2></div>
      <div className="workspace-list compact-list">
        {items.length ? items.map(item => (
          <article className="workspace-card glass" key={item.key}>
            <div>
              <h3>{item.title}</h3>
              <p>{item.detail}</p>
              <small>Reminder: {reminderLabel(item.reminderAt)}{item.timeLimit ? ` - Limit: ${reminderLabel(item.timeLimit)}` : ""}</small>
            </div>
            <div className="brief-actions">
              <span className="rating-pill">{item.type}</span>
              <button className="btn secondary" onClick={() => openPinnedWork(item)} type="button">Open</button>
              <button className="btn outline" onClick={() => setWorkReminder(item)} type="button">Set Reminder</button>
              <button className="btn outline" onClick={() => removePinnedWork(item.key)} type="button">Remove</button>
            </div>
          </article>
        )) : <article className="market-empty glass">No pinned work yet. Pin auctions, briefs, or listings from the market.</article>}
      </div>
    </>
  );
}

function MarketCard({ item, connected, saved, pinned = false, toggleSavedItem, togglePinnedWork = () => {}, setWorkReminder = () => {}, connectBusiness, offerContract, openMessageBox }) {
  const statusClass = String(item.status || "Online").toLowerCase().replace(/\s+/g, "-");
  const priceLabel = item.price && item.price !== "New listing" ? item.price : "Price on request";
  const image = item.image || "https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=900&q=80";

  return (
    <article className="market-card glass">
      <img src={image} alt={`${item.title} promotion space`} />
      <div className="body">
        <div className="card-row">
          <div>
            <h3>{item.title}</h3>
            <p>{item.partner || "Partner opportunity"}</p>
          </div>
          <div className="card-badges">
            <button className={`save-btn ${saved ? "saved" : ""}`} onClick={() => toggleSavedItem(item._id)} type="button" aria-label={saved ? "Remove saved listing" : "Save listing"}>{saved ? "Saved" : "Save"}</button>
            <span className={`status ${statusClass}`}>{item.status || "Online"}</span>
          </div>
        </div>
        <p className="market-description">{item.description}</p>
        <div className="meta">
          <span>Audience <b>{item.audience || "Audience pending"}</b></span>
          <span>Type <b>{item.type}</b></span>
        </div>
        <div className="foot">
          <strong>{priceLabel}</strong>
          <button className={`btn secondary ${connected ? "connected" : ""}`} onClick={() => connectBusiness(item.title)} type="button">{connected ? "Connected" : "Connect"}</button>
        </div>
        <div className="card-actions">
          <button className="btn outline" onClick={() => openMessageBox(item.title)} type="button">Message</button>
          <button className="btn growth" onClick={() => offerContract(item)} type="button">Offer Contract</button>
          <button className="btn outline" onClick={() => togglePinnedWork({ type: "listing", id: item._id, title: item.title, detail: `${item.type} - ${item.audience || "Audience pending"}`, view: "marketplace" })} type="button">{pinned ? "Unpin" : "Pin"}</button>
          <button className="btn outline" onClick={() => setWorkReminder({ type: "listing", id: item._id, title: item.title, detail: `${item.type} - ${item.audience || "Audience pending"}`, view: "marketplace" })} type="button">Remind</button>
        </div>
      </div>
    </article>
  );
}

function formatMoney(amount = 0, currency = "usd") {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: currency.toUpperCase() }).format((Number(amount) || 0) / 100);
}

function MessageCenter({ threads, conversations = [], openMessageBox, openConversationBox }) {
  const [messageTab, setMessageTab] = useState("all");
  const tabText = item => `${item.lastMessage || ""} ${item.recipientBusinessName || ""} ${item.participantNames?.join(" ") || ""}`.toLowerCase();
  const filterByTab = item => {
    if (messageTab === "all") return true;
    if (messageTab === "unread") return Number(item.unreadCount || 0) > 0;
    if (messageTab === "brief") return /brief|quote|proof|campaign/.test(tabText(item));
    if (messageTab === "contract") return /contract|deal|payment|escrow/.test(tabText(item));
    if (messageTab === "auction") return /auction|bid/.test(tabText(item));
    return true;
  };
  const filteredConversations = conversations.filter(filterByTab);
  const filteredThreads = threads.filter(filterByTab);
  return (
    <section className="view active">
      <div className="page-heading"><h1>Message Center</h1><p>Manage partner conversations connected to requests, promotions, and paid contracts.</p></div>
      <div className="tab-row option-tabs">
        {[
          ["all", "All"],
          ["unread", "Unread"],
          ["brief", "Brief Messages"],
          ["contract", "Contract Messages"],
          ["auction", "Auction Messages"]
        ].map(([id, label]) => <button key={id} className={messageTab === id ? "active" : ""} onClick={() => setMessageTab(id)} type="button">{label}</button>)}
      </div>
      <div className="workspace-list">
        {filteredConversations.length ? filteredConversations.map(conversation => (
          <article className="workspace-card glass" key={conversation._id}>
            <div className="request-logo">2W</div>
            <div>
              <h3>{conversation.participantNames?.join(" / ") || "Shared conversation"}</h3>
              <p>{conversation.lastMessage || "No message yet"}</p>
              <small>{conversation.lastMessageAt ? new Date(conversation.lastMessageAt).toLocaleString() : "Shared thread"}</small>
            </div>
            {conversation.unreadCount ? <span className="unread-pill">{conversation.unreadCount} new</span> : null}
            <button className="btn primary" onClick={() => openConversationBox(conversation._id)} type="button">Open</button>
          </article>
        )) : null}
        {filteredThreads.length ? filteredThreads.map(thread => (
          <article className="workspace-card glass" key={thread.recipientBusinessName}>
            <div className="request-logo">{thread.recipientBusinessName.slice(0, 2).toUpperCase()}</div>
            <div>
              <h3>{thread.recipientBusinessName}</h3>
              <p>{thread.lastMessage}</p>
              <small>{thread.count} message{thread.count === 1 ? "" : "s"} - {thread.updatedAt ? new Date(thread.updatedAt).toLocaleString() : "No activity"}</small>
            </div>
            <button className="btn primary" onClick={() => openMessageBox(thread.recipientBusinessName)} type="button">Open</button>
          </article>
        )) : !filteredConversations.length ? <article className="market-empty glass">No conversations in this option yet.</article> : null}
      </div>
    </section>
  );
}

function ExpertInbox({ inbox, openQuote, respondInvitation, openBriefWorkspace, withdrawQuote }) {
  const invited = inbox.invited || [];
  const matching = inbox.matching || [];
  const quoted = inbox.quoted || [];
  const accepted = inbox.accepted || [];
  return (
    <section className="view active">
      <div className="page-heading"><h1>Expert Inbox</h1><p>Review invitations, matching briefs, quote revisions, and accepted work.</p></div>
      <div className="workspace-grid">
        <article className="glass info-card"><h2>Invitations</h2><strong className="big-number">{invited.length}</strong><p>Briefs waiting for your response.</p></article>
        <article className="glass info-card"><h2>Quotes Sent</h2><strong className="big-number">{quoted.length}</strong><p>{quoted.filter(quote => quote.revisionNote).length} revision request{quoted.filter(quote => quote.revisionNote).length === 1 ? "" : "s"}.</p></article>
        <article className="glass info-card"><h2>Accepted Work</h2><strong className="big-number">{accepted.length}</strong><p>Proof or delivery may be pending.</p></article>
      </div>
      <div className="section-title"><h2>Invited Briefs</h2></div>
      <div className="workspace-list compact-list">
        {invited.length ? invited.map(brief => (
          <article className="workspace-card brief-card glass" key={brief._id}>
            <div><h3>{brief.brandName} - {getBriefLabel(brief)}</h3><p>{brief.goal}</p><small>{brief.budget} - {brief.language}</small></div>
            <div className="brief-actions"><button className="btn primary" onClick={() => respondInvitation(brief._id, "accepted")} type="button">Accept Invite</button><button className="btn outline" onClick={() => respondInvitation(brief._id, "declined")} type="button">Decline</button><button className="btn growth" onClick={() => openQuote(brief)} type="button">Quote</button></div>
          </article>
        )) : <article className="market-empty glass">No invitations right now.</article>}
      </div>
      <div className="section-title"><h2>Matching Open Briefs</h2></div>
      <div className="workspace-list compact-list">
        {matching.length ? matching.slice(0, 8).map(brief => (
          <article className="workspace-card brief-card glass" key={brief._id}>
            <div><h3>{brief.brandName} - {getBriefLabel(brief)}</h3><p>{brief.goal}</p><small>{brief.budget} - {brief.language}</small></div>
            <div className="brief-actions"><button className="btn growth" onClick={() => openQuote(brief)} type="button">Send Quote</button><button className="btn outline" onClick={() => openBriefWorkspace(brief._id)} type="button">Workspace</button></div>
          </article>
        )) : <article className="market-empty glass">No matching briefs found.</article>}
      </div>
      <div className="section-title"><h2>Your Quotes & Bids</h2></div>
      <div className="workspace-list compact-list">
        {quoted.length ? quoted.slice(0, 8).map(quote => (
          <article className="workspace-card brief-card glass" key={quote._id}>
            <div><h3>{quote.expertName} - {quote.isBid ? "Auction bid" : "Quote"}</h3><p>{quote.message}</p><small>{quote.amount} - {quote.timeline} - {quote.status}{quote.shortlisted ? " - shortlisted" : ""}</small></div>
            <div className="brief-actions">{quote.isBid && quote.status === "submitted" ? <button className="btn outline" onClick={() => withdrawQuote(quote.brief, quote._id)} type="button">Withdraw Bid</button> : null}</div>
          </article>
        )) : <article className="market-empty glass">Your submitted quotes and bids will appear here.</article>}
      </div>
    </section>
  );
}

function ContractsCenter({ contracts, payments, adBriefs, updateContractStatus, openMessageBox, viewContractDocument, adminPaymentAction, isAdmin }) {
  const [dealTab, setDealTab] = useState("contracts");
  const proofBriefs = adBriefs.filter(brief => brief.status === "proof_submitted");
  const disputeBriefs = adBriefs.filter(brief => brief.status === "disputed");
  const completedBriefs = adBriefs.filter(brief => brief.rating || ["completed", "closed"].includes(brief.status));
  return (
    <section className="view active">
      <div className="page-heading"><h1>Contracts & Payments</h1><p>Track paid contract offers, payment status, and partner follow-up from one place.</p></div>
      <div className="workspace-grid">
        <article className="glass info-card"><h2>Total Contracts</h2><strong className="big-number">{contracts.length}</strong><p>{contracts.filter(item => item.status === "offered").length} currently offered.</p></article>
        <article className="glass info-card"><h2>Paid Payments</h2><strong className="big-number">{payments.filter(item => item.status === "paid").length}</strong><p>{payments.length} total payment record{payments.length === 1 ? "" : "s"}.</p></article>
      </div>
      <div className="tab-row option-tabs">
        {[
          ["contracts", "Contracts"],
          ["payments", "Escrow Payments"],
          ["proof", "Proof Review"],
          ["disputes", "Disputes"],
          ["completed", "Completed"]
        ].map(([id, label]) => <button key={id} className={dealTab === id ? "active" : ""} onClick={() => setDealTab(id)} type="button">{label}</button>)}
      </div>
      {dealTab === "contracts" ? <>
      <div className="workspace-list">
        {contracts.length ? contracts.map(contract => (
          <article className="workspace-card contract-card glass" key={contract._id}>
            <div>
              <span className={`status ${contract.status.replace("_", "-")}`}>{contract.status.replace("_", " ")}</span>
              <h3>{contract.recipientBusinessName}</h3>
              <p>{contract.promotionTitle || "Contract offer"}</p>
              <small>{formatMoney(contract.amount, contract.currency)} - Payment {contract.paymentStatus}</small>
              <ContractTimeline status={contract.status} paymentStatus={contract.paymentStatus} />
            </div>
            <label>
              <span>Status</span>
              <select value={contract.status} onChange={event => updateContractStatus(contract._id, event.target.value)}>
                {contractStatusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <button className="btn secondary" onClick={() => viewContractDocument(contract._id)} type="button">Document</button>
            <button className="btn outline" onClick={() => openMessageBox(contract.recipientBusinessName)} type="button">Message</button>
          </article>
        )) : <article className="market-empty glass">No contracts yet. Offer a contract from the marketplace after choosing a partner.</article>}
      </div>
      </> : null}
      {dealTab === "payments" ? <><div className="section-title"><h2>Payment History</h2></div>
      <div className="workspace-list compact-list">
        {payments.length ? payments.map(payment => (
          <article className="workspace-card glass" key={payment._id}>
            <div>
              <h3>{payment.recipientBusinessName}</h3>
              <p>{formatMoney(payment.totalAmount || payment.amount, payment.currency)} via {payment.provider}</p>
              <small>{payment.invoiceNumber || "No invoice yet"} - base {formatMoney(payment.amount, payment.currency)} - platform fee {formatMoney(payment.platformFee || 0, payment.currency)} - escrow fee {formatMoney(payment.escrowFee || 0, payment.currency)}{payment.upiVpa ? ` - payee ${payment.upiVpa}` : ""}{payment.payerUpiId ? ` - payer ${payment.payerUpiId}` : ""}{payment.upiUtr ? ` - UTR ${payment.upiUtr}` : ""}</small>
            </div>
            <div className="brief-actions">
              <span className={`status ${payment.status}`}>{payment.status}</span>
              <span className="rating-pill">{payment.releaseStatus || "held"}</span>
              {isAdmin && ["upi", "manual_upi", "manual"].includes(payment.provider) && payment.status === "pending" && payment.upiUtr ? <button className="btn growth" onClick={() => adminPaymentAction(payment._id, "verify")} type="button">Verify Payment</button> : null}
              {isAdmin && payment.status === "paid" && payment.releaseStatus === "held" ? <button className="btn secondary" onClick={() => adminPaymentAction(payment._id, "release")} type="button">Release</button> : null}
              {isAdmin && ["paid", "pending"].includes(payment.status) ? <button className="btn outline" onClick={() => adminPaymentAction(payment._id, "refund")} type="button">Refund</button> : null}
            </div>
          </article>
        )) : <article className="market-empty glass">Payment records appear after contract checkout starts.</article>}
      </div></> : null}
      {dealTab === "proof" ? <><div className="section-title"><h2>Proof Review</h2></div><BriefSummaryList briefs={proofBriefs} empty="No proof reviews waiting." /></> : null}
      {dealTab === "disputes" ? <><div className="section-title"><h2>Disputes</h2></div><BriefSummaryList briefs={disputeBriefs} empty="No disputes right now." /></> : null}
      {dealTab === "completed" ? <><div className="section-title"><h2>Completed Reviews</h2></div>
      <div className="workspace-list compact-list">
        {completedBriefs.length ? completedBriefs.map(brief => (
          <article className="workspace-card glass" key={brief._id}>
            <div>
              <h3>{brief.brandName}</h3>
              <p>{getBriefLabel(brief)} promotion completed with proof and buyer rating.</p>
              <small>{brief.rating} star rating{brief.proofLink ? " - proof uploaded" : ""}</small>
            </div>
            <span className="rating-pill">{brief.rating} stars</span>
          </article>
        )) : <article className="market-empty glass">Reviews appear after a completed brief is rated.</article>}
      </div></> : null}
    </section>
  );
}

function BriefSummaryList({ briefs, empty }) {
  return (
    <div className="workspace-list compact-list">
      {briefs.length ? briefs.map(brief => (
        <article className="workspace-card glass" key={brief._id}>
          <div>
            <h3>{brief.brandName}</h3>
            <p>{brief.goal || brief.proofNotes || "Campaign needs attention."}</p>
            <small>{getBriefLabel(brief)} - {brief.budget || "Budget pending"}</small>
          </div>
          <span className={`status ${String(brief.status).replace("_", "-")}`}>{String(brief.status).replace("_", " ")}</span>
        </article>
      )) : <article className="market-empty glass">{empty}</article>}
    </div>
  );
}

function ContractTimeline({ status, paymentStatus }) {
  const steps = [
    ["Brief", true],
    ["Quote", ["offered", "accepted", "closed"].includes(status)],
    ["Payment", paymentStatus === "paid"],
    ["Work", ["accepted", "closed"].includes(status)],
    ["Proof", status === "closed"],
    ["Complete", status === "closed"]
  ];

  return (
    <div className="contract-timeline" aria-label="Contract timeline">
      {steps.map(([label, done]) => <span key={label} className={done ? "done" : ""}>{label}</span>)}
    </div>
  );
}

function AppSettings({ settings, setSettings, user }) {
  const selectedCurrency = currencyOptions.find(([value]) => value === settings.currency)?.[1] || "INR";
  const selectedRegion = regionOptions.find(([value]) => value === settings.region)?.[1] || "India";
  const update = patch => setSettings(previous => ({ ...previous, ...patch }));

  return (
    <section>
      <div className="section-title">
        <div>
          <h2>Settings</h2>
          <p>Control how Parasara looks and which defaults are used when you create campaigns or payments.</p>
        </div>
      </div>

      <div className="settings-layout">
        <article className="glass settings-summary">
          <span className="status online">{settings.theme === "dark" ? "Dark mode" : "Light mode"}</span>
          <h1>{user?.businessName || "Your workspace"}</h1>
          <p>{selectedRegion} workspace using {selectedCurrency} as the default currency.</p>
          <div className="settings-preview-row">
            <span>{selectedCurrency}</span>
            <span>{selectedRegion}</span>
            <span>{settings.compactMode ? "Compact" : "Comfortable"}</span>
          </div>
        </article>

        <form className="settings-form glass app-settings-form">
          <h2>App Preferences</h2>
          <div className="settings-grid">
            <label>
              <span>Theme</span>
              <select value={settings.theme} onChange={event => update({ theme: event.target.value })}>
                <option value="light">Light mode</option>
                <option value="dark">Dark mode</option>
              </select>
            </label>
            <label>
              <span>Default currency</span>
              <select value={settings.currency} onChange={event => update({ currency: event.target.value })}>
                {currencyOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label>
              <span>Region</span>
              <select value={settings.region} onChange={event => update({ region: event.target.value })}>
                {regionOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label>
              <span>Date format</span>
              <select value={settings.dateFormat} onChange={event => update({ dateFormat: event.target.value })}>
                {dateFormatOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
          </div>
          <label className="toggle-row">
            <input type="checkbox" checked={settings.compactMode} onChange={event => update({ compactMode: event.target.checked })} />
            <span>Compact layout</span>
          </label>
        </form>
      </div>
    </section>
  );
}

function Profile({ setModal, user, connections, promotions, savedItems, openMessageBox, profileForm, setProfileForm, saveProfile }) {
  const [profileOption, setProfileOption] = useState("business");
  const businessName = user?.businessName || "Business Profile";
  const industry = user?.industry || "Industry not set";
  const activePromotions = promotions.filter(item => item.status === "Online").length;
  const services = profileForm.serviceCatalog || [];
  function updateService(index, patch) {
    setProfileForm({ ...profileForm, serviceCatalog: services.map((service, serviceIndex) => serviceIndex === index ? { ...service, ...patch } : service) });
  }
  return (
    <section className="view active">
      <article className="profile-hero glass"><img src="https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=800&q=80" alt={`${businessName} workspace`} /><div><span className="status online">Online - {industry}</span>{user?.expertise ? <span className="expertise-badge">{user.expertise}</span> : null}<h1>{businessName}</h1><p>{user?.description || "Add your business story, service strengths, audience proof, and campaign preferences so buyers and partners can evaluate you quickly."}</p>{renderSocialStrip(user)}<button className="btn primary" onClick={() => setModal(proposalModal)} type="button">Propose Collaboration</button><button className="btn secondary" onClick={() => openMessageBox(businessName)} type="button">Message</button></div></article>
      <div className="tab-row option-tabs">
        {[
          ["business", "Business Info"],
          ["social", "Social Handles"],
          ["services", "Expert Services"],
          ["cases", "Case Studies"],
          ["verification", "Verification"],
          ["security", "Account Security"]
        ].map(([id, label]) => <button key={id} className={profileOption === id ? "active" : ""} onClick={() => setProfileOption(id)} type="button">{label}</button>)}
      </div>
      <article className="glass option-note">
        <strong>{profileOption === "business" ? "Business Info" : profileOption === "social" ? "Social Handles" : profileOption === "services" ? "Expert Services" : profileOption === "cases" ? "Case Studies" : profileOption === "verification" ? "Verification" : "Account Security"}</strong>
        <p>{profileOption === "security" ? "Use strong credentials and keep verified contact details current. Password reset and email verification are available from the sign-in screen." : "Update the relevant fields below, then save your profile."}</p>
      </article>
      <form className={`settings-form glass profile-form profile-form-${profileOption}`} onSubmit={saveProfile}>
        <h2>Expert Profile Settings</h2>
        <div className="mode-picker">
          {accountModeOptions.map(([value, label]) => (
            <button key={value} className={profileForm.accountMode === value ? "active" : ""} onClick={() => setProfileForm({ ...profileForm, accountMode: value })} type="button">{label}</button>
          ))}
        </div>
        <div className="settings-grid">
          <label className="profile-field profile-field-business"><span>Business name</span><input value={profileForm.businessName} onChange={event => setProfileForm({ ...profileForm, businessName: event.target.value })} maxLength="120" required /></label>
          <label className="profile-field profile-field-business"><span>Industry</span><input value={profileForm.industry} onChange={event => setProfileForm({ ...profileForm, industry: event.target.value })} maxLength="80" required /></label>
          <label className="profile-field profile-field-services profile-field-verification"><span>Ad expertise</span><select value={profileForm.expertise} onChange={event => setProfileForm({ ...profileForm, expertise: event.target.value })}><option value="">Choose expertise</option>{expertiseOptions.map(option => <option key={option} value={option}>{option}</option>)}</select></label>
          <label className="profile-field profile-field-services"><span>Availability</span><select value={profileForm.availability} onChange={event => setProfileForm({ ...profileForm, availability: event.target.value })}><option value="available">Available</option><option value="busy">Busy</option><option value="offline">Offline</option></select></label>
          <label className="profile-field profile-field-services"><span>Minimum budget</span><input type="number" min="0" value={profileForm.minBudget} onChange={event => setProfileForm({ ...profileForm, minBudget: event.target.value })} placeholder="e.g. 5000" /></label>
          <label className="profile-field profile-field-services"><span>Turnaround days</span><input type="number" min="0" value={profileForm.turnaroundDays} onChange={event => setProfileForm({ ...profileForm, turnaroundDays: event.target.value })} placeholder="e.g. 3" /></label>
          <label className="profile-field profile-field-social profile-field-services profile-field-verification"><span>Total followers</span><input type="number" min="0" value={profileForm.followerCount} onChange={event => setProfileForm({ ...profileForm, followerCount: event.target.value })} placeholder="e.g. 50000" /></label>
          <label className="profile-field profile-field-services"><span>Languages</span><input value={(profileForm.serviceLanguages || []).join(", ")} onChange={event => setProfileForm({ ...profileForm, serviceLanguages: event.target.value.split(",").map(item => item.trim()).filter(Boolean) })} placeholder="English, Hindi" /></label>
          <label className="profile-field profile-field-business profile-field-verification"><span>Website</span><input value={profileForm.website} onChange={event => setProfileForm({ ...profileForm, website: event.target.value })} maxLength="180" placeholder="https://company.com" /></label>
          <label className="profile-field profile-field-business"><span>Location</span><input value={profileForm.location} onChange={event => setProfileForm({ ...profileForm, location: event.target.value })} maxLength="120" /></label>
          <label className="profile-field profile-field-business profile-field-security"><span>Phone</span><input value={profileForm.phone} onChange={event => setProfileForm({ ...profileForm, phone: event.target.value })} maxLength="40" /></label>
          <label className="profile-field profile-field-business profile-field-services profile-field-security"><span>UPI ID</span><input value={profileForm.upiId} onChange={event => setProfileForm({ ...profileForm, upiId: event.target.value })} maxLength="120" placeholder="yourname@bank" /></label>
          <label className="profile-field profile-field-social profile-field-verification"><span>Instagram</span><input value={profileForm.instagram} onChange={event => setProfileForm({ ...profileForm, instagram: event.target.value })} maxLength="120" placeholder="@profile or URL" /></label>
          <label className="profile-field profile-field-social profile-field-verification"><span>YouTube</span><input value={profileForm.youtube} onChange={event => setProfileForm({ ...profileForm, youtube: event.target.value })} maxLength="120" placeholder="Channel URL" /></label>
          <label className="profile-field profile-field-social profile-field-verification"><span>LinkedIn</span><input value={profileForm.linkedin} onChange={event => setProfileForm({ ...profileForm, linkedin: event.target.value })} maxLength="120" placeholder="Profile URL" /></label>
          <label className="profile-field profile-field-social"><span>Facebook</span><input value={profileForm.facebook} onChange={event => setProfileForm({ ...profileForm, facebook: event.target.value })} maxLength="120" placeholder="Page URL" /></label>
          <label className="profile-field profile-field-social"><span>X / Twitter</span><input value={profileForm.twitter} onChange={event => setProfileForm({ ...profileForm, twitter: event.target.value })} maxLength="120" placeholder="@handle or URL" /></label>
          <label className="profile-field profile-field-social"><span>TikTok</span><input value={profileForm.tiktok} onChange={event => setProfileForm({ ...profileForm, tiktok: event.target.value })} maxLength="120" placeholder="@handle or URL" /></label>
          <label className="profile-field profile-field-social"><span>Snapchat</span><input value={profileForm.snapchat} onChange={event => setProfileForm({ ...profileForm, snapchat: event.target.value })} maxLength="120" placeholder="@handle or URL" /></label>
          <label className="profile-field profile-field-social"><span>Pinterest</span><input value={profileForm.pinterest} onChange={event => setProfileForm({ ...profileForm, pinterest: event.target.value })} maxLength="120" placeholder="Profile URL" /></label>
          <label className="profile-field profile-field-social"><span>WhatsApp</span><input value={profileForm.whatsapp} onChange={event => setProfileForm({ ...profileForm, whatsapp: event.target.value })} maxLength="120" placeholder="Number or wa.me link" /></label>
          <label className="profile-field profile-field-social"><span>Telegram</span><input value={profileForm.telegram} onChange={event => setProfileForm({ ...profileForm, telegram: event.target.value })} maxLength="120" placeholder="@channel or URL" /></label>
          <label className="profile-field profile-field-business wide"><span>Description</span><textarea value={profileForm.description} onChange={event => setProfileForm({ ...profileForm, description: event.target.value })} rows="4" maxLength="700" /></label>
        </div>
        <div className="section-title profile-section profile-section-services"><h2>Service Catalog</h2><button onClick={() => setProfileForm({ ...profileForm, serviceCatalog: [...services, emptyService] })} type="button">Add Service</button></div>
        <div className="service-editor profile-section profile-section-services">
          {services.length ? services.map((service, index) => (
            <article className="service-edit-row" key={`service-${index}`}>
              <select value={service.platform || "Instagram"} onChange={event => updateService(index, { platform: event.target.value })}>{socialPlatformOptions.map(platform => <option key={platform} value={platform}>{platform}</option>)}</select>
              <input value={service.service || ""} onChange={event => updateService(index, { service: event.target.value })} placeholder="Service name" maxLength="120" />
              <input value={service.startingPrice || ""} onChange={event => updateService(index, { startingPrice: event.target.value })} placeholder="Starting price" maxLength="80" />
              <input type="number" min="0" value={service.deliveryDays || ""} onChange={event => updateService(index, { deliveryDays: event.target.value })} placeholder="Days" />
              <input value={service.portfolioLink || ""} onChange={event => updateService(index, { portfolioLink: event.target.value })} placeholder="Portfolio URL" maxLength="220" />
              <button className="btn outline" onClick={() => setProfileForm({ ...profileForm, serviceCatalog: services.filter((_, serviceIndex) => serviceIndex !== index) })} type="button">Remove</button>
            </article>
          )) : <article className="market-empty glass">Add service packages so buyers can understand what you offer.</article>}
        </div>
        <div className="section-title profile-section profile-section-cases profile-section-verification"><h2>Case Studies</h2><button onClick={() => setProfileForm({ ...profileForm, caseStudies: [...(profileForm.caseStudies || []), emptyCaseStudy] })} type="button">Add Case Study</button></div>
        <div className="service-editor profile-section profile-section-cases profile-section-verification">
          {(profileForm.caseStudies || []).length ? profileForm.caseStudies.map((study, index) => (
            <article className="service-edit-row" key={`case-${index}`}>
              <input value={study.title || ""} onChange={event => setProfileForm({ ...profileForm, caseStudies: profileForm.caseStudies.map((item, itemIndex) => itemIndex === index ? { ...item, title: event.target.value } : item) })} placeholder="Case title" maxLength="120" />
              <select value={study.platform || "Instagram"} onChange={event => setProfileForm({ ...profileForm, caseStudies: profileForm.caseStudies.map((item, itemIndex) => itemIndex === index ? { ...item, platform: event.target.value } : item) })}>{socialPlatformOptions.map(platform => <option key={platform} value={platform}>{platform}</option>)}</select>
              <input value={study.resultMetric || ""} onChange={event => setProfileForm({ ...profileForm, caseStudies: profileForm.caseStudies.map((item, itemIndex) => itemIndex === index ? { ...item, resultMetric: event.target.value } : item) })} placeholder="Result metric" maxLength="120" />
              <input value={study.proofLink || ""} onChange={event => setProfileForm({ ...profileForm, caseStudies: profileForm.caseStudies.map((item, itemIndex) => itemIndex === index ? { ...item, proofLink: event.target.value } : item) })} placeholder="Proof URL" maxLength="220" />
              <input value={study.summary || ""} onChange={event => setProfileForm({ ...profileForm, caseStudies: profileForm.caseStudies.map((item, itemIndex) => itemIndex === index ? { ...item, summary: event.target.value } : item) })} placeholder="Summary" maxLength="700" />
              <button className="btn outline" onClick={() => setProfileForm({ ...profileForm, caseStudies: profileForm.caseStudies.filter((_, itemIndex) => itemIndex !== index) })} type="button">Remove</button>
            </article>
          )) : <article className="market-empty glass">Add case studies to show verified outcomes and portfolio proof.</article>}
        </div>
        <button className="btn primary" type="submit">Save Profile</button>
      </form>
      <div className="profile-grid"><article className="glass info-card"><h2>Expert Description</h2><p>{user?.description || "Add a detailed expert description in profile settings."}</p><dl><dt>Mode</dt><dd>{accountModeOptions.find(([value]) => value === (user?.accountMode || "buyer"))?.[1]}</dd><dt>Expertise</dt><dd>{user?.expertise || "Not set"}</dd><dt>Email</dt><dd>{user?.email}</dd><dt>Location</dt><dd>{user?.location || "Not set"}</dd></dl></article><article className="glass info-card"><h2>Audience Demographics</h2><div className="bar bar-45"><span>Listings</span><i /><b>{promotions.length}</b></div><div className="bar bar-32"><span>Followers</span><i /><b>{followerLabel(user?.followerCount) || "0"}</b></div><h3>Top Activity</h3><p>{activePromotions} active promotions - {connections.length} partner connections</p></article><article className="glass strength-card"><h2>Profile Strength</h2><strong>{user?.profileStrength || 30}%</strong><ProgressBar value={user?.profileStrength || 30} /><p>Account Mode Selected</p><p>{user?.expertise ? "Ad Expertise Added" : "Add Ad Expertise"}</p><p>{promotions.length ? "Promotion Listings Added" : "Add Your First Promotion"}</p><p>{connections.length ? "Partner Outreach Started" : "Connect With Partners"}</p></article><article className="glass info-card"><h2>Quick Stats</h2><p><strong>{connections.length}</strong> Partner Connections</p><p><strong>{activePromotions}</strong> Active Promotions</p><p><strong>{savedItems.length}</strong> Saved Listings</p>{user?.followerCount ? <p><strong>{followerLabel(user.followerCount)}</strong> Audience</p> : null}</article></div>
      <div className="section-title"><h2>Your Promotions</h2></div><div className="past-grid">{promotions.length ? promotions.slice(0, 3).map(item => <article className="glass" key={item._id}><img src={item.image} alt={`${item.title} promotion`} /><span>{item.type}</span><h3>{item.title}</h3></article>) : <article className="market-empty glass">Your published promotions will appear here.</article>}</div>
    </section>
  );
}

function showInfo(event, setModal, type) {
  event.preventDefault();
  const content = {
    privacy: {
      title: "Privacy Policy",
      paragraphs: [
        "Parasara stores the account, profile, campaign, message, contract, and payment details needed to operate your advertising marketplace workspace.",
        "Your private workspace data is used to authenticate your account, match briefs with experts, support conversations, process escrow workflows, and show activity history."
      ],
      items: ["Use a business email you control.", "Do not upload confidential creative files unless the recipient is authorized.", "Sign out on shared devices."]
    },
    terms: {
      title: "Terms of Service",
      paragraphs: [
        "Parasara helps buyers post advertising briefs, compare expert quotes, manage messages, create contracts, and track proof of delivery.",
        "Users are responsible for accurate campaign information, legal ad creative, timely payment, and honest proof or dispute evidence."
      ],
      items: ["Quotes and timelines should be confirmed before payment.", "Escrow releases depend on the selected workflow and proof review.", "Abusive, misleading, or unlawful campaigns may be removed."]
    },
    support: {
      title: "Support",
      paragraphs: [
        "For account access, use the verify email, reset password, and sign-in tools on this screen.",
        "Inside the app, use notifications, message threads, brief workspaces, and contract timelines to understand what needs attention next."
      ],
      items: ["Create a profile before posting campaigns.", "Complete social handles and service catalog for better expert matching.", "Keep proof links and payment references attached to the relevant brief."]
    }
  };
  setModal(content[type]);
}

const notificationsModal = { title: "Notifications", paragraphs: ["Parasara tracks campaign, quote, payment, proof, dispute, and message activity for your workspace."], items: ["Review new partner requests.", "Publish complete promotion drafts.", "Respond to quote and proof updates."] };
const messageModal = { title: "Message Center", paragraphs: ["Use message threads to discuss campaign scope, files, timelines, and delivery proof with buyers or experts."], items: ["Confirm campaign objective before accepting payment.", "Attach creative files or proof screenshots when useful.", "Keep key decisions in the thread for a clean record."] };
const proposalModal = { title: "Collaboration Proposal", paragraphs: ["Send a focused proposal that explains the offer, target audience, placement format, delivery timing, and next payment step."], items: ["Campaign goal and audience.", "Placement format and deliverables.", "Price, timeline, and proof requirements."] };

export default function Root() {
  return <ErrorBoundary><App /></ErrorBoundary>;
}
