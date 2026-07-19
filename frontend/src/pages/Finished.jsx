import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Award, Clock, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import confetti from 'canvas-confetti';

export default function Finished() {
  const navigate = useNavigate();
  const { logout, team } = useAuth();

  useEffect(() => {
    // Launch celebratory confetti bursts
    const duration = 5 * 1000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 1000 };

    const randomInRange = (min, max) => Math.random() * (max - min) + min;

    const interval = setInterval(() => {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);
      
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
      });
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
      });
    }, 250);

    return () => clearInterval(interval);
  }, []);

  const formatDuration = (start, finish) => {
    if (!start || !finish) return '-';
    const s = start.toDate ? start.toDate() : new Date(start);
    const f = finish.toDate ? finish.toDate() : new Date(finish);
    const diff = Math.abs(f - s) / 1000;
    const hrs = Math.floor(diff / 3600);
    const mins = Math.floor((diff % 3600) / 60);
    const secs = Math.floor(diff % 60);
    return `${hrs > 0 ? hrs + 'h ' : ''}${mins > 0 ? mins + 'm ' : ''}${secs}s`;
  };

  const handleExit = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center p-6 text-center overflow-hidden">
      <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full glow-purple animate-pulse-slow pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full glow-blue pointer-events-none"></div>

      <div className="z-10 max-w-lg w-full glass-card p-10 rounded-3xl border border-yellow-500/20 shadow-2xl">
        <div className="inline-flex p-5 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 mb-8 animate-bounce">
          <Award className="w-16 h-16" />
        </div>

        <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-orange-500 to-yellow-500 mb-2">
          VICTORY!
        </h1>
        <h2 className="text-xl font-bold text-slate-100 mb-6">
          You Completed the AITHERON ML 2026 Treasure Hunt!
        </h2>

        <p className="text-slate-400 text-sm max-w-sm mx-auto mb-8 leading-relaxed">
          Outstanding work! Your team successfully solved all the clues, scanned every QR in sequence, and made it to the Final Hall.
        </p>

        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4">
            <div className="text-xs text-slate-500 mb-1">Team Name</div>
            <div className="text-lg font-bold text-slate-200 truncate">{team?.team_name || 'Team'}</div>
          </div>
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4">
            <div className="text-xs text-slate-500 mb-1 flex items-center justify-center gap-1">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              Duration
            </div>
            <div className="text-lg font-bold text-slate-200 timer-glow">
              {team ? formatDuration(team.start_time, team.finish_time) : '-'}
            </div>
          </div>
        </div>

        <div className="flex gap-4">
          <button 
            onClick={() => navigate('/leaderboard')}
            className="flex-1 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold transition-all shadow-lg hover:shadow-purple-500/15"
          >
            Leaderboard
          </button>
          
          <button 
            onClick={handleExit}
            className="flex-1 py-3 rounded-xl bg-slate-800 border border-slate-700 hover:bg-slate-700 hover:border-slate-600 text-slate-300 font-semibold transition-all"
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
