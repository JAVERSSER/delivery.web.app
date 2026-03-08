// src/pages/HomePage.jsx
import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { Button, BottomSheet, toast } from "../components/UI";
import { acceptOrder, updateRiderLocation, sendMessage, subscribeMessages, sendNotification } from "../services/firestoreService";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

const fmtOrder = (o) => {
  if (o?.orderNumber) return o.orderNumber;
  const id = o?.id || "";
  let n = 0;
  for (let i = 0; i < id.length; i++) n = (n * 31 + id.charCodeAt(i)) >>> 0;
  return (n % 900000) + 100000;
};

const PHNOM_PENH = [11.5564, 104.9282];

// Inject map icon CSS once
if (!document.getElementById("map-icon-css")) {
  const s = document.createElement("style");
  s.id = "map-icon-css";
  s.textContent = "@keyframes locPulse{0%,100%{transform:scale(1);opacity:.35}50%{transform:scale(2.4);opacity:0}}";
  document.head.appendChild(s);
}

// Blue pulsing dot — "you are here" before Start
function makeLocationDot() {
  return L.divIcon({
    html: `<div style="position:relative;width:22px;height:22px;display:flex;align-items:center;justify-content:center;">
      <div style="position:absolute;inset:-6px;border-radius:50%;background:rgba(66,133,244,0.3);animation:locPulse 2s ease-in-out infinite;pointer-events:none;"></div>
      <div style="width:16px;height:16px;border-radius:50%;background:#4285F4;border:3px solid white;box-shadow:0 2px 8px rgba(66,133,244,0.55);"></div>
    </div>`,
    className: "",
    iconSize:   [22, 22],
    iconAnchor: [11, 11],
    popupAnchor:[0, -14],
  });
}

// Delivery rider icon — appears after Start, moves in real time
function makeDeliveryRiderIcon() {
  return L.divIcon({
    html: `<div style="position:relative;width:46px;height:52px;display:flex;flex-direction:column;align-items:center;">
      <div style="width:44px;height:44px;border-radius:50%;background:linear-gradient(145deg,#ff6b35,#e65c00);border:3px solid white;box-shadow:0 4px 14px rgba(230,92,0,0.55);display:flex;align-items:center;justify-content:center;">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" width="24" height="24">
          <path d="M19 7c0-1.1-.9-2-2-2h-3l2 4h-4L10 7H7L5 11H3v2h2c0 1.66 1.34 3 3 3s3-1.34 3-3h4c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-2h-1l-3-4zM8 15c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm8 0c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z"/>
        </svg>
      </div>
      <div style="width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:9px solid #e65c00;margin-top:-1px;"></div>
    </div>`,
    className: "",
    iconSize:   [46, 52],
    iconAnchor: [23, 52],
    popupAnchor:[0, -52],
  });
}

function makeIcon(emoji, bg) {
  return L.divIcon({
    html: `<div style="background:${bg};width:36px;height:36px;border-radius:50%;border:3px solid white;box-shadow:0 2px 10px rgba(0,0,0,.25);display:flex;align-items:center;justify-content:center;font-size:17px;">${emoji}</div>`,
    className: "",
    iconSize:   [36, 36],
    iconAnchor: [18, 18],
    popupAnchor:[0, -22],
  });
}

