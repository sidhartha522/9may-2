import React, { useState, useEffect } from "react";
import axios from "axios";
import "./App.css";

const API_BASE = "http://localhost:4000/api";

function SignUp({ onSignUpSuccess, onBack }) {
  const [userType, setUserType] = useState("customer");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [photo, setPhoto] = useState(null);
  const [message, setMessage] = useState("");

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => setPhoto(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handleSignUp = async () => {
    if (!phoneNumber.trim() || !password.trim() || !name.trim()) {
      setMessage("Please enter all required fields.");
      return;
    }
    try {
      await axios.post(`${API_BASE}/signup`, {
        phoneNumber,
        password,
        userType,
        name,
        photo,
      });
      setMessage("Sign up successful! You can now log in.");
      onSignUpSuccess();
    } catch (err) {
      setMessage(err.response?.data?.error || "Error signing up");
    }
  };

  return (
    <div className="page">
      <h2>Sign Up</h2>
      <label>
        User Type:
        <select value={userType} onChange={(e) => setUserType(e.target.value)}>
          <option value="customer">Customer</option>
          <option value="owner">Business Owner</option>
        </select>
      </label>
      <br />
      <input
        type="tel"
        placeholder="Phone Number"
        value={phoneNumber}
        onChange={(e) => setPhoneNumber(e.target.value)}
        autoComplete="tel"
      />
      <br />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoComplete="new-password"
      />
      <br />
      <input
        type="text"
        placeholder={userType === "customer" ? "Customer Name" : "Business Name"}
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <br />
      <input type="file" accept="image/*" onChange={handlePhotoChange} />
      {photo && (
        <div>
          <img
            src={photo}
            alt="Profile"
            style={{ maxWidth: "200px", marginTop: "10px" }}
          />
        </div>
      )}
      <br />
      <button className="violet" onClick={handleSignUp}>
        Sign Up
      </button>
      <button className="red" onClick={onBack}>
        Back
      </button>
      {message && <p>{message}</p>}
    </div>
  );
}

function Login({ onLogin, onSignUpClick, onBack }) {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post(`${API_BASE}/login`, { phoneNumber, password });
      onLogin(res.data);
    } catch {
      setError("Invalid credentials");
    }
  };

  return (
    <div className="page">
      <h2>Login</h2>
      <form onSubmit={handleSubmit}>
        <input
          type="tel"
          placeholder="Phone Number"
          value={phoneNumber}
          onChange={(e) => setPhoneNumber(e.target.value)}
          required
          autoComplete="tel"
        />
        <br />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
        />
        <br />
        <button className="violet" type="submit">
          Login
        </button>
      </form>
      <button className="blue" onClick={onSignUpClick}>
        Sign Up
      </button>
      <button className="red" onClick={onBack}>
        Back
      </button>
      {error && <p className="error-message">{error}</p>}
    </div>
  );
}

