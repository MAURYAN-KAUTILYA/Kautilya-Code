import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import IntroPage from "@/features/introduction/IntroPage";
import LoginPage from "@/features/auth/LoginPage";
import Dashboard from "@/features/dashboard/Dashboard";
import BuilderShell from "../features/builder-lab/BuilderShell";
import ProtectedRoute from "./ProtectedRoute";
export default function AppRouter() {
    return (_jsx(BrowserRouter, { children: _jsxs(Routes, { children: [_jsx(Route, { path: "/", element: _jsx(IntroPage, {}) }), _jsx(Route, { path: "/login", element: _jsx(LoginPage, {}) }), _jsx(Route, { path: "/dashboard", element: _jsx(ProtectedRoute, { children: _jsx(Dashboard, {}) }) }), _jsx(Route, { path: "/builder", element: _jsx(ProtectedRoute, { children: _jsx(BuilderShell, {}) }) }), _jsx(Route, { path: "*", element: _jsx(Navigate, { to: "/", replace: true }) })] }) }));
}
