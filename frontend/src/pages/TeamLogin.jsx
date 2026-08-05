import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Compass, KeyRound, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import Footer from '../components/Footer';

export default function TeamLogin() {
  const { teamLogin, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const [teamCode, setTeamCode] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated && user?.role === 'team') {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!teamCode.trim()) {
      toast.error('Please enter your Team Code.');
      return;
    }

    setLoading(true);
    // Standardize input format (uppercase, trim)
    const standardizedCode = teamCode.trim().toUpperCase();
    const res = await teamLogin(standardizedCode);
    setLoading(false);

    if (res.success) {
      toast.success('Welcome to the Hunt!');
      navigate('/dashboard');
    } else {
      toast.error(res.error || 'Invalid Team Code.');
    }
  };

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-between p-6 overflow-hidden">
      <div className="absolute top-1/4 right-1/4 w-80 h-80 rounded-full glow-purple animate-pulse-slow pointer-events-none"></div>

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
            <div className="p-4 rounded-full bg-purple-500/10 border border-purple-500/20 mb-4 animate-pulse">
              <KeyRound className="w-10 h-10 text-purple-400" />
            </div>
            <h2 className="text-2xl font-extrabold text-slate-100">Team Login</h2>
            <p className="text-sm text-slate-400 mt-1">Enter the Team Code assigned to you</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Team Code</label>
              <input 
                type="text"
                value={teamCode}
                onChange={(e) => setTeamCode(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-slate-900/60 border border-slate-700 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 text-slate-100 placeholder-slate-600 outline-none uppercase font-semibold text-center tracking-widest transition-all"
                placeholder="T-XXXX"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold rounded-xl shadow-lg hover:shadow-purple-500/20 disabled:opacity-50 disabled:pointer-events-none transition-all"
            >
              {loading ? 'Logging in...' : 'Enter Hunt'}
            </button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-xs text-slate-500">
              Don't have a code? Please register with the coordinators at the front desk.
            </p>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
