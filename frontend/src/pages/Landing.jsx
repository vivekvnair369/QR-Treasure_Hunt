import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Compass, Users, ShieldAlert, Award } from 'lucide-react';
import Footer from '../components/Footer';

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-between p-6 text-center select-none overflow-hidden">
      {/* Background Ornaments */}
      <div className="absolute top-10 left-10 w-72 h-72 rounded-full glow-purple opacity-20 pointer-events-none"></div>
      <div className="absolute bottom-10 right-10 w-96 h-96 rounded-full glow-blue opacity-20 pointer-events-none"></div>

      <div className="z-10 max-w-2xl w-full my-auto">
        {/* Animated Icon */}
        <div className="inline-flex p-5 rounded-full bg-purple-500/10 border border-purple-500/30 mb-8 animate-bounce">
          <Compass className="w-16 h-16 text-purple-400" />
        </div>

        {/* Heading */}
        <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-purple-400 via-pink-500 to-blue-500 mb-4">
          AITHERON ML 2026
        </h1>
        <h2 className="text-xl md:text-2xl font-medium text-slate-300 mb-8">
          QR-Based Treasure Hunt
        </h2>
        <p className="text-slate-400 text-base max-w-lg mx-auto mb-12">
          Navigate your way through campus, scan the secret QR codes at target locations, and solve the riddles to reach the Final Hall.
        </p>

        {/* Portal cards */}
        <div className="grid md:grid-cols-2 gap-6 max-w-xl mx-auto">
          {/* Team Portal Card */}
          <div 
            onClick={() => navigate('/team-login')}
            className="glass-card glass-card-hover p-6 rounded-2xl cursor-pointer text-left group"
          >
            <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mb-4 group-hover:bg-purple-500/20 group-hover:border-purple-500/40 transition-all">
              <Users className="w-6 h-6 text-purple-400" />
            </div>
            <h3 className="text-lg font-bold text-slate-100 group-hover:text-purple-300 transition-colors">Team Portal</h3>
            <p className="text-sm text-slate-400 mt-2">Log in using your Team ID or scan the Start QR to begin solving clues.</p>
          </div>

          {/* Admin Portal Card */}
          <div 
            onClick={() => navigate('/login')}
            className="glass-card glass-card-hover p-6 rounded-2xl cursor-pointer text-left group"
          >
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-4 group-hover:bg-blue-500/20 group-hover:border-blue-500/40 transition-all">
              <ShieldAlert className="w-6 h-6 text-blue-400" />
            </div>
            <h3 className="text-lg font-bold text-slate-100 group-hover:text-blue-300 transition-colors">Coordinator Portal</h3>
            <p className="text-sm text-slate-400 mt-2">Access settings, create events, bulk generate routes, and monitor team activities live.</p>
          </div>
        </div>

        {/* Public Leaderboard shortcut */}
        <div className="mt-12">
          <button 
            onClick={() => navigate('/leaderboard')}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full border border-slate-700 bg-slate-900/40 hover:bg-slate-800/40 hover:border-slate-600 text-slate-300 font-medium text-sm transition-all"
          >
            <Award className="w-4 h-4 text-yellow-500" />
            View Public Leaderboard
          </button>
        </div>
      </div>
      <Footer />
    </div>
  );
}
