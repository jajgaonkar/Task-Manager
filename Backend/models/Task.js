const mongoose = require("mongoose");

const taskSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    dueDate: { type: Date, default: null },
    priority: { type: String, enum: ["HIGH", "LOW", "ONHOLD"], default: "LOW" },
    status: { type: String, enum: ["PENDING", "INPROGRESS", "DONE"], default: "PENDING" }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Task", taskSchema);
