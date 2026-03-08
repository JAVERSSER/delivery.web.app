// src/pages/HistoryPage.jsx
import { useState, useEffect } from "react";
import { BottomSheet } from "../components/UI";

const fmtOrder = (o) => {
  if (o?.orderNumber) return o.orderNumber;
  const id = o?.id || "";
  let n = 0;
  for (let i = 0; i < id.length; i++) n = (n * 31 + id.charCodeAt(i)) >>> 0;
  return (n % 900000) + 100000;
};

function OrderDetailSheet({ order, open, onClose }) {
  if (!order) return null;
  return (
    <BottomSheet open={open} onClose={onClose} title="Delivery Details" snapFull>
      <div className="px-4 pb-8 space-y-4">

        {/* Shop → Customer */}
        <div className="bg-gray-50 rounded-2xl p-4 space-y-2">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{order.shopEmoji || "🍔"}</span>
            <div>
              <div className="font-bold text-gray-900">{order.shopName}</div>
              {order.shopAddress && <div className="text-xs text-gray-500">{order.shopAddress}</div>}
            </div>
          </div>
          <div className="border-t border-dashed border-gray-200 pt-2 flex items-start gap-2">
            <span className="text-lg mt-0.5">📍</span>
            <div>
              <div className="text-xs font-semibold text-gray-500">Delivered to</div>
              <div className="font-semibold text-gray-800">{order.customerName}</div>
              {order.address && <div className="text-xs text-gray-500 mt-0.5">{order.address}</div>}
              {order.customerPhone && <div className="text-xs text-gray-500">{order.customerPhone}</div>}
            </div>
          </div>
        </div>

        {/* Items */}
        {order.items && order.items.length > 0 && (
          <div className="bg-white border border-gray-100 rounded-2xl p-4">
            <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Order Items</div>
            {order.items.map((item, i) => (
              <div key={i} className="flex justify-between items-center py-2 border-b border-gray-50 last:border-0 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-base">{item.emoji || "🍽️"}</span>
                  <span className="text-gray-800">{item.name}</span>
                </div>
                <div className="flex items-center gap-3 text-right">
                  <span className="text-gray-400 text-xs">×{item.qty}</span>
                  <span className="text-gray-700 font-semibold">${(item.price * item.qty).toFixed(2)}</span>
                </div>
              </div>
            ))}
            <div className="flex justify-between items-center pt-3 font-bold text-gray-900">
              <span>Order Total</span>
              <span>${order.total?.toFixed(2) || "—"}</span>
            </div>
          </div>
        )}

        {/* Customer Note */}
        {order.note && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <div className="text-xs font-bold text-amber-700 uppercase tracking-wide mb-1">📝 Customer Note</div>
            <p className="text-sm text-gray-700">{order.note}</p>
          </div>
        )}

        {/* Earnings + Payment */}
        <div className="bg-green-50 border border-green-100 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <div className="text-xs text-green-600 font-semibold">Your Earnings</div>
            <div className="text-2xl font-black text-green-700">+${Number(order.deliveryFee || 0).toFixed(2)}</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-500">Payment</div>
            <div className="font-semibold text-gray-700">{order.payment || "Cash"}</div>
            <div className="text-xs text-gray-400 mt-1">{order.date} · {order.time}</div>
          </div>
        </div>

        {/* Customer Review */}
        {order.review?.rating ? (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <div className="text-xs font-bold text-amber-700 uppercase tracking-wide mb-2">Customer Review</div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-amber-400">{"⭐".repeat(order.review.rating)}</span>
              <span className="text-sm font-bold text-amber-600">{order.review.rating}/5</span>
            </div>
            {order.review.comment && (
              <p className="text-sm text-gray-600 italic">"{order.review.comment}"</p>
            )}
          </div>
        ) : (
          <div className="text-center text-xs text-gray-400 py-1">No review from customer</div>
        )}

        {/* Order ID */}
        <div className="text-center text-[10px] text-gray-300 pb-2">Order #: {fmtOrder(order)}</div>
      </div>
    </BottomSheet>
  );
}

