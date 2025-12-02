// frontend/api.js

// 🔗 BACKEND BASE URL (Render)
const API_BASE = "https://woodblock-backend.onrender.com";

// --- token + current user in memory + localStorage ---
const TOKEN_KEY = "woodBlockAuthToken";
const USER_KEY = "woodBlockCurrentUser";

let authToken = localStorage.getItem(TOKEN_KEY) || null;
let currentUser = null;
try {
  const rawUser = localStorage.getItem(USER_KEY);
  if (rawUser) currentUser = JSON.parse(rawUser);
} catch {
  currentUser = null;
}

function saveAuthState() {
  if (authToken) localStorage.setItem(TOKEN_KEY, authToken);
  else localStorage.removeItem(TOKEN_KEY);

  if (currentUser) localStorage.setItem(USER_KEY, JSON.stringify(currentUser));
  else localStorage.removeItem(USER_KEY);
}

// generic helper
async function apiRequest(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const headers = options.headers || {};

  headers["Content-Type"] = "application/json";

  if (authToken) {
    headers["Authorization"] = `Bearer ${authToken}`;
  }

  const res = await fetch(url, {
    method: options.method || "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.message || `API error: ${res.status}`);
  }

  return res.json().catch(() => ({}));
}

// public API object
window.api = {
  // allow app.js to update token/user
  setToken(token) {
    authToken = token;
    saveAuthState();
  },
  setCurrentUser(user) {
    currentUser = user;
    saveAuthState();
  },

  // auth endpoints
  async registerUser({ name, email, password }) {
    const data = await apiRequest("/api/auth/register", {
      method: "POST",
      body: { name, email, password },
    });
    if (data.token) {
      authToken = data.token;
      currentUser = data.user || null;
      saveAuthState();
    }
    return data.user || data;
  },

  async loginUser({ email, password }) {
    const data = await apiRequest("/api/auth/login", {
      method: "POST",
      body: { email, password },
    });
    if (data.token) {
      authToken = data.token;
      currentUser = data.user || null;
      saveAuthState();
    }
    return data.user || data;
  },

  // test users list
  async getUsers() {
    return apiRequest("/api/users");
  },

  // high score update
  async updateScore(score) {
    return apiRequest("/api/score/update", {
      method: "POST",
      body: { score },
    });
  },

  // leaderboard
  async getLeaderboard() {
    return apiRequest("/api/leaderboard");
  },
};
