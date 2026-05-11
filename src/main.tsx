import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { watchAppUpdates } from "./lib/appUpdate";

createRoot(document.getElementById("root")!).render(<App />);

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then(watchAppUpdates)
      .catch((error) => {
        console.error("Service worker registration failed:", error);
      });
  });
}
