import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import Gift from "./Gift";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Gift />
  </StrictMode>,
);
