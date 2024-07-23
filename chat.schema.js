import mongoose from "mongoose";

const chatSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "user" },
  username: String,
  message: String,
  room: String,
  createdAt: Date,
});

export const chatModel = mongoose.model("Chat", chatSchema);
