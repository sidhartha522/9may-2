import React, { useState, useEffect } from "react";
import axios from "axios";
import "./App.css";

const API_BASE = "http://localhost:4000/api";

function SignUp({ onSignUpSuccess, onBack }) {
  const [userType, setUserType] = useState("customer");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  const handleSignUp = async () => {
    if (!username.trim() || !password.trim()) {
      setMessage("Please enter username and password.");
      return;
    }
    try {
      await axios.post(`${API_BASE}/signup`, { username, password, userType });
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
        type="text"
        placeholder="Username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        autoComplete="off"
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
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post(`${API_BASE}/login`, { username, password });
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
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          autoComplete="username"
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
            <li key={owner.username}>
              <button
                className="blue"
                onClick={() => onSelect(owner.username)}
              >
                {owner.username}
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
      // Refresh transactions and balance after submission
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
          <button className="red" onClick={onBack}>
            Back
          </button>

          <h3>Transaction History</h3>
          {transactions.length === 0 ? (
            <p>No transactions yet.</p>
          ) : (
            <ul>
              {transactions.map((tx) => (
                <li key={tx._id}>
                  [{new Date(tx.timestamp).toLocaleString()}] {tx.type} - ₹
                  {tx.amount.toFixed(2)} {tx.description && `- ${tx.description}`}
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
        </>
      ) : (
        <>
          <p>Action: {action === "take" ? "Take Credit" : "Pay Back"}</p>
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
            placeholder="Description(optional)"
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
    </div>
  );
}

function OwnerFlow({ token, username, onBack }) {
  const [customers, setCustomers] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [loadingCustomers, setLoadingCustomers] = useState(true);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const res = await axios.get(`${API_BASE}/customers/${encodeURIComponent(username)}`, {
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
  }, [token, username]);

  const fetchTransactions = async (customerId = null) => {
    setLoadingTransactions(true);
    try {
      let url = `${API_BASE}/transactions/${encodeURIComponent(username)}`;
      if (customerId) {
        url += `?customerId=${encodeURIComponent(customerId)}`;
      }
      const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setTransactions(res.data);
      setMessage("");
    } catch {
      setTransactions([]);
      setMessage("Failed to load transactions.");
    } finally {
      setLoadingTransactions(false);
    }
  };

  const handleCustomerClick = (customerId) => {
    setSelectedCustomer(customerId);
    fetchTransactions(customerId);
  };

  const handleViewAllClick = () => {
    setSelectedCustomer(null);
    fetchTransactions();
  };

  return (
    <div className="page">
      <h2>Business Owner Flow</h2>
      <button className="red" onClick={onBack}>
        Logout
      </button>

      <h3>Customers</h3>
      {loadingCustomers ? (
        <p>Loading customers...</p>
      ) : customers.length === 0 ? (
        <p>No customers found.</p>
      ) : (
        <ul>
          {customers.map(({ customerId, balance }) => (
            <li
              key={customerId}
              style={{
                cursor: "pointer",
                fontWeight: selectedCustomer === customerId ? "bold" : "normal",
              }}
              onClick={() => handleCustomerClick(customerId)}
            >
              {customerId} - Credit Balance: ₹{balance.toFixed(2)}
            </li>
          ))}
        </ul>
      )}

      <button onClick={handleViewAllClick} style={{ marginTop: "1rem" }}>
        View All Transactions
      </button>

      <h3 style={{ marginTop: "2rem" }}>
        Transactions {selectedCustomer ? `for ${selectedCustomer}` : "(All)"}
      </h3>
      {loadingTransactions ? (
        <p>Loading transactions...</p>
      ) : message ? (
        <p>{message}</p>
      ) : transactions.length === 0 ? (
        <p>No transactions found.</p>
      ) : (
        <ul>
          {transactions.map((tx) => (
            <li key={tx._id} style={{ marginBottom: "1rem" }}>
              <strong>{tx.type}</strong> - Amount: ₹{tx.amount} -{" "}
              {new Date(tx.timestamp).toLocaleString()}
              <br />
              Description: {tx.description || "N/A"}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function App() {
  const [page, setPage] = useState("welcome");
  const [user, setUser] = useState(null);
  const [selectedBusiness, setSelectedBusiness] = useState(null);

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      setUser(parsedUser);
      if (parsedUser.userType === "customer") {
        setPage("selectBusiness");
      } else {
        setPage("ownerFlow");
      }
    }
  }, []);

  const handleLogin = (data) => {
    const userData = {
      token: data.token,
      username: data.user.username,
      userType: data.user.userType,
    };
    setUser(userData);
    localStorage.setItem("user", JSON.stringify(userData));
    if (userData.userType === "customer") {
      setPage("selectBusiness");
    } else {
      setPage("ownerFlow");
    }
  };

  const handleLogout = () => {
    setUser(null);
    setSelectedBusiness(null);
    setPage("welcome");
    localStorage.removeItem("user");
  };

  return (
    <div className="App">
      {page === "welcome" && (
        <>
          <h1>Welcome to Credit Manager</h1>
          <button className="violet" onClick={() => setPage("login")}>
            Login
          </button>
          <button className="blue" onClick={() => setPage("signup")}>
            Sign Up
          </button>
        </>
      )}

      {page === "signup" && (
        <SignUp
          onSignUpSuccess={() => setPage("login")}
          onBack={() => setPage("welcome")}
        />
      )}

      {page === "login" && (
        <Login
          onLogin={handleLogin}
          onSignUpClick={() => setPage("signup")}
          onBack={() => setPage("welcome")}
        />
      )}

      {page === "selectBusiness" && user && (
        <SelectBusiness
          token={user.token}
          onSelect={(business) => {
            setSelectedBusiness(business);
            setPage("customerFlow");
          }}
          onBack={handleLogout}
        />
      )}

      {page === "customerFlow" && user && selectedBusiness && (
        <CustomerFlow
          token={user.token}
          customerId={user.username}
          businessId={selectedBusiness}
          onBack={() => setPage("selectBusiness")}
        />
      )}

      {page === "ownerFlow" && user && (
        <OwnerFlow
          token={user.token}
          username={user.username}
          onBack={handleLogout}
        />
      )}
    </div>
  );
}

export default App;