export default function HistoryPage({ history, initialSelectedId, onClearInitialSelected }) {
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    if (!initialSelectedId) return;
    const order = history.find(o => o.id === initialSelectedId);
    if (order) setSelected(order);
    onClearInitialSelected?.();
  }, [initialSelectedId]); // eslint-disable-line

  const todayStr      = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const totalEarnings = history.reduce((s, o) => s + Number(o.deliveryFee || 0), 0);
  const todayEarnings = history
    .filter(o => o.date === todayStr)
    .reduce((s, o) => s + Number(o.deliveryFee || 0), 0);

  const reviewedCount = history.filter(o => o.review?.rating).length;
  const avgRating     = reviewedCount > 0
    ? (history.filter(o => o.review?.rating).reduce((s, o) => s + o.review.rating, 0) / reviewedCount).toFixed(1)
    : null;

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-gradient-to-br from-green-500 to-emerald-600 px-4 pt-10 pb-6 safe-top">
        <h1 className="text-2xl font-black text-white font-display">Delivery History</h1>
        <p className="text-white/70 text-sm mt-1">{history.length} total deliveries</p>
        <div className="grid grid-cols-3 gap-3 mt-4">
          <div className="bg-white/20 rounded-2xl p-3 text-center">
            <div className="font-black text-white text-xl">${todayEarnings.toFixed(2)}</div>
            <div className="text-white/70 text-xs">Today</div>
          </div>
          <div className="bg-white/20 rounded-2xl p-3 text-center">
            <div className="font-black text-white text-xl">${totalEarnings.toFixed(2)}</div>
            <div className="text-white/70 text-xs">Total Earned</div>
          </div>
          <div className="bg-white/20 rounded-2xl p-3 text-center">
            <div className="font-black text-white text-xl">{avgRating ? `${avgRating}⭐` : "—"}</div>
            <div className="text-white/70 text-xs">Avg Rating</div>
          </div>
        </div>
      </div>

      <div className="px-4 pt-4">
        {history.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-3">📋</div>
            <div className="font-bold text-gray-800">No deliveries yet</div>
            <p className="text-gray-500 text-sm mt-1">Completed deliveries will appear here</p>
          </div>
        ) : (
          <div className="space-y-3">
            {history.map(order => (
              <button
                key={order.id}
                onClick={() => setSelected(order)}
                className="w-full text-left bg-white rounded-3xl p-4 shadow-sm border border-gray-100 active:scale-[0.98] transition-transform"
              >
                {/* Header row — matches Customer OrderCard */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center text-2xl">
                      {order.shopEmoji || "🍔"}
                    </div>
                    <div>
                      <div className="font-bold text-gray-900 text-sm">{order.shopName}</div>
                      <div className="text-xs text-gray-500 mt-0.5">#{fmtOrder(order)} · {order.date}</div>
                    </div>
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-green-100 text-green-700">
                    Delivered
                  </span>
                </div>

                {/* Items text — matches Customer OrderCard */}
                {order.items?.length > 0 && (
                  <div className="text-xs text-gray-500 mb-2">
                    {order.items.map(i => `${i.name} ×${i.qty}`).join(", ")}
                  </div>
                )}

                {/* Footer row */}
                <div className="flex items-center justify-between">
                  <span className="font-bold text-green-600">+${Number(order.deliveryFee || 0).toFixed(2)}</span>
                  {order.review?.rating ? (
                    <span className="text-xs text-amber-500 flex items-center gap-1">
                      {"⭐".repeat(order.review.rating)}
                      <span className="text-gray-400 font-medium">{order.review.rating}/5</span>
                    </span>
                  ) : (
                    <span className="text-[10px] text-gray-300">Tap for details →</span>
                  )}
                </div>

                {/* Review comment — shown when customer left a comment */}
                {order.review?.comment && (
                  <div className="mt-2 pt-2 border-t border-gray-50">
                    <p className="text-xs text-gray-400 italic truncate">"{order.review.comment}"</p>
                  </div>
                )}

              </button>
            ))}
          </div>
        )}
      </div>

      <OrderDetailSheet
        order={selected}
        open={!!selected}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}
