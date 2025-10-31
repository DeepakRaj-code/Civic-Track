import mongoose from "mongoose";

const issueSchema = new mongoose.Schema({
  photo: String,
  location: String,
  emailid: String,
  category: String,
  issue: String,
  description: String,
  date: String,
  status: { type: String, default: "pending" }
});

export default mongoose.model("issue", issueSchema);
