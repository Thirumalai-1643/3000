// src/app/api/userPost/route.js

import { db } from "@/app/lib/firebase";
import { collection, addDoc } from "firebase/firestore";
import connectMongoDB from "@/app/lib/db";
import UserModel from "@/app/models/user/schema";
import { NextResponse } from "next/server";

// ✅ Dynamic CORS from .env
const allowedDomains = process.env.NEXT_PUBLIC_ALLOWED_DOMAINS
  ? process.env.NEXT_PUBLIC_ALLOWED_DOMAINS.split(",")
  : [];

const corsHeaders = (origin) => ({
  "Access-Control-Allow-Origin": allowedDomains.includes(origin) ? origin : "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
});

// Handle preflight request
export async function OPTIONS(req) {
  const origin = req.headers.get("origin") || "*";
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin) });
}

// POST: Store data in MongoDB and Firestore
export async function POST(req) {
  const origin = req.headers.get("origin") || "*";

  try {
    const body = await req.json();
    const { name, email, domain } = body;

    if (!name || !email || !domain) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400, headers: corsHeaders(origin) }
      );
    }

    // ✅ Save to MongoDB
    await connectMongoDB();
    const mongoDoc = await UserModel.create({ name, email, domain });

    // ✅ Save to Firebase Firestore
    let firebaseId = null;
    try {
      const firebaseDocRef = await addDoc(collection(db, "users"), {
        name,
        email,
        domain,
        createdAt: new Date().toISOString(),
      });
      firebaseId = firebaseDocRef.id;
    } catch (firebaseErr) {
      console.error("Firestore write failed:", firebaseErr);
    }

    return NextResponse.json(
      {
        success: true,
        mongoId: mongoDoc._id,
        firebaseId, // null if Firestore fails
        message: "User saved successfully in MongoDB + Firestore",
      },
      { status: 200, headers: corsHeaders(origin) }
    );
  } catch (error) {
    console.error("POST error:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500, headers: corsHeaders(origin) }
    );
  }
}
