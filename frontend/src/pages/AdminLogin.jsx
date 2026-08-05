import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Shield, Key, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import Footer from '../components/Footer';

export default function AdminLogin() {
  const { adminLogin, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated && user?.role === 'admin') {
      navigate('/admin-dashboard', { replace: true });
    }
  }, [isAuthenticated, user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      toast.error('All fields are required.');
      return;
    }

    setLoading(true);
    const res = await adminLogin(username, password);
    setLoading(false);

    if (res.success) {
      toast.success('Logged in as administrator!');
      navigate('/admin-dashboard');
    } else {
      toast.error(res.error || 'Authentication failed.');
    }
  };

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-between p-6 overflow-hidden">
      <div className="absolute top-1/4 left-1/4 w-80 h-80 rounded-full glow-blue animate-pulse-slow pointer-events-none"></div>
      
      {/* Return button */}
      <button 
        onClick={() => navigate('/')}
        className="absolute top-6 left-6 inline-flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to portal
      </button>

      <div className="z-10 w-full max-w-md my-auto">
        <div className="glass-card p-8 rounded-3xl shadow-2xl border border-slate-800">
          <div className="flex flex-col items-center mb-8">
            <div className="p-4 rounded-full bg-blue-500/10 border border-blue-500/20 mb-4">
              <Shield className="w-10 h-10 text-blue-400" />
            </div>
            <h2 className="text-2xl font-extrabold text-slate-100">Coordinator Login</h2>
            <p className="text-sm text-slate-400 mt-1">Enter your administration credentials</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Username</label>
              <div className="relative">
                <input 
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-4 pr-4 py-3 rounded-xl bg-slate-900/60 border border-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-slate-100 outline-none transition-all"
                  placeholder="admin"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Password</label>
              <div className="relative">
                <input 
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-4 pr-12 py-3 rounded-xl bg-slate-900/60 border border-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-slate-100 outline-none transition-all"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-xl shadow-lg hover:shadow-blue-500/20 disabled:opacity-50 disabled:pointer-events-none transition-all"
            >
              {loading ? 'Authenticating...' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
      <Footer />
    </div>
  );
}
