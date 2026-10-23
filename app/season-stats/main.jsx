import React from "react";
import { createRoot } from "react-dom/client";
import SeasonStats from "./SeasonStats.jsx";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <SeasonStats />
  </React.StrictMode>
);
