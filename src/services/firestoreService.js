// src/services/firestoreService.js
// Rider-side Firestore operations

import {
  collection, doc, addDoc, onSnapshot, updateDoc,
  query, where, serverTimestamp, Timestamp,
} from "firebase/firestore";
import { db } from "./firebase";

// ── Subscribe to orders assigned to this rider ────────────────────────────────
// Single-field query (no composite Firestore index required).
// Status filtered in JS so the listener never silently fails.
export const subscribeRiderOrders = (riderId, callback) => {
  const q = query(
    collection(db, "orders"),
    where("riderId", "==", riderId)
  );
  return onSnapshot(q, (snap) => {
    const orders = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((o) => ["rider_assigned", "delivering", "delivered"].includes(o.status));
    callback(orders);
  }, (err) => console.warn("subscribeRiderOrders error:", err.code));
};

// ── Rider accepts an order ────────────────────────────────────────────────────
export const acceptOrder = async (orderId) => {
  await updateDoc(doc(db, "orders", orderId), {
    riderAccepted: true,
    deliveryStep:  "accepted",
    updatedAt:     serverTimestamp(),
  });
};

// ── Rider advances their delivery step ───────────────────────────────────────
// step: "accepted" | "pickup" | "delivering" | "delivered"
// "delivering" also flips order status to "delivering".
// "delivered"  also flips order status to "delivered".
export const updateDeliveryStep = async (orderId, step) => {
  const updates = { deliveryStep: step, updatedAt: serverTimestamp() };
  if (step === "delivering") updates.status = "delivering";
  if (step === "delivered") {
    updates.status      = "delivered";
    updates.deliveredAt = serverTimestamp();
  }
  await updateDoc(doc(db, "orders", orderId), updates);
};

// ── Broadcast rider GPS position ─────────────────────────────────────────────
// Called every ~5s from the map's geolocation watcher.
export const updateRiderLocation = async (riderId, lat, lng) => {
  await updateDoc(doc(db, "riders", riderId), {
    lat, lng, lastSeen: serverTimestamp(),
  });
};

// ── Update rider online/offline status ───────────────────────────────────────
export const setRiderOnlineStatus = async (riderId, online) => {
  await updateDoc(doc(db, "riders", riderId), {
    status:    online ? "online" : "offline",
    updatedAt: serverTimestamp(),
  });
};

// ── Subscribe to in-app notifications for this rider ─────────────────────────
// No orderBy — sorted in JS to avoid composite index requirements.
export const subscribeUserNotifications = (userId, callback) => {
  const q = query(collection(db, "notifications", userId, "messages"));
  return onSnapshot(q, (snap) => {
    const notifs = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
    callback(notifs);
  }, (err) => console.warn("subscribeUserNotifications error:", err.code));
};

export const markNotificationRead = async (userId, notifId) => {
  await updateDoc(doc(db, "notifications", userId, "messages", notifId), { isRead: true });
};

export const markAllNotificationsRead = async (userId, notifs) => {
  await Promise.all(
    notifs.filter(n => !n.isRead).map(n =>
      updateDoc(doc(db, "notifications", userId, "messages", n.id), { isRead: true })
    )
  );
};

// ── Push a notification to any user (used for chat message alerts) ───────────
export const sendNotification = async (uid, title, body, data = {}) => {
  if (!uid) return;
  await addDoc(collection(db, "notifications", uid, "messages"), {
    title, body, data, createdAt: serverTimestamp(), isRead: false,
  });
};

// ── Send a chat message (rider ↔ customer) ────────────────────────────────────
// Stored under orders/{orderId}/chat so Firestore rules that cover orders also cover chat.
export const sendMessage = (orderId, senderId, senderRole, senderName, text) => {
  addDoc(collection(db, "orders", orderId, "chat"), {
    senderId, senderRole, senderName, text,
    createdAt: Timestamp.fromDate(new Date()),
  });
};

// ── Subscribe to chat messages for an order ───────────────────────────────────
export const subscribeMessages = (orderId, callback) => {
  const q = collection(db, "orders", orderId, "chat");
  return onSnapshot(q, (snap) => {
    const msgs = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.createdAt?.toMillis?.() || 0) - (b.createdAt?.toMillis?.() || 0));
    callback(msgs);
  });
};