// ── Leaflet two-phase navigation (Phase 1: rider→shop, Phase 2: rider→customer) ──
function RouteMap({ order, riderId }) {
  const mapElRef      = useRef(null);
  const leafletRef    = useRef(null);
  const watchRef      = useRef(null);
  const writeRef      = useRef(0);
  const routeRef      = useRef(0);
  const shopPosRef    = useRef(PHNOM_PENH);
  const custPosRef    = useRef([11.5630, 104.9240]);
  const riderPosRef   = useRef(null);
  const navRef        = useRef(false);
  const routeLayerRef = useRef(null);
  const markersRef    = useRef({});
  const phaseRef      = useRef("shop");

  const deliveryStatus = order.deliveryStatus || "accepted";
  const phase = deliveryStatus === "accepted" ? "shop" : "customer";
  phaseRef.current = phase;

  const [shopPos,   setShopPos]   = useState(PHNOM_PENH);
  const [custPos,   setCustPos]   = useState([11.5630, 104.9240]);
  const [riderPos,  setRiderPos]  = useState(null);
  const [eta,       setEta]       = useState(null);
  const [steps,     setSteps]     = useState([]);
  const [stepIdx,   setStepIdx]   = useState(0);
  const [started,   setStarted]   = useState(false);
  const [gpsStatus, setGpsStatus] = useState("waiting"); // "waiting" | "active" | "error"

  // Init Leaflet map once
  useEffect(() => {
    if (!mapElRef.current || leafletRef.current) return;
    leafletRef.current = L.map(mapElRef.current, { zoomControl: false, attributionControl: false })
      .setView(PHNOM_PENH, 14);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 })
      .addTo(leafletRef.current);
    return () => { leafletRef.current?.remove(); leafletRef.current = null; };
  }, []);

  const fetchRoute = useCallback(async (from, to) => {
    const map = leafletRef.current;
    if (!map) return;
    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${from[1]},${from[0]};${to[1]},${to[0]}?overview=full&geometries=geojson&steps=true`;
      const data = await fetch(url).then(r => r.json());
      if (data.code !== "Ok") return;
      const route = data.routes[0];
      const leg   = route.legs[0];
      if (routeLayerRef.current) map.removeLayer(routeLayerRef.current);
      routeLayerRef.current = L.geoJSON(route.geometry, {
        style: { color: phaseRef.current === "shop" ? "#4285F4" : "#34A853", weight: 5, opacity: 0.85 },
      }).addTo(map);
      setEta({
        distance: (route.distance / 1000).toFixed(1) + " km",
        duration: Math.round(route.duration / 60) + " min",
      });
      setSteps(leg.steps.map(s => ({
        instruction: s.name || s.maneuver?.type || "Continue",
        distance:    Math.round(s.distance) + " m",
      })));
    } catch {}
  }, []); // eslint-disable-line

  // Geocode addresses + draw initial overview route (shop → customer)
  useEffect(() => {
    const geocode = async (addr) => {
      try {
        const d = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(addr)}&limit=1`).then(r => r.json());
        if (d[0]) return [parseFloat(d[0].lat), parseFloat(d[0].lon)];
      } catch {}
      return null;
    };
    const run = async () => {
      const shopAddr = order.shopAddress    || "Phnom Penh, Cambodia";
      const custAddr = order.deliveryAddress || order.address || "Phnom Penh, Cambodia";
      const [sp, cp] = await Promise.all([geocode(shopAddr), geocode(custAddr)]);
      if (sp) { setShopPos(sp); shopPosRef.current = sp; }
      if (cp) { setCustPos(cp); custPosRef.current = cp; }
      // Show shop→customer overview so rider can see the full delivery area before starting
      fetchRoute(sp || shopPosRef.current, cp || custPosRef.current);
      // Fit both points in view
      const map = leafletRef.current;
      if (map && sp && cp) {
        try { map.fitBounds([sp, cp], { padding: [30, 30] }); } catch {}
      }
    };
    run();
  }, []); // eslint-disable-line

  // Re-fetch route when delivery phase changes (e.g. arrived at shop → now going to customer)
  useEffect(() => {
    const from   = riderPosRef.current || shopPosRef.current;
    const target = phase === "shop" ? shopPosRef.current : custPosRef.current;
    fetchRoute(from, target);
    routeRef.current = 0; // Force immediate re-route on next GPS tick
    setStepIdx(0);
    // Keep started=true so navigation continues seamlessly into the next phase
  }, [phase]); // eslint-disable-line

  // Update shop + customer markers
  useEffect(() => {
    const map = leafletRef.current;
    if (!map) return;
    if (markersRef.current.shop) markersRef.current.shop.setLatLng(shopPos);
    else markersRef.current.shop = L.marker(shopPos, { icon: makeIcon("🏪", "#4285F4") }).addTo(map);
    if (markersRef.current.cust) markersRef.current.cust.setLatLng(custPos);
    else markersRef.current.cust = L.marker(custPos, { icon: makeIcon("📍", "#34A853") }).addTo(map);
  }, [shopPos, custPos]);

  // Rider marker — blue dot before Start, delivery icon after Start
  useEffect(() => {
    const map = leafletRef.current;
    if (!map || !riderPos) return;
    const icon = started ? makeDeliveryRiderIcon() : makeLocationDot();
    if (markersRef.current.rider) {
      markersRef.current.rider.setLatLng(riderPos);
      markersRef.current.rider.setIcon(icon);
    } else {
      // First GPS fix — create marker and snap map to rider's real location
      markersRef.current.rider = L.marker(riderPos, { icon }).addTo(map);
      map.setView(riderPos, 15);
    }
    if (navRef.current) map.setView(riderPos, 16);
  }, [riderPos, started]); // eslint-disable-line

  // GPS watcher — updates rider marker + Firestore + re-routes every 30s
  useEffect(() => {
    if (!navigator.geolocation) { setGpsStatus("error"); return; }
    watchRef.current = navigator.geolocation.watchPosition(
      ({ coords }) => {
        const pos = [coords.latitude, coords.longitude];
        riderPosRef.current = pos;
        setRiderPos(pos);
        setGpsStatus("active");
        const now = Date.now();
        if (riderId && now - writeRef.current > 5000) {
          writeRef.current = now;
          updateRiderLocation(riderId, coords.latitude, coords.longitude).catch(() => {});
        }
        // Re-route every 10s while navigating (started), every 30s otherwise
        const rerouteInterval = navRef.current ? 10000 : 30000;
        if (now - routeRef.current > rerouteInterval) {
          routeRef.current = now;
          const target = phaseRef.current === "shop" ? shopPosRef.current : custPosRef.current;
          fetchRoute(pos, target);
        }
      },
      () => { setGpsStatus("error"); },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
    );
    return () => { if (watchRef.current != null) navigator.geolocation.clearWatch(watchRef.current); };
  }, []); // eslint-disable-line

  const destName = phase === "shop" ? (order.shopName || "Restaurant") : (order.customerName || "Customer");
  const destAddr = phase === "shop" ? (order.shopAddress || "") : (order.deliveryAddress || order.address || "");

  const handleStart = () => {
    setStarted(true);
    navRef.current = true;
    routeRef.current = 0; // Reset timer so GPS watcher re-routes immediately on next fix

    const pos  = riderPosRef.current;
    const dest = phaseRef.current === "shop" ? shopPosRef.current : custPosRef.current;

    if (pos) {
      // Immediately draw route from rider's current GPS position to the destination
      fetchRoute(pos, dest);
      if (leafletRef.current) leafletRef.current.setView(pos, 16);
    } else {
      // No GPS fix yet — show destination area, route will draw once GPS arrives
      if (leafletRef.current) leafletRef.current.setView(dest, 15);
    }
  };

  const handleStop = () => {
    setStarted(false);
    navRef.current = false;
    if (leafletRef.current && routeLayerRef.current) {
      try { leafletRef.current.fitBounds(routeLayerRef.current.getBounds(), { padding: [20, 20] }); } catch {}
    }
  };

  return (
    <div className="rounded-2xl overflow-hidden border border-gray-200 shadow-sm bg-white">
      {/* Destination header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-base font-bold flex-shrink-0 shadow ${phase === "shop" ? "bg-[#4285F4]" : "bg-[#34A853]"}`}>
          {phase === "shop" ? "🏪" : "📍"}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide">Heading to</div>
          <div className="font-bold text-gray-900 text-sm truncate">{destName}</div>
          {destAddr && <div className="text-xs text-gray-500 truncate">{destAddr}</div>}
        </div>
        {eta && (
          <div className="text-right flex-shrink-0">
            <div className="font-black text-gray-900 text-lg leading-none">{eta.duration}</div>
            <div className="text-xs text-gray-500 mt-0.5">{eta.distance}</div>
          </div>
        )}
      </div>

      {/* Map */}
      <div className="relative">
        <div ref={mapElRef} style={{ height: "220px", width: "100%" }} />

        {/* GPS status badge */}
        <div className="absolute top-2 left-2 z-[400] pointer-events-none">
          {gpsStatus === "active" ? (
            <div className="flex items-center gap-1 bg-green-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow">
              <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />LIVE GPS
            </div>
          ) : gpsStatus === "error" ? (
            <div className="bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow">NO GPS</div>
          ) : (
            <div className="flex items-center gap-1 bg-amber-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow animate-pulse">
              <span className="w-1.5 h-1.5 bg-white rounded-full" />GPS...
            </div>
          )}
        </div>

        {/* Full route button — always visible, fits all waypoints */}
        <button
          onClick={() => {
            const map = leafletRef.current;
            if (!map) return;
            if (routeLayerRef.current) {
              try { map.fitBounds(routeLayerRef.current.getBounds(), { padding: [30, 30] }); } catch {}
            } else {
              const pts = [shopPos, custPos];
              if (riderPos) pts.push(riderPos);
              try { map.fitBounds(pts, { padding: [30, 30] }); } catch {}
            }
          }}
          className="absolute bottom-2 left-2 z-[400] bg-white rounded-full shadow-lg border border-gray-200 flex items-center gap-1 px-2.5 py-1.5 active:scale-90 transition-transform"
          title="View full route"
        >
          <span className="text-sm">⛶</span>
          <span className="text-[10px] font-bold text-gray-700">Full Route</span>
        </button>

        {/* Current location button — always visible when GPS is active */}
        {riderPos && (
          <button
            onClick={() => { if (leafletRef.current) leafletRef.current.setView(riderPos, 17); }}
            className="absolute bottom-2 right-2 z-[400] w-10 h-10 bg-white rounded-full shadow-lg border border-gray-200 flex items-center justify-center active:scale-90 transition-transform"
            title="My Location"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#4285F4" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="4" fill="#4285F4" fillOpacity="0.15"/>
              <path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>
              <circle cx="12" cy="12" r="4"/>
            </svg>
          </button>
        )}
      </div>

      {/* Bottom panel */}
      {started ? (
        <div className="bg-[#1a73e8] px-4 py-3">
          {steps[stepIdx] && (
            <div className="text-white mb-2">
              <div className="text-[11px] text-blue-200 font-medium mb-0.5">{steps[stepIdx].distance}</div>
              <div className="font-bold text-sm leading-snug">{steps[stepIdx].instruction}</div>
            </div>
          )}
          <div className="flex items-center justify-between">
            <div className="flex gap-1.5">
              {stepIdx > 0 && (
                <button onClick={() => setStepIdx(i => i - 1)}
                  className="text-[11px] text-white bg-white/20 px-2.5 py-1 rounded-xl font-semibold">← Prev</button>
              )}
              {stepIdx < steps.length - 1 && (
                <button onClick={() => setStepIdx(i => i + 1)}
                  className="text-[11px] text-white bg-white/20 px-2.5 py-1 rounded-xl font-semibold">Next →</button>
              )}
              <span className="text-[11px] text-blue-200 self-center ml-1">{stepIdx + 1}/{steps.length}</span>
            </div>
            <button onClick={handleStop}
              className="text-xs bg-white/20 text-white px-3 py-1.5 rounded-xl font-bold">✕ End</button>
          </div>
        </div>
      ) : (
        <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-100">
          <div className="flex gap-3 text-xs text-gray-500">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#4285F4] inline-block" />Shop</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#34A853] inline-block" />Customer</span>
            <span className="flex items-center gap-1.5">
              <span className={`w-2.5 h-2.5 rounded-full inline-block ${started ? "bg-[#e65c00]" : "bg-[#4285F4]"}`} />
              {started ? "Rider" : "You"}
            </span>
          </div>
          <button onClick={handleStart}
            className="bg-[#1a73e8] text-white px-5 py-2 rounded-2xl font-bold text-sm shadow-lg shadow-blue-200/60 active:scale-95 transition-transform">
            ▶ Start
          </button>
        </div>
      )}
    </div>
  );
}

