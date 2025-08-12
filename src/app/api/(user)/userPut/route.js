import { db } from "@/app/lib/firebase";
import { collection, query, where, getDocs, updateDoc, doc } from "firebase/firestore";
import connectMongoDB from "@/app/lib/db";
import UserModel from "@/app/models/user/schema";
import { NextResponse } from "next/server";

// ✅ Make CORS headers reusable everywhere
const corsHeaders = {
  "Access-Control-Allow-Origin": "*", // Change to your frontend domain in production
  "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// Handle CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}

// PUT: Replace existing record in both MongoDB and Firestore
export async function PUT(req) {
  try {
    // Get query params
    const { searchParams } = new URL(req.url);
    const email = searchParams.get("email");
    const domain = searchParams.get("domain");

    // Get body
    const body = await req.json();
    const { name } = body;

    // Validate
    if (!name || !email || !domain) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400, headers: corsHeaders }
      );
    }

    /** 1️⃣ MongoDB Update **/
    await connectMongoDB();
    const mongoDoc = await UserModel.findOneAndUpdate(
      { email, domain },
      { name, updatedAt: new Date() },
      { new: true }
    );

    if (!mongoDoc) {
      return NextResponse.json(
        { error: "User not found in MongoDB" },
        { status: 404, headers: corsHeaders }
      );
    }

    /** 2️⃣ Firestore Update **/
    const usersRef = collection(db, "users");
    const q = query(usersRef, where("email", "==", email), where("domain", "==", domain));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return NextResponse.json(
        { error: "User not found in Firestore" },
        { status: 404, headers: corsHeaders }
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
        message: "Record replaced successfully in both MongoDB and Firestore",
      },
      { status: 200, headers: corsHeaders }
    );

  } catch (error) {
    console.error("PUT error:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500, headers: corsHeaders }
    );
  }
}
