import mongoose from "mongoose";

const Schema = mongoose.Schema;

const UserSchema = new Schema(
  {
    chatId: { type: String, required: true, unique: true },
    isPaused: { type: Boolean, default: false },
    pollInterval: { type: Number, default: 5 },
  },
  { timestamps: true }
);

export const User = mongoose.model("User", UserSchema, "users");
