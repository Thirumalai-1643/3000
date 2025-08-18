// src/app/api/userPut/route.js

import { db } from "@/app/lib/firebase";
import { collection, query, where, getDocs, updateDoc, doc } from "firebase/firestore";
import connectMongoDB from "@/app/lib/db";
import UserModel from "@/app/models/user/schema";
import { NextResponse } from "next/server";

// Prefer server-side var; fall back to public var if necessary
const rawAllowed =
  process.env.ALLOWED_DOMAINS ||
  process.env.NEXT_PUBLIC_ALLOWED_DOMAINS ||
  "";
const allowedDomains = rawAllowed
  .split(",")
  .map((d) => d.trim().replace(/\/$/, ""))
  .filter(Boolean);

const buildCorsHeaders = (origin) => ({
  "Access-Control-Allow-Origin": origin,
  "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Credentials": "true",
  "Access-Control-Expose-Headers": "Content-Type",
});

const isOriginAllowed = (origin) => {
  if (!origin) return false;
  const normalized = origin.replace(/\/$/, "");
  return allowedDomains.includes(normalized);
};

// Handle CORS preflight
export async function OPTIONS(req) {
  const origin = req.headers.get("origin");
  if (!isOriginAllowed(origin)) {
    return NextResponse.json({ error: "Origin not allowed" }, { status: 403 });
  }
  const headers = buildCorsHeaders(origin);
  return new NextResponse(null, { status: 204, headers });
}

export async function PUT(req) {
  const origin = req.headers.get("origin");

  // Strict origin check
  if (!isOriginAllowed(origin)) {
    console.warn("Blocked origin (userPut):", origin);
    return NextResponse.json({ error: "Origin not allowed" }, { status: 403 });
  }

  const headers = buildCorsHeaders(origin);

  try {
    // Support email/domain from query or body
    const { searchParams } = new URL(req.url);
    const qEmail = searchParams.get("email");
    const qDomain = searchParams.get("domain");

    const body = await req.json().catch(() => ({}));
    const bodyEmail = body?.email;
    const bodyDomain = body?.domain;
    const bodyName = body?.name?.toString().trim();

    // fallback domain from origin hostname
    let domain = bodyDomain || qDomain;
    if (!domain && origin) {
      try {
        domain = new URL(origin).hostname;
      } catch (e) {
        domain = null;
      }
    }

    const email = (bodyEmail || qEmail || "").toString().trim();
    const name = bodyName;

    if (!name || !email || !domain) {
      return NextResponse.json(
        { error: "Missing required fields (name, email, domain)" },
        { status: 400, headers }
      );
    }

    // Update MongoDB
    await connectMongoDB();
    const mongoDoc = await UserModel.findOneAndUpdate(
      { email, domain },
      { name, updatedAt: new Date() },
      { new: true }
    ).lean();

    if (!mongoDoc) {
      return NextResponse.json(
        { error: "User not found in MongoDB" },
        { status: 404, headers }
      );
    }

    // Firestore update (best-effort)
    let firebaseId = null;
    try {
      const usersRef = collection(db, "users");
      const q = query(
        usersRef,
        where("email", "==", email),
        where("domain", "==", domain)
      );
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const firstDoc = querySnapshot.docs[0];
        const docRef = doc(db, "users", firstDoc.id);
        await updateDoc(docRef, {
          name,
          updatedAt: new Date().toISOString(),
        });
        firebaseId = firstDoc.id;
      } else {
        // If Firestore user not found, log and continue (do not fail the whole request)
        console.warn("Firestore: user not found for update", { email, domain });
      }
    } catch (fsErr) {
      console.error("Firestore update failed:", fsErr);
      // continue — we already updated Mongo
    }

    return NextResponse.json(
      {
        success: true,
        mongoId: mongoDoc._id ?? mongoDoc.id ?? null,
        firebaseId, // null if not found or failed
        message: "Record updated in MongoDB (Firestore update best-effort)",
      },
      { status: 200, headers }
    );
  } catch (err) {
    console.error("PUT /api/userPut error:", err);
    return NextResponse.json(
      { error: err?.message || "Internal Server Error" },
      { status: 500, headers }
    );
  }
}
