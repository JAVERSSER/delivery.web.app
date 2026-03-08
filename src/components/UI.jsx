// src/components/UI.jsx
import { useState, useEffect } from "react";

export function Spinner({ size = "md", color = "green" }) {
  const s = { sm: "w-4 h-4", md: "w-6 h-6", lg: "w-8 h-8" }[size];
  const c = color === "white" ? "border-white border-t-transparent" : "border-green-500 border-t-transparent";
  return <div className={`${s} rounded-full border-2 ${c} animate-spin`} />;
}

export function Button({ children, variant = "primary", size = "md", className = "", loading = false, disabled = false, ...props }) {
  const base = "inline-flex items-center justify-center gap-2 font-semibold rounded-2xl transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed select-none";
  const variants = {
    primary:   "bg-green-500 text-white shadow-lg shadow-green-200 hover:bg-green-600 active:bg-green-700",
    secondary: "bg-green-50 text-green-700 hover:bg-green-100",
    outline:   "border-2 border-gray-200 text-gray-700 hover:border-gray-300 bg-white",
    ghost:     "text-gray-600 hover:bg-gray-100",
    danger:    "bg-red-500 text-white hover:bg-red-600",
    warning:   "bg-amber-500 text-white hover:bg-amber-600 shadow-lg shadow-amber-200",
  };
  const sizes = { sm: "px-3 py-1.5 text-xs", md: "px-4 py-2.5 text-sm", lg: "px-6 py-3.5 text-base", xl: "px-8 py-4 text-lg" };
  return (
    <button className={`${base} ${variants[variant]} ${sizes[size]} ${className}`} disabled={disabled || loading} {...props}>
      {loading ? <Spinner size="sm" color={variant === "primary" ? "white" : "green"} /> : null}
      {children}
    </button>
  );
}

export function Input({ label, error, icon, className = "", ...props }) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</label>}
      <div className="relative">
        {icon && <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-base">{icon}</span>}
        <input
          className={`w-full bg-white border ${error ? "border-red-400" : "border-gray-200 focus:border-green-400"} rounded-2xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-green-100 transition-all ${icon ? "pl-10" : ""}`}
          {...props}
        />
      </div>
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  );
}

export function BottomSheet({ open, onClose, children, title, snapFull = false }) {
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative bg-white rounded-t-3xl shadow-2xl animate-slide-up ${snapFull ? "max-h-[95vh]" : "max-h-[85vh]"} overflow-hidden flex flex-col`}>
        <div className="flex-shrink-0 pt-3 pb-1 px-4">
          <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-3" />
          {title && (
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-base font-bold text-gray-900">{title}</h3>
              <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 text-sm">✕</button>
            </div>
          )}
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain">{children}</div>
      </div>
    </div>
  );
}

export function Modal({ open, onClose, children, title }) {
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-sm animate-bounce-in overflow-hidden max-h-[90vh] flex flex-col">
        {title && (
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 flex-shrink-0">
            <h3 className="font-bold text-gray-900">{title}</h3>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500">✕</button>
          </div>
        )}
        <div className="overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

let toastFn = null;
export function toast(msg, type = "success") { if (toastFn) toastFn(msg, type); }

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  toastFn = (msg, type) => {
    const id = Date.now();
    setToasts(p => [...p, { id, msg, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3000);
  };
  const icons = { success: "✅", error: "❌", info: "ℹ️", warning: "⚠️" };
  return (
    <>
      {children}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 w-[90vw] max-w-sm pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} className="bg-gray-900 text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-3 animate-fade-in text-sm font-medium">
            <span>{icons[t.type]}</span><span>{t.msg}</span>
          </div>
        ))}
      </div>
    </>
  );
}