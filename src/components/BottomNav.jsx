// src/components/BottomNav.jsx
const tabs = [
  { id: "home",    icon: "🏠", label: "Home" },
  { id: "history", icon: "📋", label: "History" },
  { id: "profile", icon: "👤", label: "Profile" },
];

export default function BottomNav({ page, setPage, incomingCount = 0 }) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t border-gray-100 safe-bottom z-40 max-w-md mx-auto shadow-[0_-4px_24px_rgba(0,0,0,0.07)]">
      <div className="flex">
        {tabs.map(t => {
          const active = page === t.id;
          return (
            <button key={t.id} onClick={() => setPage(t.id)}
              className="flex-1 flex flex-col items-center pt-2 pb-2.5 relative transition-all">
              {active && (
                <span className="absolute top-0 left-1/4 right-1/4 h-0.5 bg-green-500 rounded-full" />
              )}
              <div className={`w-10 h-10 flex items-center justify-center rounded-2xl transition-all ${active ? "bg-green-50" : ""}`}>
                <div className="relative">
                  <span className="text-xl">{t.icon}</span>
                  {t.id === "home" && incomingCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center animate-pulse">
                      {incomingCount}
                    </span>
                  )}
                </div>
              </div>
              <span className={`text-[10px] font-bold mt-0.5 ${active ? "text-green-500" : "text-gray-400"}`}>{t.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
