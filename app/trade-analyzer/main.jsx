import React from "react";
import { createRoot } from "react-dom/client";
import TradeAnalyzer from "./TradeAnalyzer.jsx";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <TradeAnalyzer />
  </React.StrictMode>
);
