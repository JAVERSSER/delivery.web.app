// src/App.jsx
import { useState, useEffect, useRef } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ToastProvider, Spinner, toast } from "./components/UI";
import BottomNav    from "./components/BottomNav";
import AuthPage     from "./pages/AuthPage";
import HomePage     from "./pages/HomePage";
import HistoryPage  from "./pages/HistoryPage";
import ProfilePage  from "./pages/ProfilePage";
import {
  subscribeRiderOrders,
  updateDeliveryStep,
  setRiderOnlineStatus,
  subscribeUserNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "./services/firestoreService";

function AppInner() {
  const { rider, loading } = useAuth();
  const [page, setPage]             = useState("home");
  const [isOnline, setIsOnline]     = useState(false);
  const [isOffline, setIsOffline]   = useState(!navigator.onLine);

  useEffect(() => {
    const goOnline  = () => setIsOffline(false);
    const goOffline = () => setIsOffline(true);
    window.addEventListener("online",  goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online",  goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);
  const [activeOrder, setActiveOrder]       = useState(null);
  const [incomingOrders, setIncomingOrders] = useState([]);
  const [history, setHistory]               = useState([]);
  const [notifications, setNotifications]   = useState([]);
  const [historyOrderId, setHistoryOrderId] = useState(null);

  const notifInitialDone = useRef(false);
  const seenNotifIds     = useRef(new Set());

  // ── Sync online status to Firestore when rider logs in or gets approved ──
  // Keyed on uid + approved so it re-runs the moment admin approves the rider,
  // but NOT on every GPS update (which only changes lat/lng/lastSeen).
  useEffect(() => {
    if (!rider?.uid) return;
    if (!rider.approved) {
      setIsOnline(false);
      return;
    }
    setRiderOnlineStatus(rider.uid, true).catch(console.error);
    setIsOnline(true);
    // Set offline when browser tab is closed
    const handleUnload = () => setRiderOnlineStatus(rider.uid, false).catch(() => {});
    window.addEventListener("beforeunload", handleUnload);
    return () => window.removeEventListener("beforeunload", handleUnload);
  }, [rider?.uid, rider?.approved]); // eslint-disable-line

  // ── Request browser notification permission ────────────────────────────────
  useEffect(() => {
    if (!rider) return;
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, [rider]);

  // ── Subscribe to Firestore push notifications (sent by admin) ────────────
  useEffect(() => {
    if (!rider) return;
    notifInitialDone.current = false;
    seenNotifIds.current = new Set();

    const unsub = subscribeUserNotifications(rider.uid, (notifs) => {
      setNotifications(notifs);

      // First snapshot: seed seen IDs silently — skip toasting old notifications
      if (!notifInitialDone.current) {
        notifs.forEach((n) => seenNotifIds.current.add(n.id));
        notifInitialDone.current = true;
        return;
      }

      // Only toast genuinely new unread notifications
      notifs.forEach((n) => {
        if (!seenNotifIds.current.has(n.id) && !n.isRead) {
          toast(`${n.title} — ${n.body}`, "info");
          if ("Notification" in window && Notification.permission === "granted") {
            new Notification(n.title, { body: n.body, icon: "/favicon.ico" });
          }
          markNotificationRead(rider.uid, n.id).catch(() => {});
        }
        seenNotifIds.current.add(n.id);
      });
    });
    return unsub;
  }, [rider]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Subscribe to orders assigned to this rider ─────────────────────────────
  useEffect(() => {
    if (!rider) return;

    const unsub = subscribeRiderOrders(rider.uid, (orders) => {
      // "incoming" = assigned but rider hasn't accepted yet
      const incoming  = orders.filter((o) => !o.riderAccepted && o.status === "rider_assigned");
      // "active"   = accepted by rider (in progress)
      const active    = orders.find((o) => o.riderAccepted && o.status !== "delivered");
      // "done"     = fully delivered — sync to history with review data
      const doneOrders = orders.filter((o) => o.riderAccepted && o.status === "delivered");

      setIncomingOrders(
        incoming.map((o) => ({
          ...o,
          deliveryAddress: o.deliveryAddress || o.address || "",
          customerName:    o.customerName    || o.customer || "Customer",
        }))
      );

      if (active) {
        setActiveOrder((prev) => {
          const step = active.deliveryStep || "accepted";
          if (prev?.id === active.id) {
            return { ...prev, ...active, deliveryStatus: step };
          }
          return { ...active, deliveryStatus: step };
        });
      } else {
        // No active order — clear using functional update to avoid stale closure
        setActiveOrder((prev) => (prev ? null : prev));
      }

      // Sync delivered orders from Firestore so history always reflects real data + reviews
      if (doneOrders.length > 0) {
        setHistory(
          doneOrders
            .map((o) => ({
              id:           o.id,
              orderNumber:  o.orderNumber,
              shopName:     o.shopName,
              shopEmoji:    o.shopEmoji,
              shopAddress:  o.shopAddress || "",
              customerName: o.customerName || o.customer || "Customer",
              customerPhone: o.phone || o.customerPhone || "",
              address:      o.address || o.deliveryAddress || "",
              items:        o.items || [],
              note:         o.note || "",
              total:        Number(o.total || 0),
              deliveryFee:  Number(o.deliveryFee || 0),
              payment:      o.payment || "Cash",
              date: o.date || new Date(
                o.createdAt?.seconds ? o.createdAt.seconds * 1000 : Date.now()
              ).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
              time:   o.time || "",
              status: "delivered",
              review: o.review || null,
            }))
            .sort((a, b) => {
              // Sort newest first using the original createdAt if available
              const aMs = doneOrders.find(o => o.id === a.id)?.createdAt?.seconds || 0;
              const bMs = doneOrders.find(o => o.id === b.id)?.createdAt?.seconds || 0;
              return bMs - aMs;
            })
        );
      }
    });

    return unsub;
  }, [rider]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Handle rider going online/offline ─────────────────────────────────────
  const handleSetOnline = (online) => {
    setIsOnline(online);
    if (rider) setRiderOnlineStatus(rider.uid, online).catch(console.error);
  };

  // ── Rider advances delivery step ───────────────────────────────────────────
  // Called by HomePage → ActiveOrderCard button presses
  const handleDeliveryStepUpdate = async (orderId, newStep) => {
    setActiveOrder((prev) => prev ? { ...prev, deliveryStatus: newStep } : prev);
    try {
      await updateDeliveryStep(orderId, newStep);
    } catch (e) {
      console.error("Failed to update delivery step:", e);
    }
    // History is populated from Firestore via subscribeRiderOrders; just clear the active order
    if (newStep === "delivered") {
      setTimeout(() => setActiveOrder(null), 2500);
    }
  };

  // History is Firestore-driven — this is a no-op kept for prop compatibility
  const handleDeliveryComplete = () => {};

  if (isOffline) {
    return (
      <div className="min-h-screen bg-green-50 flex flex-col items-center justify-center gap-4 p-8 text-center">
        <div className="text-6xl">📶</div>
        <h2 className="text-xl font-black text-gray-900">No Internet Connection</h2>
        <p className="text-gray-500 text-sm">Please check your connection and try again.</p>
        <div className="flex items-center gap-2 text-gray-400 text-xs mt-2">
          <span className="w-2 h-2 bg-red-400 rounded-full animate-pulse" />Offline
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-green-50 flex flex-col items-center justify-center gap-4">
        <div className="text-5xl">🛵</div>
        <Spinner size="lg" color="green" />
        <div className="text-gray-500 text-sm font-medium">Loading Rider App...</div>
      </div>
    );
  }

  if (!rider) return <AuthPage />;

  return (
    <div className="max-w-md mx-auto min-h-screen relative bg-white">
      {page === "home" && (
        <HomePage
          activeOrder={activeOrder}
          setActiveOrder={setActiveOrder}
          isOnline={isOnline}
          setIsOnline={handleSetOnline}
          incomingOrders={incomingOrders}
          setIncomingOrders={setIncomingOrders}
          onDeliveryComplete={handleDeliveryComplete}
          onDeliveryStepUpdate={handleDeliveryStepUpdate}
          notifications={notifications}
          onMarkAllRead={() => { if (rider?.uid) markAllNotificationsRead(rider.uid, notifications).catch(() => {}); }}
          setPage={setPage}
          onGoHistory={(orderId) => { setHistoryOrderId(orderId); setPage("history"); }}
        />
      )}
      {page === "history" && (
        <HistoryPage
          history={history}
          initialSelectedId={historyOrderId}
          onClearInitialSelected={() => setHistoryOrderId(null)}
        />
      )}
      {page === "profile" && <ProfilePage />}

      {/* ── Persistent incoming-order banner (visible on any non-home page) ── */}
      {page !== "home" && incomingOrders.length > 0 && (
        <button
          onClick={() => setPage("home")}
          className="fixed bottom-20 left-4 right-4 z-50 bg-green-500 text-white rounded-2xl px-4 py-3 flex items-center gap-3 shadow-2xl shadow-green-200 animate-bounce max-w-[calc(28rem-2rem)] mx-auto"
          style={{ left: "1rem", right: "1rem" }}
        >
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-xl flex-shrink-0">
            🛵
          </div>
          <div className="flex-1 text-left">
            <div className="font-black text-sm">New Order Assigned!</div>
            <div className="text-xs text-green-100 mt-0.5">Tap to view and accept the order</div>
          </div>
          <span className="text-white/80 text-lg font-bold">→</span>
        </button>
      )}

      <BottomNav page={page} setPage={setPage} incomingCount={incomingOrders.length} />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <AppInner />
      </ToastProvider>
    </AuthProvider>
  );
}
