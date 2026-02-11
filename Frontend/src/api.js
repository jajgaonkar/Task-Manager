import axios from "axios";

export const API_BASE_URL = "https://task-manager-is03.onrender.com/api";

const API = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true
});

// Separate client for refresh (no interceptors)
const RefreshAPI = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true
});

let accessToken = null;
export const setAccessToken = (t) => { accessToken = t; };
export const getAccessToken = () => accessToken;

API.interceptors.request.use((config) => {
  const t = getAccessToken();
  if (t) config.headers.Authorization = `Bearer ${t}`;
  return config;
});

let isRefreshing = false;
let pendingQueue = [];

const resolveQueue = (err, token) => {
  pendingQueue.forEach((p) => (err ? p.reject(err) : p.resolve(token)));
  pendingQueue = [];
};

API.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    const status = error?.response?.status;

    // Don't try refresh on auth endpoints
    const url = original?.url || "";
    if (url.includes("/auth/login") || url.includes("/auth/register") || url.includes("/auth/refresh")) {
      return Promise.reject(error);
    }

    if (status !== 401 || original?._retry) return Promise.reject(error);
    original._retry = true;

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        pendingQueue.push({
          resolve: (token) => {
            original.headers.Authorization = `Bearer ${token}`;
            resolve(API(original));
          },
          reject
        });
      });
    }

    isRefreshing = true;

    try {
      const r = await RefreshAPI.post("/auth/refresh");
      const newToken = r.data.accessToken;

      setAccessToken(newToken);
      resolveQueue(null, newToken);

      original.headers.Authorization = `Bearer ${newToken}`;
      return API(original);
    } catch (refreshErr) {
      resolveQueue(refreshErr, null);
      setAccessToken(null);

      try { await RefreshAPI.post("/auth/logout"); } catch {}

      window.location.href = "/login";
      return Promise.reject(refreshErr);
    } finally {
      isRefreshing = false;
    }
  }
);

export default API;
