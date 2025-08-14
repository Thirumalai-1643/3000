import { db } from "@/app/lib/firebase";
import { collection, query, where, getDocs, updateDoc, doc } from "firebase/firestore";
import connectMongoDB from "@/app/lib/db";
import UserModel from "@/app/models/user/schema";
import { NextResponse } from "next/server";

// ✅ Dynamic CORS from .env
const allowedDomains = process.env.NEXT_PUBLIC_ALLOWED_DOMAINS
  ? process.env.NEXT_PUBLIC_ALLOWED_DOMAINS.split(",")
  : [];

const corsHeaders = (origin) => ({
  "Access-Control-Allow-Origin": allowedDomains.includes(origin) ? origin : "*",
  "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
});

// Handle CORS preflight
export async function OPTIONS(req) {
  const origin = req.headers.get("origin") || "*";
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(origin),
  });
}

// PUT: Update record in MongoDB + Firestore
export async function PUT(req) {
  try {
    const origin = req.headers.get("origin") || "*";
    const { searchParams } = new URL(req.url);
    const email = searchParams.get("email");
    const domain = searchParams.get("domain");

    const body = await req.json();
    const { name } = body;

    if (!name || !email || !domain) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400, headers: corsHeaders(origin) }
      );
    }

    // ✅ MongoDB update
    await connectMongoDB();
    const mongoDoc = await UserModel.findOneAndUpdate(
      { email, domain },
      { name, updatedAt: new Date() },
      { new: true }
    );

    if (!mongoDoc) {
      return NextResponse.json(
        { error: "User not found in MongoDB" },
        { status: 404, headers: corsHeaders(origin) }
      );
    }

    // ✅ Firestore update
    const usersRef = collection(db, "users");
    const q = query(usersRef, where("email", "==", email), where("domain", "==", domain));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return NextResponse.json(
        { error: "User not found in Firestore" },
        { status: 404, headers: corsHeaders(origin) }
      );
    }

    const docRef = doc(db, "users", querySnapshot.docs[0].id);
    await updateDoc(docRef, {
      name,
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json(
      {
        success: true,
        mongoId: mongoDoc._id,
        firebaseId: querySnapshot.docs[0].id,
        message: "Record updated successfully in both MongoDB and Firestore",
      },
      { status: 200, headers: corsHeaders(origin) }
    );
  } catch (error) {
    console.error("PUT error:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500, headers: corsHeaders("*") }
    );
  }
}
