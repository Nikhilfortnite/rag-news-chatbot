import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:5000/api",
  headers: {
    "Content-Type": "application/json",
  },
});

// Add interceptor to inject token in all requests (except login)
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("usernameToken");
  if (token && !config.url.includes("/auth/login")) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Login API
export const login = (username) => api.post(`/auth/login`, { username });

// Session APIs
export const createSession = () => api.post("/session/create");
export const getAllSessions = () => api.get("/session/list-all");
export const getSessionById = (id) => api.get(`/session/${id}`);
export const deleteSession = (id) => api.delete(`/session/${id}`);

// Chat APIs
export const sendMessage = (sessionId, message) =>
  api.post("/chat/message", { sessionId, message });

export const getChatHistory = (sessionId, limit = 50) =>
  api.get(`/chat/history/${sessionId}?limit=${limit}`);

export const clearChatHistory = (sessionId) =>
  api.delete(`/chat/clear/${sessionId}`);

export const getStats = () => api.get("/chat/stats");
