// server.js
require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();

/* ---------- GLOBAL MIDDLEWARE ---------- */
app.use(express.json());
app.use(cors());

// Log every incoming request
app.use((req, res, next) => {
  console.log("REQ:", new Date().toISOString(), req.method, req.url);
  next();
});

/* ---------- MONGODB CONNECTION ---------- */
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB error:", err));


/* ---------- USER MODEL ---------- */
const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, unique: true, required: true },
    passwordHash: { type: String, required: true },
    highScore: { type: Number, default: 0 }
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);

/* ---------- AUTH MIDDLEWARE (JWT) ---------- */

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;

  if (!token) {
    return res.status(401).json({ message: "No token provided" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "secret");
    req.userId = decoded.id;
    next();
  } catch (err) {
    console.error("JWT verify error:", err);
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}

/* ======================================================
   AUTH ROUTES
   ====================================================== */

// REGISTER
app.post("/api/auth/register", async (req, res) => {
  console.log("➡️ Register payload:", req.body);

  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: "Missing fields" });
  }

  try {
    const exists = await User.findOne({ email });
    if (exists) {
      return res.status(400).json({ message: "Email already exists" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, passwordHash });

    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET || "secret"
    );

    res.json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        highScore: user.highScore
      },
      token
    });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ message: "Server error during register" });
  }
});

// LOGIN
app.post("/api/auth/login", async (req, res) => {
  console.log("➡️ Login payload:", req.body);

  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Missing fields" });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET || "secret"
    );

    res.json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        highScore: user.highScore
      },
      token
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Server error during login" });
  }
});

/* ======================================================
   SCORE UPDATE ROUTE (PROTECTED)
   ====================================================== */

app.post("/api/score/update", authMiddleware, async (req, res) => {
  console.log("➡️ Score update payload:", req.body, "userId:", req.userId);

  let { score } = req.body;
  score = Number(score);

  if (!Number.isFinite(score)) {
    return res.status(400).json({ message: "Score must be a valid number" });
  }

  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (score > (user.highScore || 0)) {
      user.highScore = score;
      await user.save();
      console.log("✅ High score updated to", score);
    } else {
      console.log("ℹ️ Score not higher, no update");
    }

    res.json({ highScore: user.highScore });
  } catch (err) {
    console.error("Score update error:", err);
    res.status(500).json({ message: "Server error updating score" });
  }
});

/* ======================================================
   LEADERBOARD ROUTE
   ====================================================== */

// public: returns top 10 players by highScore
app.get("/api/leaderboard", async (req, res) => {
  console.log("➡️ Leaderboard requested");
  try {
    const players = await User.find(
      { highScore: { $gt: 0 } },
      "name highScore"
    )
      .sort({ highScore: -1, createdAt: 1 })
      .limit(10);

    res.json(players);
  } catch (err) {
    console.error("Leaderboard error:", err);
    res.status(500).json({ message: "Server error fetching leaderboard" });
  }
});

/* ======================================================
   USERS ROUTE (FOR TEST BUTTON)
   ====================================================== */

app.get("/api/users", async (req, res) => {
  console.log("➡️ Users list requested");

  try {
    const users = await User.find({}, "-passwordHash");
    res.json(users);
  } catch (err) {
    console.error("Users fetch error:", err);
    res.status(500).json({ message: "Server error fetching users" });
  }
});

/* ---------- START SERVER ---------- */
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
