// src/app/api/userGet/route.js

import connectMongoDB from "@/app/lib/db";
import UserModel from "@/app/models/user/schema";
import { NextResponse } from "next/server";

// ✅ Dynamic CORS from .env
const allowedDomains = process.env.NEXT_PUBLIC_ALLOWED_DOMAINS
  ? process.env.NEXT_PUBLIC_ALLOWED_DOMAINS.split(",")
  : [];

const corsHeaders = (origin) => ({
  "Access-Control-Allow-Origin": allowedDomains.includes(origin) ? origin : "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
});

// Handle preflight request
export async function OPTIONS(req) {
  const origin = req.headers.get("origin") || "*";
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin) });
}

// GET: Fetch users by domain
export async function GET(req) {
  const origin = req.headers.get("origin") || "*";

  try {
    await connectMongoDB();

    const { searchParams } = new URL(req.url);
    const domain = searchParams.get("domain");

    if (!domain) {
      return NextResponse.json(
        { success: false, message: "Missing domain in query" },
        { status: 400, headers: corsHeaders(origin) }
      );
    }

    const users = await UserModel.find({ domain }).sort({ createdAt: -1 });

    return NextResponse.json(
      {
        success: true,
        data: users,
      },
      { status: 200, headers: corsHeaders(origin) }
    );
  } catch (error) {
    console.error("GET error:", error);
    return NextResponse.json(
      {
        success: false,
        message: error.message || "Internal Server Error",
      },
      { status: 500, headers: corsHeaders(origin) }
    );
  }
}
