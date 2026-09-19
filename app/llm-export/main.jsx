import React from "react";
import { createRoot } from "react-dom/client";
import LlmExport from "./LlmExport.jsx";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <LlmExport />
  </React.StrictMode>
);
