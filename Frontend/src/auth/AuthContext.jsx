import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import API from "../api";
import { setAccessToken } from "../api";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(true);

  const login = async (email, password) => {
    const res = await API.post("/auth/login", { email, password });
    setAccessToken(res.data.accessToken);
    setUser(res.data.user);
    localStorage.setItem("user", JSON.stringify(res.data.user));
    return res.data.user;
  };

  const register = async (name, email, password) => {
    const res = await API.post("/auth/register", { name, email, password });
    setAccessToken(res.data.accessToken);
    setUser(res.data.user);
    localStorage.setItem("user", JSON.stringify(res.data.user));
    return res.data.user;
  };

  const logout = async () => {
    try {
      await API.post("/auth/logout");
    } catch {
      // ignore (server down)
    }
    setAccessToken(null);
    setUser(null);
    localStorage.removeItem("user");
    window.location.href = "/login";
  };

  // On app start: try refresh using cookie; if server is down / cookie invalid -> logged out
  useEffect(() => {
    (async () => {
      try {
        const res = await API.post("/auth/refresh");
        setAccessToken(res.data.accessToken);
        setUser(res.data.user);
        localStorage.setItem("user", JSON.stringify(res.data.user));
      } catch {
        setAccessToken(null);
        setUser(null);
        localStorage.removeItem("user");
      } finally {
        setBooting(false);
      }
    })();
  }, []);

  const value = useMemo(() => ({ user, booting, login, register, logout }), [user, booting]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
