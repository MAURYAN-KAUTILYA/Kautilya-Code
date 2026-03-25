import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import AppRouter from "@/navigation/AppRouter";
import { AppThemeProvider } from "@/theme/AppThemeProvider";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppThemeProvider>
      <AppRouter />
    </AppThemeProvider>
  </React.StrictMode>
);
