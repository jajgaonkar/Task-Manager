const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

const ACCESS_TTL = "15m";
const REFRESH_TTL = "7d";

const signAccessToken = (userId) =>
  jwt.sign({ userId }, process.env.JWT_ACCESS_SECRET, { expiresIn: ACCESS_TTL });

const signRefreshToken = (userId) =>
  jwt.sign({ userId }, process.env.JWT_REFRESH_SECRET, { expiresIn: REFRESH_TTL });

const isProd = process.env.NODE_ENV === "production";

const refreshCookieOptions = {
  httpOnly: true,
  secure: isProd,            // true in production (HTTPS)
  sameSite: "lax",           // works well when frontend+backend are same-site (use Vite proxy below)
  path: "/api/auth",
  maxAge: 7 * 24 * 60 * 60 * 1000
};

const clearRefreshCookieOptions = {
  ...refreshCookieOptions,
  maxAge: 0
};

const sanitizeUser = (u) => ({ id: u._id, name: u.name, email: u.email });

const register = async (req, res) => {
  try {
    const { name, email, password } = req.body || {};
    if (!name || !email || !password) return res.status(400).json({ message: "All fields are required" });

    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ message: "Email already in use" });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, passwordHash });

    const accessToken = signAccessToken(user._id);
    const refreshToken = signRefreshToken(user._id);

    user.refreshTokenHash = await bcrypt.hash(refreshToken, 10);
    await user.save();

    res.cookie("refreshToken", refreshToken, refreshCookieOptions);
    res.status(201).json({ accessToken, user: sanitizeUser(user) });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ message: "All fields are required" });

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "Invalid credentials" });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(400).json({ message: "Invalid credentials" });

    const accessToken = signAccessToken(user._id);
    const refreshToken = signRefreshToken(user._id);

    user.refreshTokenHash = await bcrypt.hash(refreshToken, 10);
    await user.save();

    res.cookie("refreshToken", refreshToken, refreshCookieOptions);
    res.json({ accessToken, user: sanitizeUser(user) });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

const refresh = async (req, res) => {
  try {
    const token = req.cookies?.refreshToken;
    if (!token) return res.status(401).json({ message: "No refresh token" });

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    } catch {
      res.clearCookie("refreshToken", clearRefreshCookieOptions);
      return res.status(401).json({ message: "Invalid refresh token" });
    }

    const user = await User.findById(decoded.userId);
    if (!user || !user.refreshTokenHash) {
      res.clearCookie("refreshToken", clearRefreshCookieOptions);
      return res.status(401).json({ message: "Refresh token not recognized" });
    }

    const matches = await bcrypt.compare(token, user.refreshTokenHash);
    if (!matches) {
      user.refreshTokenHash = null;
      await user.save();
      res.clearCookie("refreshToken", clearRefreshCookieOptions);
      return res.status(401).json({ message: "Refresh token reused/invalid" });
    }

    // ROTATE refresh token
    const newAccessToken = signAccessToken(user._id);
    const newRefreshToken = signRefreshToken(user._id);

    user.refreshTokenHash = await bcrypt.hash(newRefreshToken, 10);
    await user.save();

    res.cookie("refreshToken", newRefreshToken, refreshCookieOptions);
    res.json({ accessToken: newAccessToken, user: sanitizeUser(user) });
  } catch (err) {
    console.error("Refresh error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

const logout = async (req, res) => {
  try {
    const token = req.cookies?.refreshToken;

    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
        await User.findByIdAndUpdate(decoded.userId, { refreshTokenHash: null });
      } catch {
        // ignore
      }
    }

    res.clearCookie("refreshToken", clearRefreshCookieOptions);
    res.json({ message: "Logged out" });
  } catch (err) {
    console.error("Logout error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = { register, login, refresh, logout };
