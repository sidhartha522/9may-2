const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");

const app = express();
app.use(cors());
app.use(express.json());

const JWT_SECRET = "your_jwt_secret_here"; // Use env var in production

app.use(cors({
  origin: "http://localhost:3000",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

// Connect to MongoDB (replace with your MongoDB URI)
mongoose.connect("mongodb://localhost:27017/creditledger");

const db = mongoose.connection;
db.on("error", (error) => console.error("MongoDB connection error:", error));
db.once("open", () => console.log("MongoDB connected successfully"));

// Define User schema and model
const userSchema = new mongoose.Schema({
  phoneNumber: { type: String, unique: true, required: true },
  passwordHash: { type: String, required: true },
  userType: { type: String, enum: ["customer", "owner"], required: true },
  name: { type: String, required: true },
  photo: { type: String, default: null },
});
const User = mongoose.model("User", userSchema);

// Define Transaction schema and model
const transactionSchema = new mongoose.Schema({
  businessId: { type: String, required: true },
  customerId: { type: String, required: true },
  type: { type: String, enum: ["Credit Taken", "Payment Made"], required: true },
  amount: { type: Number, required: true },
  description: { type: String, default: "" },
  photo: { type: String, default: null },
  timestamp: { type: Date, default: Date.now },
});
const Transaction = mongoose.model("Transaction", transactionSchema);

// Middleware to authenticate JWT token and set req.user
function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  if (!authHeader) return res.status(401).json({ error: "Missing auth header" });
  const token = authHeader.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Missing token" });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: "Invalid token" });
    req.user = user;
    next();
  });
}

// Signup endpoint
app.post("/api/signup", async (req, res) => {
  const { phoneNumber, password, userType, name, photo } = req.body;
  if (!phoneNumber || !password || !userType || !name) {
    return res.status(400).json({ error: "Missing required fields" });
  }
  if (userType !== "customer" && userType !== "owner") {
    return res.status(400).json({ error: "Invalid userType" });
  }
  try {
    const existingUser = await User.findOne({ phoneNumber });
    if (existingUser) {
      return res.status(400).json({ error: "User already exists" });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const user = new User({ phoneNumber, passwordHash, userType, name, photo: photo || null });
    await user.save();
    res.json({ message: "User registered successfully" });
  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Login endpoint
app.post("/api/login", async (req, res) => {
  const { phoneNumber, password } = req.body;
  if (!phoneNumber || !password) {
    return res.status(400).json({ error: "Missing phoneNumber or password" });
  }
  try {
    const user = await User.findOne({ phoneNumber });
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    const token = jwt.sign(
      { phoneNumber: user.phoneNumber, userType: user.userType, name: user.name, photo: user.photo },
      JWT_SECRET,
      { expiresIn: "12h" }
    );
    res.json({ token, user: { phoneNumber: user.phoneNumber, userType: user.userType, name: user.name, photo: user.photo } });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// Get all business owners (for customers to select)
app.get("/api/businesses", authenticateToken, async (req, res) => {
  try {
    const owners = await User.find({ userType: "owner" }, "phoneNumber name photo").lean();
    res.json(owners);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// Get customers for a business owner with balances
app.get("/api/customers/:businessId", authenticateToken, async (req, res) => {
  const businessId = req.params.businessId;
  if (req.user.phoneNumber !== businessId) {
    return res.status(403).json({ error: "Unauthorized" });
  }
  try {
    const agg = await Transaction.aggregate([
      { $match: { businessId } },
      {
        $group: {
          _id: "$customerId",
          creditTaken: {
            $sum: {
              $cond: [{ $eq: ["$type", "Credit Taken"] }, "$amount", 0],
            },
          },
          paymentMade: {
            $sum: {
              $cond: [{ $eq: ["$type", "Payment Made"] }, "$amount", 0],
            },
          },
        },
      },
    ]);

    const customers = await Promise.all(
      agg.map(async (item) => {
        const customerUser = await User.findOne({ phoneNumber: item._id });
        return {
          customerId: item._id,
          customerName: customerUser ? customerUser.name : item._id,
          customerPhoto: customerUser ? customerUser.photo : null,
          balance: (item.creditTaken || 0) - (item.paymentMade || 0),
        };
      })
    );

    res.json(customers);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// Get transactions for a business, optionally filtered by customerId
app.get("/api/transactions/:businessId", authenticateToken, async (req, res) => {
  const businessId = req.params.businessId;
  if (req.user.phoneNumber !== businessId && req.user.userType !== "customer") {
    return res.status(403).json({ error: "Unauthorized" });
  }
  const customerId = req.query.customerId;
  try {
    let filter = { businessId };
    if (customerId) {
      filter.customerId = customerId;
    }
    const txs = await Transaction.find(filter).sort({ timestamp: -1 }).lean();

    const enriched = await Promise.all(
      txs.map(async (tx) => {
        const custUser = await User.findOne({ phoneNumber: tx.customerId });
        const busUser = await User.findOne({ phoneNumber: tx.businessId });
        return {
          ...tx,
          customerName: custUser ? custUser.name : tx.customerId,
          customerPhoto: custUser ? custUser.photo : null,
          businessName: busUser ? busUser.name : tx.businessId,
          businessPhoto: busUser ? busUser.photo : null,
        };
      })
    );

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// Get credit balance for a customer-business pair
app.get("/api/credit/:businessId/:customerId", authenticateToken, async (req, res) => {
  const { businessId, customerId } = req.params;
  if (
    req.user.phoneNumber !== businessId &&
    req.user.phoneNumber !== customerId
  ) {
    return res.status(403).json({ error: "Unauthorized" });
  }
  try {
    const agg = await Transaction.aggregate([
      { $match: { businessId, customerId } },
      {
        $group: {
          _id: null,
          creditTaken: {
            $sum: {
              $cond: [{ $eq: ["$type", "Credit Taken"] }, "$amount", 0],
            },
          },
          paymentMade: {
            $sum: {
              $cond: [{ $eq: ["$type", "Payment Made"] }, "$amount", 0],
            },
          },
        },
      },
    ]);
    const balance = agg.length > 0 ? agg[0].creditTaken - agg[0].paymentMade : 0;
    res.json({ balance });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// Add a transaction
app.post("/api/transaction", authenticateToken, async (req, res) => {
  const { businessId, customerId, type, amount, description, photo } = req.body;
  if (!businessId || !customerId || !type || !amount) {
    return res.status(400).json({ error: "Missing required fields" });
  }
  if (
    req.user.phoneNumber !== businessId &&
    req.user.phoneNumber !== customerId
  ) {
    return res.status(403).json({ error: "Unauthorized" });
  }
  if (type !== "Credit Taken" && type !== "Payment Made") {
    return res.status(400).json({ error: "Invalid transaction type" });
  }
  try {
    const tx = new Transaction({
      businessId,
      customerId,
      type,
      amount: Number(amount),
      description: description || "",
      photo: photo || null,
    });
    await tx.save();
    res.json({ message: "Transaction added", transaction: tx });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// Token verification endpoint
  app.get("/api/verify-token", authenticateToken, (req, res) => {
  res.json({ valid: true, user: req.user });
});

const PORT = 4000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
