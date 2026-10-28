import React from "react";
import { createRoot } from "react-dom/client";
import MatchupInsights from "./MatchupInsights.jsx";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <MatchupInsights />
  </React.StrictMode>
);
