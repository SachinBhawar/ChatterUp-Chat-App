import mongoose, { Schema } from "mongoose";

const roomSchema = new mongoose.Schema({
  room: String,
  joinedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: "user" }],
});
