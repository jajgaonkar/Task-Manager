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

// If you use Vite proxy (recommended), set origin to true OR your dev origin.
// Cookies + XHR require credentials config. [web:275][web:276]
app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || true,
    credentials: true
  })
);

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
