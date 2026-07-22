import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Award, Trophy, Clock, ArrowLeft, RefreshCw, Star } from 'lucide-react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';
import toast from 'react-hot-toast';

export default function Leaderboard() {
  const navigate = useNavigate();
  const [standings, setStandings] = useState([]);
  const [clues, setClues] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Subscribe to leaderboard collection in real-time
    const unsub = onSnapshot(collection(db, 'leaderboard'), (snap) => {
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setStandings(list);
      setLoading(false);
    }, (err) => {
      console.error('Error fetching leaderboard:', err);
      toast.error('Failed to load leaderboard data.');
      setLoading(false);
    });

    const unsubClues = onSnapshot(collection(db, 'clues'), (snap) => {
      setClues(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsub();
      unsubClues();
    };
  }, []);

  const formatMinutes = (seconds) => {
    if (!seconds || seconds <= 0) return '0s';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}m ${secs}s`;
  };

  const getProgressDetails = (t) => {
    if (!t) return { percent: 0, completed: 0, total: 3 };
    const routeClues = clues.filter(c => c.route_id === t.route_id);
    const total = routeClues.length || 3;
    const completed = t.status === 'finished' ? total : Math.max(0, (t.current_sequence || 1) - 1);
    return {
      percent: Math.round((completed / total) * 100),
      completed,
      total
    };
  };

  const getTeamProgressPercent = (t) => {
    return getProgressDetails(t).percent;
  };

  const sortTeams = (list) => {
    const sortKey = (t) => {
      const progress = getTeamProgressPercent(t);
      const elapsed = t.elapsed_seconds || 0;
      
      const isWinner = t.is_grand_winner || t.is_qualifying_winner;
      
      if (t.status === 'finished' || isWinner) {
        return [0, elapsed, t.team_name];
      }
      if (t.status === 'active') {
        return [1, -progress, elapsed, t.team_name];
      }
      return [2, 0, 0, t.team_name];
    };
    
    return [...list].sort((a, b) => {
      const ka = sortKey(a);
      const kb = sortKey(b);
      for (let i = 0; i < 4; i++) {
        if (ka[i] !== kb[i]) {
          if (typeof ka[i] === 'string') return ka[i].localeCompare(kb[i]);
          return ka[i] - kb[i];
        }
      }
      return 0;
    });
  };

  const championshipTeams = sortTeams(standings.filter(t => t.route_id === 'championship'));
  const qualifyingTeams = sortTeams(standings.filter(t => t.route_id !== 'championship'));

  return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-8 relative">
      <div className="absolute top-10 right-10 w-96 h-96 rounded-full glow-blue opacity-30 pointer-events-none"></div>
      
      <div className="max-w-4xl mx-auto z-10 relative">
        {/* Header */}
        <header className="flex justify-between items-center mb-8">
          <button 
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Go back
          </button>
        </header>

        {/* Title */}
        <div className="text-center mb-10">
          <div className="inline-flex p-4 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 mb-4 animate-pulse">
            <Trophy className="w-10 h-10" />
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-slate-100">AITHERON ML 2026 Leaderboard</h1>
          <p className="text-sm text-slate-400 mt-1">Real-time standings of symposium teams</p>
        </div>

        {loading ? (
          <div className="text-center py-20">
            <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-slate-400 text-sm">Retrieving standings...</p>
          </div>
        ) : standings.length === 0 ? (
          <div className="glass-card rounded-3xl p-20 text-center border border-slate-900 shadow-2xl">
            <Star className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400 font-bold">No teams registered yet.</p>
          </div>
        ) : (
          <div className="space-y-10">
            {/* 1. CHAMPIONSHIP STANDINGS */}
            {championshipTeams.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-lg font-black text-yellow-400 uppercase tracking-widest text-left flex items-center gap-2">
                  🏆 Championship Finals (Round 2)
                </h2>
                <div className="glass-card rounded-3xl overflow-hidden shadow-2xl border border-yellow-500/20">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-yellow-500/5 text-xs text-yellow-400 uppercase tracking-wider font-semibold border-b border-yellow-500/10">
                          <th className="py-4 px-6 text-center w-20">Rank</th>
                          <th className="py-4 px-6">Team</th>
                          <th className="py-4 px-6">Championship Clue</th>
                          <th className="py-4 px-6">Hints Used</th>
                          <th className="py-4 px-6 text-right">Duration</th>
                        </tr>
                      </thead>
                      <tbody>
                        {championshipTeams.map((team, index) => {
                          const isWinner = team.is_grand_winner;
                          return (
                            <tr 
                              key={team.id}
                              className={`border-b border-slate-900/60 hover:bg-slate-900/30 transition-colors ${
                                isWinner ? 'bg-yellow-500/5' : 'bg-slate-950/40'
                              }`}
                            >
                              <td className="py-5 px-6 text-center">
                                <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold border ${
                                  index === 0 ? 'text-yellow-400 bg-yellow-500/5 border-yellow-500/20' : 'text-slate-400 border-slate-800'
                                }`}>
                                  {index + 1}
                                </span>
                              </td>
                              <td className="py-5 px-6">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-slate-100 text-sm">{team.team_name}</span>
                                  {isWinner && (
                                    <span className="inline-flex items-center gap-0.5 px-2.5 py-0.5 rounded-full text-[9px] font-black bg-gradient-to-r from-yellow-500 to-amber-500 text-slate-950 uppercase shadow-md shadow-yellow-500/10">
                                      🥇 Grand Champion
                                    </span>
                                  )}
                                  {team.status === 'active' && (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/15 uppercase animate-pulse">
                                      Active
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-5 px-6 text-left">
                                <div className="text-slate-300 font-medium flex flex-col">
                                  <span>{team.status === 'finished' ? 'Completed Route!' : `Clue ${team.current_sequence || 1}`}</span>
                                  <span className="text-[10px] text-yellow-500 font-bold">
                                    {getProgressDetails(team).percent}% Completed ({getProgressDetails(team).completed}/{getProgressDetails(team).total} Clues)
                                  </span>
                                </div>
                              </td>
                              <td className="py-5 px-6 font-mono text-slate-400">
                                {team.hints_used || 0} hint(s)
                              </td>
                              <td className="py-5 px-6 text-right font-mono font-bold text-slate-200">
                                {formatMinutes(team.elapsed_seconds)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* 2. QUALIFYING STANDINGS */}
            <div className="space-y-4">
              <h2 className="text-lg font-black text-purple-400 uppercase tracking-widest text-left flex items-center gap-2">
                ⚡ Qualifying Round (Round 1)
              </h2>
              <div className="glass-card rounded-3xl overflow-hidden shadow-2xl border border-slate-900">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-900/80 text-xs text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                        <th className="py-4 px-6 text-center w-20">Rank</th>
                        <th className="py-4 px-6">Team</th>
                        <th className="py-4 px-6">Starting Block</th>
                        <th className="py-4 px-6">Clue Progress</th>
                        <th className="py-4 px-6 text-right">Duration</th>
                      </tr>
                    </thead>
                    <tbody>
                      {qualifyingTeams.map((team, index) => {
                        const isWinner = team.is_qualifying_winner;
                        return (
                          <tr 
                            key={team.id}
                            className={`border-b border-slate-900 hover:bg-slate-900/30 transition-colors ${
                              isWinner ? 'bg-purple-950/20' : ''
                            }`}
                          >
                            <td className="py-5 px-6 text-center">
                              <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold border ${
                                isWinner ? 'text-purple-400 bg-purple-500/10 border-purple-500/20' : 'text-slate-400 border-slate-800'
                              }`}>
                                {index + 1}
                              </span>
                            </td>
                            <td className="py-5 px-6">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-100 text-sm">{team.team_name}</span>
                                {isWinner && (
                                  <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[9px] font-bold bg-green-500/10 text-green-400 border border-green-500/15 uppercase">
                                    <Award className="w-2.5 h-2.5" /> Block Winner
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-5 px-6 text-slate-400 font-semibold uppercase text-xs">
                              {team.route_id === 'route_a' ? 'Block A' : team.route_id === 'route_b' ? 'Block B' : team.route_id === 'route_c' ? 'Block C' : 'Qualifying'}
                            </td>
                            <td className="py-5 px-6 text-left">
                              <div className="text-slate-300 font-medium flex flex-col font-medium">
                                <span>{team.status === 'finished' ? 'Completed Route' : `Clue ${team.current_sequence || 1}`}</span>
                                <span className="text-[10px] text-purple-400 font-bold">
                                  {getProgressDetails(team).percent}% Completed ({getProgressDetails(team).completed}/{getProgressDetails(team).total} Clues)
                                </span>
                              </div>
                            </td>
                            <td className="py-5 px-6 text-right font-mono font-bold text-slate-200">
                              {team.status === 'finished' || team.status === 'active' ? formatMinutes(team.elapsed_seconds) : '-'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