// ── Confirmation dialog ───────────────────────────────────────────────────────
function ConfirmModal({ open, title, message, confirmLabel = "Confirm", variant = "green", onConfirm, onClose }) {
  if (!open) return null;
  const btnCls = variant === "green"
    ? "bg-green-500 hover:bg-green-600 text-white"
    : "bg-orange-500 hover:bg-orange-600 text-white";
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 bg-black/50" onClick={onClose}>
      <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="text-lg font-black text-gray-900 mb-1">{title}</div>
        <div className="text-sm text-gray-500 mb-6">{message}</div>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-2xl border-2 border-gray-200 text-gray-700 font-semibold text-sm hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => { onConfirm(); onClose(); }}
            className={`flex-1 py-3 rounded-2xl font-bold text-sm transition-colors ${btnCls}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── ORDER DETAIL SHEET ────────────────────────────────────────────────────────
function OrderDetailSheet({ order, open, onClose, onAccept }) {
  if (!order) return null;
  return (
    <BottomSheet open={open} onClose={onClose} title="New Order Request" snapFull>
      <div className="px-4 pb-8 space-y-4">
        {/* Shop → Customer route */}
        <div className="bg-gray-50 rounded-3xl p-4 space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-sm flex-shrink-0 mt-0.5">🏪</div>
            <div>
              <div className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide">Pickup from</div>
              <div className="font-bold text-gray-900 text-sm">{order.shopEmoji} {order.shopName}</div>
              <div className="text-xs text-gray-500">{order.shopAddress}</div>
            </div>
          </div>
          <div className="ml-4 border-l-2 border-dashed border-gray-200 pl-4 text-[10px] text-gray-400">
            {order.distance} · ~{order.estimatedTime}
          </div>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-sm flex-shrink-0 mt-0.5">📍</div>
            <div>
              <div className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide">Deliver to</div>
              <div className="font-bold text-gray-900 text-sm">{order.customerName}</div>
              <div className="text-xs text-gray-500">{order.deliveryAddress}</div>
            </div>
          </div>
        </div>

        {/* Items */}
        <div className="bg-white border border-gray-100 rounded-2xl p-4">
          <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Order Items</div>
          {order.items.map((item, i) => (
            <div key={i} className="flex justify-between text-sm py-1">
              <span className="text-gray-700">{item.name}</span>
              <span className="text-gray-500">×{item.qty}</span>
            </div>
          ))}
        </div>

        {/* Customer Note */}
        {order.note && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <div className="text-xs font-bold text-amber-700 uppercase tracking-wide mb-1">📝 Customer Note</div>
            <p className="text-sm text-gray-700">{order.note}</p>
          </div>
        )}

        {/* Earnings */}
        <div className="bg-green-50 border border-green-100 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <div className="text-xs text-green-600 font-semibold">Your Earnings</div>
            <div className="text-2xl font-black text-green-700">${order.deliveryFee.toFixed(2)}</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-500">Order Total</div>
            <div className="font-bold text-gray-700">${order.total.toFixed(2)}</div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <Button variant="primary" size="lg" className="w-full" onClick={() => onAccept(order)}>Accept Order 🚀</Button>
        </div>
      </div>
    </BottomSheet>
  );
}

// ── Chat panel (rider ↔ customer) — receives msgs from parent ─────────────────
const RIDER_QUICK = ["I'm on my way! 🛵", "Almost there!", "I'm at your door 🚪", "Running a bit late 🙏", "Order picked up ✅"];

function ChatPanel({ msgs, orderId, myId, myName, customerId, customerName }) {
  const [text, setText]       = useState("");
  const endRef = useRef(null);
  const taRef  = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs]);

  const formatTime = (ts) => {
    if (!ts) return "";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  };

  const handleTextChange = (e) => {
    setText(e.target.value);
    const ta = taRef.current;
    if (ta) { ta.style.height = "auto"; ta.style.height = Math.min(ta.scrollHeight, 96) + "px"; }
  };

  const send = () => {
    const t = text.trim();
    if (!t) return;
    setText("");
    if (taRef.current) taRef.current.style.height = "auto";
    sendMessage(orderId, myId, "rider", myName, t);
    sendNotification(customerId, `💬 ${myName}`, t, { orderId }).catch(() => {});
  };

  // Group consecutive messages from same sender
  const grouped = msgs.map((m, i) => ({
    ...m,
    isFirst: i === 0 || msgs[i - 1].senderId !== m.senderId,
    isLast:  i === msgs.length - 1 || msgs[i + 1].senderId !== m.senderId,
  }));

  return (
    <div className="border border-orange-100 rounded-2xl overflow-hidden">
      <div className="bg-orange-50 px-4 py-2.5 border-b border-orange-100 flex items-center gap-2">
        <span className="text-sm">💬</span>
        <span className="text-xs font-bold text-orange-700">Chat with {customerName || "Customer"}</span>
        <span className="ml-auto text-[10px] text-gray-400">{msgs.length > 0 ? `${msgs.length} message${msgs.length > 1 ? "s" : ""}` : ""}</span>
      </div>

      <div className="max-h-64 overflow-y-auto p-3 space-y-0.5 bg-white">
        {msgs.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-6">No messages yet. Say hello! 👋</p>
        )}
        {grouped.map(m => {
          const isMine = m.senderId === myId;
          return (
            <div key={m.id} className={`flex flex-col ${isMine ? "items-end" : "items-start"} ${m.isFirst ? "mt-2" : "mt-0.5"}`}>
              {!isMine && m.isFirst && (
                <span className="text-[10px] text-gray-400 font-semibold px-1 mb-0.5">{m.senderName || "Customer"}</span>
              )}
              <div className={`max-w-[80%] px-3 py-2 text-sm leading-snug break-words ${
                isMine
                  ? `bg-orange-500 text-white ${m.isFirst ? "rounded-t-2xl" : "rounded-t-lg"} ${m.isLast ? "rounded-b-2xl rounded-br-sm" : "rounded-b-lg"}`
                  : `bg-gray-100 text-gray-800 ${m.isFirst ? "rounded-t-2xl" : "rounded-t-lg"} ${m.isLast ? "rounded-b-2xl rounded-bl-sm" : "rounded-b-lg"}`
              }`}>
                {m.text}
              </div>
              {m.isLast && (
                <span className="text-[10px] text-gray-400 mt-0.5 px-1">{formatTime(m.createdAt)}</span>
              )}
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {/* Quick replies — always visible, horizontal scroll */}
      <div className="px-3 pt-2 pb-1 flex gap-1.5 overflow-x-auto scrollbar-hide bg-white border-t border-gray-50">
        {RIDER_QUICK.map(q => (
          <button key={q} onClick={() => { setText(q); taRef.current?.focus(); }}
            className="flex-shrink-0 text-xs bg-orange-50 border border-orange-200 text-orange-600 px-2.5 py-1 rounded-full active:scale-95 transition-transform whitespace-nowrap">
            {q}
          </button>
        ))}
      </div>

      <div className="flex items-end gap-2 p-2 border-t border-gray-100 bg-white">
        <textarea
          ref={taRef}
          rows={1}
          value={text}
          onChange={handleTextChange}
          onKeyDown={e => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), send())}
          placeholder="Message customer..."
          className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 outline-none focus:border-orange-400 transition-all resize-none overflow-hidden leading-snug"
        />
        <button onClick={send} disabled={!text.trim()}
          className="w-9 h-9 rounded-xl bg-orange-500 text-white flex items-center justify-center disabled:opacity-40 active:scale-90 transition-all text-lg font-bold flex-shrink-0 mb-0.5">
          ›
        </button>
      </div>
    </div>
  );
}

// ── ACTIVE ORDER CARD ─────────────────────────────────────────────────────────
function ActiveOrderCard({ order, onStatusUpdate, riderId, riderName }) {
  const steps = [
    { key: "accepted",    label: "Accepted",    btnLabel: "Arrived at Shop →",    nextStatus: "pickup" },
    { key: "pickup",      label: "At Shop",     btnLabel: "Picked Up →",          nextStatus: "delivering" },
    { key: "delivering",  label: "Delivering",  btnLabel: "Mark Delivered ✓",     nextStatus: "delivered" },
    { key: "delivered",   label: "Delivered",   btnLabel: null,                   nextStatus: null },
  ];
  const currentIdx  = steps.findIndex(s => s.key === order.deliveryStatus) || 0;
  const current     = steps[currentIdx];
  const [chatOpen,  setChatOpen]  = useState(false);
  const [msgs,      setMsgs]      = useState([]);
  const [seenCount, setSeenCount] = useState(0);
  const msgsRef = useRef([]);

  // Subscribe to messages here so unread count works even when chat is closed
  useEffect(() => {
    if (!order.id) return;
    return subscribeMessages(order.id, (m) => { msgsRef.current = m; setMsgs(m); });
  }, [order.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const inboundTotal = msgs.filter(m => m.senderId !== riderId).length;
  const unread       = Math.max(0, inboundTotal - seenCount);

  // Auto-open chat when a new customer message arrives
  useEffect(() => {
    if (unread > 0 && !chatOpen) setChatOpen(true);
  }, [unread]); // eslint-disable-line

  const toggleChat = () => {
    setChatOpen(c => {
      if (!c) setSeenCount(msgsRef.current.filter(m => m.senderId !== riderId).length);
      return !c;
    });
  };

  return (
    <div className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-500 to-emerald-500 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
            <span className="text-white font-bold text-sm">Active Delivery</span>
          </div>
          <span className="bg-white/20 text-white text-xs font-semibold px-2 py-1 rounded-full">#{fmtOrder(order)}</span>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Progress steps */}
        <div className="flex items-center justify-between">
          {steps.map((s, i) => (
            <div key={s.key} className="flex items-center">
              <div className={`flex flex-col items-center gap-1 ${i <= currentIdx ? "opacity-100" : "opacity-30"}`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${i < currentIdx ? "bg-green-500 text-white" : i === currentIdx ? "bg-green-500 text-white ring-4 ring-green-100" : "bg-gray-100 text-gray-400"}`}>
                  {i < currentIdx ? "✓" : i + 1}
                </div>
                <span className="text-[9px] text-gray-500 font-medium">{s.label}</span>
              </div>
              {i < steps.length - 1 && (
                <div className={`w-8 h-0.5 mx-1 mb-4 ${i < currentIdx ? "bg-green-500" : "bg-gray-100"}`} />
              )}
            </div>
          ))}
        </div>

        {/* Route */}
        <div className="bg-gray-50 rounded-2xl p-3 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-lg">{order.shopEmoji}</span>
            <div>
              <div className="text-xs text-gray-400">Pickup</div>
              <div className="text-sm font-semibold text-gray-800">{order.shopName} · {order.shopAddress}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-lg">📍</span>
            <div>
              <div className="text-xs text-gray-400">Deliver to</div>
              <div className="text-sm font-semibold text-gray-800">{order.customerName} · {order.deliveryAddress}</div>
            </div>
          </div>
        </div>

        {/* Map + in-app navigate controls */}
        {order.deliveryStatus !== "delivered" && (
          <RouteMap order={order} riderId={riderId} />
        )}

        {/* Customer contact */}
        <div className="flex items-center justify-between bg-blue-50 rounded-2xl px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-base">👤</span>
            <div>
              <div className="text-xs text-blue-600 font-semibold">Customer</div>
              <div className="text-sm font-bold text-gray-800">{order.customerName}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleChat}
              className={`relative w-9 h-9 rounded-xl flex items-center justify-center text-base transition-all ${chatOpen ? "bg-green-500 text-white shadow-md shadow-green-200" : "bg-white border border-gray-200 text-gray-600"}`}
            >
              💬
              {unread > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </button>
            <a href={`tel:${order.customerPhone}`} className="w-9 h-9 rounded-xl bg-green-500 flex items-center justify-center text-white text-base shadow-md shadow-green-200">📞</a>
          </div>
        </div>

        {/* Chat panel — toggles with 💬 button */}
        {chatOpen && (
          <ChatPanel
            msgs={msgs}
            orderId={order.id}
            myId={riderId}
            myName={riderName}
            customerId={order.customerId}
            customerName={order.customerName}
          />
        )}

        {/* Action button */}
        {current.btnLabel && (
          <Button variant="primary" size="lg" className="w-full" onClick={() => onStatusUpdate(order.id, steps[currentIdx + 1].key)}>
            {current.btnLabel}
          </Button>
        )}

        {order.deliveryStatus === "delivered" && (
          <div className="text-center py-3">
            <div className="text-3xl mb-1">🎉</div>
            <div className="font-bold text-green-700">Delivery Complete!</div>
            <div className="text-sm text-gray-500 mt-1">Earnings: <span className="font-bold text-green-600">${order.deliveryFee.toFixed(2)}</span></div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── NOTIFICATION PANEL (Delivery) ────────────────────────────────────────────
function NotificationPanel({ notifications, onClose, onMarkAllRead, onNotifOrderClick }) {
  const unread = notifications.filter(n => !n.isRead);
  return (
    <div className="fixed inset-0 z-[150]" onClick={onClose}>
      <div
        className="absolute top-20 right-4 w-80 bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <span className="font-bold text-gray-900 text-sm">Notifications</span>
          <div className="flex items-center gap-2">
            {unread.length > 0 && (
              <button
                onClick={onMarkAllRead}
                className="text-xs text-green-600 font-semibold hover:text-green-700 transition-colors"
              >
                Mark all read
              </button>
            )}
            {unread.length === 0 && notifications.length > 0 && (
              <span className="text-xs text-gray-400">All read</span>
            )}
          </div>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">
              <div className="text-3xl mb-2">🔔</div>
              No notifications yet
            </div>
          ) : (
            notifications.slice(0, 20).map(n => (
              <button
                key={n.id}
                onClick={() => { onClose(); if (n.data?.orderId) onNotifOrderClick?.(n.data.orderId); }}
                className={`w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-green-50 active:bg-green-100 transition-colors ${!n.isRead ? "bg-green-50/50" : ""}`}
              >
                <div className="flex items-start gap-3">
                  <span className="text-lg flex-shrink-0 mt-0.5">
                    {n.data?.status === "cancelled" ? "❌" : n.data?.orderId ? "🛵" : "📦"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-semibold ${!n.isRead ? "text-gray-900" : "text-gray-600"}`}>{n.title}</div>
                    <div className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.body}</div>
                  </div>
                  {!n.isRead && <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0 mt-1.5" />}
                </div>
              </button>
            ))
          )}
        </div>
        {notifications.length > 0 && (
          <div className="px-4 py-2.5 border-t border-gray-100 text-center">
            <button onClick={onClose} className="text-xs text-gray-400 hover:text-gray-600">Close</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── HOME PAGE ─────────────────────────────────────────────────────────────────
export default function HomePage({ activeOrder, setActiveOrder, isOnline, incomingOrders, setIncomingOrders, onDeliveryComplete, onDeliveryStepUpdate, notifications = [], onMarkAllRead, onGoHistory }) {
  const { rider } = useAuth();
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [detailOpen, setDetailOpen]       = useState(false);
  const [confirm, setConfirm]             = useState(null); // { title, message, confirmLabel, variant, onConfirm }
  const [notifOpen, setNotifOpen]         = useState(false);
  const prevIncomingCount = useRef(0);

  // ── Auto-popup + browser notification when a new order arrives ───────────
  useEffect(() => {
    const prev = prevIncomingCount.current;
    prevIncomingCount.current = incomingOrders.length;

    if (incomingOrders.length > prev && isOnline && !activeOrder && !detailOpen) {
      const newOrder = incomingOrders[incomingOrders.length - 1];
      setSelectedOrder(newOrder);
      setDetailOpen(true);
      toast(`🛵 New order from ${newOrder.shopName}!`, "success");
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification("New Order Request! 🛵", {
          body: `${newOrder.shopName} → ${newOrder.customerName || "Customer"}`,
          icon: "/favicon.ico",
        });
      }
    }
  }, [incomingOrders.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const doAccept = async (order) => {
    try { await acceptOrder(order.id); } catch (e) { console.error(e); }
    setActiveOrder({ ...order, deliveryStatus: "accepted" });
    setIncomingOrders(prev => prev.filter(o => o.id !== order.id));
    setDetailOpen(false);
    toast(`Order accepted! Head to ${order.shopName}`, "success");
  };

  const requestAccept = (order) => {
    setConfirm({
      title: "Accept this order?",
      message: `${order.shopEmoji || "🍔"} ${order.shopName} → ${order.customerName}\n${order.distance || ""} · Earn $${order.deliveryFee?.toFixed(2)}`,
      confirmLabel: "Accept Order 🚀",
      variant: "green",
      onConfirm: () => doAccept(order),
    });
  };

  const doStatusUpdate = (orderId, newStatus) => {
    setActiveOrder(prev => ({ ...prev, deliveryStatus: newStatus }));
    const messages = {
      pickup:     "📦 Arrived at restaurant — picking up order",
      delivering: "🛵 Order picked up — heading to customer",
      delivered:  "🎉 Order delivered successfully!",
    };
    toast(messages[newStatus] || "Status updated", "success");
    if (onDeliveryStepUpdate) onDeliveryStepUpdate(orderId, newStatus);
    if (newStatus === "delivered") {
      setTimeout(() => { onDeliveryComplete(activeOrder); setActiveOrder(null); }, 2500);
    }
  };

  const requestStatusUpdate = (orderId, newStatus) => {
    const configs = {
      pickup:     { title: "Arrived at Shop?",  message: `Confirm you have arrived at ${activeOrder?.shopName}.`,             confirmLabel: "Yes, I'm Here",  variant: "orange" },
      delivering: { title: "Picked Up Order?",  message: "Confirm you have collected the order and are heading out.",          confirmLabel: "Picked Up ✓",    variant: "orange" },
      delivered:  { title: "Order Delivered?",  message: `Confirm the order was delivered to ${activeOrder?.customerName}.`,  confirmLabel: "Mark Delivered", variant: "green"  },
    };
    const cfg = configs[newStatus];
    if (cfg) {
      setConfirm({ ...cfg, onConfirm: () => doStatusUpdate(orderId, newStatus) });
    } else {
      doStatusUpdate(orderId, newStatus);
    }
  };

  const unreadNotifCount = notifications.filter(n => !n.isRead).length;

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Notification panel overlay */}
      {notifOpen && (
        <NotificationPanel
          notifications={notifications}
          onClose={() => setNotifOpen(false)}
          onMarkAllRead={() => { if (onMarkAllRead) onMarkAllRead(); }}
          onNotifOrderClick={(orderId) => {
            // Incoming order → open detail sheet
            const incoming = incomingOrders.find(o => o.id === orderId);
            if (incoming) { setSelectedOrder(incoming); setDetailOpen(true); return; }
            // Active order → already visible on screen, nothing needed
            if (activeOrder?.id === orderId) return;
            // Delivered / completed order → go to History and auto-open that order
            onGoHistory?.(orderId);
          }}
        />
      )}

      {/* Header */}
      <div className="bg-gradient-to-br from-green-500 to-emerald-600 px-4 pt-10 pb-4 safe-top">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white/20 flex items-center justify-center text-white font-black text-lg">{rider?.avatar || "V"}</div>
            <div>
              <p className="text-white/70 text-xs">Good day,</p>
              <h2 className="font-black text-white text-base">{rider?.name}</h2>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Notification bell */}
            <button
              onClick={() => setNotifOpen(v => !v)}
              className="relative w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center text-base"
            >
              🔔
              {unreadNotifCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                  {unreadNotifCount > 9 ? "9+" : unreadNotifCount}
                </span>
              )}
            </button>
            {/* Online status indicator */}
            <div className="flex items-center gap-2 bg-white/20 rounded-2xl px-3 py-2">
              <span className="w-2.5 h-2.5 bg-green-300 rounded-full animate-pulse" />
              <span className="text-white text-xs font-semibold">Online</span>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4">
        {/* Active order */}
        {activeOrder && (
          <div>
            <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />Current Delivery
            </h3>
            <ActiveOrderCard order={activeOrder} onStatusUpdate={requestStatusUpdate} riderId={rider?.uid} riderName={rider?.name} />
          </div>
        )}

        {/* Incoming orders */}
        {isOnline && incomingOrders.length > 0 && !activeOrder && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-gray-800 flex items-center gap-2">
                <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />New Requests
              </h3>
              <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2 py-1 rounded-full">{incomingOrders.length} new</span>
            </div>
            <div className="space-y-3">
              {incomingOrders.map(order => (
                <div key={order.id} className="bg-white rounded-3xl border border-amber-100 shadow-sm overflow-hidden">
                  <div className="bg-amber-50 px-4 py-2 border-b border-amber-100 flex items-center gap-2">
                    <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
                    <span className="text-xs font-bold text-amber-700">New Order Request</span>
                    <span className="ml-auto text-xs text-gray-500">#{fmtOrder(order)}</span>
                  </div>
                  <div className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="text-3xl">{order.shopEmoji}</div>
                      <div className="flex-1">
                        <div className="font-bold text-gray-900 text-sm">{order.shopName} → {order.customerName}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{order.distance} · {order.estimatedTime} · {order.items.length} items</div>
                      </div>
                      <div className="text-right">
                        <div className="font-black text-green-600">${order.deliveryFee.toFixed(2)}</div>
                        <div className="text-[10px] text-gray-400">earnings</div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => { setSelectedOrder(order); setDetailOpen(true); }} className="flex-1 py-2 rounded-xl bg-green-50 border-2 border-green-200 text-green-700 text-sm font-bold hover:bg-green-100 transition-all">View Details</button>
                      <button onClick={() => requestAccept(order)} className="flex-1 py-2 rounded-xl bg-green-500 text-white text-sm font-bold hover:bg-green-600 shadow-md shadow-green-200 transition-all">Accept ✓</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!activeOrder && incomingOrders.length === 0 && (
          <div className="text-center py-12">
            <div className="text-6xl mb-3">🛵</div>
            <div className="font-bold text-gray-800 text-lg">Waiting for orders...</div>
            <p className="text-gray-500 text-sm mt-1">New orders will appear here automatically</p>
          </div>
        )}
      </div>

      <OrderDetailSheet order={selectedOrder} open={detailOpen} onClose={() => setDetailOpen(false)} onAccept={requestAccept} />
      <ConfirmModal
        open={!!confirm}
        title={confirm?.title}
        message={confirm?.message}
        confirmLabel={confirm?.confirmLabel}
        variant={confirm?.variant}
        onConfirm={confirm?.onConfirm || (() => {})}
        onClose={() => setConfirm(null)}
      />
    </div>
  );
}