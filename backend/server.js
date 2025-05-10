const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const app = express();

// Configure CORS to allow your frontend origin and necessary headers/methods
app.use(cors({
  origin: "http://localhost:3000", // Replace with your frontend URL if different
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || "your_very_strong_jwt_secret_here_change_this";
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/creditledger";

// Connect to MongoDB
mongoose.connect(MONGO_URI, {
  // Removed deprecated options as per latest driver versions
});

mongoose.connection.on("connected", () => {
  console.log("MongoDB connected");
});
mongoose.connection.on("error", (err) => {
  console.error("MongoDB connection error:", err);
});

// Schemas
const userSchema = new mongoose.Schema({
  username: { type: String, unique: true },
  passwordHash: String,
  userType: { type: String, enum: ["customer", "owner"] },
});

const transactionSchema = new mongoose.Schema({
  businessId: String,
  customerId: String,
  type: String,
  amount: Number,
  description: String,
  photo: String, // base64 string
  timestamp: { type: Date, default: Date.now },
});

const User = mongoose.model("User", userSchema);
const Transaction = mongoose.model("Transaction", transactionSchema);

// Middleware to authenticate JWT token
const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Unauthorized" });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
};

// Routes

// Sign up
app.post("/api/signup", async (req, res) => {
  try {
    const { username, password, userType } = req.body;
    if (!username || !password || !userType) {
      return res.status(400).json({ error: "Missing fields" });
    }
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ error: "Username already exists" });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const user = new User({ username, passwordHash, userType });
    await user.save();
    res.json({ message: "User created" });
  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Login
app.post("/api/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user) return res.status(400).json({ error: "Invalid credentials" });
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(400).json({ error: "Invalid credentials" });
    const token = jwt.sign(
      { username: user.username, userType: user.userType },
      JWT_SECRET,
      { expiresIn: "1d" }
    );
    res.json({ token, user: { username: user.username, userType: user.userType } });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get business owners (for customers to select)
app.get("/api/businesses", authMiddleware, async (req, res) => {
  try {
    const owners = await User.find({ userType: "owner" }, "username");
    res.json(owners);
  } catch (error) {
    console.error("Get businesses error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get customer credit balance for a business
app.get("/api/credit/:businessId/:customerId", authMiddleware, async (req, res) => {
  try {
    const { businessId, customerId } = req.params;
    const transactions = await Transaction.find({ businessId, customerId });
    let balance = 0;
    transactions.forEach((tx) => {
      if (tx.type === "Credit Taken") balance += tx.amount;
      else if (tx.type === "Payment Made") balance -= tx.amount;
    });
    if (balance < 0) balance = 0;
    res.json({ balance });
  } catch (error) {
    console.error("Get credit balance error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Add transaction
app.post("/api/transaction", authMiddleware, async (req, res) => {
  try {
    const { businessId, customerId, type, amount, description, photo } = req.body;
    if (!businessId || !customerId || !type || !amount) {
      return res.status(400).json({ error: "Missing fields" });
    }
    const tx = new Transaction({
      businessId,
      customerId,
      type,
      amount,
      description,
      photo,
    });
    await tx.save();
    res.json({ message: "Transaction recorded" });
  } catch (error) {
    console.error("Add transaction error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get transactions for business and optionally customer
app.get("/api/transactions/:businessId", authMiddleware, async (req, res) => {
  try {
    const { businessId } = req.params;
    const { customerId } = req.query;
    let filter = { businessId };
    if (customerId) filter.customerId = customerId;
    const transactions = await Transaction.find(filter).sort({ timestamp: -1 });
    res.json(transactions);
  } catch (error) {
    console.error("Get transactions error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});