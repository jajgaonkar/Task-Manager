require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cookieParser = require("cookie-parser");
const cors = require("cors");

const authRoutes = require("./routes/authRoutes");
const taskRoutes = require("./routes/taskRoutes");

const app = express();

app.use(express.json());
app.use(cookieParser());

// CORS (dev + prod)
const allowedOrigins = [
  "http://localhost:5173",
  "https://jay-task-manager.netlify.app",
  process.env.CLIENT_ORIGIN
].filter(Boolean);

const corsOptions = {
  origin: (origin, cb) => {
    // allow requests with no origin (Postman/curl)
    if (!origin) return cb(null, true);
    if (allowedOrigins.includes(origin)) return cb(null, true);
    return cb(new Error("Not allowed by CORS"));
  },
  credentials: true
};

app.use(cors(corsOptions));

// Express v5 fix: DON'T use "*" here (it crashes); use a named wildcard instead
app.options("/{*splat}", cors(corsOptions));

app.get("/api/health", (req, res) => res.json({ ok: true }));

app.use("/api/auth", authRoutes);
app.use("/api/tasks", taskRoutes);

// connect + start
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB connected");
    app.listen(process.env.PORT || 5000, () => console.log("Server started"));
  })
  .catch((err) => {
    console.error("Mongo connect error:", err);
    process.exit(1);
  });
