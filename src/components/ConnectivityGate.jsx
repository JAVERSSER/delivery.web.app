// ConnectivityGate.jsx — blocks the Delivery app if offline or location denied
import { useState, useEffect } from "react";

function GateScreen({ icon, title, msg, btn, onBtn }) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 text-center">
      <div className="bg-white rounded-3xl shadow-xl p-8 max-w-xs w-full">
        <div className="text-6xl mb-4">{icon}</div>
        <h1 className="text-xl font-black text-gray-900 mb-2">{title}</h1>
        <p className="text-gray-500 text-sm mb-6">{msg}</p>
        <button
          onClick={onBtn}
          className="w-full bg-green-500 text-white py-3 rounded-2xl font-bold text-sm"
        >
          {btn}
        </button>
      </div>
    </div>
  );
}

export default function ConnectivityGate({ children }) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [locState, setLocState] = useState("checking");

  useEffect(() => {
    const goOnline  = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener("online",  goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online",  goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  useEffect(() => {
    if (!navigator.geolocation) { setLocState("denied"); return; }

    const requestPos = () =>
      navigator.geolocation.getCurrentPosition(
        () => setLocState("granted"),
        () => setLocState("denied"),
        { timeout: 10000 }
      );

    if (navigator.permissions) {
      navigator.permissions.query({ name: "geolocation" }).then((r) => {
        if (r.state === "granted")      setLocState("granted");
        else if (r.state === "denied")  setLocState("denied");
        else                            requestPos();
        r.onchange = () => {
          if (r.state === "granted")     setLocState("granted");
          else if (r.state === "denied") setLocState("denied");
        };
      }).catch(() => requestPos());
    } else {
      requestPos();
    }
  }, []);

  if (!isOnline) return (
    <GateScreen
      icon="📡"
      title="No Internet Connection"
      msg="Please check your Wi-Fi or mobile data and try again."
      btn="Retry"
      onBtn={() => setIsOnline(navigator.onLine)}
    />
  );

  if (locState === "denied") return (
    <GateScreen
      icon="📍"
      title="Location Access Required"
      msg="Enable location in your browser settings, then refresh the page."
      btn="Refresh Page"
      onBtn={() => window.location.reload()}
    />
  );

  if (locState === "checking") return null;

  return children;
}
