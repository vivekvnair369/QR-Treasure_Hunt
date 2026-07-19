import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Toaster } from 'react-hot-toast';

// Pages
import Landing from './pages/Landing';
import AdminLogin from './pages/AdminLogin';
import TeamLogin from './pages/TeamLogin';
import TeamDashboard from './pages/TeamDashboard';
import Scanner from './pages/Scanner';
import WrongQR from './pages/WrongQR';
import Finished from './pages/Finished';
import AdminDashboard from './pages/AdminDashboard';
import Leaderboard from './pages/Leaderboard';

// Admin Protected Route
const AdminRoute = ({ children }) => {
  const { isAuthenticated, user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-400">
        <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }
  if (!isAuthenticated || user?.role !== 'admin') {
    return <Navigate to="/login" replace />;
  }
  return children;
};

// Team Protected Route
const TeamRoute = ({ children }) => {
  const { isAuthenticated, user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-400">
        <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }
  if (!isAuthenticated || user?.role !== 'team') {
    return <Navigate to="/team-login" replace />;
  }
  return children;
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <Toaster 
          position="top-right"
          toastOptions={{
            style: {
              background: '#1e293b',
              color: '#f8fafc',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '12px'
            }
          }}
        />
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<AdminLogin />} />
          <Route path="/team-login" element={<TeamLogin />} />
          <Route path="/leaderboard" element={<Leaderboard />} />

          {/* Team Portal Protected Routes */}
          <Route path="/dashboard" element={
            <TeamRoute>
              <TeamDashboard />
            </TeamRoute>
          } />
          <Route path="/scan" element={
            <TeamRoute>
              <Scanner />
            </TeamRoute>
          } />
          <Route path="/wrong-qr" element={
            <TeamRoute>
              <WrongQR />
            </TeamRoute>
          } />
          <Route path="/finished" element={
            <TeamRoute>
              <Finished />
            </TeamRoute>
          } />

          {/* Admin Portal Protected Routes */}
          <Route path="/admin-dashboard" element={
            <AdminRoute>
              <AdminDashboard />
            </AdminRoute>
          } />

          {/* Catch-all Redirect */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
