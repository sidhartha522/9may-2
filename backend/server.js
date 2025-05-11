const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

const app = express();
app.use(cors());
app.use(express.json());

const JWT_SECRET = "your_jwt_secret_here"; // Use env var in production

// In-memory user store: phoneNumber -> user object
// user object: { phoneNumber, passwordHash, userType, name, photo }
const users = new Map();

// In-memory transactions store: array of transaction objects
// transaction: { _id, businessId, customerId, type, amount, description, photo, timestamp }
const transactions = [];
let transactionIdCounter = 1;

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
  if (users.has(phoneNumber)) {
    return res.status(400).json({ error: "User already exists" });
  }
  if (userType !== "customer" && userType !== "owner") {
    return res.status(400).json({ error: "Invalid userType" });
  }
  const passwordHash = await bcrypt.hash(password, 10);
  users.set(phoneNumber, { phoneNumber, passwordHash, userType, name, photo: photo || null });
  res.json({ message: "User registered successfully" });
});

// Login endpoint
app.post("/api/login", async (req, res) => {
  const { phoneNumber, password } = req.body;
  if (!phoneNumber || !password) {
    return res.status(400).json({ error: "Missing phoneNumber or password" });
  }
  const user = users.get(phoneNumber);
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
});

// Get all business owners (for customers to select)
app.get("/api/businesses", authenticateToken, (req, res) => {
  const owners = [];
  for (const user of users.values()) {
    if (user.userType === "owner") {
      owners.push({ phoneNumber: user.phoneNumber, name: user.name, photo: user.photo });
    }
  }
  res.json(owners);
});

// Get customers for a business owner with balances
app.get("/api/customers/:businessId", authenticateToken, (req, res) => {
  const businessId = req.params.businessId;
  if (req.user.phoneNumber !== businessId) {
    return res.status(403).json({ error: "Unauthorized" });
  }
  // Find all customers who have transactions with this business
  const customerMap = new Map();
  for (const tx of transactions) {
    if (tx.businessId === businessId) {
      if (!customerMap.has(tx.customerId)) {
        const customerUser = users.get(tx.customerId);
        customerMap.set(tx.customerId, {
          customerId: tx.customerId,
          customerName: customerUser ? customerUser.name : tx.customerId,
          customerPhoto: customerUser ? customerUser.photo : null,
          balance: 0,
        });
      }
      const cust = customerMap.get(tx.customerId);
      if (tx.type === "Credit Taken") {
        cust.balance += tx.amount;
      } else if (tx.type === "Payment Made") {
        cust.balance -= tx.amount;
      }
    }
  }
  res.json(Array.from(customerMap.values()));
});

// Get transactions for a business, optionally filtered by customerId
app.get("/api/transactions/:businessId", authenticateToken, (req, res) => {
  const businessId = req.params.businessId;
  if (req.user.phoneNumber !== businessId && req.user.userType !== "customer") {
    return res.status(403).json({ error: "Unauthorized" });
  }
  const customerId = req.query.customerId;
  let filtered = transactions.filter((tx) => tx.businessId === businessId);
  if (customerId) {
    filtered = filtered.filter((tx) => tx.customerId === customerId);
  }
  // Enrich transactions with names and photos
  const enriched = filtered.map((tx) => {
    const custUser = users.get(tx.customerId);
    const busUser = users.get(tx.businessId);
    return {
      ...tx,
      customerName: custUser ? custUser.name : tx.customerId,
      customerPhoto: custUser ? custUser.photo : null,
      businessName: busUser ? busUser.name : tx.businessId,
      businessPhoto: busUser ? busUser.photo : null,
    };
  });
  res.json(enriched);
});

// Get credit balance for a customer-business pair
app.get("/api/credit/:businessId/:customerId", authenticateToken, (req, res) => {
  const { businessId, customerId } = req.params;
  if (
    req.user.phoneNumber !== businessId &&
    req.user.phoneNumber !== customerId
  ) {
    return res.status(403).json({ error: "Unauthorized" });
  }
  let balance = 0;
  for (const tx of transactions) {
    if (tx.businessId === businessId && tx.customerId === customerId) {
      if (tx.type === "Credit Taken") {
        balance += tx.amount;
      } else if (tx.type === "Payment Made") {
        balance -= tx.amount;
      }
    }
  }
  res.json({ balance });
});

// Add a transaction
app.post("/api/transaction", authenticateToken, (req, res) => {
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
  const tx = {
    _id: (transactionIdCounter++).toString(),
    businessId,
    customerId,
    type,
    amount: Number(amount),
    description: description || "",
    photo: photo || null,
    timestamp: Date.now(),
  };
  transactions.push(tx);
  res.json({ message: "Transaction added", transaction: tx });
});

const PORT = 4000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});