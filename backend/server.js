import express from 'express'
import mongoose from 'mongoose'
import user from './models/user.js'
import admin from './models/admin.js'
import issue from './models/issues.js'
import multer from 'multer'
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: path.join(__dirname, ".env") });
const app = express()
const port = 3000

mongoose.connect(process.env.MONGO_URI).then(() => console.log('✅ Connected to MongoDB Atlas'))
  .catch(err => console.error('❌ MongoDB Connection Error:', err));

const uploadDir = path.join(process.cwd(),"public", "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
  console.log("📁 'uploads' folder created automatically");
}

app.use(express.json())
app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "public/uploads"),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

app.get('/', (req, res) => {
  res.sendFile('index.html', { root: 'public' })
})

app.get('/registration', (req, res) => {
  res.sendFile('registration.html', { root: 'public' })
})

app.get('/user', (req, res) => {
  res.sendFile('user.html', { root: 'public' })
})

app.get('/admin', (req, res) => {
  res.sendFile('admin.html', { root: 'public' })
})

app.post('/api/users/signup', async (req, res) => {
  try {
    const newUser = new user(req.body);
    await newUser.save();
    res.status(201).json({ message: 'User created successfully' });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/api/users/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const existingUser = await user.findOne({ email, password });

    if (existingUser) {
      res.json({ message: 'Login successful' });
    }

    else {
      res.status(401).json({ error: 'Invalid credentials' });
    }
  } catch (error) {
    console.error('Error logging in user:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post("/api/admins/login", async (req, res) => {
  try {
    const { adminId, password } = req.body;
    const admins = await admin.findOne({ adminId, password });
    if (admins) {
      res.json({ message: "Admin login successful!" });
    } else {
      res.status(401).json({ error: "Invalid admin credentials" });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/issues", upload.single("photo"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "no file uploaded" })
    }
    const newIssue = new issue({
      photo: `/uploads/${req.file.filename}`,
      location: req.body.location,
      emailid: req.body.emailid,
      category: req.body.category,
      issue: req.body.issue,
      description: req.body.description,
      date: new Date().toLocaleDateString(),
      status: "pending"
    });

    await newIssue.save();
    res.status(201).json({ message: "Issue submitted successfully!" });
  } catch (err) {
    console.error("Error submitting issue:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/api/issues", async (req, res) => {
  try {
    const issues = await issue.find().sort({ _id: -1 });

    // Fetch names for each issue's emailid
    const issuesWithNames = await Promise.all(
      issues.map(async (item) => {
        const userInfo = await user.findOne({ email: item.emailid });
        return {
          ...item._doc,
          username: userInfo ? userInfo.name : "Anonymous User"
        };
      })
    );

    res.json(issuesWithNames);
  } catch (error) {
    console.error("Error fetching issues:", error);
    res.status(500).json({ error: "Failed to fetch issues" });
  }
});

// Fetch issues by status (accepted, pending, rejected)
app.get("/api/issues/status/:status", async (req, res) => {
  try {
    const { status } = req.params;
    const issues = await issue.find({ status }).sort({ _id: -1 });

    // Attach username for each issue
    const issuesWithNames = await Promise.all(
      issues.map(async (item) => {
        const userInfo = await user.findOne({ email: item.emailid });
        return {
          ...item._doc,
          username: userInfo ? userInfo.name : "Anonymous User"
        };
      })
    );

    res.json(issuesWithNames);
  } catch (error) {
    console.error("Error fetching filtered issues:", error);
    res.status(500).json({ error: "Failed to fetch filtered issues" });
  }
});

// Fetch issues of a specific user (and optional status)
app.get("/api/issues/user/:emailid", async (req, res) => {
  try {
    const { emailid } = req.params;
    const { status } = req.query; // optional query param ?status=pending

    const filter = { emailid };
    if (status) filter.status = status;

    const issues = await issue.find(filter).sort({ _id: -1 });

    const issuesWithNames = await Promise.all(
      issues.map(async (item) => {
        const userInfo = await user.findOne({ email: item.emailid });
        return {
          ...item._doc,
          username: userInfo ? userInfo.name : "Anonymous User"
        };
      })
    );

    res.json(issuesWithNames);
  } catch (error) {
    console.error("Error fetching user issues:", error);
    res.status(500).json({ error: "Failed to fetch user issues" });
  }
});

// Get all pending issues (for admin)
app.get("/pending", async (req, res) => {
  try {
    const issues = await issue.find({ status: "pending" });
    res.json(issues);
  } catch (err) {
    res.status(500).json({ message: "Error fetching pending issues" });
  }
});

app.get("/api/issues/accepted", async (req, res) => {
  try {
    // Fetch accepted issues sorted by latest first
    const acceptedIssues = await issue.find({ status: "accepted" }).sort({ _id: -1 });

    // Attach the user's name for each issue
    const issuesWithNames = await Promise.all(
      acceptedIssues.map(async (item) => {
        const userInfo = await user.findOne({ email: item.emailid });
        return {
          ...item._doc,
          username: userInfo ? userInfo.name : "Anonymous User"
        };
      })
    );

    res.json(issuesWithNames);
  } catch (error) {
    console.error("Error fetching accepted issues:", error);
    res.status(500).json({ error: "Failed to fetch accepted issues" });
  }
});



// Update issue status by ID (admin)
app.patch("/api/issues/:id/status", async (req, res) => {
  try {
    const { status } = req.body;
    const Issue = await issue.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );
    if (!Issue) {
      return res.status(404).json({ message: "Issue not found" });
    }
    res.json({ message: `Issue ${status}`, Issue });
  } catch (err) {
    res.status(500).json({ message: "Failed to update issue status" });
  }
});

// ✅ Get total number of users (for admin dashboard)
app.get("/api/users/count", async (req, res) => {
  try {
    const count = await user.countDocuments();
    res.json({ count });
  } catch (err) {
    console.error("Error fetching user count:", err);
    res.status(500).json({ message: "Error fetching user count" });
  }
});

// ✅ Search users by name (case-insensitive)
app.get("/api/users/search", async (req, res) => {
  try {
    const { name } = req.query;
    if (!name) return res.status(400).json({ message: "Name required" });

    const regex = new RegExp(name, "i"); // case-insensitive search
    const usersFound = await user.find({ name: regex });

    res.json(usersFound);
  } catch (err) {
    console.error("Error searching users:", err);
    res.status(500).json({ message: "Error searching users" });
  }
});

// ✅ Delete user and all their issues
app.delete("/api/users/:email", async (req, res) => {
  try {
    const { email } = req.params;

    // Delete the user
    const deletedUser = await user.findOneAndDelete({ email });
    if (!deletedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    // Delete all issues associated with this user's email
    await issue.deleteMany({ emailid: email });

    res.json({ message: "User and all related issues deleted successfully" });
  } catch (err) {
    console.error("Error deleting user and issues:", err);
    res.status(500).json({ message: "Failed to delete user and issues" });
  }
});


app.listen(port, () => {
  console.log(`Example app listening on port http://localhost:${port}`)
})
