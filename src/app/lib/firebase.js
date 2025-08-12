// src/app/lib/firebase.js

import { initializeApp } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";

// Your Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAA1h0fJk08_0p8rHUPvOMkwh-Le78ZEpw",
  authDomain: "irebase-live-data.firebaseapp.com",
  projectId: "irebase-live-data",
  storageBucket: "irebase-live-data.firebasestorage.app",
  messagingSenderId: "767090618977",
  appId: "1:767090618977:web:f9f137cd71f4090c093020",
  measurementId: "G-K9QCTQY66Q"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore
const db = getFirestore(app);

// Initialize Analytics (only if supported)
let analytics;
if (typeof window !== "undefined") {
  isSupported().then((supported) => {
    if (supported) {
      analytics = getAnalytics(app);
    }
  });
}

export { db, analytics, app };
