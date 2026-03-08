// src/pages/AuthPage.jsx
import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/UI";

export default function AuthPage() {
  const { login, register, error, setError } = useAuth();

  const [mode, setMode] = useState("login"); // "login" | "register"
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
    vehicle: "",
  });

  const [errs, setErrs] = useState({});

  const set = (k, v) => {
    setForm((p) => ({ ...p, [k]: v }));
    setErrs((p) => ({ ...p, [k]: "" }));
    setError("");
  };

  const validate = () => {
    const e = {};

    if (mode === "register" && !form.name.trim())
      e.name = "Name is required";

    if (!form.email.trim())
      e.email = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(form.email))
      e.email = "Enter a valid email";

    if (!form.password)
      e.password = "Password is required";
    else if (form.password.length < 6)
      e.password = "At least 6 characters";

    if (mode === "register" && !form.phone.trim())
      e.phone = "Phone is required";

    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const e2 = validate();
    if (Object.keys(e2).length) {
      setErrs(e2);
      return;
    }

    setLoading(true);

    if (mode === "login")
      await login(form.email, form.password);
    else
      await register(form);

    setLoading(false);
  };

  const switchMode = (m) => {
    setMode(m);
    setErrs({});
    setError("");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50 flex flex-col">
      
      {/* Hero */}
      <div className="flex-shrink-0 pt-12 pb-8 px-6 text-center">
        <div className="relative inline-block">
          <div className="w-24 h-24 bg-gradient-to-br from-green-400 to-emerald-600 rounded-3xl flex items-center justify-center text-5xl shadow-2xl shadow-green-200 mx-auto mb-4">
            🛵
          </div>
          <div className="absolute -top-1 -right-1 w-6 h-6 bg-green-400 rounded-full animate-pulse opacity-60" />
        </div>

        <h1 className="text-3xl font-black text-gray-900 mt-2">
          Rider App
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          FoodDash · Delivery Partner
        </p>
      </div>

      {/* Card */}
      <div className="flex-1 bg-white rounded-t-3xl shadow-2xl px-6 pt-6 pb-8">
        
        {/* Tabs */}
        <div className="flex bg-gray-100 rounded-2xl p-1 mb-6">
          {["login", "register"].map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => switchMode(m)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                mode === m
                  ? "bg-white text-green-600 shadow-sm"
                  : "text-gray-500"
              }`}
            >
              {m === "login" ? "Sign In" : "Sign Up"}
            </button>
          ))}
        </div>

        {/* Global Error */}
        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-2xl px-4 py-3 mb-4">
            <span>⚠️</span>
            <span className="text-red-600 text-sm">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Name (register only) */}
          {mode === "register" && (
            <Field label="Full Name" icon="👤" error={errs.name}>
              <input
                type="text"
                placeholder="Visal Sok"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                className={inputCls(errs.name)}
              />
            </Field>
          )}

          {/* Email */}
          <Field label="Email" icon="✉️" error={errs.email}>
            <input
              type="email"
              placeholder="rider@email.com"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              className={inputCls(errs.email)}
            />
          </Field>

          {/* Password */}
          <Field label="Password" icon="🔒" error={errs.password}>
            <input
              type={showPass ? "text" : "password"}
              placeholder="••••••••"
              value={form.password}
              onChange={(e) => set("password", e.target.value)}
              className={inputCls(errs.password) + " pr-11"}
            />
            <button
              type="button"
              onClick={() => setShowPass(!showPass)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm"
            >
              {showPass ? "🙈" : "👁️"}
            </button>
          </Field>

          {/* Phone (register only) */}
          {mode === "register" && (
            <Field label="Phone Number" icon="📱" error={errs.phone}>
              <input
                type="tel"
                placeholder="012 345 678"
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
                className={inputCls(errs.phone)}
              />
            </Field>
          )}

          {/* Vehicle (optional) */}
          {mode === "register" && (
            <Field label="Vehicle Type (optional)" icon="🏍️" error="">
              <input
                type="text"
                placeholder="Motorbike"
                value={form.vehicle}
                onChange={(e) => set("vehicle", e.target.value)}
                className={inputCls("")}
              />
            </Field>
          )}

          <Button
            type="submit"
            size="xl"
            className="w-full mt-2 bg-green-500 hover:bg-green-600"
            loading={loading}
          >
            {mode === "login" ? "Sign In →" : "Create Account →"}
          </Button>
        </form>

        {mode === "register" && (
          <p className="text-center text-xs text-gray-400 mt-4">
            Your account needs admin approval before you can accept orders.
          </p>
        )}
      </div>
    </div>
  );
}

/* ───────── Helpers ───────── */

function inputCls(err) {
  return `w-full bg-white text-black placeholder-gray-400 border ${
    err
      ? "border-red-400"
      : "border-gray-200 focus:border-green-400"
  } rounded-2xl pl-10 py-3 text-sm outline-none focus:ring-2 focus:ring-green-100 transition-all`;
}

function Field({ label, icon, error, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
        {label}
      </label>
      <div className="relative">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-base">
          {icon}
        </span>
        {children}
      </div>
      {error && (
        <span className="text-xs text-red-500">
          {error}
        </span>
      )}
    </div>
  );
}