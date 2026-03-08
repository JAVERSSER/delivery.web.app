import React from "react"
import ReactDOM from "react-dom/client"
import App from "./App.jsx"
import ConnectivityGate from "./components/ConnectivityGate.jsx"
import "./index.css"

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ConnectivityGate>
      <App />
    </ConnectivityGate>
  </React.StrictMode>
)