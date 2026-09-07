import React from "react";
import { createRoot } from "react-dom/client";
import HallOfFame from "./HallOfFame.jsx";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <HallOfFame />
  </React.StrictMode>
);
