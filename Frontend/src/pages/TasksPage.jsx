import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  CalendarClock,
  Flame,
  PauseCircle,
  LayoutDashboard,
  PlusCircle,
  ListChecks,
  LogOut,
  Pencil,
  Trash2,
  ChevronDown,
  Bell,
  Search,
  X
} from "lucide-react";
import API from "../api";

const statusOptions = [
  { value: "PENDING", label: "Pending" },
  { value: "IN_PROGRESS", label: "In-progress" },
  { value: "DONE", label: "Done" }
];

const priorityOptions = [
  { value: "HIGH", label: "High", icon: Flame, pill: "bg-red-50 text-red-700 ring-1 ring-red-200" },
  { value: "LOW", label: "Low", icon: ListChecks, pill: "bg-slate-100 text-slate-700 ring-1 ring-slate-200" },
  { value: "ON_HOLD", label: "On hold", icon: PauseCircle, pill: "bg-violet-50 text-violet-700 ring-1 ring-violet-200" }
];

const getDaysInMonth = (date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
const getFirstDayOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay();

const dateKeyFromDate = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const safeDate = (value) => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

const daysUntil = (dueDate) => {
  const d = safeDate(dueDate);
  if (!d) return null;
  const today = startOfToday();
  const due = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffMs = due.getTime() - today.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
};

const isDueSoon = (task) => {
  if (!task?.dueDate) return false;
  if (task.status === "DONE") return false;
  const n = daysUntil(task.dueDate);
  return n !== null && n >= 0 && n <= 1;
};

const badgeForPriority = (priority) =>
  priorityOptions.find((p) => p.value === priority)?.pill ||
  "bg-slate-100 text-slate-700 ring-1 ring-slate-200";

const iconForPriority = (priority) => priorityOptions.find((p) => p.value === priority)?.icon || ListChecks;
const labelForPriority = (priority) => priorityOptions.find((p) => p.value === priority)?.label || "Low";

// --- UI helpers (presentation only) ---
const FieldLabel = ({ children }) => (
  <label className="text-xs font-semibold text-slate-700">{children}</label>
);

const SelectNice = ({ value, onChange, name, options }) => (
  <div className="relative">
    <select
      name={name}
      value={value}
      onChange={onChange}
      className="
        w-full appearance-none rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900
        shadow-sm outline-none transition
        focus:border-amber-400 focus:ring-4 focus:ring-amber-100
      "
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
  </div>
);

const DateNice = ({ value, onChange, name }) => (
  <input
    type="date"
    name={name}
    value={value}
    onChange={onChange}
    className="
      w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900
      shadow-sm outline-none transition
      focus:border-amber-400 focus:ring-4 focus:ring-amber-100
    "
  />
);

const TextInputNice = (props) => (
  <input
    {...props}
    className={`
      w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900
      shadow-sm outline-none transition
      placeholder:text-slate-400
      focus:border-amber-400 focus:ring-4 focus:ring-amber-100
      ${props.className || ""}
    `}
  />
);

const TextAreaNice = (props) => (
  <textarea
    {...props}
    className={`
      w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900
      shadow-sm outline-none transition
      placeholder:text-slate-400
      focus:border-amber-400 focus:ring-4 focus:ring-amber-100
      ${props.className || ""}
    `}
  />
);

const TasksPage = () => {
  const navigate = useNavigate();
  const mainRef = useRef(null);

  const [tasks, setTasks] = useState([]);
  const [userName] = useState(() => {
    const stored = localStorage.getItem("user");
    if (!stored) return "";
    try {
      const u = JSON.parse(stored);
      return u?.name || "";
    } catch {
      return "";
    }
  });
  const [activeView, setActiveView] = useState("dashboard"); // dashboard | add | all
  const [error, setError] = useState("");

  const [currentDate, setCurrentDate] = useState(new Date());

  // tap-to-open fallback for touch devices
  const [openDateKey, setOpenDateKey] = useState(null);

  const [addAnother, setAddAnother] = useState(false);
  const [addForm, setAddForm] = useState({
    title: "",
    description: "",
    dueDate: "",
    priority: "LOW",
    status: "PENDING"
  });

  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({
    title: "",
    description: "",
    dueDate: "",
    priority: "LOW",
    status: "PENDING"
  });

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  const loadTasks = async () => {
    try {
      const res = await API.get("/tasks");
      setTasks(res.data);
    } catch (err) {
      if (err.response?.status === 401) logout();
      else setError("Failed to load tasks");
    }
  };

  useEffect(() => {
    loadTasks();
  }, []);

  // Close date popup on outside click + Esc (UI only)
  useEffect(() => {
    const onDocClick = () => setOpenDateKey(null);
    const onKey = (e) => {
      if (e.key === "Escape") setOpenDateKey(null);
    };
    document.addEventListener("click", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const tasksByDueDate = useMemo(() => {
    const grouped = {};
    tasks.forEach((t) => {
      const d = safeDate(t.dueDate);
      if (!d) return;
      const key = dateKeyFromDate(new Date(d.getFullYear(), d.getMonth(), d.getDate()));
      grouped[key] = grouped[key] || [];
      grouped[key].push(t);
    });
    return grouped;
  }, [tasks]);

  const dueSoonTasks = useMemo(() => {
    return tasks
      .filter((t) => isDueSoon(t))
      .sort((a, b) => (safeDate(a.dueDate)?.getTime() || 0) - (safeDate(b.dueDate)?.getTime() || 0));
  }, [tasks]);

  const priorityBuckets = useMemo(() => {
    const buckets = { HIGH: [], LOW: [], ON_HOLD: [] };
    tasks.forEach((t) => {
      const key = buckets[t.priority] ? t.priority : "LOW";
      buckets[key].push(t);
    });

    const sortFn = (a, b) => {
      const da = safeDate(a.dueDate)?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const db = safeDate(b.dueDate)?.getTime() ?? Number.MAX_SAFE_INTEGER;
      if (da !== db) return da - db;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    };

    buckets.HIGH.sort(sortFn);
    buckets.LOW.sort(sortFn);
    buckets.ON_HOLD.sort(sortFn);
    return buckets;
  }, [tasks]);

  const prevMonth = () => {
    const d = new Date(currentDate);
    d.setMonth(d.getMonth() - 1);
    setCurrentDate(d);
    setOpenDateKey(null);
  };

  const nextMonth = () => {
    const d = new Date(currentDate);
    d.setMonth(d.getMonth() + 1);
    setCurrentDate(d);
    setOpenDateKey(null);
  };

  const daysInMonth = getDaysInMonth(currentDate);
  const firstDay = getFirstDayOfMonth(currentDate);
  const monthDays = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const dateKeyForDay = (day) => {
    const y = currentDate.getFullYear();
    const m = String(currentDate.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}-${String(day).padStart(2, "0")}`;
  };

  const handleAddChange = (e) => setAddForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const toIsoOrNull = (yyyyMmDd) => {
    if (!yyyyMmDd) return null;
    return new Date(`${yyyyMmDd}T00:00:00`).toISOString();
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!addForm.title.trim()) return;

    try {
      const payload = {
        title: addForm.title,
        description: addForm.description,
        status: addForm.status,
        priority: addForm.priority,
        dueDate: toIsoOrNull(addForm.dueDate)
      };

      const res = await API.post("/tasks", payload);
      setTasks((prev) => [res.data, ...prev]);

      if (addAnother) setAddForm((p) => ({ ...p, title: "", description: "", dueDate: "" }));
      else {
        setAddForm({ title: "", description: "", dueDate: "", priority: "LOW", status: "PENDING" });
        setActiveView("dashboard");
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to create task");
    }
  };

  const startEdit = (task) => {
    const d = safeDate(task.dueDate);
    const yyyyMmDd = d
      ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
      : "";

    setEditingId(task._id);
    setEditForm({
      title: task.title || "",
      description: task.description || "",
      status: task.status || "PENDING",
      priority: task.priority || "LOW",
      dueDate: yyyyMmDd
    });
  };

  const cancelEdit = () => setEditingId(null);
  const handleEditChange = (e) => setEditForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        title: editForm.title,
        description: editForm.description,
        status: editForm.status,
        priority: editForm.priority,
        dueDate: editForm.dueDate ? toIsoOrNull(editForm.dueDate) : null
      };

      const res = await API.put(`/tasks/${editingId}`, payload);
      setTasks((prev) => prev.map((t) => (t._id === editingId ? res.data : t)));
      setEditingId(null);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update task");
    }
  };

  const handleDelete = async (id) => {
    try {
      await API.delete(`/tasks/${id}`);
      setTasks((prev) => prev.filter((t) => t._id !== id));
    } catch {
      setError("Failed to delete task");
    }
  };

  const handleStatusChange = async (task, status) => {
    try {
      const res = await API.put(`/tasks/${task._id}`, { status });
      setTasks((prev) => prev.map((t) => (t._id === task._id ? res.data : t)));
    } catch {
      setError("Failed to change status");
    }
  };

  const TaskCard = ({ task }) => {
    const DueIcon = isDueSoon(task) ? AlertTriangle : CalendarClock;
    const PIcon = iconForPriority(task.priority);
    const d = safeDate(task.dueDate);

    return (
      <div
        className={`
          relative rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition
          hover:-translate-y-0.5 hover:shadow-md
          ${isDueSoon(task) ? "ring-2 ring-amber-200" : ""}
        `}
      >
        {isDueSoon(task) && (
          <div className="absolute right-3 top-3">
            <span className="relative flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400/60" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-amber-400" />
            </span>
          </div>
        )}

        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <PIcon className="h-4 w-4 text-slate-700" />
              <h4 className="truncate text-sm font-semibold text-slate-900">{task.title}</h4>
            </div>

            {task.description ? (
              <p className="mt-1 line-clamp-2 text-xs text-slate-600">{task.description}</p>
            ) : (
              <p className="mt-1 text-xs text-slate-400">No description</p>
            )}
          </div>

          <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold ${badgeForPriority(task.priority)}`}>
            {labelForPriority(task.priority)}
          </span>
        </div>

        <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-3 text-[11px] text-slate-600">
          <div className="flex min-w-0 items-center gap-2">
            <DueIcon className={`h-4 w-4 ${isDueSoon(task) ? "text-amber-600 animate-pulse" : "text-slate-500"}`} />
            <span className="truncate">
              {d ? d.toLocaleDateString() : "No due date"}
              {isDueSoon(task) ? " · Due soon" : ""}
            </span>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <div className="relative">
              <select
                value={task.status}
                onChange={(e) => handleStatusChange(task, e.target.value)}
                className="
                  appearance-none rounded-full border border-slate-200 bg-white px-3 py-1.5 pr-7 text-[11px] font-semibold text-slate-800
                  shadow-sm outline-none transition
                  hover:border-amber-300
                  focus:border-amber-400 focus:ring-4 focus:ring-amber-100
                "
              >
                {statusOptions.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            </div>

            <button
              onClick={() => startEdit(task)}
              className="rounded-full border border-slate-200 bg-white p-2 text-slate-700 shadow-sm transition hover:border-amber-300 hover:bg-amber-50"
              title="Edit"
            >
              <Pencil className="h-4 w-4" />
            </button>

            <button
              onClick={() => handleDelete(task._id)}
              className="rounded-full border border-red-200 bg-white p-2 text-red-600 shadow-sm transition hover:bg-red-50"
              title="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  const SidebarButton = ({ active, onClick, icon: Icon, label }) => (
    <button
      onClick={onClick}
      className={`
        flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition
        ${active ? "bg-white/10 text-white" : "text-white/70 hover:bg-white/10 hover:text-white"}
      `}
    >
      <span
        className={`
          grid h-10 w-10 place-items-center rounded-xl
          ${active ? "bg-amber-500 text-slate-900" : "bg-white/10 text-white"}
        `}
      >
        <Icon className="h-4 w-4" />
      </span>
      <span className="font-semibold">{label}</span>
    </button>
  );

  return (
    // lock viewport height; sidebar + main can scroll independently
    <div className="h-[100dvh] w-full overflow-hidden bg-[#f6f7fb] text-slate-900">
      <div className="flex h-full">
        {/* Desktop sidebar (scrollable as requested) */}
        <aside className="hidden md:block md:w-72 h-full shrink-0 overflow-y-auto overscroll-contain bg-slate-950 px-5 py-6 border-r border-white/10">
          <div className="flex min-h-full flex-col">
            <div className="mb-7">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                <h1 className="text-2xl font-bold tracking-tight text-white">TaskFlow</h1>
              </div>
            </div>

            <nav className="space-y-2">
              <p className="px-1 text-[11px] font-bold uppercase tracking-wider text-white/40">Menu</p>

              <SidebarButton
                active={activeView === "dashboard"}
                onClick={() => setActiveView("dashboard")}
                icon={LayoutDashboard}
                label="Dashboard"
              />
              <SidebarButton
                active={activeView === "add"}
                onClick={() => setActiveView("add")}
                icon={PlusCircle}
                label="Add task"
              />
              <SidebarButton
                active={activeView === "all"}
                onClick={() => setActiveView("all")}
                icon={ListChecks}
                label="All tasks"
              />
            </nav>

            <div className="mt-6 border-t border-white/10 pt-4">
              <button
                onClick={logout}
                className="inline-flex w-full items-center justify-between rounded-xl bg-white/5 px-3 py-2 text-xs font-semibold text-white/80 transition hover:bg-white/10"
              >
                <span className="inline-flex items-center gap-2">
                  <LogOut className="h-4 w-4" />
                  Log out
                </span>
                <span className="text-[10px]">⇦</span>
              </button>
            </div>
          </div>
        </aside>

        {/* Main (scrolls) */}
        <main
          ref={mainRef}
          onScroll={() => {
            if (openDateKey) setOpenDateKey(null);
          }}
          className="h-full flex-1 overflow-y-auto overscroll-contain px-3 py-5 sm:px-4 sm:py-6 md:px-8 md:py-8 pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-8"
        >
          <div className="mx-auto w-full max-w-6xl">
            {/* Header */}
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-extrabold tracking-tight text-slate-900">
                  {activeView === "dashboard" ? "Dashboard" : activeView === "add" ? "Create task" : "All tasks"}
                </h2>
                <p className="text-sm text-slate-500">Welcome back, {userName}.</p>
              </div>
            </div>

            {error && (
              <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {/* DASHBOARD */}
            {activeView === "dashboard" && (
              <div className="space-y-6">
                {/* Banner */}
                <div className="rounded-3xl bg-gradient-to-r from-amber-500 to-orange-400 p-5 sm:p-6 text-white shadow-lg">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-sm/6 opacity-95">
                        Hello <span className="font-extrabold">{userName}</span>
                      </p>
                      <p className="mt-1 max-w-xl text-sm opacity-95">
                        Today you have <span className="font-extrabold">{tasks.length}</span> tasks in total.
                      </p>
                      <p className="mt-4 text-xs opacity-90">Have a productive day.</p>
                    </div>

                    <div className="rounded-2xl bg-white/15 px-4 py-3 backdrop-blur">
                      <p className="text-xs opacity-95">Today</p>
                      <p className="text-sm font-bold">{new Date().toLocaleDateString()}</p>
                    </div>
                  </div>
                </div>

                {/* Due soon */}
                <div className="rounded-3xl border border-amber-200 bg-white p-5 shadow-sm">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2">
                      <span className="grid h-10 w-10 place-items-center rounded-2xl bg-amber-100 text-amber-700">
                        <AlertTriangle className="h-5 w-5" />
                      </span>
                      <div>
                        <p className="text-sm font-extrabold text-slate-900">Due soon</p>
                        <p className="text-xs text-slate-500">Tasks due in the next 48 hours</p>
                      </div>
                    </div>

                    <span className="w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                      {dueSoonTasks.length} task{dueSoonTasks.length === 1 ? "" : "s"}
                    </span>
                  </div>

                  {dueSoonTasks.length > 0 && (
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      {dueSoonTasks.slice(0, 4).map((t) => (
                        <div key={t._id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate text-sm font-semibold text-slate-900">{t.title}</p>
                            <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${badgeForPriority(t.priority)}`}>
                              {labelForPriority(t.priority)}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-slate-600">Due: {safeDate(t.dueDate)?.toLocaleDateString()}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Calendar + lanes */}
                <div className="grid gap-5 xl:grid-cols-[380px,1fr]">
                  {/* Calendar (NO horizontal scrolling) */}
                  <section className="relative isolate z-10 overflow-visible rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="mb-4 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Calendar</p>
                        <p className="text-sm font-extrabold text-slate-900">
                          {currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={prevMonth}
                          className="grid h-10 w-10 place-items-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50"
                          title="Previous month"
                        >
                          ‹
                        </button>
                        <button
                          onClick={nextMonth}
                          className="grid h-10 w-10 place-items-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50"
                          title="Next month"
                        >
                          ›
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-7 gap-1 text-center text-[9px] sm:text-[10px] font-extrabold uppercase tracking-wide text-slate-400">
                      {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                        <div key={`${d}-${i}`} className="py-1">
                          {d}
                        </div>
                      ))}
                    </div>

                    <div className="grid grid-cols-7 gap-1">
                      {Array.from({ length: firstDay }).map((_, i) => (
                        <div key={`pad-${i}`} className="h-10 sm:h-12 rounded-2xl" />
                      ))}

                      {monthDays.map((day) => {
                        const key = dateKeyForDay(day);
                        const dayTasks = tasksByDueDate[key] || [];
                        const hasDueSoon = dayTasks.some((t) => isDueSoon(t));
                        const isOpen = openDateKey === key;

                        const col = (firstDay + (day - 1)) % 7;
                        const alignRight = col >= 5;

                        return (
                          <div
                            key={day}
                            className="
                              group relative h-10 sm:h-12 rounded-2xl border border-slate-200 bg-white p-1.5 sm:p-2 shadow-sm transition
                              hover:-translate-y-0.5 hover:bg-slate-50 hover:shadow-md hover:z-20
                            "
                            onClick={(e) => {
                              e.stopPropagation();
                              if (dayTasks.length === 0) return;
                              setOpenDateKey((prev) => (prev === key ? null : key));
                            }}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] sm:text-[11px] font-extrabold text-slate-800">{day}</span>
                              {hasDueSoon && <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />}
                            </div>

                            <div className="mt-0.5 sm:mt-1 flex items-center gap-1">
                              {dayTasks.slice(0, 3).map((t) => (
                                <span
                                  key={t._id}
                                  className={`h-1.5 w-1.5 rounded-full ${
                                    t.priority === "HIGH"
                                      ? "bg-red-500"
                                      : t.priority === "ON_HOLD"
                                      ? "bg-violet-500"
                                      : "bg-amber-500"
                                  }`}
                                />
                              ))}
                              {dayTasks.length > 3 && (
                                <span className="text-[9px] sm:text-[10px] font-bold text-slate-400">+{dayTasks.length - 3}</span>
                              )}
                            </div>

                            {/* Popup: hover (desktop) + tap (mobile) */}
                            {dayTasks.length > 0 && (
                              <div
                                onClick={(e) => e.stopPropagation()}
                                className={`
                                  absolute top-full z-50 pt-2
                                  w-[min(18rem,calc(100vw-2rem))] sm:w-72
                                  ${alignRight ? "right-0" : "left-0"}
                                  transition-all duration-200 ease-out
                                  ${
                                    isOpen
                                      ? "pointer-events-auto opacity-100 translate-y-0 scale-100"
                                      : "pointer-events-none opacity-0 translate-y-1 scale-95"
                                  }
                                  group-hover:pointer-events-auto group-hover:opacity-100 group-hover:translate-y-0 group-hover:scale-100
                                `}
                              >
                                <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-xl">
                                  <div className="mb-2 flex items-center justify-between gap-2">
                                    <p className="text-xs font-extrabold text-slate-900">{key}</p>

                                    <div className="flex items-center gap-2">
                                      <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-700">
                                        {dayTasks.length} task{dayTasks.length === 1 ? "" : "s"}
                                      </span>

                                    
                                    </div>
                                  </div>

                                  <div className="max-h-44 space-y-2 overflow-auto pr-1">
                                    {dayTasks.slice(0, 8).map((t) => (
                                      <div key={t._id} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                                        <div className="flex items-start justify-between gap-2">
                                          <p className="truncate text-xs font-bold text-slate-900">{t.title}</p>
                                          <span
                                            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${badgeForPriority(
                                              t.priority
                                            )}`}
                                          >
                                            {labelForPriority(t.priority)}
                                          </span>
                                        </div>

                                        <p className="mt-1 text-[11px] text-slate-600">
                                          Status: {statusOptions.find((s) => s.value === t.status)?.label}
                                          {isDueSoon(t) ? " · Due soon" : ""}
                                        </p>
                                      </div>
                                    ))}

                                    {dayTasks.length > 8 && (
                                      <p className="text-[11px] font-semibold text-slate-500">+{dayTasks.length - 8} more…</p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <p className="mt-4 text-[11px] text-slate-500">Desktop: hover a date. Mobile: tap a date to open/close.</p>
                  </section>

                  {/* Priority lanes (VISIBLE on mobile too) */}
                  <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                    {["HIGH", "LOW", "ON_HOLD"].map((p) => {
                      const PIcon = iconForPriority(p);
                      const items = priorityBuckets[p];

                      return (
                        <div key={p} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                          <div className="mb-4 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="grid h-10 w-10 place-items-center rounded-2xl bg-slate-100 text-slate-700">
                                <PIcon className="h-5 w-5" />
                              </span>
                              <div>
                                <p className="text-sm font-extrabold text-slate-900">{labelForPriority(p)}</p>
                                <p className="text-xs text-slate-500">Priority lane</p>
                              </div>
                            </div>

                            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">{items.length}</span>
                          </div>

                          <div className="space-y-3">
                            {items.slice(0, 6).map((t) =>
                              editingId === t._id ? (
                                <form key={t._id} onSubmit={handleEditSubmit} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                                  <div className="space-y-2">
                                    <TextInputNice name="title" value={editForm.title} onChange={handleEditChange} required />
                                    <TextAreaNice name="description" value={editForm.description} onChange={handleEditChange} rows={2} />

                                    <div className="grid grid-cols-2 gap-2">
                                      <SelectNice
                                        name="priority"
                                        value={editForm.priority}
                                        onChange={handleEditChange}
                                        options={priorityOptions.map((x) => ({ value: x.value, label: x.label }))}
                                      />
                                      <SelectNice name="status" value={editForm.status} onChange={handleEditChange} options={statusOptions} />
                                    </div>

                                    <DateNice name="dueDate" value={editForm.dueDate} onChange={handleEditChange} />
                                  </div>

                                  <div className="mt-3 flex justify-end gap-2">
                                    <button
                                      type="button"
                                      onClick={cancelEdit}
                                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      type="submit"
                                      className="rounded-xl bg-amber-500 px-3 py-2 text-xs font-extrabold text-slate-900 shadow-sm transition hover:bg-amber-400"
                                    >
                                      Save
                                    </button>
                                  </div>
                                </form>
                              ) : (
                                <TaskCard key={t._id} task={t} />
                              )
                            )}

                            {items.length === 0 && (
                              <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-xs font-semibold text-slate-500">
                                No tasks here yet.
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </section>
                </div>
              </div>
            )}

            {/* ADD TASK */}
            {activeView === "add" && (
              <section className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
                <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="text-lg font-extrabold text-slate-900">Create task</h2>
                    <p className="mt-1 text-sm text-slate-500">Same task features, updated UI theme.</p>
                  </div>

                  <button
                    onClick={() => setActiveView("dashboard")}
                    className="w-fit rounded-2xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
                  >
                    Back to dashboard
                  </button>
                </div>

                <form onSubmit={handleCreateSubmit} className="max-w-2xl space-y-5">
                  <div className="space-y-1.5">
                    <FieldLabel>Title *</FieldLabel>
                    <TextInputNice
                      name="title"
                      value={addForm.title}
                      onChange={handleAddChange}
                      required
                      placeholder="e.g. Prepare presentation deck"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <FieldLabel>Description</FieldLabel>
                    <TextAreaNice
                      name="description"
                      value={addForm.description}
                      onChange={handleAddChange}
                      rows={4}
                      placeholder="Optional details..."
                    />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                    <div className="space-y-1.5">
                      <FieldLabel>Due date</FieldLabel>
                      <DateNice name="dueDate" value={addForm.dueDate} onChange={handleAddChange} />
                    </div>

                    <div className="space-y-1.5">
                      <FieldLabel>Priority</FieldLabel>
                      <SelectNice
                        name="priority"
                        value={addForm.priority}
                        onChange={handleAddChange}
                        options={priorityOptions.map((p) => ({ value: p.value, label: p.label }))}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <FieldLabel>Status</FieldLabel>
                      <SelectNice name="status" value={addForm.status} onChange={handleAddChange} options={statusOptions} />
                    </div>
                  </div>

                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                    <input
                      type="checkbox"
                      checked={addAnother}
                      onChange={(e) => setAddAnother(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    Add another task after creating this one
                  </label>

                  <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center">
                    <button
                      type="submit"
                      className="rounded-2xl bg-amber-500 px-6 py-3 text-sm font-extrabold text-slate-900 shadow-sm transition hover:bg-amber-400"
                    >
                      <span className="inline-flex items-center gap-2">
                        <PlusCircle className="h-4 w-4" />
                        Create Task
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveView("dashboard")}
                      className="rounded-2xl border border-slate-200 bg-white px-6 py-3 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </section>
            )}

            {/* ALL TASKS */}
            {activeView === "all" && (
              <section className="space-y-4">
                <div className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
                  <h2 className="text-lg font-extrabold text-slate-900">All tasks</h2>
                  <p className="mt-1 text-sm text-slate-500">Everything in one place.</p>
                </div>

                {tasks.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-10 text-center text-sm font-semibold text-slate-500 shadow-sm">
                    No tasks yet.
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {tasks.map((t) =>
                      editingId === t._id ? (
                        <form
                          key={t._id}
                          onSubmit={handleEditSubmit}
                          className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
                        >
                          <div className="space-y-2">
                            <TextInputNice name="title" value={editForm.title} onChange={handleEditChange} required />
                            <TextAreaNice name="description" value={editForm.description} onChange={handleEditChange} rows={2} />

                            <div className="grid grid-cols-2 gap-2">
                              <SelectNice
                                name="priority"
                                value={editForm.priority}
                                onChange={handleEditChange}
                                options={priorityOptions.map((x) => ({ value: x.value, label: x.label }))}
                              />
                              <SelectNice name="status" value={editForm.status} onChange={handleEditChange} options={statusOptions} />
                            </div>

                            <DateNice name="dueDate" value={editForm.dueDate} onChange={handleEditChange} />
                          </div>

                          <div className="mt-3 flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={cancelEdit}
                              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
                            >
                              Cancel
                            </button>
                            <button
                              type="submit"
                              className="rounded-xl bg-amber-500 px-3 py-2 text-xs font-extrabold text-slate-900 shadow-sm transition hover:bg-amber-400"
                            >
                              Save
                            </button>
                          </div>
                        </form>
                      ) : (
                        <TaskCard key={t._id} task={t} />
                      )
                    )}
                  </div>
                )}
              </section>
            )}
          </div>
        </main>
      </div>

      {/* Mobile bottom navigation (always visible) */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden border-t border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-around px-3 py-2">
          <button
            onClick={() => setActiveView("dashboard")}
            className={`flex flex-col items-center gap-1 rounded-xl px-3 py-2 text-[11px] font-bold transition ${
              activeView === "dashboard" ? "text-amber-700" : "text-slate-600"
            }`}
          >
            <LayoutDashboard className="h-5 w-5" />
            Dashboard
          </button>

          <button
            onClick={() => setActiveView("add")}
            className={`flex flex-col items-center gap-1 rounded-xl px-3 py-2 text-[11px] font-bold transition ${
              activeView === "add" ? "text-amber-700" : "text-slate-600"
            }`}
          >
            <PlusCircle className="h-5 w-5" />
            Add
          </button>

          <button
            onClick={() => setActiveView("all")}
            className={`flex flex-col items-center gap-1 rounded-xl px-3 py-2 text-[11px] font-bold transition ${
              activeView === "all" ? "text-amber-700" : "text-slate-600"
            }`}
          >
            <ListChecks className="h-5 w-5" />
            Tasks
          </button>

          <button
            onClick={logout}
            className="flex flex-col items-center gap-1 rounded-xl px-3 py-2 text-[11px] font-bold text-slate-600 transition"
          >
            <LogOut className="h-5 w-5" />
            Logout
          </button>
        </div>
      </nav>

      <style>{`
        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      `}</style>
    </div>
  );
};

export default TasksPage;
