import React from "react";
import { createRoot } from "react-dom/client";
import SiteApi from "./SiteApi.jsx";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <SiteApi />
  </React.StrictMode>
);