function SelectBusiness({ token, onSelect, onBack }) {
  const [businessOwners, setBusinessOwners] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOwners = async () => {
      try {
        const res = await axios.get(`${API_BASE}/businesses`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setBusinessOwners(res.data);
      } catch {
        setBusinessOwners([]);
      } finally {
        setLoading(false);
      }
    };
    fetchOwners();
  }, [token]);

  return (
    <div className="page">
      <h2>Select Business</h2>
      {loading ? (
        <p>Loading...</p>
      ) : businessOwners.length === 0 ? (
        <p>No business owners registered yet.</p>
      ) : (
        <ul>
          {businessOwners.map((owner) => (
            <li key={owner.phoneNumber}>
              <button
                className="blue"
                onClick={() => onSelect(owner.phoneNumber)}
              >
                {owner.name} {owner.photo && (
                  <img
                    src={owner.photo}
                    alt="Business"
                    style={{ maxWidth: "50px", verticalAlign: "middle", marginLeft: "10px" }}
                  />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
      <button className="red" onClick={onBack}>
        Back
      </button>
    </div>
  );
}

function CustomerFlow({ token, customerId, businessId, onBack }) {
  const [action, setAction] = useState(null);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [photo, setPhoto] = useState(null);
  const [message, setMessage] = useState("");
  const [transactions, setTransactions] = useState([]);
  const [balance, setBalance] = useState(0);

  useEffect(() => {
    const fetchTransactionsAndBalance = async () => {
      try {
        const [txRes, balRes] = await Promise.all([
          axios.get(`${API_BASE}/transactions/${businessId}`, {
            headers: { Authorization: `Bearer ${token}` },
            params: { customerId },
          }),
          axios.get(`${API_BASE}/credit/${businessId}/${customerId}`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);
        setTransactions(txRes.data);
        setBalance(balRes.data.balance);
      } catch {
        setTransactions([]);
        setBalance(0);
      }
    };
    fetchTransactionsAndBalance();
  }, [businessId, customerId, token]);

  const handleSubmit = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) {
      setMessage("Please enter a valid amount.");
      return;
    }
    try {
      await axios.post(
        `${API_BASE}/transaction`,
        {
          businessId,
          customerId,
          type: action === "take" ? "Credit Taken" : "Payment Made",
          amount: amt,
          description,
          photo,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMessage("Transaction recorded successfully.");
      setAmount("");
      setDescription("");
      setPhoto(null);
      setAction(null);
      const [txRes, balRes] = await Promise.all([
        axios.get(`${API_BASE}/transactions/${businessId}`, {
          headers: { Authorization: `Bearer ${token}` },
          params: { customerId },
        }),
        axios.get(`${API_BASE}/credit/${businessId}/${customerId}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      setTransactions(txRes.data);
      setBalance(balRes.data.balance);
    } catch {
      setMessage("Failed to record transaction.");
    }
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => setPhoto(reader.result);
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="page">
      <h2>Customer Flow - Business: {businessId}</h2>
      <p>Current Credit Balance: ₹{balance.toFixed(2)}</p>
      {!action ? (
        <>
          <button className="violet" onClick={() => setAction("take")}>
            Take Credit
          </button>
          <button className="green" onClick={() => setAction("pay")}>
            Pay Back
          </button>
        </>
      ) : (
        <>
          <h3>{action === "take" ? "Take Credit" : "Pay Back"}</h3>
          <input
            type="number"
            placeholder="Amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            min="0"
            step="0.01"
          />
          <br />
          <input
            type="text"
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <br />
          <input type="file" accept="image/*" onChange={handlePhotoChange} />
          {photo && (
            <div>
              <img
                src={photo}
                alt="Bill"
                style={{ maxWidth: "200px", marginTop: "10px" }}
              />
            </div>
          )}
          <br />
          <button className="violet" onClick={handleSubmit}>
            Submit
          </button>
          <button className="red" onClick={() => setAction(null)}>
            Cancel
          </button>
          {message && <p>{message}</p>}
        </>
      )}
      <h3>Transaction History</h3>
      {transactions.length === 0 ? (
        <p>No transactions yet.</p>
      ) : (
        <ul>
          {transactions.map((tx) => (
            <li key={tx._id} style={{ marginBottom: "15px" }}>
              <strong>Date:</strong> {new Date(tx.timestamp).toLocaleString()}
              <br />
              <strong>Type:</strong> {tx.type}
              <br />
              <strong>Amount:</strong> ₹{tx.amount.toFixed(2)}
              <br />
              {tx.description && (
                <>
                  <strong>Description:</strong> {tx.description}
                  <br />
                </>
              )}
              {tx.photo && (
                <div>
                  <img
                    src={tx.photo}
                    alt="Bill"
                    style={{ maxWidth: "100px", marginTop: "5px" }}
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <button className="red" onClick={onBack}>
        Back
      </button>
    </div>
  );
}

function CustomerTransactionsPage({ token, ownerPhone, customerId, onBack }) {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const fetchTransactions = async () => {
      setLoading(true);
      try {
        const url = `${API_BASE}/transactions/${encodeURIComponent(ownerPhone)}`;
        const res = await axios.get(url, {
          headers: { Authorization: `Bearer ${token}` },
          params: { customerId },
        });
        setTransactions(res.data);
      } catch {
        setTransactions([]);
        setMessage("Failed to load transactions.");
      } finally {
        setLoading(false);
      }
    };
    fetchTransactions();
  }, [token, ownerPhone, customerId]);

  return (
    <div className="page">
      <h2>Transactions with Customer</h2>
      <button className="red" onClick={onBack}>
        Back to Dashboard
      </button>
      {loading ? (
        <p>Loading transactions...</p>
      ) : transactions.length === 0 ? (
        <p>No transactions found.</p>
      ) : (
        <ul>
          {transactions.map((tx) => (
            <li key={tx._id} style={{ marginBottom: "15px" }}>
              <strong>Date:</strong> {new Date(tx.timestamp).toLocaleString()}
              <br />
              <strong>Type:</strong> {tx.type}
              <br />
              <strong>Amount:</strong> ₹{tx.amount.toFixed(2)}
              <br />
              {tx.description && (
                <>
                  <strong>Description:</strong> {tx.description}
                  <br />
                </>
              )}
              {tx.photo && (
                <div>
                  <img
                    src={tx.photo}
                    alt="Bill"
                    style={{ maxWidth: "100px", marginTop: "5px" }}
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {message && <p>{message}</p>}
    </div>
  );
}

function TransactionsHistoryPage({ token, ownerPhone, onBack }) {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [sortBy, setSortBy] = useState("latest");

  useEffect(() => {
    const fetchTransactions = async () => {
      setLoading(true);
      try {
        const url = `${API_BASE}/transactions/${encodeURIComponent(ownerPhone)}`;
        const res = await axios.get(url, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setTransactions(res.data);
      } catch {
        setTransactions([]);
        setMessage("Failed to load transactions.");
      } finally {
        setLoading(false);
      }
    };
    fetchTransactions();
  }, [token, ownerPhone]);

  const filteredTransactions = React.useMemo(() => {
    if (!transactions) return [];

    const now = new Date();
    let filtered = [...transactions];

    if (sortBy === "this_week") {
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      filtered = filtered.filter((tx) => new Date(tx.timestamp) >= startOfWeek);
    } else if (sortBy === "this_month") {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      filtered = filtered.filter((tx) => new Date(tx.timestamp) >= startOfMonth);
    }

    if (sortBy === "latest") {
      filtered.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    } else if (sortBy === "oldest") {
      filtered.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    }

    return filtered;
  }, [transactions, sortBy]);

  return (
    <div className="page">
      <h2>All Transactions History</h2>
      <button className="red" onClick={onBack}>
        Back to Dashboard
      </button>
      <div style={{ margin: "10px 0" }}>
        <label htmlFor="sortBy">Sort By: </label>
        <select
          id="sortBy"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
        >
          <option value="latest">Latest to Oldest</option>
          <option value="oldest">Oldest to Latest</option>
          <option value="this_week">This Week</option>
          <option value="this_month">This Month</option>
        </select>
      </div>
      {loading ? (
        <p>Loading transactions...</p>
      ) : filteredTransactions.length === 0 ? (
        <p>No transactions found.</p>
      ) : (
        <ul>
          {filteredTransactions.map((tx) => (
            <li key={tx._id} style={{ marginBottom: "15px" }}>
              <strong>Date:</strong> {new Date(tx.timestamp).toLocaleString()}
              <br />
              <strong>Type:</strong> {tx.type}
              <br />
              <strong>Amount:</strong> ₹{tx.amount.toFixed(2)}
              <br />
              {tx.description && (
                <>
                  <strong>Description:</strong> {tx.description}
                  <br />
                </>
              )}
              <strong>Customer:</strong> {tx.customerName}{" "}
              {tx.customerPhoto && (
                <img
                  src={tx.customerPhoto}
                  alt="Customer"
                  style={{ maxWidth: "50px", verticalAlign: "middle", marginLeft: "10px" }}
                />
              )}
              <br />
              <strong>Business:</strong> {tx.businessName}{" "}
              {tx.businessPhoto && (
                <img
                  src={tx.businessPhoto}
                  alt="Business"
                  style={{ maxWidth: "50px", verticalAlign: "middle", marginLeft: "10px" }}
                />
              )}
              {tx.photo && (
                <div>
                  <img
                    src={tx.photo}
                    alt="Bill"
                    style={{ maxWidth: "100px", marginTop: "5px" }}
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {message && <p>{message}</p>}
    </div>
  );
}

function OwnerFlow({ token, phoneNumber, onSelectCustomer, onShowHistory, onBack }) {
  const [customers, setCustomers] = useState([]);
  const [loadingCustomers, setLoadingCustomers] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const res = await axios.get(`${API_BASE}/customers/${encodeURIComponent(phoneNumber)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setCustomers(res.data);
      } catch {
        setCustomers([]);
        setMessage("Failed to load customers.");
      } finally {
        setLoadingCustomers(false);
      }
    };
    fetchCustomers();
  }, [token, phoneNumber]);

  return (
    <div className="page">
      <h2>Business Owner Dashboard</h2>
      <button className="red" onClick={onBack}>
        Logout
      </button>
      <button className="green" onClick={onShowHistory} style={{ marginLeft: "10px" }}>
        History
      </button>
      <h3>Customers</h3>
      {loadingCustomers ? (
        <p>Loading customers...</p>
      ) : customers.length === 0 ? (
        <p>No customers found.</p>
      ) : (
        <ul>
          {customers.map(({ customerId, customerName, customerPhoto, balance }) => (
            <li key={customerId}>
              <button
                className="blue"
                onClick={() => onSelectCustomer(customerId)}
              >
                {customerName}{" "}
                {customerPhoto && (
                  <img
                    src={customerPhoto}
                    alt="Customer"
                    style={{ maxWidth: "50px", verticalAlign: "middle", marginLeft: "10px" }}
                  />
                )}{" "}
                (Balance: ₹{balance.toFixed(2)})
              </button>
            </li>
          ))}
        </ul>
      )}
      {message && <p>{message}</p>}
    </div>
  );
}

function App() {
  const [page, setPage] = useState("welcome");
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [selectedBusiness, setSelectedBusiness] = useState(null);
  const [selectedCustomerForTransactions, setSelectedCustomerForTransactions] = useState(null);
  const [showHistory, setShowHistory] = useState(false);

  const handleLogin = (data) => {
    setToken(data.token);
    setUser(data.user);
    setPage("dashboard");
  };

  const handleLogout = () => {
    setToken(null);
    setUser(null);
    setSelectedBusiness(null);
    setSelectedCustomerForTransactions(null);
    setShowHistory(false);
    setPage("welcome");
  };

  if (page === "welcome") {
    return (
      <div className="page">
        <h1>Credit Ledger</h1>
        <button className="violet" onClick={() => setPage("login")}>
          Login
        </button>
        <button className="blue" onClick={() => setPage("signup")}>
          Sign Up
        </button>
      </div>
    );
  }

  if (page === "signup") {
    return (
      <SignUp
        onSignUpSuccess={() => setPage("login")}
        onBack={() => setPage("welcome")}
      />
    );
  }

  if (page === "login") {
    return (
      <Login
        onLogin={handleLogin}
        onSignUpClick={() => setPage("signup")}
        onBack={() => setPage("welcome")}
      />
    );
  }

  if (page === "dashboard") {
    if (user.userType === "customer") {
      if (!selectedBusiness) {
        return (
          <SelectBusiness
            token={token}
            onSelect={(businessPhone) => setSelectedBusiness(businessPhone)}
            onBack={handleLogout}
          />
        );
      }
      return (
        <CustomerFlow
          token={token}
          customerId={user.phoneNumber}
          businessId={selectedBusiness}
          onBack={() => setSelectedBusiness(null)}
        />
      );
    } else if (user.userType === "owner") {
      if (showHistory) {
        return (
          <TransactionsHistoryPage
            token={token}
            ownerPhone={user.phoneNumber}
            onBack={() => setShowHistory(false)}
          />
        );
      }
      if (selectedCustomerForTransactions) {
        return (
          <CustomerTransactionsPage
            token={token}
            ownerPhone={user.phoneNumber}
            customerId={selectedCustomerForTransactions}
            onBack={() => setSelectedCustomerForTransactions(null)}
          />
        );
      }
      return (
        <OwnerFlow
          token={token}
          phoneNumber={user.phoneNumber}
          onSelectCustomer={(customerId) => setSelectedCustomerForTransactions(customerId)}
          onShowHistory={() => setShowHistory(true)}
          onBack={handleLogout}
        />
      );
    }
  }

  return <p>Loading...</p>;
}

export default App;