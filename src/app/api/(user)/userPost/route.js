// src/app/api/userPost/route.js

import { db } from "@/app/lib/firebase";
import { collection, addDoc } from "firebase/firestore";
import connectMongoDB from "@/app/lib/db";
import UserModel from "@/app/models/user/schema";
import { NextResponse } from "next/server";

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// Handle preflight request
export async function OPTIONS() {
  return NextResponse.json({}, {
    status: 200,
    headers: corsHeaders,
  });
}

// POST: Store data in MongoDB and Firestore
export async function POST(req) {
  try {
    const body = await req.json();
    const { name, email, domain } = body;

    if (!name || !email || !domain) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400, headers: corsHeaders }
      );
    }

    // 1. Save to MongoDB
    await connectMongoDB();
    const mongoDoc = await UserModel.create({ name, email, domain });

    // 2. Save to Firebase Firestore
    let firebaseId = null;
    try {
      const firebaseDocRef = await addDoc(collection(db, "users"), {
        name,
        email,
        domain,
        createdAt: new Date().toISOString(),
      });
      firebaseId = firebaseDocRef.id; // ✅ Correct property
    } catch (firebaseErr) {
      console.error("Firestore write failed:", firebaseErr);
    }

    return NextResponse.json(
      {
        success: true,
        mongoId: mongoDoc._id,
        firebaseId: firebaseId, // will be null if Firestore write fails
      },
      { status: 200, headers: corsHeaders }
    );

  } catch (error) {
    console.error("POST error:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500, headers: corsHeaders }
    );
  }
}
