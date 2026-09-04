import React from "react";
import { createRoot } from "react-dom/client";
import LiveMatchups from "./LiveMatchups.jsx";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <LiveMatchups />
  </React.StrictMode>
);
