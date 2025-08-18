// src/app/api/userGet/route.js
import connectMongoDB from "@/app/lib/db";
import UserModel from "@/app/models/user/schema";
import { NextResponse } from "next/server";

// Allowed domains from env
const rawAllowed =
  process.env.ALLOWED_DOMAINS ||
  process.env.NEXT_PUBLIC_ALLOWED_DOMAINS ||
  "";
const allowedDomains = rawAllowed
  .split(",")
  .map((d) => d.trim().replace(/\/$/, ""))
  .filter(Boolean);

// Build CORS headers
const buildCorsHeaders = (origin) => ({
  "Access-Control-Allow-Origin": origin,
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Credentials": "true",
  "Access-Control-Expose-Headers": "Content-Type",
});

// Check if origin is allowed
const isOriginAllowed = (origin) => {
  if (!origin) return false;
  const normalized = origin.replace(/\/$/, "");

  // ✅ Allow localhost automatically for dev
  if (normalized.startsWith("http://localhost")) return true;

  return allowedDomains.includes(normalized);
};

// Handle preflight OPTIONS
export async function OPTIONS(req) {
  const origin = req.headers.get("origin");
  if (!isOriginAllowed(origin)) {
    return NextResponse.json({ error: "Origin not allowed" }, { status: 403 });
  }
  const headers = buildCorsHeaders(origin);
  return new NextResponse(null, { status: 204, headers });
}

// Handle GET
export async function GET(req) {
  const origin = req.headers.get("origin");
  if (!isOriginAllowed(origin)) {
    console.warn("Blocked origin (userGet):", origin);
    return NextResponse.json({ error: "Origin not allowed" }, { status: 403 });
  }

  const headers = buildCorsHeaders(origin);

  try {
    await connectMongoDB();

    const { searchParams } = new URL(req.url);
    let domain = searchParams.get("domain");

    if (!domain) {
      try {
        domain = origin ? new URL(origin).hostname : null;
      } catch {
        domain = null;
      }
    }

    if (!domain) {
      return NextResponse.json(
        { success: false, message: "Missing domain (query or origin)" },
        { status: 400, headers }
      );
    }

    const users = await UserModel.find({ domain }).sort({ createdAt: -1 }).lean();

    return NextResponse.json(
      { success: true, data: users || [] },
      { status: 200, headers }
    );
  } catch (err) {
    console.error("GET /api/userGet error:", err);
    return NextResponse.json(
      { success: false, message: err?.message || "Internal Server Error" },
      { status: 500, headers }
    );
  }
}
