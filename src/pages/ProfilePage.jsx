// src/pages/ProfilePage.jsx
import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { Button, Modal, toast } from "../components/UI";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../services/firebase";

export default function ProfilePage() {
  const { rider, logout, updateProfile } = useAuth();
  const [logoutModal, setLogoutModal]     = useState(false);
  const [editing, setEditing]             = useState(false);
  const [saving, setSaving]               = useState(false);
  const [doneOrders, setDoneOrders]       = useState([]);
  const [form, setForm] = useState({
    name:    rider?.name    || "",
    phone:   rider?.phone   || "",
    vehicle: rider?.vehicle || "Motorbike",
    plate:   rider?.plate   || "",
  });

  // Subscribe to this rider's delivered orders — single-field query, filter in JS
  useEffect(() => {
    if (!rider?.uid) return;
    const q = query(collection(db, "orders"), where("riderId", "==", rider.uid));
    return onSnapshot(q, (snap) => {
      setDoneOrders(
        snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(o => o.status === "delivered")
      );
    });
  }, [rider?.uid]); // eslint-disable-line react-hooks/exhaustive-deps

  // Helpers for time-based filtering
  const toMs = (o) => o.placedAt || (o.createdAt?.toMillis?.()) || 0;
  const now      = Date.now();
  const todayMs  = new Date().setHours(0, 0, 0, 0);
  const weekMs   = now - 7 * 24 * 60 * 60 * 1000;

  const todayOrders = doneOrders.filter(o => toMs(o) >= todayMs);
  const weekOrders  = doneOrders.filter(o => toMs(o) >= weekMs);

  const todayEarnings = todayOrders.reduce((s, o) => s + (Number(o.deliveryFee) || 0), 0);
  const weekEarnings  = weekOrders .reduce((s, o) => s + (Number(o.deliveryFee) || 0), 0);
  const totalEarnings = doneOrders .reduce((s, o) => s + (Number(o.deliveryFee) || 0), 0);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const openEdit = () => {
    setForm({
      name:    rider?.name    || "",
      phone:   rider?.phone   || "",
      vehicle: rider?.vehicle || "Motorbike",
      plate:   rider?.plate   || "",
    });
    setEditing(true);
  };

  const save = async () => {
    if (!form.name.trim()) { toast("Name is required", "error"); return; }
    setSaving(true);
    await updateProfile(form);
    setSaving(false);
    setEditing(false);
    toast("Profile updated!", "success");
  };

  const stats = [
    { label: "Deliveries", value: doneOrders.length,             icon: "📦" },
    { label: "Rating",     value: `${rider?.rating ?? 5.0}★`,   icon: "⭐" },
    { label: "This Week",  value: `$${weekEarnings.toFixed(2)}`, icon: "💵" },
  ];

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-gradient-to-br from-green-500 to-emerald-600 px-4 pt-10 pb-16 safe-top">
        <div className="flex items-center justify-between mb-5">
          <h1 className="text-xl font-black text-white font-display">My Profile</h1>
          <button
            onClick={openEdit}
            className="bg-white/20 text-white text-xs font-semibold px-3 py-1.5 rounded-full hover:bg-white/30 transition-all"
          >
            Edit ✏️
          </button>
        </div>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-3xl bg-white flex items-center justify-center text-2xl font-black text-green-600 shadow-lg">
            {rider?.avatar || (rider?.name?.[0]?.toUpperCase()) || "R"}
          </div>
          <div>
            <h2 className="text-xl font-black text-white">{rider?.name}</h2>
            <p className="text-white/80 text-sm">{rider?.email}</p>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="w-1.5 h-1.5 bg-green-300 rounded-full animate-pulse" />
              <span className="text-white/70 text-xs">{rider?.approved ? "Approved Rider" : "Pending Approval"}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="mx-4 -mt-8 bg-white rounded-3xl shadow-lg p-4 flex divide-x divide-gray-100 mb-4">
        {stats.map(s => (
          <div key={s.label} className="flex-1 text-center">
            <div className="text-2xl mb-0.5">{s.icon}</div>
            <div className="font-black text-gray-900 text-lg leading-tight">{s.value}</div>
            <div className="text-[11px] text-gray-500">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="px-4 space-y-4">
        {/* Earnings card */}
        <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-3xl p-4 text-white">
          <div className="text-xs font-semibold opacity-70 mb-2">Total Earnings</div>
          <div className="text-3xl font-black">${totalEarnings.toFixed(2)}</div>
          <div className="flex gap-4 mt-3">
            <div className="bg-white/20 rounded-xl px-3 py-2 text-center">
              <div className="font-bold text-base">${todayEarnings.toFixed(2)}</div>
              <div className="text-[10px] opacity-70">Today</div>
            </div>
            <div className="bg-white/20 rounded-xl px-3 py-2 text-center">
              <div className="font-bold text-base">${weekEarnings.toFixed(2)}</div>
              <div className="text-[10px] opacity-70">This Week</div>
            </div>
          </div>
        </div>

        {/* Info card */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
          {[
            { icon: "🛵", label: "Vehicle",       value: rider?.vehicle || "—" },
            { icon: "🪪", label: "License Plate", value: rider?.plate   || "—" },
            { icon: "📱", label: "Phone",         value: rider?.phone   || "—" },
            { icon: "📧", label: "Email",         value: rider?.email   || "—" },
            { icon: "💳", label: "Payment",       value: "Cash" },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3.5 border-b border-gray-50 last:border-0">
              <span className="text-xl w-8">{item.icon}</span>
              <span className="flex-1 text-sm font-medium text-gray-700">{item.label}</span>
              <span className="text-sm text-gray-500">{item.value}</span>
            </div>
          ))}
        </div>

        <button
          onClick={() => setLogoutModal(true)}
          className="w-full bg-red-50 border border-red-100 text-red-600 font-bold rounded-3xl py-4 flex items-center justify-center gap-2"
        >
          🚪 Sign Out
        </button>
      </div>

      {/* Edit Profile Modal */}
      <Modal open={editing} onClose={() => setEditing(false)} title="Edit Profile">
        <div className="p-4 space-y-4">
          {/* Name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Full Name</label>
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-2xl px-3 py-2.5">
              <span>👤</span>
              <input
                value={form.name}
                onChange={e => set("name", e.target.value)}
                className="flex-1 bg-transparent text-sm outline-none text-gray-800"
                placeholder="Your name"
              />
            </div>
          </div>

          {/* Phone */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Phone Number</label>
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-2xl px-3 py-2.5">
              <span>📱</span>
              <input
                type="tel"
                value={form.phone}
                onChange={e => set("phone", e.target.value)}
                className="flex-1 bg-transparent text-sm outline-none text-gray-800"
                placeholder="012 345 678"
              />
            </div>
          </div>

          {/* Vehicle */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Vehicle Type</label>
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-2xl px-3 py-2.5">
              <span>🛵</span>
              <input
                value={form.vehicle}
                onChange={e => set("vehicle", e.target.value)}
                className="flex-1 bg-transparent text-sm outline-none text-gray-800"
                placeholder="e.g. Motorbike, Bicycle, Car..."
              />
            </div>
          </div>

          {/* Plate */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">License Plate</label>
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-2xl px-3 py-2.5">
              <span>🪪</span>
              <input
                value={form.plate}
                onChange={e => set("plate", e.target.value)}
                className="flex-1 bg-transparent text-sm outline-none text-gray-800 uppercase"
                placeholder="2A-1234"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <Button variant="outline" className="flex-1" onClick={() => setEditing(false)}>Cancel</Button>
            <Button variant="primary" className="flex-1" loading={saving} onClick={save}>Save</Button>
          </div>
        </div>
      </Modal>

      {/* Logout confirm */}
      <Modal open={logoutModal} onClose={() => setLogoutModal(false)}>
        <div className="p-6 text-center">
          <div className="text-4xl mb-3">👋</div>
          <h3 className="font-bold text-gray-900 text-lg mb-1">Sign Out?</h3>
          <p className="text-gray-500 text-sm mb-5">You'll stop receiving delivery requests.</p>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setLogoutModal(false)}>Cancel</Button>
            <Button variant="danger" className="flex-1" onClick={logout}>Sign Out</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
