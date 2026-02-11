const Task = require("../models/Task");

const getTasks = async (req, res) => {
  const userId = req.user.userId;
  const tasks = await Task.find({ userId }).sort({ createdAt: -1 });
  res.json(tasks.map(t => ({ ...t.toObject(), id: t._id })));
};

const createTask = async (req, res) => {
  const userId = req.user.userId;
  const { title, description = "", dueDate = null, priority = "LOW", status = "PENDING" } = req.body;

  if (!title?.trim()) return res.status(400).json({ message: "Title is required" });

  const task = await Task.create({ userId, title, description, dueDate, priority, status });
  res.status(201).json({ ...task.toObject(), id: task._id });
};

const updateTask = async (req, res) => {
  const userId = req.user.userId;
  const taskId = req.params.id;

  const task = await Task.findOneAndUpdate(
    { _id: taskId, userId },
    { ...req.body },
    { new: true }
  );

  if (!task) return res.status(404).json({ message: "Task not found" });
  res.json({ ...task.toObject(), id: task._id });
};

const deleteTask = async (req, res) => {
  const userId = req.user.userId;
  const taskId = req.params.id;

  const task = await Task.findOneAndDelete({ _id: taskId, userId });
  if (!task) return res.status(404).json({ message: "Task not found" });

  res.json({ message: "Deleted" });
};

module.exports = { getTasks, createTask, updateTask, deleteTask };
