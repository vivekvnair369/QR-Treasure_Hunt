import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  Trophy, Clock, Compass, Camera, Lock, HelpCircle, LogOut, CheckCircle, Award,
  CheckCircle2, XCircle, AlertCircle, Sparkles, Download, ArrowRight, Zap, RefreshCw
} from 'lucide-react';
import { 
  doc, onSnapshot, query, collection, where, limit, updateDoc, addDoc, serverTimestamp, setDoc, getDocs 
} from 'firebase/firestore';
import { db } from '../firebase/config';
import toast from 'react-hot-toast';
import confetti from 'canvas-confetti';

export default function TeamDashboard() {
  const { team, logout } = useAuth();
  const navigate = useNavigate();
  
  const [activeClue, setActiveClue] = useState(null);
  const [loadingClue, setLoadingClue] = useState(true);
  const [showHint, setShowHint] = useState(false);
  const [elapsedTime, setElapsedTime] = useState('00:00:00');
  const [eventInfo, setEventInfo] = useState(null);
  const [countdownText, setCountdownText] = useState('00:00');
  const [routeInfo, setRouteInfo] = useState(null);
  const [finalists, setFinalists] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [routeCluesCount, setRouteCluesCount] = useState(0);
  const [showCountdown, setShowCountdown] = useState(false);
  const [countdownNum, setCountdownNum] = useState(3);
  const [countdownFinished, setCountdownFinished] = useState(false);
  const [tempOverrideWaiting, setTempOverrideWaiting] = useState(false);
  const [showRouteBroadcast, setShowRouteBroadcast] = useState(false);
  const [showGlobalBroadcast, setShowGlobalBroadcast] = useState(false);
  // Subscribe to Active Event Info
  useEffect(() => {
    const unsubEvent = onSnapshot(query(collection(db, 'events'), where('active', '==', true), limit(1)), (snap) => {
      if (!snap.empty) {
        const ev = snap.docs[0].data();
        setEventInfo({ id: snap.docs[0].id, ...ev });
      }
    });

    return () => {
      unsubEvent();
    };
  }, []);

  // Auto-activate team if event is already running and team is waiting/registered
  useEffect(() => {
    if (
      eventInfo &&
      ['qualifying', 'championship'].includes(eventInfo.status) &&
      team &&
      ['registered', 'checked_in', 'waiting'].includes(team.status)
    ) {
      const activateTeam = async () => {
        try {
          const teamRef = doc(db, 'teams', team.id);
          const q = query(collection(db, 'clues'), where('route_id', '==', team.route_id));
          const snap = await getDocs(q);
          const totalClues = snap.size || 3;
          
          const startProgress = Math.round((1 / totalClues) * 100);

          await updateDoc(teamRef, {
            status: 'active',
            start_time: serverTimestamp(),
            current_sequence: 2,
            progress_percent: startProgress,
            completed_clues: 1,
            total_clues: totalClues
          });

          await setDoc(doc(db, 'leaderboard', team.id), {
            team_name: team.team_name,
            college_name: team.college_name || "",
            status: 'active',
            current_sequence: 2,
            elapsed_seconds: 0,
            hints_used: 0,
            finish_time: null,
            is_qualifying_winner: false,
            is_grand_winner: false,
            route_id: team.route_id,
            progress_percent: startProgress,
            completed_clues: 1,
            total_clues: totalClues
          }, { merge: true });
        } catch (err) {
          console.error("Error auto-starting team:", err);
        }
      };
      activateTeam();
    }
  }, [eventInfo, team?.status, team?.route_id]);

  // Subscribe to Route info (for broadcast hints and completion status)
  useEffect(() => {
    if (!team || !team.route_id) return;
    const unsubRoute = onSnapshot(doc(db, 'routes', team.route_id), (snap) => {
      if (snap.exists()) {
        setRouteInfo({ id: snap.id, ...snap.data() });
      } else {
        setRouteInfo(null);
      }
    });
    return unsubRoute;
  }, [team?.route_id]);

  // Subscribe to Leaderboard (real-time standings for ranks & spectating)
  useEffect(() => {
    if (!team) return;
    const unsubLeaderboard = onSnapshot(collection(db, 'leaderboard'), (snap) => {
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setLeaderboard(list);
      
      // Filter out finalists for spectator view
      const champFinalists = list.filter(t => t.route_id === 'championship');
      setFinalists(champFinalists);
    }, (err) => {
      console.warn("Leaderboard subscription hidden or restricted:", err);
    });
    return unsubLeaderboard;
  }, [team]);

  // Subscribe to Route Clues (for dynamic count & active clue selection)
  useEffect(() => {
    if (!team || !team.route_id) return;
    
    setLoadingClue(true);
    const q = query(
      collection(db, 'clues'),
      where('route_id', '==', team.route_id)
    );
    
    const unsubClues = onSnapshot(q, (snap) => {
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRouteCluesCount(list.length);
      
      const active = list.find(c => c.sequence === (team.current_sequence || 1));
      setActiveClue(active || null);
      setLoadingClue(false);
    }, (err) => {
      console.error("Clues subscription error:", err);
      setLoadingClue(false);
    });

    return unsubClues;
  }, [team?.route_id, team?.current_sequence]);

  // Real-time Broadcast Visibility & Auto-hide Timer
  useEffect(() => {
    // 1. Route Broadcast Check
    const activeHint = team?.broadcast_hint || team?.broadcast_message || team?.current_hint || 
                       routeInfo?.broadcast_hint || routeInfo?.broadcast_message || routeInfo?.current_hint;
                       
    const isAutoHide = (team?.broadcast_hint || team?.broadcast_message || team?.current_hint)
      ? (team?.broadcast_hint_auto_hide || team?.broadcast_message_auto_hide)
      : (routeInfo?.broadcast_hint_auto_hide || routeInfo?.broadcast_message_auto_hide);
      
    const hideAt = (team?.broadcast_hint || team?.broadcast_message || team?.current_hint)
      ? (team?.broadcast_hint_hide_at || team?.broadcast_message_hide_at)
      : (routeInfo?.broadcast_hint_hide_at || routeInfo?.broadcast_message_hide_at);

    let routeTimeoutId = null;

    if (activeHint) {
      console.log("Broadcast received:", activeHint);
      if (isAutoHide && hideAt) {
        const expiry = hideAt.seconds ? (hideAt.seconds * 1000) : new Date(hideAt).getTime();
        const delay = expiry - Date.now();
        if (delay <= 0) {
          setShowRouteBroadcast(false);
        } else {
          setShowRouteBroadcast(true);
          console.log(`Route broadcast auto-hiding in ${Math.round(delay/1000)}s.`);
          routeTimeoutId = setTimeout(() => {
            setShowRouteBroadcast(false);
            console.log("Route broadcast UI updated (expired).");
          }, delay);
        }
      } else {
        setShowRouteBroadcast(true);
        console.log("Route broadcast UI updated (persistent).");
      }
    } else {
      setShowRouteBroadcast(false);
    }

    // 2. Global Event Broadcast Check
    const activeMsg = eventInfo?.broadcast_message || eventInfo?.broadcast_hint || eventInfo?.current_hint;
    const isGlobalAutoHide = eventInfo?.broadcast_message_auto_hide || eventInfo?.broadcast_hint_auto_hide;
    const globalHideAt = eventInfo?.broadcast_message_hide_at || eventInfo?.broadcast_hint_hide_at;

    let globalTimeoutId = null;

    if (activeMsg) {
      console.log("Global broadcast received:", activeMsg);
      if (isGlobalAutoHide && globalHideAt) {
        const expiry = globalHideAt.seconds ? (globalHideAt.seconds * 1000) : new Date(globalHideAt).getTime();
        const delay = expiry - Date.now();
        if (delay <= 0) {
          setShowGlobalBroadcast(false);
        } else {
          setShowGlobalBroadcast(true);
          console.log(`Global broadcast auto-hiding in ${Math.round(delay/1000)}s.`);
          globalTimeoutId = setTimeout(() => {
            setShowGlobalBroadcast(false);
            console.log("Global broadcast UI updated (expired).");
          }, delay);
        }
      } else {
        setShowGlobalBroadcast(true);
        console.log("Global broadcast UI updated (persistent).");
      }
    } else {
      setShowGlobalBroadcast(false);
    }

    return () => {
      if (routeTimeoutId) clearTimeout(routeTimeoutId);
      if (globalTimeoutId) clearTimeout(globalTimeoutId);
    };
  }, [
    team?.broadcast_hint, team?.broadcast_message, team?.current_hint, 
    team?.broadcast_hint_auto_hide, team?.broadcast_message_auto_hide, 
    team?.broadcast_hint_hide_at, team?.broadcast_message_hide_at,
    routeInfo?.broadcast_hint, routeInfo?.broadcast_message, routeInfo?.current_hint, 
    routeInfo?.broadcast_hint_auto_hide, routeInfo?.broadcast_message_auto_hide, 
    routeInfo?.broadcast_hint_hide_at, routeInfo?.broadcast_message_hide_at,
    eventInfo?.broadcast_message, eventInfo?.broadcast_hint, eventInfo?.current_hint, 
    eventInfo?.broadcast_message_auto_hide, eventInfo?.broadcast_hint_auto_hide, 
    eventInfo?.broadcast_message_hide_at, eventInfo?.broadcast_hint_auto_hide
  ]);

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
        const start = team.start_time.seconds ? (team.start_time.seconds * 1000) : (team.start_time.toMillis ? team.start_time.toMillis() : Date.now());
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
    if (eventInfo && ['running', 'qualifying', 'championship'].includes(eventInfo.status) && eventInfo.event_start && eventInfo.countdown_timer_active) {
      const interval = setInterval(() => {
        const start = eventInfo.event_start.seconds ? (eventInfo.event_start.seconds * 1000) : (eventInfo.event_start.toMillis ? eventInfo.event_start.toMillis() : Date.now());
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

  const getProgress = () => {
    if (!team) return 0;
    if (team.status === 'completed' || team.status === 'finished') return 100;
    return team.progress_percent || 0;
  };

  const getTeamStateCase = () => {
    if (!eventInfo || !team) return 'loading';

    const evStatus = eventInfo.status;
    const currentRound = eventInfo.current_round || 1;

    // Disqualified is always disqualified
    if (team.status === 'disqualified') return 'disqualified';

    // Case 8: Event Completed
    if (evStatus === 'completed') {
      return 'completed_result';
    }

    // Case 7: Event Timed Out
    if (evStatus === 'timeout') {
      return 'timeout';
    }

    // Event is not active yet (draft, ready, registration_open, etc.)
    if (['draft', 'registration_open', 'registration_closed', 'ready'].includes(evStatus)) {
      return 'pre_event';
    }

    // Case 5: Grand Champion
    if (team.is_grand_winner) {
      return 'grand_champion';
    }

    // If the event is in championship round (Round 2)
    if (currentRound === 2 || evStatus === 'championship') {
      if (team.route_id === 'championship') {
        if (team.status === 'finished') {
          return 'championship_finalist_completed'; // Case 6
        }
        return 'championship_playing'; // Case 4
      } else {
        return 'eliminated_spectator'; // Case 2
      }
    }

    // Under Round 1 (Qualifying):
    if (currentRound === 1 || evStatus === 'qualifying') {
      if (team.is_qualifying_winner === true) {
        if (evStatus === 'waiting_championship') {
          return 'waiting_championship'; // Case 3
        }
        return 'qualified_winner'; // Case 1
      }

      // Check if their route has a winner already
      if (routeInfo?.winner_team_id && routeInfo?.winner_team_id !== team.id) {
        return 'eliminated_spectator'; // Case 2: Someone else finished first
      }

      // If they finished but didn't win (e.g. they scanned last clue after winner)
      if (team.status === 'finished' && !team.is_qualifying_winner) {
        return 'eliminated_spectator'; // Case 2
      }

      // Normal play
      if (team.status === 'registered' || team.status === 'checked_in' || team.status === 'waiting') {
        return 'not_started';
      }
      return 'playing';
    }

    return 'playing';
  };

  const stateCase = getTeamStateCase();

  const getTeamRank = () => {
    if (leaderboard.length === 0 || !team) return '-';
    
    // Sort leaderboard using same criteria as Leaderboard.jsx
    const sorted = [...leaderboard].sort((a, b) => {
      const sortKey = (t) => {
        const progress = t.progress_percent || 0;
        const elapsed = t.elapsed_seconds || 0;
        const isWinner = t.is_grand_winner || t.is_qualifying_winner;
        
        if (t.status === 'finished' || isWinner) {
          return [0, elapsed, t.team_name || ""];
        }
        if (t.status === 'active') {
          return [1, -progress, elapsed, t.team_name || ""];
        }
        return [2, 0, 0, t.team_name || ""];
      };
      
      const ka = sortKey(a);
      const kb = sortKey(b);
      for (let i = 0; i < 4; i++) {
        if (ka[i] !== kb[i]) {
          if (typeof ka[i] === 'string') return ka[i].localeCompare(kb[i] || "");
          return ka[i] - kb[i];
        }
      }
      return 0;
    });
    
    const idx = sorted.findIndex(t => t.id === team.id);
    return idx !== -1 ? `#${idx + 1}` : '-';
  };

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

  // Trigger confetti burst on victory
  useEffect(() => {
    const sc = getTeamStateCase();
    if (sc === 'qualified_winner' || sc === 'grand_champion') {
      const duration = 4 * 1000;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 1000 };

      const randomInRange = (min, max) => Math.random() * (max - min) + min;

      const interval = setInterval(() => {
        const timeLeft = animationEnd - Date.now();
        if (timeLeft <= 0) return clearInterval(interval);

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
    }
  }, [team?.status, eventInfo?.status, team?.is_qualifying_winner, team?.is_grand_winner]);

  // Trigger transition countdown when moving to a final result screen
  useEffect(() => {
    if (stateCase === 'loading') return;

    const nonFinalCases = ['loading', 'pre_event', 'playing', 'not_started', 'championship_playing'];
    
    // Reset countdown states if we are back in playing/active state
    if (nonFinalCases.includes(stateCase)) {
      setCountdownFinished(false);
      setTempOverrideWaiting(false);
      return;
    }

    // Trigger full screen 3-2-1-0 countdown if final state reached and hasn't run
    if (!countdownFinished && !showCountdown) {
      setShowCountdown(true);
      setCountdownNum(3);
    }
  }, [stateCase, countdownFinished]);

  // Countdown timer sequence
  useEffect(() => {
    if (!showCountdown) return;

    const interval = setInterval(() => {
      setCountdownNum((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setTimeout(() => {
            setShowCountdown(false);
            setCountdownFinished(true);
          }, 1000);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [showCountdown]);

  // Auto transition from Qualified Winner to Waiting for Championship screen after 4s
  useEffect(() => {
    if (stateCase === 'qualified_winner' && countdownFinished && !tempOverrideWaiting) {
      const timer = setTimeout(() => {
        setTempOverrideWaiting(true);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [stateCase, countdownFinished, tempOverrideWaiting]);

  return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-8 relative">
      <div className="absolute top-10 left-10 w-96 h-96 rounded-full glow-purple opacity-20 pointer-events-none"></div>

      {/* 3-2-1-0 Transition Countdown Overlay */}
      {showCountdown && (
        <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-md z-50 flex flex-col items-center justify-center select-none animate-fadeIn">
          <div className="text-center space-y-6">
            <p className="text-purple-400 text-xs font-bold uppercase tracking-[0.2em] animate-pulse">Synchronizing Results</p>
            <div key={countdownNum} className="text-9xl font-black text-white drop-shadow-[0_0_40px_rgba(168,85,247,0.55)] animate-countdownZoom">
              {countdownNum}
            </div>
            <p className="text-slate-500 text-[10px] font-bold tracking-wider uppercase">Standby for placement...</p>
          </div>
        </div>
      )}
      
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

        {/* CONDITIONAL STATUS SCREENS OR NORMAL PLAYING DASHBOARD */}

        {stateCase === 'loading' && (
          <div className="w-full glass-card p-12 rounded-3xl border border-slate-900 shadow-2xl text-center space-y-4">
            <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-slate-400 text-sm font-medium">Synchronizing game state...</p>
          </div>
        )}

        {stateCase === 'disqualified' && (
          <div className="w-full glass-card p-10 rounded-3xl border border-red-500/20 shadow-2xl text-center space-y-6 animate-scaleUp">
            <div className="inline-flex p-4 bg-red-500/10 border border-red-500/20 rounded-full text-red-400 mb-2">
              <Compass className="w-12 h-12 rotate-45" />
            </div>
            <h2 className="text-2xl font-bold text-slate-200">Disqualified!</h2>
            <p className="text-slate-400 text-sm max-w-sm mx-auto leading-relaxed">
              Your team has been disqualified from the hunt by the coordinators. Please contact the front desk.
            </p>
          </div>
        )}

        {/* CASE 1: qualified_winner */}
        {stateCase === 'qualified_winner' && countdownFinished && !tempOverrideWaiting && (
          <div className="w-full glass-card p-10 rounded-3xl border border-yellow-500/20 shadow-2xl text-center space-y-6 animate-scaleUp">
            <div className="inline-flex p-5 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 mb-2 animate-bounce">
              <Award className="w-16 h-16" />
            </div>
            
            <h2 className="text-3xl font-extrabold text-slate-100">🎉 Congratulations!</h2>
            <p className="text-slate-300 text-sm max-w-md mx-auto leading-relaxed">
              You are the winner of your qualifying route.
            </p>
            <p className="text-slate-255 text-sm font-bold max-w-sm mx-auto">
              You have successfully qualified for the Championship Round.
            </p>
            <p className="text-slate-400 text-xs max-w-sm mx-auto italic">
              Please wait while the coordinator prepares the next round.
            </p>

            <div className="flex justify-center gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-green-500/10 text-green-400 border border-green-500/20">
                ✅ Qualified
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
                🏆 Route Winner
              </span>
            </div>

            <div className="flex gap-4 pt-4 max-w-md mx-auto">
              <button 
                onClick={() => navigate('/leaderboard')}
                className="flex-1 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold transition-all shadow-lg text-xs"
              >
                View Leaderboard
              </button>
              <button 
                disabled
                className="flex-1 py-3 rounded-xl bg-slate-800 border border-slate-700 text-slate-400 font-semibold text-xs flex items-center justify-center gap-1.5"
              >
                <Clock className="w-3.5 h-3.5 animate-spin" /> Wait for Championship
              </button>
            </div>
          </div>
        )}

        {/* CASE 2: eliminated_spectator */}
        {stateCase === 'eliminated_spectator' && countdownFinished && (
          <div className="space-y-6 animate-scaleUp">
            <div className="w-full glass-card p-8 rounded-3xl border border-slate-900 shadow-2xl text-center space-y-6">
              <div className="inline-flex p-4 bg-red-500/10 border border-red-500/20 rounded-full text-red-400 mb-2">
                <XCircle className="w-12 h-12" />
              </div>
              
              <h2 className="text-2xl font-bold text-slate-200">Thank You for Participating!</h2>
              <p className="text-slate-400 text-sm max-w-md mx-auto leading-relaxed">
                The qualifying round has ended. Unfortunately another team completed your route first.
              </p>
              <p className="text-slate-500 text-xs italic">
                Status: <span className="text-red-400 font-bold">❌ Eliminated</span>
              </p>

              <div className="flex justify-center gap-2">
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-red-500/10 text-red-400 border border-red-500/20">
                  ❌ Eliminated
                </span>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20">
                  👀 Spectator Mode Enabled
                </span>
              </div>

              <div className="flex gap-4 pt-4 max-w-md mx-auto">
                <button 
                  onClick={() => {
                    const el = document.getElementById('live-spectator-progress');
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="flex-1 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold transition-all text-xs"
                >
                  Watch Championship
                </button>
                <button 
                  onClick={() => navigate('/leaderboard')}
                  className="flex-1 py-3 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-850 text-slate-300 font-semibold text-xs"
                >
                  View Leaderboard
                </button>
              </div>
            </div>

            {/* Live progress section */}
            <div id="live-spectator-progress" className="w-full glass-card p-6 rounded-3xl border border-slate-900 text-left space-y-4">
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-widest mb-2 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-ping"></span> Live Finalists Progress
              </h3>
              <div className="space-y-5">
                {finalists.length === 0 ? (
                  <p className="text-xs text-slate-500 py-2">Waiting for finalists to initialize...</p>
                ) : (
                  finalists.map((f, i) => {
                    // Group clues to calculate progress % dynamically
                    const progress = f.progress_percent || 0;
                    const completed = f.completed_clues || 0;
                    const total = f.total_clues || 3;
                    return (
                      <div key={i} className="space-y-2 border-b border-slate-900/60 pb-4 last:border-0 last:pb-0">
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="text-sm font-bold text-slate-200">{f.team_name}</p>
                            <p className="text-[10px] text-slate-500 uppercase tracking-wider">{f.college_name || 'Symposium Finalist'}</p>
                          </div>
                          <div className="text-right">
                            <span className={`px-2.5 py-0.5 rounded text-[10px] font-black uppercase ${
                              f.status === 'finished' ? 'bg-green-500/10 text-green-400 border border-green-500/25 animate-pulse' : 'bg-purple-500/10 text-purple-400 border border-purple-500/25'
                            }`}>
                              {f.status === 'finished' ? '🏆 Winner' : `Clue #${f.current_sequence || 1}`}
                            </span>
                          </div>
                        </div>
                        
                        {/* Progress Bar */}
                        <div className="flex items-center gap-3">
                          <div className="flex-1 bg-slate-950 border border-slate-900 h-2.5 rounded-full overflow-hidden">
                            <div className="bg-gradient-to-r from-purple-500 to-pink-500 h-full rounded-full transition-all duration-500" style={{ width: `${progress}%` }}></div>
                          </div>
                          <span className="text-xs font-mono font-bold text-slate-400">{progress}% ({completed}/{total})</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {/* CASE 3: waiting_championship */}
        {(stateCase === 'waiting_championship' || (stateCase === 'qualified_winner' && tempOverrideWaiting)) && (
          <div className="w-full glass-card p-10 rounded-3xl border border-purple-500/20 shadow-2xl text-center space-y-6 animate-scaleUp">
            <div className="inline-flex p-5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 mb-2">
              <RefreshCw className="w-16 h-16 animate-spin text-purple-500" />
            </div>
            
            <h2 className="text-3xl font-extrabold text-slate-100">🏆 Championship Round</h2>
            <p className="text-slate-300 text-sm max-w-md mx-auto leading-relaxed">
              You have qualified for the Championship.
            </p>
            <p className="text-slate-400 text-xs max-w-md mx-auto italic font-bold">
              The next round will begin shortly. Waiting for the coordinator...
            </p>

            {/* Live Announcements */}
            {showGlobalBroadcast && (
              <div className="max-w-md mx-auto p-4 rounded-2xl bg-purple-950/40 border border-purple-500/30 text-purple-200 text-sm font-semibold flex items-start gap-3 shadow-lg shadow-purple-500/5 animate-pulse text-left relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 to-pink-500/5 pointer-events-none"></div>
                <span className="text-lg relative z-10">📢</span>
                <div className="relative z-10">
                  <p className="text-[9px] text-purple-400 font-bold uppercase tracking-widest mb-0.5">Announcement</p>
                  <p className="italic text-slate-200 font-medium">"{eventInfo.broadcast_message}"</p>
                </div>
              </div>
            )}

            <div className="max-w-md mx-auto p-4 bg-slate-950/60 border border-slate-900 rounded-2xl flex flex-col items-center gap-2">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Live Status</span>
              <span className="text-xs text-purple-300 font-mono animate-pulse">Setting up Round 2 checkpoints...</span>
            </div>

            {eventInfo?.countdown_timer_active && (
              <div className="my-2 text-slate-400 text-xs">
                Global Countdown: <span className="font-mono font-bold text-slate-200">{countdownText}</span>
              </div>
            )}
          </div>
        )}

        {/* CASE 5: grand_champion */}
        {stateCase === 'grand_champion' && countdownFinished && (
          <div className="w-full glass-card p-10 rounded-3xl border border-yellow-500/30 shadow-2xl text-center space-y-6 animate-scaleUp">
            <div className="inline-flex p-5 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 mb-2 animate-bounce">
              <Trophy className="w-20 h-20 text-yellow-400 filter drop-shadow-[0_0_15px_rgba(234,179,8,0.3)]" />
            </div>
            
            <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-amber-500 to-yellow-400 mb-2">
              🏆 GRAND CHAMPION
            </h1>
            <p className="text-slate-200 text-base max-w-md mx-auto leading-relaxed">
              Congratulations! You are the Treasure Hunt Champion.
            </p>
            <p className="text-slate-400 text-sm italic">
              Thank you for participating. You conquered the final round!
            </p>

            <div className="grid grid-cols-2 gap-4 max-w-md mx-auto text-left pt-2">
              <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4">
                <span className="text-[10px] text-slate-500 font-bold uppercase block mb-1">Final Rank</span>
                <span className="text-lg font-black text-yellow-400">🏆 Rank #1 Champion</span>
              </div>
              <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4">
                <span className="text-[10px] text-slate-500 font-bold uppercase block mb-1">Completion Time</span>
                <span className="text-lg font-bold text-slate-200 font-mono">
                  {team ? formatDuration(team.start_time, team.finish_time) : '-'}
                </span>
              </div>
            </div>

            <div className="flex justify-center pt-2">
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
                🥇 Champion
              </span>
            </div>

            <div className="flex gap-4 pt-4 max-w-md mx-auto">
              <button 
                onClick={() => navigate('/leaderboard')}
                className="flex-1 py-3.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold transition-all shadow-lg text-xs"
              >
                View Leaderboard
              </button>
              <button 
                onClick={() => toast.success("Certificate generation will be available soon!")}
                className="flex-1 py-3.5 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-850 text-slate-300 font-bold text-xs flex items-center justify-center gap-1.5 transition-all"
              >
                <Download className="w-4 h-4" /> Download Certificate
              </button>
            </div>
          </div>
        )}

        {/* CASE 6: championship_finalist_completed */}
        {stateCase === 'championship_finalist_completed' && countdownFinished && (
          <div className="w-full glass-card p-10 rounded-3xl border border-slate-800 shadow-2xl text-center space-y-6 animate-scaleUp">
            <div className="inline-flex p-5 rounded-full bg-slate-800 border border-slate-700 text-slate-400 mb-2">
              <Award className="w-16 h-16 text-slate-300" />
            </div>
            
            <h2 className="text-3xl font-bold text-slate-200">🥈 Congratulations!</h2>
            <p className="text-slate-400 text-sm max-w-md mx-auto leading-relaxed">
              You reached the Championship Final.
            </p>
            <p className="text-slate-500 text-xs italic">
              Thank you for participating.
            </p>

            <div className="grid grid-cols-2 gap-4 max-w-md mx-auto text-left pt-2">
              <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4">
                <span className="text-[10px] text-slate-500 font-bold uppercase block mb-1">Final Rank</span>
                <span className="text-lg font-bold text-slate-200 font-mono">{getTeamRank()}</span>
              </div>
              <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4">
                <span className="text-[10px] text-slate-500 font-bold uppercase block mb-1">Completion Time</span>
                <span className="text-lg font-bold text-slate-200 font-mono">
                  {team ? formatDuration(team.start_time, team.finish_time) : '-'}
                </span>
              </div>
            </div>

            <div className="flex justify-center gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-800 text-slate-300 border border-slate-700">
                🥈 Finalist
              </span>
            </div>

            <div className="max-w-md mx-auto pt-4">
              <button 
                onClick={() => navigate('/leaderboard')}
                className="w-full py-3 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl text-xs transition-all"
              >
                View Leaderboard
              </button>
            </div>
          </div>
        )}

        {/* CASE 7: timeout */}
        {stateCase === 'timeout' && countdownFinished && (
          <div className="w-full glass-card p-10 rounded-3xl border border-red-500/20 shadow-2xl text-center space-y-6 animate-scaleUp">
            <div className="inline-flex p-4 bg-red-500/10 border border-red-500/20 rounded-full text-red-400 mb-2">
              <Clock className="w-14 h-14 text-red-400 animate-pulse" />
            </div>
            
            <h2 className="text-3xl font-extrabold text-slate-200">⏰ Time's Up!</h2>
            <p className="text-slate-300 text-sm max-w-md mx-auto leading-relaxed font-bold">
              The event has ended.
            </p>
            <p className="text-slate-400 text-xs max-w-md mx-auto leading-relaxed">
              No further scans are accepted. Please proceed to the event stage.
            </p>

            <div className="inline-flex px-3 py-1 rounded-full text-xs font-bold bg-red-500/10 text-red-400 border border-red-500/20 animate-pulse">
              Event Closed
            </div>

            <div className="max-w-md mx-auto pt-4">
              <button 
                onClick={() => navigate('/leaderboard')}
                className="w-full py-3 bg-slate-900 border border-slate-800 hover:bg-slate-850 text-slate-300 font-bold rounded-xl text-xs transition-all"
              >
                View Leaderboard
              </button>
            </div>
          </div>
        )}

        {/* CASE 8: completed_result */}
        {stateCase === 'completed_result' && countdownFinished && (
          <div className="w-full glass-card p-10 rounded-3xl border border-slate-850 shadow-2xl text-center space-y-6 animate-scaleUp">
            <div className="inline-flex p-4 bg-purple-500/10 border border-purple-500/20 rounded-full inline-flex text-purple-400 mb-2">
              <Award className="w-14 h-14 text-purple-400" />
            </div>
            
            <h2 className="text-3xl font-black text-slate-200">Symposium Results</h2>
            <p className="text-slate-400 text-xs uppercase tracking-widest font-bold">AITHERON ML 2026</p>

            <div className="space-y-4 max-w-md mx-auto text-left bg-slate-950/60 border border-slate-900 p-6 rounded-3xl">
              <div className="flex justify-between items-center border-b border-slate-900 pb-2">
                <span className="text-xs text-slate-500 font-medium">Team Name</span>
                <span className="text-sm font-bold text-slate-200 truncate max-w-[200px]">{team?.team_name}</span>
              </div>
              <div className="flex justify-between items-center border-b border-slate-900 pb-2">
                <span className="text-xs text-slate-500 font-medium">Route</span>
                <span className="text-sm font-bold text-slate-200">{team?.route_id === 'championship' ? 'Championship Route' : 'Qualifying Route'}</span>
              </div>
              <div className="flex justify-between items-center border-b border-slate-900 pb-2">
                <span className="text-xs text-slate-500 font-medium">Completion Time</span>
                <span className="text-sm font-bold text-slate-200 font-mono">
                  {team?.finish_time ? formatDuration(team.start_time, team.finish_time) : 'Not Finished'}
                </span>
              </div>
              <div className="flex justify-between items-center border-b border-slate-900 pb-2">
                <span className="text-xs text-slate-500 font-medium">Final Position</span>
                <span className="text-sm font-black text-purple-400">{getTeamRank()}</span>
              </div>
              <div className="flex justify-between items-center pt-2">
                <span className="text-xs text-slate-500 font-medium">Result Badge</span>
                <span>
                  {team?.is_grand_winner ? (
                    <span className="px-2.5 py-0.5 rounded text-[9px] font-black bg-gradient-to-r from-yellow-500 to-amber-500 text-slate-950 uppercase border border-yellow-500/25">🥇 Champion</span>
                  ) : team?.route_id === 'championship' ? (
                    <span className="px-2.5 py-0.5 rounded text-[9px] font-black uppercase bg-slate-800 text-slate-300 border border-slate-700">🥈 Finalist</span>
                  ) : team?.is_qualifying_winner ? (
                    <span className="px-2.5 py-0.5 rounded text-[9px] font-black uppercase bg-green-500/10 text-green-400 border border-green-500/25">🏆 Qualified</span>
                  ) : eventInfo?.timeout ? (
                    <span className="px-2.5 py-0.5 rounded text-[9px] font-black uppercase bg-red-500/10 text-red-400 border border-red-500/25">⏰ Timed Out</span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded text-[9px] font-black uppercase bg-red-500/10 text-red-400 border border-red-500/25">❌ Eliminated</span>
                  )}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-slate-300 text-sm font-semibold">Thank You for Participating!</p>
              <p className="text-xs text-slate-500">See You Next Year!</p>
            </div>

            <div className="max-w-md mx-auto pt-4">
              <button 
                onClick={() => navigate('/leaderboard')}
                className="w-full py-3 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl text-xs transition-all"
              >
                View Leaderboard
              </button>
            </div>
          </div>
        )}

        {/* DEFAULT: Normal playing / paused / not started dashboard */}
        {['playing', 'paused', 'not_started', 'championship_playing', 'pre_event'].includes(stateCase) && (
          <>
            {/* Dashboard Grid */}
            <div className="grid md:grid-cols-3 gap-6 mb-8 text-left">
              {/* Status Card */}
              <div className="glass-card p-6 rounded-2xl flex flex-col justify-between animate-fadeIn">
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
                  {(team?.status === 'registered' || team?.status === 'waiting') && 'Checked-in. Scan the Start QR!'}
                  {team?.status === 'active' && 'Find your next checkpoint QR!'}
                  {team?.status === 'paused' && 'Scanning is temporarily disabled.'}
                </p>
              </div>
 
              {/* Timer Card */}
              <div className="glass-card p-6 rounded-2xl flex flex-col justify-between animate-fadeIn">
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
              <div className="glass-card p-6 rounded-2xl flex flex-col justify-between animate-fadeIn">
                <span className="text-xs text-slate-500 font-medium">COMPLETION</span>
                <div className="my-3">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-bold text-slate-300">Route Progress</span>
                    <span className="text-sm font-semibold text-purple-400">{getProgress()}%</span>
                  </div>
                  <div className="w-full bg-slate-900 border border-slate-800 h-2.5 rounded-full overflow-hidden mb-2">
                    <div 
                      className="bg-gradient-to-r from-purple-500 to-pink-500 h-full rounded-full transition-all duration-500" 
                      style={{ width: `${getProgress()}%` }}
                    ></div>
                  </div>
                </div>
                <div className="text-xs text-slate-400 font-bold space-y-1.5 pt-1">
                  <div className="flex justify-between text-purple-300 uppercase tracking-wider">
                    <span>Current:</span>
                    <span>{team?.status === 'finished' ? 'Completed Route' : `Clue ${team?.current_sequence || 1} / ${routeCluesCount}`}</span>
                  </div>
                  <div className="flex justify-between text-slate-500 uppercase tracking-wider text-[10px]">
                    <span>Completed:</span>
                    <span>{team?.status === 'finished' ? routeCluesCount : Math.max(0, (team?.current_sequence || 1) - 1)} / {routeCluesCount} Clues</span>
                  </div>
                  <div className="flex justify-between text-pink-400 uppercase tracking-wider text-[10px]">
                    <span>Pending:</span>
                    <span>{team?.status === 'finished' ? 0 : Math.max(0, routeCluesCount - (team?.current_sequence || 1) + 1)} Clue(s)</span>
                  </div>
                </div>
              </div>
            </div>
 
            {/* Members List */}
            {team?.member_names && (
              <div className="glass-card p-6 rounded-2xl mb-8 text-left animate-fadeIn">
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
            <div className="glass-card p-8 rounded-3xl mb-8 animate-fadeIn">
              {stateCase === 'pre_event' ? (
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
              ) : (team?.status === 'registered' || team?.status === 'checked_in' || team?.status === 'waiting') ? (
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
                  {showRouteBroadcast && (
                    <div className="mb-6 p-5 rounded-2xl bg-purple-950/40 border border-purple-500/35 text-purple-200 text-sm font-semibold flex items-start gap-3 shadow-lg shadow-purple-500/10 animate-pulse relative overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 to-pink-500/5 pointer-events-none"></div>
                      <span className="text-xl relative z-10">📢</span>
                      <div className="text-left relative z-10">
                        <p className="text-[9px] text-purple-400 font-extrabold uppercase tracking-[0.15em] mb-1">ADMIN BROADCAST HINT</p>
                        <p className="italic text-slate-100 font-medium text-xs leading-relaxed">"{team?.broadcast_hint || team?.broadcast_message || team?.current_hint || routeInfo?.broadcast_hint || routeInfo?.current_hint || routeInfo?.broadcast_message}"</p>
                      </div>
                    </div>
                  )}

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
            <div className="glass-card p-6 rounded-2xl text-left animate-fadeIn">
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
          </>
        )}
      </div>
    </div>
  );
}
