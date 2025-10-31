import mongoose from "mongoose";

const adminSchema = new mongoose.Schema({
  adminId: { type: String, unique: true },
  password: String,
});

export default mongoose.model("Admin", adminSchema);
