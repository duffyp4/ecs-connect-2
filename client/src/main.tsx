import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { setupAutoSync } from "./lib/offlineQueue";

// Initialize offline queue auto-sync (drains pending submissions when online)
setupAutoSync();

createRoot(document.getElementById("root")!).render(<App />);
