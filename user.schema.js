import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    userName: String,
    profileImage: Buffer,
    // contentType: { type: String, enum: ["image/jpeg", "image/png", "image/gif"], default: "image/png" },
  },
  { timestamps: true }
);

export const userModel = mongoose.model("user", userSchema);
