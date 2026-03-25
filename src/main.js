import { jsx as _jsx } from "react/jsx-runtime";
import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import AppRouter from "@/navigation/AppRouter";
import { AppThemeProvider } from "@/theme/AppThemeProvider";
ReactDOM.createRoot(document.getElementById("root")).render(_jsx(React.StrictMode, { children: _jsx(AppThemeProvider, { children: _jsx(AppRouter, {}) }) }));
