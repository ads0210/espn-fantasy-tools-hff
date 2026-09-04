import React from "react";
import { createRoot } from "react-dom/client";
import DraftHelper from "./DraftHelper.jsx";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <DraftHelper />
  </React.StrictMode>
);
