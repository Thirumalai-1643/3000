// src/app/api/userPost/route.js

import { db } from "@/app/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import connectMongoDB from "@/app/lib/db";
import UserModel from "@/app/models/user/schema";
import { NextResponse } from "next/server";

// Prefer server-side var; fall back to public if you only have that
const rawAllowed =
  process.env.ALLOWED_DOMAINS ||
  process.env.NEXT_PUBLIC_ALLOWED_DOMAINS ||
  "";
const allowedDomains = rawAllowed
  .split(",")
  .map((d) => d.trim())
  .filter(Boolean);

// Build CORS headers for a given origin (only if allowed)
const buildCorsHeaders = (origin) => ({
  "Access-Control-Allow-Origin": origin,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Credentials": "true",
  // expose any extra headers if you need them:
  "Access-Control-Expose-Headers": "Content-Type",
});

// Helper: check if origin is allowed
const isOriginAllowed = (origin) => {
  if (!origin) return false;
  // normalize origin (strip trailing slash)
  const normalized = origin.replace(/\/$/, "");
  return allowedDomains.includes(normalized);
};

// Handle preflight
export async function OPTIONS(req) {
  const origin = req.headers.get("origin");
  if (!isOriginAllowed(origin)) {
    return NextResponse.json(
      { error: "Origin not allowed" },
      { status: 403 }
    );
  }

  const headers = buildCorsHeaders(origin);
  // 204 No Content for preflight
  return new NextResponse(null, { status: 204, headers });
}

export async function POST(req) {
  const origin = req.headers.get("origin");

  // strict origin check (important when using cookies/credentials)
  if (!isOriginAllowed(origin)) {
    console.warn("Blocked origin:", origin);
    return NextResponse.json(
      { error: "Origin not allowed" },
      { status: 403 }
    );
  }

  const headers = buildCorsHeaders(origin);

  try {
    const body = await req.json();

    // Support domain from body, query param, or origin hostname fallback
    const url = new URL(req.url || "http://localhost");
    const queryDomain = url.searchParams.get("domain");
    const domainFromOrigin = origin ? new URL(origin).hostname : null;

    const name = body?.name?.toString().trim();
    const email = body?.email?.toString().trim();
    const domain = (body?.domain || queryDomain || domainFromOrigin || "")
      .toString()
      .trim();

    if (!name || !email || !domain) {
      return NextResponse.json(
        { error: "Missing required fields (name, email, domain)" },
        { status: 400, headers }
      );
    }

    // Save to MongoDB
    await connectMongoDB();
    const mongoDoc = await UserModel.create({ name, email, domain });

    // Save to Firestore (best-effort — don't fail whole request if Firestore fails)
    let firebaseId = null;
    try {
      const firebaseDocRef = await addDoc(collection(db, "users"), {
        name,
        email,
        domain,
        createdAt: serverTimestamp ? serverTimestamp() : new Date().toISOString(),
      });
      firebaseId = firebaseDocRef.id;
    } catch (firebaseErr) {
      console.error("Firestore write failed:", firebaseErr);
    }

    return NextResponse.json(
      {
        success: true,
        mongoId: mongoDoc._id ?? mongoDoc.id ?? null,
        firebaseId,
        message: "User saved successfully",
      },
      { status: 200, headers }
    );
  } catch (err) {
    console.error("POST /api/userPost error:", err);
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500, headers }
    );
  }
}
