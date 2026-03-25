import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import IntroPage from "@/features/introduction/IntroPage";
import LoginPage from "@/features/auth/LoginPage";
import Dashboard from "@/features/dashboard/Dashboard";
import BuilderShell from "../features/builder-lab/BuilderShell";
import ProtectedRoute from "./ProtectedRoute";

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"        element={<IntroPage />} />
        <Route path="/login"   element={<LoginPage />} />
        <Route 
          path="/dashboard" 
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/builder" 
          element={
            <ProtectedRoute>
              <BuilderShell />
            </ProtectedRoute>
          } 
        />
        {/* Fallback */}
        <Route path="*"        element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
