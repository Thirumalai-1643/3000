// src/app/api/userGet/route.js

import connectMongoDB from "@/app/lib/db";
import UserModel from "@/app/models/user/schema";
import { NextResponse } from "next/server";

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// Handle preflight request
export async function OPTIONS() {
  return NextResponse.json({}, {
    status: 200,
    headers: corsHeaders,
  });
}

// GET: Fetch users by domain
export async function GET(req) {
  try {
    await connectMongoDB();

    const { searchParams } = new URL(req.url);
    const domain = searchParams.get("domain");

    if (!domain) {
      return NextResponse.json(
        { success: false, message: "Missing domain in query" },
        { status: 400, headers: corsHeaders }
      );
    }

    const users = await UserModel.find({ domain }).sort({ createdAt: -1 });

    return NextResponse.json(
      {
        success: true,
        data: users,
      },
      {
        status: 200,
        headers: corsHeaders,
      }
    );
  } catch (error) {
    console.error("GET error:", error);
    return NextResponse.json(
      {
        success: false,
        message: error.message || "Internal Server Error",
      },
      {
        status: 500,
        headers: corsHeaders,
      }
    );
  }
}
