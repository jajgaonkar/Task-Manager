// src/utils/session.js
const FALLBACK_TTL_MS = 30 * 60 * 1000; // 30 minutes

const base64UrlToBase64 = (str) => {
  const pad = "=".repeat((4 - (str.length % 4)) % 4);
  return (str + pad).replace(/-/g, "+").replace(/_/g, "/");
};

export const parseJwt = (token) => {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const json = atob(base64UrlToBase64(part));
    return JSON.parse(json);
  } catch {
    return null;
  }
};

export const getExpiresAt = (token) => {
  const payload = parseJwt(token);
  if (payload?.exp) return payload.exp * 1000;
  return Date.now() + FALLBACK_TTL_MS;
};

export const setSession = (token, user) => {
  const expiresAt = getExpiresAt(token);
  localStorage.setItem("token", token);
  localStorage.setItem("user", JSON.stringify(user));
  localStorage.setItem("expiresAt", String(expiresAt));
  return expiresAt;
};

export const clearSession = () => {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  localStorage.removeItem("expiresAt");
};

export const isSessionExpired = () => {
  const expiresAt = Number(localStorage.getItem("expiresAt") || 0);
  if (!expiresAt) return false; // if you prefer: treat missing as expired
  return Date.now() >= expiresAt;
};

let logoutTimer = null;

export const scheduleAutoLogout = (onLogout) => {
  if (logoutTimer) clearTimeout(logoutTimer);

  const expiresAt = Number(localStorage.getItem("expiresAt") || 0);
  if (!expiresAt) return;

  const msLeft = expiresAt - Date.now();
  if (msLeft <= 0) {
    onLogout?.();
    return;
  }

  logoutTimer = setTimeout(() => {
    onLogout?.();
  }, msLeft);
};
