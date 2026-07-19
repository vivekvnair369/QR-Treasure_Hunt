import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  Trophy, Clock, Compass, Camera, Lock, HelpCircle, LogOut, CheckCircle, Award
} from 'lucide-react';
import { 
  doc, onSnapshot, query, collection, where, limit, updateDoc, addDoc, serverTimestamp 
} from 'firebase/firestore';
import { db } from '../firebase/config';
import toast from 'react-hot-toast';

export default function TeamDashboard() {
  const { team, logout } = useAuth();
  const navigate = useNavigate();
  
  const [activeClue, setActiveClue] = useState(null);
  const [loadingClue, setLoadingClue] = useState(true);
  const [showHint, setShowHint] = useState(false);
  const [elapsedTime, setElapsedTime] = useState('00:00:00');
  const [eventInfo, setEventInfo] = useState(null);
  const [countdownText, setCountdownText] = useState('00:00');

  // Redirect to finished page if completed
  useEffect(() => {
    if (team && (team.status === 'completed' || team.status === 'finished')) {
      navigate('/finished');
    }
  }, [team, navigate]);

  // Subscribe to Active Event Info
  useEffect(() => {
    const unsubEvent = onSnapshot(query(collection(db, 'events'), where('active', '==', true), limit(1)), (snap) => {
      if (!snap.empty) {
        const ev = snap.docs[0].data();
        setEventInfo({ id: snap.docs[0].id, ...ev });
        if (ev.status === 'completed' || ev.status === 'archived') {
          navigate('/finished');
        }
      }
    });
    return unsubEvent;
  }, [navigate]);

  // Subscribe to Clue detail
  useEffect(() => {
    if (!team || !team.route_id) return;
    
    setLoadingClue(true);
    const q = query(
      collection(db, 'clues'),
      where('route_id', '==', team.route_id),
      where('sequence', '==', team.current_sequence || 1),
      limit(1)
    );
    
    const unsubClue = onSnapshot(q, (snap) => {
      if (!snap.empty) {
        setActiveClue({ id: snap.docs[0].id, ...snap.docs[0].data() });
      } else {
        setActiveClue(null);
      }
      setLoadingClue(false);
    }, (err) => {
      console.error("Clue subscription error:", err);
      setLoadingClue(false);
    });

    return unsubClue;
  }, [team?.route_id, team?.current_sequence]);

  const handleShowHint = async () => {
    if (!showHint && team) {
      try {
        await updateDoc(doc(db, 'teams', team.id), {
          hints_used: (team.hints_used || 0) + 1
        });
        await addDoc(collection(db, 'auditLogs'), {
          action_type: 'use_hint',
          performed_by: team.team_name,
          timestamp: serverTimestamp(),
          ip_address: '127.0.0.1',
          affected_team: team.team_name,
          details: `Team opened hint for sequence clue #${team.current_sequence || 1}.`
        });
      } catch (err) {
        console.error('Failed to log hint usage:', err);
      }
    }
    setShowHint(!showHint);
  };

  // Team Ticking Timer
  useEffect(() => {
    if (team && team.status === 'active' && team.start_time) {
      const interval = setInterval(() => {
        const start = team.start_time.seconds * 1000;
        const now = Date.now();
        
        const totalPauseSecs = team.total_paused_duration_seconds || 0;
        const bonusMins = team.bonus_time_minutes || 0;
        const penaltyMins = team.time_penalty_minutes || 0;
        
        const diff = Math.floor((now - start) / 1000) - totalPauseSecs - (bonusMins * 60) + (penaltyMins * 60);
        const finalDiff = Math.max(0, diff);
        
        const hrs = Math.floor(finalDiff / 3600);
        const mins = Math.floor((finalDiff % 3600) / 60);
        const secs = finalDiff % 60;
        
        const pad = (num) => String(num).padStart(2, '0');
        setElapsedTime(`${pad(hrs)}:${pad(mins)}:${pad(secs)}`);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [team]);

  // Global Event Countdown Timer
  useEffect(() => {
    if (eventInfo && eventInfo.status === 'running' && eventInfo.event_start && eventInfo.countdown_timer_active) {
      const interval = setInterval(() => {
        const start = eventInfo.event_start.seconds * 1000;
        const limitSecs = (eventInfo.max_time_limit_minutes + eventInfo.grace_time_minutes) * 60;
        const totalPauseSecs = eventInfo.total_paused_duration_seconds || 0;
        
        const now = Date.now();
        const elapsedSecs = Math.floor((now - start) / 1000) - totalPauseSecs;
        const remainingSecs = Math.max(0, limitSecs - elapsedSecs);
        
        const hrs = Math.floor(remainingSecs / 3600);
        const mins = Math.floor((remainingSecs % 3600) / 60);
        const secs = remainingSecs % 60;
        
        const pad = (num) => String(num).padStart(2, '0');
        setCountdownText(hrs > 0 ? `${pad(hrs)}:${pad(mins)}:${pad(secs)}` : `${pad(mins)}:${pad(secs)}`);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [eventInfo]);

  // Calculate Progress Percentage
  const getProgress = () => {
    if (!team) return 0;
    if (team.status === 'completed' || team.status === 'finished') return 100;
    const total = eventInfo?.num_clues_per_route || 4;
    const current = team.current_sequence || 1;
    return Math.round(((current - 1) / total) * 100);
  };

  return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-8 relative">
      <div className="absolute top-10 left-10 w-96 h-96 rounded-full glow-purple opacity-20 pointer-events-none"></div>
      
      <div className="max-w-4xl mx-auto z-10 relative">
        {/* Header */}
        <header className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 to-pink-500 flex items-center justify-center font-bold text-white shadow-lg shadow-purple-500/20">A</div>
            <div className="text-left">
              <h1 className="text-md font-black tracking-wider text-slate-200">{eventInfo?.name || 'AITHERON ML 2026'}</h1>
              <p className="text-[9px] text-purple-400 font-bold uppercase tracking-widest">Team Dashboard</p>
            </div>
          </div>
          <button 
            onClick={logout}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 border border-slate-800 text-red-400 hover:bg-red-950/20 text-xs font-bold rounded-xl transition-all"
          >
            <LogOut className="w-4 h-4" /> Logout
          </button>
        </header>

        {/* Dashboard Grid */}
        <div className="grid md:grid-cols-3 gap-6 mb-8 text-left">
          {/* Status Card */}
          <div className="glass-card p-6 rounded-2xl flex flex-col justify-between">
            <span className="text-xs text-slate-500 font-medium">TEAM STATUS</span>
            <div className="my-3 flex items-center gap-2">
              <span className="text-xl font-black text-slate-100 uppercase truncate max-w-[150px]">{team?.team_name}</span>
              {team?.status === 'active' && (
                <span className="inline-flex px-3 py-1 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20 animate-pulse">
                  Playing
                </span>
              )}
              {team?.status === 'paused' && (
                <span className="inline-flex px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  Paused
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400">
              {team?.status === 'registered' && 'Checked-in. Scan the Start QR!'}
              {team?.status === 'active' && 'Find your next checkpoint QR!'}
              {team?.status === 'paused' && 'Scanning is temporarily disabled.'}
            </p>
          </div>

          {/* Timer Card */}
          <div className="glass-card p-6 rounded-2xl flex flex-col justify-between">
            <span className="text-xs text-slate-500 font-medium flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" /> {eventInfo?.countdown_timer_active ? 'GLOBAL COUNTDOWN' : 'ELAPSED TIME'}
            </span>
            <div className="my-3 font-mono text-3xl font-bold text-purple-400 timer-glow">
              {eventInfo?.countdown_timer_active ? countdownText : (team?.status === 'active' ? elapsedTime : '00:00:00')}
            </div>
            <p className="text-xs text-slate-400">
              {eventInfo?.countdown_timer_active ? 'Time remaining to complete the hunt.' : 'Timer starts upon scanning the first QR.'}
            </p>
          </div>

          {/* Progress Card */}
          <div className="glass-card p-6 rounded-2xl flex flex-col justify-between">
            <span className="text-xs text-slate-500 font-medium">COMPLETION</span>
            <div className="my-3">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-bold text-slate-300">Route Progress</span>
                <span className="text-sm font-semibold text-purple-400">{getProgress()}%</span>
              </div>
              <div className="w-full bg-slate-900 border border-slate-800 h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-purple-500 to-pink-500 h-full rounded-full transition-all duration-500" 
                  style={{ width: `${getProgress()}%` }}
                ></div>
              </div>
            </div>
            <p className="text-xs text-slate-400">
              Clue {team?.current_sequence || 1}
            </p>
          </div>
        </div>

        {/* Members List */}
        {team?.member_names && (
          <div className="glass-card p-6 rounded-2xl mb-8 text-left">
            <h3 className="text-xs text-slate-500 font-bold tracking-wider mb-3">
              TEAM MEMBERS ({team.num_members})
            </h3>
            <div className="flex flex-wrap gap-2">
              {team.member_names.split(',').map((name, i) => (
                <span key={i} className="px-3 py-1 bg-purple-500/10 border border-purple-500/15 text-purple-300 rounded-full text-xs font-semibold">
                  {name.trim()}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <div className="glass-card p-8 rounded-3xl mb-8">
          {eventInfo && ['draft', 'registration_open', 'registration_closed', 'ready'].includes(eventInfo.status) ? (
            <div className="text-center py-16 flex flex-col items-center">
              <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-full inline-flex text-purple-400 mb-6 animate-pulse">
                <Lock className="w-12 h-12" />
              </div>
              <h2 className="text-2xl font-bold text-slate-200 mb-3">{eventInfo.name}</h2>
              <p className="text-purple-400 text-xs font-mono uppercase tracking-widest mb-2">Event Status: {eventInfo.status?.replace('_', ' ')}</p>
              <p className="text-slate-400 text-sm max-w-md mx-auto leading-relaxed">
                The event has not started yet. Please wait for the coordinators to officially launch the symposium activity.
              </p>
            </div>
          ) : team?.status === 'disqualified' ? (
            <div className="text-center py-12">
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-full inline-flex text-red-400 mb-6">
                <Compass className="w-12 h-12 rotate-45" />
              </div>
              <h2 className="text-2xl font-bold text-slate-200 mb-3">Disqualified!</h2>
              <p className="text-slate-400 text-sm max-w-md mx-auto leading-relaxed">
                Your team has been disqualified from the hunt by the coordinators. Please contact the front desk.
              </p>
            </div>
          ) : (team?.status === 'registered' || team?.status === 'checked_in') ? (
            <div className="text-center py-12 flex flex-col items-center">
              <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-full inline-flex text-amber-400 mb-6 animate-bounce">
                <Lock className="w-12 h-12" />
              </div>
              <h2 className="text-2xl font-bold text-slate-200 mb-3">Clues are Locked!</h2>
              <p className="text-slate-400 text-sm max-w-md mx-auto leading-relaxed mb-6">
                Your team is registered and ready. To unlock your first clue and start your timers, locate the <strong>Start QR Code</strong> physically and scan it using your phone camera.
              </p>
              <button
                onClick={() => navigate('/scan')}
                className="inline-flex items-center gap-2 px-6 py-3.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 font-bold rounded-2xl text-slate-950 transition-all shadow-lg"
              >
                <Camera className="w-5 h-5" /> Open QR Scanner
              </button>
            </div>
          ) : loadingClue ? (
            <div className="text-center py-16">
              <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-slate-400 text-sm">Decoding active clue...</p>
            </div>
          ) : activeClue ? (
            <div>
              {eventInfo?.status === 'paused' && (
                <div className="mb-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold flex items-center gap-2 animate-pulse justify-center">
                  ⏸️ The coordinators have temporarily paused the event. Checkpoint scanning is currently suspended.
                </div>
              )}

              <div className="flex justify-between items-center mb-6">
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20">
                  CLUE #{activeClue.sequence}
                </span>
                <span className="text-xs text-slate-500 font-medium">Checkpoint Sequence</span>
              </div>

              {/* Riddle box */}
              <div className="bg-slate-950/60 border border-slate-900 p-6 rounded-2xl mb-6 text-left">
                <h3 className="text-xs text-slate-500 font-bold tracking-wider mb-2">RIDDLE</h3>
                <p className="text-slate-200 text-lg font-medium leading-relaxed italic">
                  "{activeClue.clue_text}"
                </p>
              </div>

              {/* Hint section */}
              {activeClue.hint ? (
                <div className="text-left">
                  <button
                    onClick={handleShowHint}
                    className="inline-flex items-center gap-2 text-xs font-semibold text-purple-400 hover:text-purple-300 transition-colors"
                  >
                    <HelpCircle className="w-4 h-4" />
                    {showHint ? 'Hide Hint' : 'Need a hint?'}
                  </button>
                  {showHint && (
                    <div className="mt-3 p-4 rounded-xl bg-purple-950/20 border border-purple-500/15 text-purple-300 text-sm leading-relaxed animate-fadeIn">
                      💡 <strong>Hint:</strong> {activeClue.hint}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-slate-600 text-left">No hints available for this clue.</p>
              )}

              {/* Checkpoint Scan Button */}
              <button
                onClick={() => navigate('/scan')}
                disabled={eventInfo?.status === 'paused'}
                className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 font-bold rounded-2xl text-white transition-all shadow-lg hover:shadow-purple-500/10 flex items-center justify-center gap-2 mt-6 disabled:opacity-40 disabled:pointer-events-none"
              >
                <Camera className="w-5 h-5" /> Scan Checkpoint QR
              </button>
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-slate-400">No clues unlocked yet.</p>
            </div>
          )}
        </div>

        {/* Instructions & Guidelines */}
        <div className="glass-card p-6 rounded-2xl text-left">
          <h3 className="text-sm font-bold text-slate-300 mb-3 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-purple-400" /> Instructions
          </h3>
          <ul className="text-xs text-slate-400 space-y-2 list-disc pl-4">
            <li>Solve the riddle shown in the dashboard. It describes a location on campus.</li>
            <li>Go to that location physically. Look for a hidden QR code.</li>
            <li>Scan the QR code with your phone camera. It will automatically validate your progress.</li>
            <li>Do NOT share QR codes or locations with other teams. Route tampering is strictly logged!</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
