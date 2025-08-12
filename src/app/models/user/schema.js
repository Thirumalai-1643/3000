import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    unique: true,
  },
  domain: {
    type: String,
    required: true,
    trim: true,
  }
}, { timestamps: true });

export default mongoose.models.User || mongoose.model("User", userSchema);
