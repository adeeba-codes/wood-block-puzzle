// api.js
const API_BASE = "http://localhost:5000/api";

// Load token & user from localStorage
let authToken = localStorage.getItem("token") || null;
let currentUser = null;
try {
  const savedUser = localStorage.getItem("currentUser");
  currentUser = savedUser ? JSON.parse(savedUser) : null;
} catch {
  currentUser = null;
}

function setToken(token) {
  authToken = token;
  if (token) {
    localStorage.setItem("token", token);
  } else {
    localStorage.removeItem("token");
  }
}

function setCurrentUser(user) {
  currentUser = user || null;
  if (user) {
    localStorage.setItem("currentUser", JSON.stringify(user));
  } else {
    localStorage.removeItem("currentUser");
  }
}

function getCurrentUser() {
  return currentUser;
}

// Generic request helper
async function apiRequest(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };

  if (authToken) {
    headers["Authorization"] = `Bearer ${authToken}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers
  });

  let data = {};
  try {
    data = await res.json();
  } catch {
    data = {};
  }

  if (!res.ok) {
    const msg = data.message || `API error (status ${res.status})`;
    console.error("API error:", msg, "status:", res.status, "data:", data);
    throw new Error(msg);
  }

  return data;
}

/* ---------- AUTH ---------- */

async function registerUser({ name, email, password }) {
  const data = await apiRequest("/auth/register", {
    method: "POST",
    body: JSON.stringify({ name, email, password })
  });
  setToken(data.token);
  setCurrentUser(data.user);
  return data.user;
}

async function loginUser({ email, password }) {
  const data = await apiRequest("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password })
  });
  setToken(data.token);
  setCurrentUser(data.user);
  return data.user;
}

/* ---------- USERS (TEST) ---------- */

async function getUsers() {
  return apiRequest("/users", { method: "GET" });
}

/* ---------- SCORE UPDATE ---------- */

async function updateScore(score) {
  if (!authToken) {
    console.warn("Not logged in, skipping backend score update");
    return null;
  }
  const data = await apiRequest("/score/update", {
    method: "POST",
    body: JSON.stringify({ score })
  });
  if (currentUser && typeof data.highScore === "number") {
    currentUser.highScore = data.highScore;
    setCurrentUser(currentUser);
  }
  return data;
}

/* ---------- LEADERBOARD ---------- */

async function getLeaderboard() {
  return apiRequest("/leaderboard", { method: "GET" });
}

/* ---------- EXPOSE TO WINDOW ---------- */

window.api = {
  setToken,
  setCurrentUser,
  getCurrentUser,
  registerUser,
  loginUser,
  getUsers,
  updateScore,
  getLeaderboard
};
