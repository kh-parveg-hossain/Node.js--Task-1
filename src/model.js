import mongoose, { Schema } from "mongoose";

const UserSchema = new Schema(
  {
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    resetToken: String,          // for forgot password
    resetTokenExpiry: Date,      // optional expiry for reset token
  },
  { timestamps: true }           // adds createdAt & updatedAt
);

export const User = mongoose.model("User", UserSchema);
