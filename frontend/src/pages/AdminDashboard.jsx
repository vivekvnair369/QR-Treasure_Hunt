import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  ShieldAlert, RefreshCw, LogOut, FileText, Download, Users, 
  Map, HelpCircle, Activity, Search, Trash2, Plus, Edit3, 
  Upload, X, Check, Clipboard, Printer, AlertTriangle, ArrowUpDown, ChevronLeft, ChevronRight, Award, Eye,
  Play, Pause, Square, Lock, Unlock, Settings, Database, AlertOctagon, MessageSquare, Volume2, Trophy, Clock
} from 'lucide-react';
import { 
  collection, doc, onSnapshot, getDocs, getDoc, addDoc, updateDoc, deleteDoc, 
  query, where, orderBy, limit, writeBatch, serverTimestamp, setDoc, Timestamp 
} from 'firebase/firestore';
import { db, firebaseConfig } from '../firebase/config';
import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, connectAuthEmulator } from 'firebase/auth';
import toast from 'react-hot-toast';
import QRCode from 'qrcode';
import confetti from 'canvas-confetti';

export default function AdminDashboard() {
  const { logout, user } = useAuth();
  const navigate = useNavigate();

  // Tab State
  const [activeTab, setActiveTab] = useState('overview'); // overview, teams, routes, clues, event, championship

  // Dashboard Lists
  const [teams, setTeams] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [clues, setClues] = useState([]);
  const [scanLogs, setScanLogs] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [eventData, setEventData] = useState(null);
  const [qrCodes, setQrCodes] = useState([]);

  // Search & Filters on Teams
  const [teamSearch, setTeamSearch] = useState('');
  const [teamFilter, setTeamFilter] = useState('all');
  const [teamRouteFilter, setTeamRouteFilter] = useState('all');

  // Pagination on Teams
  const [teamPage, setTeamPage] = useState(1);
  const teamsPerPage = 10;

  // Modals & Forms State
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [teamForm, setTeamForm] = useState({ 
    id: null, team_name: '', college_name: '', department: '', 
    leader_name: '', phone: '', leader_email: '', num_members: 1, 
    member_names: '', route_id: '', status: 'registered' 
  });

  const [showRouteModal, setShowRouteModal] = useState(false);
  const [routeForm, setRouteForm] = useState({ id: null, name: '' });

  const [showClueModal, setShowClueModal] = useState(false);
  const [clueForm, setClueForm] = useState({ id: null, route_id: '', sequence: '', clue_text: '', answer: '', hint: '', location_name: '', qr_id: '', enabled: true });

  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [generateForm, setGenerateForm] = useState({ num_routes: 3, route_prefix: 'Route' });

  // Event Config Form State
  const [eventConfig, setEventConfig] = useState({
    name: 'AITHERON ML 2026', description: '', venue: '', max_teams: 100, num_routes: 3, num_clues_per_route: 4, final_destination: '',
    registration_start: '', registration_end: '', event_start: '', event_end: '', max_time_limit_minutes: 90,
    countdown_timer_active: false, grace_time_minutes: 5, auto_close_on_expiry: true, status: 'draft',
    leaderboard_frozen: false, leaderboard_hidden: false, scans_locked: false
  });

  // Emergency Controls States
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [bonusTimeInput, setBonusTimeInput] = useState(10);
  const [penaltyTimeInput, setPenaltyTimeInput] = useState(5);
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcastHintText, setBroadcastHintText] = useState('');
  const [selectedBroadcastRoute, setSelectedBroadcastRoute] = useState('route_a');
  const [champBroadcastTarget, setChampBroadcastTarget] = useState('all_finalists'); // all_finalists, one_finalist, everyone
  const [champSelectedFinalistId, setChampSelectedFinalistId] = useState('');
  const [champBroadcastHintText, setChampBroadcastHintText] = useState('');

  const [broadcastAutoHide, setBroadcastAutoHide] = useState(false);
  const [broadcastDuration, setBroadcastDuration] = useState(5);
  const [champBroadcastAutoHide, setChampBroadcastAutoHide] = useState(false);
  const [champBroadcastDuration, setChampBroadcastDuration] = useState(5);
  const [broadcastsHistory, setBroadcastsHistory] = useState([]);

  const safeTimestampToInputString = (ts) => {
    if (!ts) return '';
    try {
      const date = ts.toDate ? ts.toDate() : (ts.seconds ? new Date(ts.seconds * 1000) : new Date(ts));
      if (!isNaN(date.getTime())) {
        const tzoffset = date.getTimezoneOffset() * 60000;
        return (new Date(date.getTime() - tzoffset)).toISOString().slice(0, 16);
      }
    } catch (e) {
      console.error("Error formatting date: ", e);
    }
    return '';
  };

  const safeFormatTime = (ts, showDate = false) => {
    if (!ts) return 'Just now';
    try {
      let date;
      if (ts && typeof ts.toDate === 'function') {
        date = ts.toDate();
      } else if (ts && typeof ts.seconds === 'number') {
        date = new Date(ts.seconds * 1000);
      } else if (ts instanceof Date) {
        date = ts;
      } else if (typeof ts === 'string' || typeof ts === 'number') {
        date = new Date(ts);
      } else {
        return 'Just now';
      }
      
      if (isNaN(date.getTime())) {
        return 'Just now';
      }
      
      if (showDate) {
        return date.toLocaleString();
      }
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch (e) {
      return 'Just now';
    }
  };

  // Trigger full-screen confetti when a grand champion is declared
  useEffect(() => {
    if (eventData?.championship_winner_id) {
      const duration = 5 * 1000;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 100 };

      function randomInRange(min, max) {
        return Math.random() * (max - min) + min;
      }

      const interval = setInterval(function() {
        const timeLeft = animationEnd - Date.now();

        if (timeLeft <= 0) {
          return clearInterval(interval);
        }

        const particleCount = 50 * (timeLeft / duration);
        confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
        confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
      }, 250);

      return () => clearInterval(interval);
    }
  }, [eventData?.championship_winner_id]);

  // 1. Real-time Firestore Subscriptions
  useEffect(() => {
    // A. Active Event subscription
    const unsubEvent = onSnapshot(query(collection(db, 'events'), where('active', '==', true), limit(1)), (snap) => {
      if (!snap.empty) {
        const ev = snap.docs[0].data();
        setEventData({ id: snap.docs[0].id, ...ev });
        setEventConfig({
          name: ev.name || 'AITHERON ML 2026',
          description: ev.description || '',
          venue: ev.venue || '',
          max_teams: ev.max_teams || 100,
          num_routes: ev.num_routes || 3,
          num_clues_per_route: ev.num_clues_per_route || 4,
          final_destination: ev.final_destination || '',
          registration_start: safeTimestampToInputString(ev.registration_start),
          registration_end: safeTimestampToInputString(ev.registration_end),
          event_start: safeTimestampToInputString(ev.event_start),
          event_end: safeTimestampToInputString(ev.event_end),
          max_time_limit_minutes: ev.max_time_limit_minutes || 90,
          countdown_timer_active: !!ev.countdown_timer_active,
          grace_time_minutes: ev.grace_time_minutes || 5,
          auto_close_on_expiry: !!ev.auto_close_on_expiry,
          status: ev.status || 'draft',
          leaderboard_frozen: !!ev.leaderboard_frozen,
          leaderboard_hidden: !!ev.leaderboard_hidden,
          scans_locked: !!ev.scans_locked
        });
      }
    });

    // B. Teams subscription
    const unsubTeams = onSnapshot(collection(db, 'teams'), (snap) => {
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTeams(list);
    });

    // C. Routes subscription
    const unsubRoutes = onSnapshot(collection(db, 'routes'), (snap) => {
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRoutes(list);
    });

    // D. Clues subscription
    const unsubClues = onSnapshot(collection(db, 'clues'), (snap) => {
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setClues(list);
    });

    // E. Scan Logs subscription
    const unsubScans = onSnapshot(query(collection(db, 'scanLogs'), orderBy('timestamp', 'desc'), limit(50)), (snap) => {
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setScanLogs(list);
    });

    // F. Audit Logs subscription
    const unsubAudit = onSnapshot(query(collection(db, 'auditLogs'), orderBy('timestamp', 'desc'), limit(50)), (snap) => {
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAuditLogs(list);
    });

    // G. QR Codes subscription
    const unsubQRCodes = onSnapshot(collection(db, 'qrCodes'), (snap) => {
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setQrCodes(list);
    });

    // H. Broadcasts subscription (Real-time History)
    const unsubBroadcasts = onSnapshot(query(collection(db, 'broadcasts'), orderBy('timestamp', 'desc'), limit(50)), (snap) => {
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setBroadcastsHistory(list);
    }, (err) => {
      console.error("Broadcasts history subscription error:", err);
    });

    return () => {
      unsubEvent();
      unsubTeams();
      unsubRoutes();
      unsubClues();
      unsubScans();
      unsubAudit();
      unsubQRCodes();
      unsubBroadcasts();
    };
  }, []);

  // Timers and Stats calculation
  const calculateElapsedSeconds = (t) => {
    if (!t.start_time) return 0;
    const start = t.start_time.seconds * 1000;
    const end = t.finish_time ? t.finish_time.seconds * 1000 : Date.now();
    let duration = (end - start) / 1000;
    let totalPause = t.total_paused_duration_seconds || 0;
    if (t.status === 'paused' && t.paused_at) {
      totalPause += (Date.now() - (t.paused_at.seconds * 1000)) / 1000;
    }
    duration = duration - totalPause - ((t.bonus_time_minutes || 0) * 60) + ((t.time_penalty_minutes || 0) * 60);
    return Math.max(0, Math.floor(duration));
  };

  const getStats = () => {
    const running = teams.filter(t => t.status === 'active').length;
    const finished = teams.filter(t => t.status === 'finished').length;
    const pending = teams.filter(t => ['registered', 'checked_in'].includes(t.status)).length;
    const totalHints = teams.reduce((acc, t) => acc + (t.hints_used || 0), 0);
    const totalScansVal = scanLogs.length;
    const wrongScansVal = scanLogs.filter(log => ['wrong_route', 'invalid_sequence'].includes(log.status)).length;
    const successRateVal = totalScansVal ? Math.round(((totalScansVal - wrongScansVal) / totalScansVal) * 100) : 0;
    
    const completedList = teams.filter(t => t.status === 'finished' && t.start_time && t.finish_time);
    let avgSec = 0;
    let fastTeam = '-';
    let slowTeam = '-';
    if (completedList.length > 0) {
      const times = completedList.map(t => calculateElapsedSeconds(t));
      avgSec = times.reduce((s, x) => s + x, 0) / times.length;
      
      let minVal = Infinity, maxVal = -1;
      completedList.forEach(t => {
        const el = calculateElapsedSeconds(t);
        if (el < minVal) { minVal = el; fastTeam = `${t.team_name} (${Math.floor(el/60)}m)`; }
        if (el > maxVal) { maxVal = el; slowTeam = `${t.team_name} (${Math.floor(el/60)}m)`; }
      });
    }

    return {
      running, finished, pending, totalHints, totalScansVal, wrongScansVal, successRateVal, avgSec, fastTeam, slowTeam
    };
  };

  const currentStats = getStats();

  const getTeamProgressPercent = (t) => {
    if (!t) return 0;
    if (t.status === 'finished' || t.status === 'completed') return 100;
    const routeClues = clues.filter(c => c.route_id === t.route_id);
    const total = routeClues.length || 3;
    const completed = Math.max(0, (t.current_sequence || 1) - 1);
    return (completed / total) * 100;
  };

  const getSortedLeaderboard = () => {
    const teamList = [...teams];
    const sortKey = (t) => {
      const progress = getTeamProgressPercent(t);
      const elapsed = calculateElapsedSeconds(t);
      const isWinner = t.is_grand_winner || t.is_qualifying_winner;
      
      if (t.status === 'finished' || isWinner) {
        return [0, elapsed, t.team_name];
      }
      if (t.status === 'active') {
        return [1, -progress, elapsed, t.team_name];
      }
      return [2, 0, 0, t.team_name];
    };
    return teamList.sort((a, b) => {
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

  const sortedLeaderboard = getSortedLeaderboard();

  const logAuditLocal = async (actionType, performedBy, ipAddress, affectedTeam, details) => {
    await addDoc(collection(db, 'auditLogs'), {
      action_type: actionType,
      performed_by: performedBy,
      timestamp: serverTimestamp(),
      ip_address: ipAddress || '127.0.0.1',
      affected_team: affectedTeam || null,
      details: details
    });
  };

  const updateLeaderboardDocLocal = async (teamId, teamData = null) => {
    if (!teamData) {
      const snap = await getDoc(doc(db, 'teams', teamId));
      if (snap.exists()) {
        teamData = snap.data();
      } else {
        return;
      }
    }
    
    let elapsedSeconds = 0;
    if (teamData.start_time) {
      const start = teamData.start_time.toMillis ? teamData.start_time.toMillis() : (teamData.start_time.seconds ? teamData.start_time.seconds * 1000 : new Date(teamData.start_time).getTime());
      const end = teamData.finish_time 
        ? (teamData.finish_time.toMillis ? teamData.finish_time.toMillis() : (teamData.finish_time.seconds ? teamData.finish_time.seconds * 1000 : new Date(teamData.finish_time).getTime()))
        : Date.now();
      let duration = (end - start) / 1000;
      
      let totalPause = teamData.total_paused_duration_seconds || 0;
      if (teamData.status === 'paused' && teamData.paused_at) {
        const pauseStart = teamData.paused_at.toMillis ? teamData.paused_at.toMillis() : (teamData.paused_at.seconds ? teamData.paused_at.seconds * 1000 : new Date(teamData.paused_at).getTime());
        totalPause += (Date.now() - pauseStart) / 1000;
      }
      
      duration = duration - totalPause - ((teamData.bonus_time_minutes || 0) * 60) + ((teamData.time_penalty_minutes || 0) * 60);
      elapsedSeconds = Math.max(0, Math.floor(duration));
    }

    // Calculate dynamic progress percent and counts
    const routeClues = clues.filter(c => c.route_id === (teamData.route_id || ""));
    const totalClues = routeClues.length || 3;
    const completedClues = teamData.status === 'finished' ? totalClues : Math.max(0, (teamData.current_sequence || 1) - 1);
    const progressPercent = Math.round((completedClues / totalClues) * 100);

    await setDoc(doc(db, 'leaderboard', teamId), {
      team_name: teamData.team_name,
      college_name: teamData.college_name || "",
      status: teamData.status,
      current_sequence: teamData.current_sequence || 1,
      elapsed_seconds: elapsedSeconds,
      hints_used: teamData.hints_used || 0,
      finish_time: teamData.finish_time || null,
      route_id: teamData.route_id || "",
      progress_percent: progressPercent,
      completed_clues: completedClues,
      total_clues: totalClues
    }, { merge: true });
  };

  // Control Action triggers
  const triggerEventAction = async (action, extra = {}) => {
    if (action === 'end' && !window.confirm('Are you sure you want to end the event?')) return;
    if (action === 'soft_reset' && !window.confirm("Are you sure you want to reset the event?\n\nThis will reset all gameplay progress and results, but will NOT delete any teams, routes, clues, QR codes, or authentication accounts.")) return;
    if (action === 'championship_soft_reset' && !window.confirm("Are you sure you want to reset the Championship? This will clear all finalist progress and reset Round 2, but will NOT affect qualifying round results.")) return;
    if (action === 'full_reset' && !window.confirm('⚠️ WARNING: Full reset wipes routes, clues, scan logs, and teams!')) return;

    try {
      toast.loading(`Applying ${action}...`);
      
      const eventRef = doc(db, 'events', 'active_event');
      const adminUser = user?.username || 'admin';
      const ip = '127.0.0.1';

      if (action === 'start') {
        await updateDoc(eventRef, {
          status: 'qualifying',
          event_start: serverTimestamp(),
          current_round: 1
        });
        await logAuditLocal('event_control', adminUser, ip, null, 'Admin launched the event qualifying round.');
      } else if (action === 'pause') {
        await updateDoc(eventRef, {
          status: 'paused',
          paused_at: serverTimestamp()
        });
        
        const batch = writeBatch(db);
        const activeTeams = teams.filter(t => t.status === 'active');
        activeTeams.forEach(t => {
          batch.update(doc(db, 'teams', t.id), {
            status: 'paused',
            paused_at: serverTimestamp()
          });
        });
        await batch.commit();
        await logAuditLocal('event_control', adminUser, ip, null, 'Suspended checkpoint scanning globally.');
      } else if (action === 'resume') {
        const eventDoc = await getDoc(eventRef);
        const eventData = eventDoc.data();
        const pauseStart = eventData.paused_at ? (eventData.paused_at.toMillis ? eventData.paused_at.toMillis() : eventData.paused_at.seconds * 1000) : Date.now();
        const pauseDur = Math.floor((Date.now() - pauseStart) / 1000);
        const prevPause = eventData.total_paused_duration_seconds || 0;
        const nextStatus = eventData.current_round === 2 ? 'championship' : 'qualifying';

        await updateDoc(eventRef, {
          status: nextStatus,
          paused_at: null,
          total_paused_duration_seconds: prevPause + pauseDur
        });

        const batch = writeBatch(db);
        const pausedTeams = teams.filter(t => t.status === 'paused');
        pausedTeams.forEach(t => {
          const tPauseStart = t.paused_at ? (t.paused_at.toMillis ? t.paused_at.toMillis() : t.paused_at.seconds * 1000) : Date.now();
          const tPauseDur = Math.floor((Date.now() - tPauseStart) / 1000);
          const tPrevPause = t.total_paused_duration_seconds || 0;
          batch.update(doc(db, 'teams', t.id), {
            status: 'active',
            paused_at: null,
            total_paused_duration_seconds: tPrevPause + tPauseDur
          });
        });
        await batch.commit();
        await logAuditLocal('event_control', adminUser, ip, null, 'Resumed the event. Scanning re-enabled.');
      } else if (action === 'end') {
        await updateDoc(eventRef, {
          status: 'completed',
          event_end: serverTimestamp()
        });

        const batch = writeBatch(db);
        const activeOrPausedTeams = teams.filter(t => ['active', 'paused'].includes(t.status));
        activeOrPausedTeams.forEach(t => {
          batch.update(doc(db, 'teams', t.id), {
            status: 'finished',
            finish_time: serverTimestamp()
          });
        });
        await batch.commit();
        await logAuditLocal('event_control', adminUser, ip, null, 'Event marked as completed. All active team timers stopped.');
      } else if (action === 'timeout') {
        if (!window.confirm('Are you sure you want to trigger Timeout? This stops all scans.')) return;
        await updateDoc(eventRef, {
          status: 'timeout',
          event_end: serverTimestamp()
        });

        const batch = writeBatch(db);
        const activeOrPausedTeams = teams.filter(t => ['active', 'paused'].includes(t.status));
        activeOrPausedTeams.forEach(t => {
          batch.update(doc(db, 'teams', t.id), {
            status: 'finished',
            finish_time: serverTimestamp()
          });
        });
        await batch.commit();
        await logAuditLocal('event_control', adminUser, ip, null, 'Event marked as timed out. All active team timers stopped.');
      } else if (action === 'lock_scans') {
        await updateDoc(eventRef, { scans_locked: true });
        await logAuditLocal('event_control', adminUser, ip, null, 'Locked scans globally.');
      } else if (action === 'unlock_scans') {
        await updateDoc(eventRef, { scans_locked: false });
        await logAuditLocal('event_control', adminUser, ip, null, 'Unlocked scans globally.');
      } else if (action === 'freeze_leaderboard') {
        await updateDoc(eventRef, { leaderboard_frozen: true });
        await logAuditLocal('event_control', adminUser, ip, null, 'Froze leaderboard updates.');
      } else if (action === 'unfreeze_leaderboard') {
        await updateDoc(eventRef, { leaderboard_frozen: false });
        await logAuditLocal('event_control', adminUser, ip, null, 'Unfroze leaderboard updates.');
      } else if (action === 'hide_leaderboard') {
        await updateDoc(eventRef, { leaderboard_hidden: true });
        await logAuditLocal('event_control', adminUser, ip, null, 'Hid leaderboard from team dashboards.');
      } else if (action === 'show_leaderboard') {
        await updateDoc(eventRef, { leaderboard_hidden: false });
        await logAuditLocal('event_control', adminUser, ip, null, 'Exposed leaderboard to team dashboards.');
      } else if (action === 'soft_reset') {
        const scanLogsSnaps = await getDocs(collection(db, 'scanLogs'));
        let batch = writeBatch(db);
        scanLogsSnaps.forEach(doc => batch.delete(doc.ref));
        await batch.commit();

        batch = writeBatch(db);
        teams.forEach(t => {
          const routeId = t.original_route_id || t.route_id;
          
          // Get first clue ID of the route
          const routeClues = clues.filter(c => c.route_id === routeId).sort((a, b) => (a.sequence || 1) - (b.sequence || 1));
          const firstClueId = routeClues.length > 0 ? routeClues[0].id : "";
          const totalClues = routeClues.length || 3;

          batch.update(doc(db, 'teams', t.id), {
            current_sequence: 1,
            completed: false,
            finish_time: null,
            finished_at: null,
            start_time: null,
            elapsed_time: 0,
            current_clue_id: firstClueId,
            last_scan_time: null,
            is_qualifying_winner: false,
            is_grand_winner: false,
            is_finalist: false,
            status: 'waiting',
            time_penalty_minutes: 0,
            bonus_time_minutes: 0,
            hints_used: 0,
            total_paused_duration_seconds: 0,
            paused_at: null,
            round: 1,
            route_id: routeId,
            progress_percent: 0,
            completed_clues: 0,
            total_clues: totalClues
          });
        });
        await batch.commit();

        // Reset Route Winners & Broadcast Hints
        batch = writeBatch(db);
        routes.forEach(r => {
          batch.update(doc(db, 'routes', r.id), {
            winner_team_id: null,
            winner_team_name: "",
            winner_finish_time: null,
            current_hint: "",
            broadcast_hint: "",
            broadcast_message: "",
            hint_updated_at: null
          });
        });
        await batch.commit();

        // Reset Leaderboard without deleting documents
        const lbSnaps = await getDocs(collection(db, 'leaderboard'));
        batch = writeBatch(db);
        lbSnaps.forEach(docSnap => {
          const teamId = docSnap.id;
          const t = teams.find(teamDoc => teamDoc.id === teamId);
          const routeId = t ? (t.original_route_id || t.route_id) : "";
          const routeClues = clues.filter(c => c.route_id === routeId);
          const totalClues = routeClues.length || 3;
          batch.update(docSnap.ref, {
            status: 'waiting',
            current_sequence: 1,
            elapsed_seconds: 0,
            hints_used: 0,
            finish_time: null,
            is_qualifying_winner: false,
            is_grand_winner: false,
            route_id: routeId,
            progress_percent: 0,
            completed_clues: 0,
            total_clues: totalClues
          });
        });
        await batch.commit();

        await updateDoc(eventRef, {
          current_round: 1,
          status: "qualifying",
          started_at: null,
          event_start: null,
          completed_at: null,
          winner_team_id: null,
          championship_started: false,
          broadcast_message: "",
          event_completed: false,
          timeout: false,
          paused_at: null,
          total_paused_duration_seconds: 0,
          championship_winner_id: "",
          championship_winner_name: ""
        });
        
        toast.dismiss(); // dismiss loading toast
        toast.success(
          <div>
            <strong>✅ Event has been successfully reset.</strong>
            <div className="text-[10px] mt-1 text-slate-400">All gameplay progress has been cleared.</div>
            <div className="text-[10px] text-slate-400">Teams, routes, clues, QR codes, and authentication accounts have been preserved.</div>
          </div>,
          { duration: 5000 }
        );
        await logAuditLocal('event_control', adminUser, ip, null, 'Soft reset completed. All gameplay progress has been cleared.');
      } else if (action === 'championship_soft_reset') {
        let batch = writeBatch(db);
        const finalists = teams.filter(t => t.route_id === 'championship' || t.is_finalist);
        const champClues = clues.filter(c => c.route_id === 'championship').sort((a, b) => (a.sequence || 1) - (b.sequence || 1));
        const firstClueId = champClues.length > 0 ? champClues[0].id : "";
        const totalClues = champClues.length || 3;

        finalists.forEach(t => {
          batch.update(doc(db, 'teams', t.id), {
            status: 'active',
            start_time: serverTimestamp(),
            current_sequence: 1,
            completed: false,
            finish_time: null,
            finished_at: null,
            elapsed_time: 0,
            total_paused_duration_seconds: 0,
            paused_at: null,
            is_grand_winner: false,
            current_clue_id: firstClueId,
            progress_percent: 0,
            completed_clues: 0,
            total_clues: totalClues,
            broadcast_hint: "",
            broadcast_message: "",
            current_hint: "",
            broadcast_hint_auto_hide: false,
            broadcast_message_auto_hide: false,
            broadcast_hint_hide_at: null,
            broadcast_message_hide_at: null,
            broadcast_hint_updated_at: null
          });
          
          batch.update(doc(db, 'leaderboard', t.id), {
            status: 'active',
            current_sequence: 1,
            elapsed_seconds: 0,
            finish_time: null,
            is_grand_winner: false,
            route_id: 'championship',
            progress_percent: 0,
            completed_clues: 0,
            total_clues: totalClues
          });
        });

        // Clear championship route broadcast hint
        const champRouteRef = doc(db, 'routes', 'championship');
        batch.update(champRouteRef, {
          broadcast_hint: "",
          broadcast_message: "",
          current_hint: "",
          broadcast_hint_auto_hide: false,
          broadcast_message_auto_hide: false,
          broadcast_hint_hide_at: null,
          broadcast_message_hide_at: null,
          broadcast_hint_updated_at: null
        });

        batch.update(eventRef, {
          status: 'championship',
          current_round: 2,
          event_start: serverTimestamp(),
          paused_at: null,
          total_paused_duration_seconds: 0,
          scans_locked: false,
          championship_winner_id: "",
          championship_winner_name: "",
          broadcast_message: "",
          broadcast_hint: "",
          current_hint: "",
          broadcast_message_auto_hide: false,
          broadcast_hint_auto_hide: false,
          broadcast_message_hide_at: null,
          broadcast_hint_hide_at: null,
          broadcast_message_updated_at: null
        });

        await batch.commit();

        const scanLogsSnaps = await getDocs(collection(db, 'scanLogs'));
        batch = writeBatch(db);
        let deletedLogsCount = 0;
        scanLogsSnaps.forEach(logDoc => {
          const lData = logDoc.data();
          if (lData.route_id === 'championship' || finalists.some(f => f.id === lData.team_id)) {
            batch.delete(logDoc.ref);
            deletedLogsCount++;
          }
        });
        if (deletedLogsCount > 0) {
          await batch.commit();
        }

        toast.dismiss();
        toast.success("Championship progress has been successfully reset!");
        await logAuditLocal('event_control', adminUser, ip, null, 'Championship Soft Reset completed.');
      } else if (action === 'full_reset') {
        let batch = writeBatch(db);
        const scanLogsSnaps = await getDocs(collection(db, 'scanLogs'));
        scanLogsSnaps.forEach(doc => batch.delete(doc.ref));
        const teamsSnaps = await getDocs(collection(db, 'teams'));
        teamsSnaps.forEach(doc => batch.delete(doc.ref));
        const lbSnaps = await getDocs(collection(db, 'leaderboard'));
        lbSnaps.forEach(doc => batch.delete(doc.ref));
        const cluesSnaps = await getDocs(collection(db, 'clues'));
        cluesSnaps.forEach(doc => batch.delete(doc.ref));
        const routesSnaps = await getDocs(collection(db, 'routes'));
        routesSnaps.forEach(doc => batch.delete(doc.ref));
        await batch.commit();

        await updateDoc(eventRef, {
          status: 'draft',
          paused_at: null,
          total_paused_duration_seconds: 0
        });
        await logAuditLocal('event_control', adminUser, ip, null, 'CRITICAL: Full reset completed. Cleared database completely.');
      }

      toast.dismiss();
      toast.success(`Action '${action}' applied successfully.`);
    } catch (err) {
      toast.dismiss();
      toast.error(err.message || 'Failed to update event state.');
    }
  };

  const triggerTeamOverride = async (teamId, action, extra = {}) => {
    try {
      toast.loading(`Applying override...`);
      
      const teamRef = doc(db, 'teams', teamId);
      const teamSnap = await getDoc(teamRef);
      if (!teamSnap.exists()) {
        throw new Error('Team not found.');
      }
      const teamData = teamSnap.data();
      const adminEmail = user?.username || 'admin';
      const ip = '127.0.0.1';

      const updates = {};
      let auditDetails = '';

      if (action === 'unlock_next') {
        const nextSeq = teamData.current_sequence + 1;
        updates.current_sequence = nextSeq;
        auditDetails = `Manually unlocked next sequence (${nextSeq}) clue.`;
      } else if (action === 'skip_current') {
        const nextSeq = teamData.current_sequence + 1;
        updates.current_sequence = nextSeq;
        auditDetails = `Skipped checkpoint sequence ${teamData.current_sequence}.`;
      } else if (action === 'restart') {
        updates.start_time = null;
        updates.finish_time = null;
        updates.status = 'registered';
        updates.current_sequence = 1;
        updates.time_penalty_minutes = 0;
        updates.bonus_time_minutes = 0;
        updates.hints_used = 0;
        updates.total_paused_duration_seconds = 0;
        updates.paused_at = null;
        auditDetails = 'Wiped and reset all progress.';
      } else if (action === 'mark_completed') {
        updates.status = 'finished';
        updates.finish_time = serverTimestamp();
        auditDetails = 'Forced status completion.';
      } else if (action === 'bonus_time') {
        updates.bonus_time_minutes = (teamData.bonus_time_minutes || 0) + (extra.bonus_time_minutes || 0);
        auditDetails = `Awarded ${extra.bonus_time_minutes} minutes bonus time.`;
      } else if (action === 'time_penalty') {
        updates.time_penalty_minutes = (teamData.time_penalty_minutes || 0) + (extra.penalty_minutes || 0);
        auditDetails = `Applied ${extra.penalty_minutes} minutes penalty.`;
      } else if (action === 'pause') {
        updates.status = 'paused';
        updates.paused_at = serverTimestamp();
        auditDetails = 'Paused team timer.';
      } else if (action === 'resume') {
        const pauseStart = teamData.paused_at ? (teamData.paused_at.toMillis ? teamData.paused_at.toMillis() : teamData.paused_at.seconds * 1000) : Date.now();
        const pauseDur = Math.floor((Date.now() - pauseStart) / 1000);
        const prevPause = teamData.total_paused_duration_seconds || 0;
        updates.status = 'active';
        updates.paused_at = null;
        updates.total_paused_duration_seconds = prevPause + pauseDur;
        auditDetails = 'Resumed team timer.';
      }

      // Calculate dynamic progress details based on override updates
      const finalSeq = updates.status === 'finished' ? teamData.current_sequence : (updates.current_sequence !== undefined ? updates.current_sequence : teamData.current_sequence);
      const finalStatus = updates.status !== undefined ? updates.status : teamData.status;
      const routeClues = clues.filter(c => c.route_id === teamData.route_id);
      const totalClues = routeClues.length || 3;
      const completedCluesCount = finalStatus === 'finished' ? totalClues : Math.max(0, finalSeq - 1);
      const progressPercent = Math.round((completedCluesCount / totalClues) * 100);

      updates.progress_percent = progressPercent;
      updates.completed_clues = completedCluesCount;
      updates.total_clues = totalClues;

      await updateDoc(teamRef, updates);
      await logAuditLocal('manual_override', adminEmail, ip, teamData.team_name, auditDetails);
      
      const mergedTeamData = { ...teamData, ...updates };
      if (updates.finish_time === serverTimestamp()) mergedTeamData.finish_time = new Date();
      if (updates.paused_at === serverTimestamp()) mergedTeamData.paused_at = new Date();
      await updateLeaderboardDocLocal(teamId, mergedTeamData);

      toast.dismiss();
      toast.success('Override applied.');
    } catch (err) {
      toast.dismiss();
      toast.error(err.message || 'Override failed.');
    }
  };

  const handleAdvanceToChampionship = async () => {
    // Find qualifying winners (those with is_qualifying_winner === true)
    const winners = teams.filter(t => t.is_qualifying_winner === true);
    if (winners.length === 0) {
      toast.error("No route winners qualified yet! Block winners must complete first.");
      return;
    }
    if (!window.confirm(`Are you sure you want to advance the following ${winners.length} teams to the Championship Round: ${winners.map(w => w.team_name).join(', ')}?`)) {
      return;
    }
    
    try {
      toast.loading('Starting Championship Round...');
      const batch = writeBatch(db);
      
      // Update active event status
      const eventRef = doc(db, 'events', 'active_event');
      batch.update(eventRef, {
        current_round: 2,
        status: 'championship',
        championship_started: true,
        championship_winner_id: "",
        championship_winner_name: "",
        event_start: serverTimestamp(),
        total_paused_duration_seconds: 0
      });
      
      // Promote finalists
      const champClues = clues.filter(c => c.route_id === 'championship');
      const totalChampClues = champClues.length || 3;

      winners.forEach(w => {
        const teamRef = doc(db, 'teams', w.id);
        batch.update(teamRef, {
          route_id: 'championship',
          current_sequence: 1,
          status: 'active',
          start_time: serverTimestamp(),
          round: 2,
          hints_used: 0,
          bonus_time_minutes: 0,
          time_penalty_minutes: 0,
          finish_time: null,
          is_grand_winner: false,
          progress_percent: 0,
          completed_clues: 0,
          total_clues: totalChampClues
        });
        
        const leaderboardRef = doc(db, 'leaderboard', w.id);
        batch.set(leaderboardRef, {
          team_name: w.team_name,
          college_name: w.college_name || "",
          route_id: 'championship',
          current_sequence: 1,
          status: 'active',
          elapsed_seconds: 0,
          hints_used: 0,
          finish_time: null,
          is_grand_winner: false,
          progress_percent: 0,
          completed_clues: 0,
          total_clues: totalChampClues
        }, { merge: true });
      });
      
      await batch.commit();
      toast.dismiss();
      toast.success('Championship Round active! Finalists promoted.');
      await logAuditLocal('start_championship', 'admin', '127.0.0.1', null, `Admin started the Championship Round with ${winners.length} finalists.`);
    } catch (err) {
      toast.dismiss();
      toast.error(err.message || 'Promotion failed.');
    }
  };

  const handleChampionshipBroadcast = async (e) => {
    e.preventDefault();
    if (!champBroadcastHintText.trim()) {
      toast.error("Please enter a hint message.");
      return;
    }
    
    toast.loading("Sending hint broadcast...");
    try {
      const batch = writeBatch(db);
      const adminUser = user?.username || 'admin';
      const hideAt = champBroadcastAutoHide ? new Date(Date.now() + Number(champBroadcastDuration) * 60 * 1000) : null;
      
      let targetRouteId = 'championship';
      let targetRouteName = 'Championship Route';

      if (champBroadcastTarget === 'all_finalists') {
        const routeRef = doc(db, 'routes', 'championship');
        batch.update(routeRef, { 
          broadcast_hint: champBroadcastHintText.trim(),
          broadcast_message: champBroadcastHintText.trim(),
          current_hint: champBroadcastHintText.trim(),
          broadcast_hint_auto_hide: champBroadcastAutoHide,
          broadcast_message_auto_hide: champBroadcastAutoHide,
          broadcast_hint_hide_at: hideAt,
          broadcast_message_hide_at: hideAt,
          broadcast_updated_at: serverTimestamp(),
          broadcast_hint_updated_at: serverTimestamp(),
          hint_updated_at: serverTimestamp()
        });
        await logAuditLocal('broadcast_hint', adminUser, '127.0.0.1', null, `Admin broadcasted hint to all finalists: "${champBroadcastHintText}"`);
      } else if (champBroadcastTarget === 'one_finalist') {
        if (!champSelectedFinalistId) {
          throw new Error("Please select a target finalist.");
        }
        const targetTeam = teams.find(t => t.id === champSelectedFinalistId);
        const teamRef = doc(db, 'teams', champSelectedFinalistId);
        batch.update(teamRef, { 
          broadcast_hint: champBroadcastHintText.trim(),
          broadcast_message: champBroadcastHintText.trim(),
          current_hint: champBroadcastHintText.trim(),
          broadcast_hint_auto_hide: champBroadcastAutoHide,
          broadcast_message_auto_hide: champBroadcastAutoHide,
          broadcast_hint_hide_at: hideAt,
          broadcast_message_hide_at: hideAt,
          broadcast_updated_at: serverTimestamp(),
          broadcast_hint_updated_at: serverTimestamp(),
          hint_updated_at: serverTimestamp()
        });
        targetRouteId = targetTeam?.route_id || 'championship';
        targetRouteName = `Team: ${targetTeam?.team_name || 'Finalist'}`;
        await logAuditLocal('broadcast_hint', adminUser, '127.0.0.1', targetTeam?.team_name || null, `Admin broadcasted hint to team ${targetTeam?.team_name}: "${champBroadcastHintText}"`);
      } else if (champBroadcastTarget === 'everyone') {
        const eventRef = doc(db, 'events', 'active_event');
        batch.update(eventRef, { 
          broadcast_message: champBroadcastHintText.trim(),
          broadcast_hint: champBroadcastHintText.trim(),
          current_hint: champBroadcastHintText.trim(),
          broadcast_message_auto_hide: champBroadcastAutoHide,
          broadcast_hint_auto_hide: champBroadcastAutoHide,
          broadcast_message_hide_at: hideAt,
          broadcast_hint_hide_at: hideAt,
          broadcast_message_updated_at: serverTimestamp(),
          broadcast_hint_updated_at: serverTimestamp(),
          broadcast_updated_at: serverTimestamp(),
          hint_updated_at: serverTimestamp()
        });
        routes.forEach(r => {
          batch.update(doc(db, 'routes', r.id), { 
            broadcast_hint: champBroadcastHintText.trim(),
            broadcast_message: champBroadcastHintText.trim(),
            current_hint: champBroadcastHintText.trim(),
            broadcast_hint_auto_hide: champBroadcastAutoHide,
            broadcast_message_auto_hide: champBroadcastAutoHide,
            broadcast_hint_hide_at: hideAt,
            broadcast_message_hide_at: hideAt,
            broadcast_updated_at: serverTimestamp(),
            broadcast_hint_updated_at: serverTimestamp(),
            hint_updated_at: serverTimestamp()
          });
        });
        targetRouteId = 'everyone';
        targetRouteName = 'Everyone';
        await logAuditLocal('broadcast_hint', adminUser, '127.0.0.1', null, `Admin broadcasted message to everyone: "${champBroadcastHintText}"`);
      }

      // Add to broadcast history
      const historyRef = doc(collection(db, 'broadcasts'));
      batch.set(historyRef, {
        route_id: targetRouteId,
        route_name: targetRouteName,
        message: champBroadcastHintText.trim(),
        timestamp: serverTimestamp(),
        auto_hide: champBroadcastAutoHide,
        duration_minutes: champBroadcastAutoHide ? Number(champBroadcastDuration) : null,
        hide_at: hideAt,
        status: 'active'
      });
      
      await batch.commit();
      setChampBroadcastHintText('');
      toast.dismiss();
      toast.success("Broadcast hint sent successfully!");
    } catch (err) {
      toast.dismiss();
      toast.error(err.message || "Failed to send broadcast hint.");
    }
  };

  const handleBroadcastHint = async (e) => {
    e.preventDefault();
    if (!broadcastHintText.trim()) {
      toast.error("Please enter a hint message.");
      return;
    }
    try {
      toast.loading(`Broadcasting hint...`);
      const routeRef = doc(db, 'routes', selectedBroadcastRoute);
      const hideAt = broadcastAutoHide ? new Date(Date.now() + Number(broadcastDuration) * 60 * 1000) : null;
      
      const batch = writeBatch(db);
      
      // Update route
      batch.update(routeRef, {
        broadcast_hint: broadcastHintText.trim(),
        broadcast_message: broadcastHintText.trim(),
        current_hint: broadcastHintText.trim(),
        broadcast_hint_auto_hide: broadcastAutoHide,
        broadcast_message_auto_hide: broadcastAutoHide,
        broadcast_hint_hide_at: hideAt,
        broadcast_message_hide_at: hideAt,
        broadcast_updated_at: serverTimestamp(),
        broadcast_hint_updated_at: serverTimestamp(),
        hint_updated_at: serverTimestamp()
      });
      
      // Add broadcast history
      const historyRef = doc(collection(db, 'broadcasts'));
      batch.set(historyRef, {
        route_id: selectedBroadcastRoute,
        route_name: getRouteName(selectedBroadcastRoute),
        message: broadcastHintText.trim(),
        timestamp: serverTimestamp(),
        auto_hide: broadcastAutoHide,
        duration_minutes: broadcastAutoHide ? Number(broadcastDuration) : null,
        hide_at: hideAt,
        status: 'active'
      });
      
      await batch.commit();
      
      toast.dismiss();
      toast.success(`Hint broadcasted to ${getRouteName(selectedBroadcastRoute)}.`);
      await logAuditLocal('broadcast_hint', 'admin', '127.0.0.1', null, `Admin broadcasted hint to route ${selectedBroadcastRoute}: "${broadcastHintText}"`);
      setBroadcastHintText('');
    } catch (err) {
      toast.dismiss();
      console.error(err);
      toast.error('Failed to broadcast hint.');
    }
  };

  const handleClearBroadcast = async (routeId) => {
    try {
      toast.loading('Clearing broadcast...');
      const routeRef = doc(db, 'routes', routeId);
      
      const batch = writeBatch(db);
      
      // Clear route
      batch.update(routeRef, {
        broadcast_hint: "",
        broadcast_message: "",
        current_hint: "",
        broadcast_hint_auto_hide: false,
        broadcast_message_auto_hide: false,
        broadcast_hint_hide_at: null,
        broadcast_message_hide_at: null,
        broadcast_updated_at: serverTimestamp(),
        broadcast_hint_updated_at: serverTimestamp(),
        hint_updated_at: serverTimestamp()
      });
      
      // Add a history item for clearing
      const historyRef = doc(collection(db, 'broadcasts'));
      batch.set(historyRef, {
        route_id: routeId,
        route_name: getRouteName(routeId),
        message: " [Cleared Broadcast] ",
        timestamp: serverTimestamp(),
        auto_hide: false,
        duration_minutes: null,
        hide_at: null,
        status: 'cleared'
      });
      
      await batch.commit();
      
      toast.dismiss();
      toast.success(`Cleared hint for ${getRouteName(routeId)}.`);
      await logAuditLocal('clear_broadcast', 'admin', '127.0.0.1', null, `Admin cleared broadcast hint for route ${routeId}`);
    } catch (err) {
      toast.dismiss();
      console.error(err);
      toast.error('Failed to clear broadcast.');
    }
  };

  const saveEventConfiguration = async (e) => {
    e.preventDefault();
    try {
      toast.loading('Saving Event config...');
      
      const eventRef = doc(db, 'events', 'active_event');
      const updatedConfig = { ...eventConfig };
      
      const dateFields = ['registration_start', 'registration_end', 'event_start', 'event_end'];
      dateFields.forEach(field => {
        if (updatedConfig[field]) {
          if (typeof updatedConfig[field] === 'string') {
            const date = new Date(updatedConfig[field]);
            if (!isNaN(date.getTime())) {
              updatedConfig[field] = Timestamp.fromDate(date);
            } else {
              updatedConfig[field] = null;
            }
          }
        } else {
          updatedConfig[field] = null;
        }
      });

      await updateDoc(eventRef, updatedConfig);
      
      const adminUser = user?.username || 'admin';
      await logAuditLocal('restore_config', adminUser, '127.0.0.1', null, 'Imported and restored event configuration.');

      toast.dismiss();
      toast.success('Event configuration saved.');
    } catch (err) {
      toast.dismiss();
      toast.error(err.message || 'Failed to save config.');
    }
  };

  const handleBackupDownload = async () => {
    try {
      const eventRef = doc(db, 'events', 'active_event');
      const snapshot = await getDoc(eventRef);
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(snapshot.data(), null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `aitheron_firebase_backup.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      toast.success('JSON Backup downloaded.');
    } catch (err) {
      toast.error('Failed to export backup.');
    }
  };

  const handleBackupUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        
        const eventRef = doc(db, 'events', 'active_event');
        const updatedConfig = { ...parsed };
        
        const dateFields = ['registration_start', 'registration_end', 'event_start', 'event_end'];
        dateFields.forEach(field => {
          if (updatedConfig[field]) {
            if (updatedConfig[field].seconds) {
              updatedConfig[field] = new Timestamp(updatedConfig[field].seconds, updatedConfig[field].nanoseconds);
            } else if (typeof updatedConfig[field] === 'string') {
              const date = new Date(updatedConfig[field]);
              if (!isNaN(date.getTime())) {
                updatedConfig[field] = Timestamp.fromDate(date);
              } else {
                updatedConfig[field] = null;
              }
            }
          } else {
            updatedConfig[field] = null;
          }
        });

        await updateDoc(eventRef, updatedConfig);
        toast.success('JSON Config restored.');
      } catch (err) {
        toast.error('Invalid configuration file.');
      }
    };
    reader.readAsText(file);
  };

  // CSV Exporters
  const downloadAuditLogs = async () => {
    try {
      let csv = 'Action,Performed By,Timestamp,IP Address,Affected Team,Details\n';
      auditLogs.forEach(d => {
        const t = safeFormatTime(d.timestamp, true);
        csv += `"${d.action_type || ''}","${d.performed_by || ''}","${t}","${d.ip_address || ''}","${d.affected_team || ''}","${(d.details || '').replace(/"/g, '""')}"\n`;
      });
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'audit_logs.csv';
      a.click();
    } catch (e) {
      toast.error('CSV export failed.');
    }
  };

  const downloadScanLogs = async () => {
    try {
      let csv = 'Team,QR ID,Status,Timestamp,Device,IP Address\n';
      scanLogs.forEach(d => {
        const t = safeFormatTime(d.timestamp, true);
        csv += `"${d.team_name || ''}","${d.qr_id || ''}","${d.status || ''}","${t}","${d.device || ''}","${d.ip_address || ''}"\n`;
      });
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'scan_logs.csv';
      a.click();
    } catch (e) {
      toast.error('CSV export failed.');
    }
  };

  const handleExport = async (type) => {
    try {
      let csv = 'Rank,Team Name,Status,Sequence,Elapsed Time (Secs),Hints Used\n';
      sortedLeaderboard.forEach((t, i) => {
        csv += `"${i+1}","${t.team_name}","${t.status}","${t.current_sequence || 1}","${calculateElapsedSeconds(t)}","${t.hints_used || 0}"\n`;
      });
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `leaderboard_${type}.csv`;
      a.click();
      toast.success('Leaderboard exported successfully!');
    } catch (e) {
      toast.error('Failed to export leaderboard.');
    }
  };

  // CSV Parser
  const parseCSV = (text) => {
    const lines = text.split('\n');
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
    const result = [];
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      const currentline = lines[i].split(',').map(c => c.trim().replace(/"/g, ''));
      const obj = {};
      for (let j = 0; j < headers.length; j++) {
        obj[headers[j]] = currentline[j];
      }
      result.push(obj);
    }
    return result;
  };

  const fileInputRef = useRef(null);
  const handleCSVUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const teamsList = parseCSV(evt.target.result);
        if (teamsList.length === 0) {
          toast.error("No valid teams found in CSV.");
          return;
        }
        toast.loading('Importing teams...');
        const batch = writeBatch(db);
        teamsList.forEach(t => {
          const newTeamRef = doc(collection(db, 'teams'));
          const code = 'T-' + Math.random().toString(36).substring(2, 6).toUpperCase();
          batch.set(newTeamRef, {
            team_name: t.team_name || t.name || 'Unnamed Team',
            college_name: t.college_name || '',
            department: t.department || '',
            leader_name: t.leader_name || '',
            phone: t.phone || '',
            leader_email: t.leader_email || '',
            num_members: parseInt(t.num_members || 1),
            member_names: t.member_names || '',
            team_code: code,
            route_id: '',
            status: 'registered',
            current_sequence: 1,
            time_penalty_minutes: 0,
            bonus_time_minutes: 0,
            hints_used: 0,
            total_paused_duration_seconds: 0,
            paused_at: null
          });
        });
        await batch.commit();
        toast.dismiss();
        toast.success(`${teamsList.length} teams imported successfully!`);
      } catch (err) {
        toast.dismiss();
        toast.error('Failed to parse and import CSV file.');
      }
    };
    reader.readAsText(file);
  };

  const handleAutoBalance = async () => {
    try {
      toast.loading('Auto-balancing teams...');
      const batch = writeBatch(db);
      if (routes.length === 0) {
        toast.dismiss();
        toast.error('No routes found. Create routes first.');
        return;
      }
      
      let idx = 0;
      teams.forEach(t => {
        const routeId = routes[idx % routes.length].id;
        batch.update(doc(db, 'teams', t.id), { route_id: routeId });
        idx++;
      });
      await batch.commit();
      toast.dismiss();
      toast.success('Auto-balanced routes successfully!');
    } catch (err) {
      toast.dismiss();
      toast.error('Auto-balancing failed.');
    }
  };

  const handleBulkGenerateRoutes = async (e) => {
    e.preventDefault();
    toast.loading('Generating routes...');
    try {
      const batch = writeBatch(db);
      
      for (let i = 1; i <= generateForm.num_routes; i++) {
        const rName = `${generateForm.route_prefix} ${String.fromCharCode(64 + i)}`;
        const rRef = doc(collection(db, 'routes'));
        batch.set(rRef, { name: rName, created_at: serverTimestamp() });
        
        const cluesPool = [
          { location_name: 'Library', clue_text: 'I have thousands of sheets but no beds, thousands of stories but no dreams.', answer: 'Library', hint: 'Go to the Central Library' },
          { location_name: 'AI Lab', clue_text: 'Where silicon chips meet artificial minds, and future software takes its designs.', answer: 'AI Lab', hint: 'Computer Science Department' },
          { location_name: 'Mechanical Block', clue_text: 'Listen to the gears grind and engines roar, where mechanical dreams take flight and soar.', answer: 'Mechanical Block', hint: 'Workshop Area' },
          { location_name: 'Canteen', clue_text: 'Where coffee brews and hunger dies, under the smell of hot samosa pies.', answer: 'Canteen', hint: 'Snack Joint' }
        ];

        let seq = 1;
        for (const rawClue of cluesPool) {
          const cRef = doc(collection(db, 'clues'));
          const qrRef = doc(collection(db, 'qrCodes'));
          const secret = Math.random().toString(36).substring(2, 10);
          
          batch.set(qrRef, {
            qr_id: qrRef.id,
            clue_id: cRef.id,
            secret_token: secret
          });
          
          batch.set(cRef, {
            route_id: rRef.id,
            sequence: seq,
            clue_text: rawClue.clue_text,
            answer: rawClue.answer,
            hint: rawClue.hint,
            location_name: rawClue.location_name,
            qr_id: qrRef.id,
            enabled: true,
            placement_status: 'not_placed'
          });
          seq++;
        }
      }
      
      await batch.commit();
      toast.dismiss();
      toast.success('Routes and QR clues successfully bulk-generated!');
      setShowGenerateModal(false);
    } catch (err) {
      toast.dismiss();
      toast.error('Failed to generate routes.');
    }
  };

  const handleGenerateChampionshipClues = async () => {
    toast.loading('Generating championship clues...');
    try {
      const batch = writeBatch(db);
      
      // Ensure championship route exists
      const routeRef = doc(db, 'routes', 'championship');
      batch.set(routeRef, { 
        name: "Championship Route", 
        winner_team_id: "", 
        winner_team_name: "", 
        winner_finish_time: null, 
        broadcast_hint: "" 
      }, { merge: true });

      const defaultChampClues = [
        { location_name: 'Admin Block Plaza', clue_text: 'Where the national flag flies high and proud, in front of the main building\'s crowd.', answer: 'Admin Block Plaza', hint: 'Main Flagpole' },
        { location_name: 'College Ground', clue_text: 'Where green grass grows and athletes run, playing football or cricket in the sun.', answer: 'College Ground', hint: 'Sports Field Pavilion' },
        { location_name: 'Auditorium', clue_text: 'The final hall where winners are crowned, where the loudest cheers and applause resound.', answer: 'Auditorium', hint: 'Main Auditorium Building' }
      ];

      let seq = 1;
      for (const clue of defaultChampClues) {
        const cId = `clue_championship_${seq}`;
        const qrId = `qr_championship_${seq}`;
        const secret = `secret_championship_${seq}`;

        batch.set(doc(db, 'qrCodes', qrId), {
          qr_id: qrId,
          clue_id: cId,
          secret_token: secret
        });

        batch.set(doc(db, 'clues', cId), {
          route_id: 'championship',
          sequence: seq,
          clue_text: clue.clue_text,
          answer: clue.answer,
          hint: clue.hint,
          location_name: clue.location_name,
          qr_id: qrId,
          enabled: true,
          placement_status: 'placed'
        });
        seq++;
      }

      await batch.commit();
      toast.dismiss();
      toast.success('Championship clues generated successfully!');
    } catch (err) {
      toast.dismiss();
      console.error(err);
      toast.error('Failed to generate championship clues.');
    }
  };

  const handleCreateChampionshipRoute = async () => {
    toast.loading('Creating Championship Route...');
    try {
      await setDoc(doc(db, 'routes', 'championship'), {
        name: "Championship Route",
        winner_team_id: "",
        winner_team_name: "",
        winner_finish_time: null,
        broadcast_hint: ""
      });
      toast.dismiss();
      toast.success('Championship Route configured successfully!');
    } catch (err) {
      toast.dismiss();
      console.error(err);
      toast.error('Failed to configure Championship Route.');
    }
  };

  // CRUD Team
  const saveTeam = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        team_name: teamForm.team_name,
        college_name: teamForm.college_name,
        department: teamForm.department,
        leader_name: teamForm.leader_name,
        phone: teamForm.phone,
        leader_email: teamForm.leader_email,
        num_members: parseInt(teamForm.num_members),
        member_names: teamForm.member_names,
        route_id: teamForm.route_id || '',
        status: teamForm.status
      };
      
      if (teamForm.id) {
        await updateDoc(doc(db, 'teams', teamForm.id), payload);
        toast.success('Team updated.');
      } else {
        toast.loading('Registering team account...');
        const code = 'T-' + Math.random().toString(36).substring(2, 6).toUpperCase();
        
        const secondaryApp = initializeApp(firebaseConfig, 'SecondaryApp');
        const secondaryAuth = getAuth(secondaryApp);
        if (import.meta.env.VITE_USE_EMULATORS === 'true' || (import.meta.env.DEV && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'))) {
          connectAuthEmulator(secondaryAuth, 'http://127.0.0.1:9099', { disableWarnings: true });
        }
        try {
          const userCred = await createUserWithEmailAndPassword(
            secondaryAuth,
            `${code.toLowerCase()}@aitheron.com`,
            code
          );
          
          await setDoc(doc(db, 'teams', userCred.user.uid), {
            ...payload,
            team_code: code,
            current_sequence: 1,
            time_penalty_minutes: 0,
            bonus_time_minutes: 0,
            hints_used: 0,
            total_paused_duration_seconds: 0,
            paused_at: null
          });
          
          toast.dismiss();
          toast.success(`Team registered successfully. Team Code: ${code}`);
        } catch (authErr) {
          toast.dismiss();
          console.error("Auth creation failed:", authErr);
          toast.error("Failed to create team authentication account: " + authErr.message);
          return;
        } finally {
          await secondaryAuth.signOut();
          const { deleteApp } = await import('firebase/app');
          await deleteApp(secondaryApp);
        }
      }
      setShowTeamModal(false);
    } catch (err) {
      toast.error('Failed to save team.');
    }
  };

  const deleteTeam = async (id) => {
    if (!window.confirm('Delete this team?')) return;
    try {
      await deleteDoc(doc(db, 'teams', id));
      toast.success('Team deleted.');
    } catch (err) {
      toast.error('Failed to delete team.');
    }
  };

  // CRUD Route
  const saveRoute = async (e) => {
    e.preventDefault();
    try {
      if (routeForm.id) {
        await updateDoc(doc(db, 'routes', routeForm.id), { name: routeForm.name });
      } else {
        await addDoc(collection(db, 'routes'), { name: routeForm.name, created_at: serverTimestamp() });
      }
      setShowRouteModal(false);
      setRouteForm({ id: null, name: '' });
      toast.success('Route saved.');
    } catch (err) {
      toast.error('Failed to save route.');
    }
  };

  const deleteRoute = async (id) => {
    if (!window.confirm('Delete this route? This will not delete associated clues.')) return;
    try {
      await deleteDoc(doc(db, 'routes', id));
      toast.success('Route deleted.');
    } catch (err) {
      toast.error('Failed to delete route.');
    }
  };

  // CRUD Clue
  const saveClue = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        route_id: clueForm.route_id,
        sequence: parseInt(clueForm.sequence),
        clue_text: clueForm.clue_text,
        answer: clueForm.answer,
        hint: clueForm.hint,
        location_name: clueForm.location_name,
        enabled: clueForm.enabled
      };

      if (clueForm.id) {
        await updateDoc(doc(db, 'clues', clueForm.id), payload);
        toast.success('Clue updated.');
      } else {
        const cRef = doc(collection(db, 'clues'));
        const qrRef = doc(collection(db, 'qrCodes'));
        const secret = Math.random().toString(36).substring(2, 10);

        const batch = writeBatch(db);
        batch.set(qrRef, {
          qr_id: qrRef.id,
          clue_id: cRef.id,
          secret_token: secret
        });
        batch.set(cRef, {
          ...payload,
          qr_id: qrRef.id,
          placement_status: 'not_placed'
        });
        await batch.commit();
        toast.success('Clue created with QR.');
      }
      setShowClueModal(false);
    } catch (err) {
      toast.error('Failed to save clue.');
    }
  };

  const deleteClue = async (id) => {
    if (!window.confirm('Delete this clue and its associated QR Code?')) return;
    try {
      const clueSnap = await getDoc(doc(db, 'clues', id));
      if (clueSnap.exists()) {
        const d = clueSnap.data();
        const batch = writeBatch(db);
        batch.delete(doc(db, 'clues', id));
        if (d.qr_id) {
          batch.delete(doc(db, 'qrCodes', d.qr_id));
        }
        await batch.commit();
        toast.success('Clue deleted.');
      }
    } catch (err) {
      toast.error('Failed to delete clue.');
    }
  };

  const updatePlacementStatus = async (clueId, val) => {
    try {
      await updateDoc(doc(db, 'clues', clueId), { placement_status: val });
      toast.success('Placement status updated.');
    } catch (err) {
      toast.error('Failed to update placement.');
    }
  };

  const toggleClueEnabled = async (clueId, currentVal) => {
    try {
      await updateDoc(doc(db, 'clues', clueId), { enabled: !currentVal });
      toast.success('Clue state updated.');
    } catch (err) {
      toast.error('Failed to update clue state.');
    }
  };

  const regenerateClueQR = async (clueId) => {
    if (!window.confirm('Regenerate QR security token? Old QRs will be invalidated.')) return;
    try {
      const clueSnap = await getDoc(doc(db, 'clues', clueId));
      if (clueSnap.exists()) {
        const d = clueSnap.data();
        if (d.qr_id) {
          const secret = Math.random().toString(36).substring(2, 10);
          await updateDoc(doc(db, 'qrCodes', d.qr_id), { secret_token: secret });
          toast.success('QR Code secret regenerated.');
        }
      }
    } catch (err) {
      toast.error('Failed to regenerate QR.');
    }
  };

  const printQR = async (clue) => {
    const qrDoc = qrCodes.find(q => q.qr_id === clue.qr_id);
    if (!qrDoc || !qrDoc.secret_token) {
      toast.error('QR Code secret token not found or still loading.');
      return;
    }

    const routeName = getRouteName(clue.route_id);
    const qrValue = `${window.location.origin}/scan?qr_id=${clue.qr_id}&token=${qrDoc.secret_token}`;

    const loadingToast = toast.loading('Generating QR Code...');
    let qrDataUrl = '';
    try {
      qrDataUrl = await QRCode.toDataURL(qrValue, {
        width: 1024,
        margin: 2,
        errorCorrectionLevel: 'H'
      });
      toast.dismiss(loadingToast);
    } catch (err) {
      toast.dismiss(loadingToast);
      toast.error('Failed to generate QR Code.');
      console.error(err);
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Pop-up blocked! Please allow pop-ups for this site.');
      return;
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>Print QR Checkpoint</title>
          <style>
            @media print {
              body {
                margin: 0;
                padding: 0;
                display: flex;
                align-items: center;
                justify-content: center;
                height: 100vh;
                background-color: #fff;
              }
              .no-print {
                display: none;
              }
            }
            body {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              background-color: #f8fafc;
              margin: 0;
              padding: 0;
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
            }
            .card {
              background: white;
              border: 3px dashed #3b82f6;
              padding: 40px;
              max-width: 450px;
              width: 100%;
              box-sizing: border-box;
              margin: 20px;
              border-radius: 24px;
              box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
              text-align: center;
            }
            .title {
              font-size: 28px;
              font-weight: 800;
              color: #1e293b;
              margin-bottom: 8px;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .subtitle {
              font-size: 14px;
              color: #64748b;
              margin-bottom: 24px;
              font-weight: 500;
            }
            .qr-container {
              display: flex;
              justify-content: center;
              align-items: center;
              margin: 24px 0;
            }
            .qr-image {
              width: 260px;
              height: 260px;
              display: block;
              border: 1px solid #e2e8f0;
              padding: 10px;
              border-radius: 16px;
              background: #fff;
            }
            .seq {
              font-size: 20px;
              font-weight: 700;
              color: #3b82f6;
              margin-bottom: 12px;
            }
            .info-box {
              background: #f1f5f9;
              padding: 12px;
              border-radius: 12px;
              margin-top: 20px;
            }
            .info-item {
              font-size: 13px;
              color: #475569;
              margin: 4px 0;
              font-family: monospace;
            }
            .info-label {
              font-weight: bold;
              color: #0f172a;
            }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="title">AITHERON ML 2026</div>
            <div class="subtitle">Official Checkpoint QR Code</div>
            <div class="seq">Sequence Checkpoint #${clue.sequence}</div>
            <div class="qr-container">
              <img class="qr-image" src="${qrDataUrl}" alt="Checkpoint QR Code" />
            </div>
            <div class="info-box">
              <div class="info-item"><span class="info-label">QR ID:</span> ${clue.qr_id}</div>
              <div class="info-item"><span class="info-label">Route:</span> ${routeName}</div>
            </div>
          </div>
          <script>
            const img = document.querySelector('.qr-image');
            if (img.complete) {
              window.print();
              window.close();
            } else {
              img.onload = function() {
                window.print();
                window.close();
              };
              img.onerror = function() {
                window.print();
                window.close();
              };
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Searching, sorting, filtering logic
  const filteredTeams = sortedLeaderboard.filter(t => {
    const matchSearch = t.team_name.toLowerCase().includes(teamSearch.toLowerCase()) ||
                        t.team_code.toLowerCase().includes(teamSearch.toLowerCase());
    const matchFilter = teamFilter === 'all' || t.status === teamFilter;
    const matchRoute = teamRouteFilter === 'all' || t.route_id === teamRouteFilter;
    return matchSearch && matchFilter && matchRoute;
  });

  const totalPages = Math.ceil(filteredTeams.length / teamsPerPage);
  const paginatedTeams = filteredTeams.slice((teamPage - 1) * teamsPerPage, teamPage * teamsPerPage);

  const getRouteName = (routeId) => {
    const route = routes.find(r => r.id === routeId);
    return route ? route.name : 'Unassigned';
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col md:flex-row relative">
      {/* Side Navigation Bar */}
      <aside className="w-full md:w-64 bg-slate-900 border-r border-slate-850 p-6 flex flex-col justify-between">
        <div className="space-y-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 to-pink-500 flex items-center justify-center font-black text-white shadow-lg shadow-purple-500/20">A</div>
            <div>
              <h2 className="text-sm font-black tracking-wider text-slate-200">AITHERON ML 2026</h2>
              <p className="text-[10px] text-purple-400 font-bold uppercase tracking-widest">Admin Console</p>
            </div>
          </div>

          <nav className="flex flex-col gap-2">
            <button onClick={() => setActiveTab('overview')} className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-bold transition-all ${activeTab === 'overview' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:bg-slate-850'}`}>
              <Activity className="w-4 h-4" /> Live Overview
            </button>
            <button onClick={() => setActiveTab('teams')} className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-bold transition-all ${activeTab === 'teams' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:bg-slate-850'}`}>
              <Users className="w-4 h-4" /> Teams Manager
            </button>
            <button onClick={() => setActiveTab('routes')} className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-bold transition-all ${activeTab === 'routes' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:bg-slate-850'}`}>
              <Map className="w-4 h-4" /> Routes Manager
            </button>
            <button onClick={() => setActiveTab('clues')} className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-bold transition-all ${activeTab === 'clues' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:bg-slate-850'}`}>
              <HelpCircle className="w-4 h-4" /> Clues & QRs
            </button>
            <button onClick={() => setActiveTab('event')} className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-bold transition-all ${activeTab === 'event' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:bg-slate-850'}`}>
              <ShieldAlert className="w-4 h-4" /> Event Control
            </button>
            <button onClick={() => setActiveTab('championship')} className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-bold transition-all ${activeTab === 'championship' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:bg-slate-850'}`}>
              <Trophy className="w-4 h-4" /> Championship Round
            </button>
          </nav>
        </div>

        <button onClick={logout} className="flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-bold text-red-400 hover:bg-red-950/20 transition-all">
          <LogOut className="w-4 h-4" /> Logout Console
        </button>
      </aside>

      {/* Main Panel */}
      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1 p-6 md:p-8 space-y-6 overflow-y-auto">
          {/* TAB 1: Live Overview Dashboard */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="glass-card p-5 rounded-3xl border border-slate-900 text-left">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Registered Teams</span>
                  <div className="text-3xl font-black mt-2 text-slate-100">{teams.length}</div>
                </div>
                <div className="glass-card p-5 rounded-3xl border border-slate-900 text-left">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Active Hunters</span>
                  <div className="text-3xl font-black mt-2 text-purple-400">{currentStats.running}</div>
                </div>
                <div className="glass-card p-5 rounded-3xl border border-slate-900 text-left">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Finished Hunt</span>
                  <div className="text-3xl font-black mt-2 text-green-400">{currentStats.finished}</div>
                </div>
                <div className="glass-card p-5 rounded-3xl border border-slate-900 text-left">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Scan Success Rate</span>
                  <div className="text-3xl font-black mt-2 text-amber-400">{currentStats.successRateVal}%</div>
                </div>
              </div>

              {/* TOURNAMENT & BROADCAST CONTROL PANEL */}
              <div className="grid md:grid-cols-2 gap-6">
                {/* 1. Championship Round Advancement Control */}
                <div className="glass-card p-6 rounded-3xl border border-slate-900 text-left flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
                        🏆 Championship Control (Round 2)
                      </h3>
                      <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase ${
                        eventData?.current_round === 2 ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                      }`}>
                        {eventData?.current_round === 2 ? 'Championship Active' : 'Round 1 (Qualifying)'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                      {eventData?.current_round === 2 
                        ? "The Championship Round is currently active. The 3 finalists are hunting for the championship QRs."
                        : "Once Route Winners are determined for Route A, B, and C, click the button below to promote the 3 finalists and start the Championship Round."
                      }
                    </p>
                    
                    {/* Live winners list */}
                    <div className="space-y-2 mb-4 bg-slate-950/40 p-4 rounded-2xl border border-slate-900">
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Route / Block Winners:</p>
                      <div className="grid grid-cols-3 gap-2">
                        {['route_a', 'route_b', 'route_c'].map(rId => {
                          const route = routes.find(r => r.id === rId);
                          const winnerName = route?.winner_team_name;
                          return (
                            <div key={rId} className="p-2 bg-slate-900/60 border border-slate-800 rounded-xl flex flex-col">
                              <span className="text-[9px] text-slate-500 font-bold uppercase">{rId === 'route_a' ? 'Block A' : rId === 'route_b' ? 'Block B' : 'Block C'}</span>
                              <span className={`text-[11px] font-extrabold truncate mt-0.5 ${winnerName ? 'text-green-400' : 'text-slate-500 italic'}`}>
                                {winnerName || 'No Winner Yet'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                  
                  {eventData?.current_round !== 2 && (
                    <button
                      onClick={handleAdvanceToChampionship}
                      disabled={teams.filter(t => t.is_qualifying_winner === true).length === 0}
                      className="w-full py-3 bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-400 hover:to-amber-400 font-bold rounded-2xl text-slate-950 transition-all shadow-lg hover:shadow-yellow-500/10 flex items-center justify-center gap-2 text-xs disabled:opacity-40 disabled:pointer-events-none"
                    >
                      <Trophy className="w-4 h-4" /> Start Championship Round
                    </button>
                  )}
                  {eventData?.current_round === 2 && (
                    <div className="p-3 bg-yellow-500/5 border border-yellow-500/10 rounded-2xl text-center text-[11px] text-yellow-400 font-bold uppercase tracking-wide">
                      🏁 Finals in Progress!
                    </div>
                  )}
                </div>

                {/* 2. Admin Broadcast Hint Control */}
                <div className="glass-card p-6 rounded-3xl border border-slate-900 text-left flex flex-col justify-between">
                  <div>
                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200 mb-4 flex items-center gap-2">
                      📢 Broadcast Clue Hints
                    </h3>
                    <form onSubmit={handleBroadcastHint} className="space-y-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Target Route</label>
                        <select 
                          value={selectedBroadcastRoute} 
                          onChange={(e) => setSelectedBroadcastRoute(e.target.value)} 
                          className="w-full px-3 py-2 bg-slate-950 border border-slate-900 text-xs text-slate-300 outline-none rounded-xl"
                        >
                          {routes.map(r => (
                            <option key={r.id} value={r.id}>{r.name} {r.broadcast_hint ? '💬' : ''}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Hint Message / Announcement</label>
                        <input 
                          type="text" 
                          placeholder="e.g. Look under the bench near the entrance..."
                          value={broadcastHintText} 
                          onChange={(e) => setBroadcastHintText(e.target.value)} 
                          className="w-full px-4 py-2 bg-slate-950 border border-slate-900 text-slate-100 outline-none text-xs focus:border-purple-500 transition-colors rounded-xl mb-2"
                        />
                      </div>
                      <div className="flex items-center justify-between py-1 bg-slate-950/30 px-3 rounded-xl border border-slate-900/50 mb-1">
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <input 
                            type="checkbox"
                            checked={broadcastAutoHide}
                            onChange={(e) => setBroadcastAutoHide(e.target.checked)}
                            className="w-3.5 h-3.5 rounded bg-slate-950 border border-slate-900 accent-purple-600"
                          />
                          <span className="text-[10px] font-bold text-slate-400 uppercase">Enable Auto-hide</span>
                        </label>
                        {broadcastAutoHide && (
                          <div className="flex items-center gap-1.5">
                            <input 
                              type="number"
                              min="1"
                              max="120"
                              value={broadcastDuration}
                              onChange={(e) => setBroadcastDuration(Number(e.target.value))}
                              className="w-14 px-2 py-1 bg-slate-950 border border-slate-900 text-xs text-center text-slate-100 rounded-lg outline-none focus:border-purple-500 font-mono"
                            />
                            <span className="text-[9px] font-bold text-slate-500 uppercase">Min</span>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button 
                          type="submit" 
                          className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl text-xs transition-all shadow-md shadow-purple-500/10"
                        >
                          Broadcast Hint
                        </button>
                        {routes.find(r => r.id === selectedBroadcastRoute)?.broadcast_hint && (
                          <button 
                            type="button"
                            onClick={() => handleClearBroadcast(selectedBroadcastRoute)}
                            className="px-4 py-2.5 bg-red-950/20 border border-red-500/10 hover:bg-red-950/30 text-red-400 font-bold rounded-xl text-xs transition-all"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                    </form>
                  </div>
                </div>
              </div>

              {/* Leaderboard & Recent Scans */}
              <div className="grid lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 glass-card p-6 rounded-3xl border border-slate-900 text-left">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200">Symposium Leaderboard</h3>
                    <div className="flex gap-2">
                      <button onClick={() => handleExport('csv')} className="p-2 bg-slate-900 border border-slate-800 text-slate-300 rounded-xl hover:text-purple-400 text-xs flex items-center gap-1.5 font-bold transition-all"><Download className="w-3.5 h-3.5" /> CSV</button>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead>
                        <tr className="text-[10px] text-slate-500 font-bold uppercase border-b border-slate-900 pb-3">
                          <th className="pb-3 pl-3">Rank</th>
                          <th className="pb-3">Team Code</th>
                          <th className="pb-3">Team Name</th>
                          <th className="pb-3">Route</th>
                          <th className="pb-3">Sequence</th>
                          <th className="pb-3">Status</th>
                          <th className="pb-3 text-right pr-3">Elapsed Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedLeaderboard.map((team, idx) => (
                          <tr key={team.id} className="border-b border-slate-900/40 hover:bg-slate-900/20">
                            <td className="py-3 pl-3 font-mono font-bold text-purple-400">#{idx + 1}</td>
                            <td className="py-3 font-mono text-slate-400">{team.team_code}</td>
                            <td className="py-3 font-bold text-slate-200">{team.team_name}</td>
                            <td className="py-3 text-slate-400">{getRouteName(team.route_id)}</td>
                            <td className="py-3 text-slate-400">
                              <div>Clue {team.status === 'finished' ? 'Finished' : (team.current_sequence || 1)}</div>
                              <div className="text-[10px] text-purple-400 font-bold">
                                {Math.round(getTeamProgressPercent(team))}% ({team.status === 'finished' ? (clues.filter(c => c.route_id === team.route_id).length || 3) : Math.max(0, (team.current_sequence || 1) - 1)} / {clues.filter(c => c.route_id === team.route_id).length || 3})
                              </div>
                            </td>
                            <td className="py-3"><span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${team.status === 'finished' ? 'bg-green-500/10 text-green-400' : team.status === 'active' ? 'bg-purple-500/10 text-purple-400' : 'bg-slate-850 text-slate-400'}`}>{team.status}</span></td>
                            <td className="py-3 text-right pr-3 font-mono text-slate-300">{team.status === 'finished' || team.status === 'active' ? `${Math.floor(calculateElapsedSeconds(team)/60)}m ${calculateElapsedSeconds(team)%60}s` : '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="glass-card p-6 rounded-3xl border border-slate-900 text-left">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200 mb-6">Recent Activity Scans</h3>
                  <div className="space-y-4 max-h-[400px] overflow-y-auto pr-1">
                    {scanLogs.map((log) => (
                      <div key={log.id} className="p-3 bg-slate-900/30 border border-slate-900 rounded-2xl flex flex-col gap-1.5 text-[11px]">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-slate-200">{log.team_name}</span>
                          <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${log.status === 'valid' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>{log.status}</span>
                        </div>
                        <div className="flex justify-between items-center text-slate-500">
                          <span>QR: {log.qr_id}</span>
                          <span>{safeFormatTime(log.timestamp)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Recent Broadcast History Table */}
              <div className="glass-card p-6 rounded-3xl border border-slate-900 text-left">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200 mb-4 flex items-center gap-2">
                  📜 Recent Broadcast History
                </h3>
                <div className="overflow-x-auto border border-slate-900 rounded-2xl bg-slate-950/40">
                  <table className="w-full text-xs text-left text-slate-350">
                    <thead className="bg-slate-950 text-slate-400 uppercase text-[9px] font-bold tracking-wider border-b border-slate-900">
                      <tr>
                        <th className="px-4 py-3">Time</th>
                        <th className="px-4 py-3">Route / Target</th>
                        <th className="px-4 py-3">Message</th>
                        <th className="px-4 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-900/60">
                      {broadcastsHistory.length === 0 ? (
                        <tr>
                          <td colSpan="4" className="px-4 py-8 text-center text-slate-500 italic">
                            No broadcasts recorded yet.
                          </td>
                        </tr>
                      ) : (
                        broadcastsHistory.map((b) => {
                          let displayStatus = 'Active';
                          let badgeColor = 'bg-green-500/10 text-green-400 border-green-500/15';

                          if (b.status === 'cleared') {
                            displayStatus = 'Cleared';
                            badgeColor = 'bg-slate-900 text-slate-500 border-slate-800';
                          } else {
                            // Check if superseded
                            const r = routes.find(route => route.id === b.route_id);
                            if (r && r.broadcast_hint !== b.message) {
                              displayStatus = 'Superseded';
                              badgeColor = 'bg-slate-900 text-slate-500 border-slate-800';
                            } else if (b.auto_hide && b.hide_at) {
                              const expiry = b.hide_at.seconds ? (b.hide_at.seconds * 1000) : new Date(b.hide_at).getTime();
                              if (Date.now() >= expiry) {
                                displayStatus = 'Expired';
                                badgeColor = 'bg-red-500/10 text-red-400 border-red-500/15';
                              }
                            }
                          }

                          const timeStr = safeFormatTime(b.timestamp);

                          return (
                            <tr key={b.id} className="hover:bg-slate-950/20">
                              <td className="px-4 py-3 font-mono text-[10px] text-slate-500 whitespace-nowrap">{timeStr}</td>
                              <td className="px-4 py-3 font-bold text-slate-350 whitespace-nowrap">{b.route_name}</td>
                              <td className="px-4 py-3 text-slate-200 max-w-[300px] truncate" title={b.message}>{b.message}</td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase border ${badgeColor}`}>
                                  {displayStatus}
                                </span>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Teams Manager */}
          {activeTab === 'teams' && (
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
                <div className="flex gap-2">
                  <button onClick={() => { setTeamForm({ id: null, team_name: '', college_name: '', department: '', leader_name: '', phone: '', leader_email: '', num_members: 1, member_names: '', route_id: '', status: 'registered' }); setShowTeamModal(true); }} className="px-4 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-purple-500/15"><Plus className="w-4 h-4" /> Add Team</button>
                  <button onClick={handleAutoBalance} className="px-4 py-2.5 bg-slate-900 border border-slate-800 text-slate-300 rounded-xl hover:text-purple-400 text-xs font-bold transition-all">Auto Balance Routes</button>
                </div>
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input type="text" placeholder="Search team code or name..." value={teamSearch} onChange={e => setTeamSearch(e.target.value)} className="pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 outline-none w-56 focus:border-purple-500" />
                  </div>
                  <label className="px-4 py-2 bg-slate-900 border border-slate-800 text-slate-300 rounded-xl hover:text-purple-400 text-xs font-bold flex items-center gap-1.5 cursor-pointer">
                    <Upload className="w-4 h-4" /> Import CSV
                    <input type="file" accept=".csv" ref={fileInputRef} onChange={handleCSVUpload} className="hidden" />
                  </label>
                </div>
              </div>

              <div className="glass-card rounded-3xl border border-slate-900 overflow-hidden text-left">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="bg-slate-900/60 text-[10px] text-slate-500 font-bold uppercase border-b border-slate-900">
                        <th className="py-4 px-6">Team Details</th>
                        <th className="py-4 px-6">Leader Contact</th>
                        <th className="py-4 px-6">Assigned Route</th>
                        <th className="py-4 px-6">Progress</th>
                        <th className="py-4 px-6">Status</th>
                        <th className="py-4 px-6 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedTeams.map((t) => (
                        <tr key={t.id} className="border-b border-slate-900/30 hover:bg-slate-900/10">
                          <td className="py-4 px-6">
                            <div className="font-bold text-slate-200 text-sm">{t.team_name}</div>
                            <div className="text-[10px] font-mono text-purple-400 mt-0.5">Code: {t.team_code}</div>
                            <div className="text-[10px] text-slate-500 mt-1">{t.college_name} • {t.department}</div>
                          </td>
                          <td className="py-4 px-6">
                            <div className="font-medium text-slate-300">{t.leader_name}</div>
                            <div className="text-[10px] text-slate-500 mt-0.5">{t.phone}</div>
                          </td>
                          <td className="py-4 px-6 text-slate-300 font-semibold">{getRouteName(t.route_id)}</td>
                          <td className="py-4 px-6 text-slate-400">
                            <div>Sequence {t.status === 'finished' ? 'Finished' : (t.current_sequence || 1)}</div>
                            <div className="text-[10px] text-purple-400 font-bold">
                              {Math.round(getTeamProgressPercent(t))}% ({t.status === 'finished' ? (clues.filter(c => c.route_id === t.route_id).length || 3) : Math.max(0, (t.current_sequence || 1) - 1)} / {clues.filter(c => c.route_id === t.route_id).length || 3})
                            </div>
                          </td>
                          <td className="py-4 px-6"><span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${t.status === 'finished' ? 'bg-green-500/10 text-green-400 border border-green-500/15' : t.status === 'active' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/15' : 'bg-slate-850 text-slate-400'}`}>{t.status}</span></td>
                          <td className="py-4 px-6 text-right">
                            <div className="inline-flex gap-1.5">
                              <button onClick={() => { setTeamForm({ id: t.id, team_name: t.team_name, college_name: t.college_name, department: t.department, leader_name: t.leader_name, phone: t.phone, leader_email: t.leader_email, num_members: t.num_members, member_names: t.member_names, route_id: t.route_id, status: t.status }); setShowTeamModal(true); }} className="p-2 bg-slate-900 hover:bg-slate-850 rounded-xl text-slate-400 hover:text-purple-400 transition-colors"><Edit3 className="w-3.5 h-3.5" /></button>
                              <button onClick={() => deleteTeam(t.id)} className="p-2 bg-red-950/10 hover:bg-red-950/20 rounded-xl text-red-500/60 hover:text-red-400 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Routes Manager */}
          {activeTab === 'routes' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <button onClick={() => { setRouteForm({ id: null, name: '' }); setShowRouteModal(true); }} className="px-4 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-purple-500/15"><Plus className="w-4 h-4" /> Create Route</button>
                <button onClick={() => setShowGenerateModal(true)} className="px-4 py-2.5 bg-slate-900 border border-slate-800 text-slate-300 rounded-xl hover:text-purple-400 text-xs font-bold transition-all">Bulk Generate Routes</button>
              </div>

              {/* Championship Route Status Card */}
              <div className="glass-card p-6 rounded-3xl border border-slate-900 text-left space-y-3">
                <div className="flex justify-between items-center">
                  <div>
                    <h4 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                      🏆 Championship Route Configuration
                    </h4>
                    <p className="text-xs text-slate-400 mt-1">
                      {routes.some(r => r.id === 'championship')
                        ? "Configured: The Championship Route document is active in your database."
                        : "Not Configured: The Championship Route document is missing from your database."
                      }
                    </p>
                  </div>
                  {routes.some(r => r.id === 'championship') ? (
                    <span className="px-3 py-1 bg-green-500/10 border border-green-500/20 text-green-400 rounded-xl text-[10px] font-black uppercase">
                      ✅ Configured
                    </span>
                  ) : (
                    <button 
                      onClick={handleCreateChampionshipRoute}
                      className="px-4 py-2 bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-400 hover:to-amber-400 text-slate-950 font-bold rounded-xl text-xs transition-all shadow-md shadow-yellow-500/10"
                    >
                      ⚡ Restore Championship Route
                    </button>
                  )}
                </div>
                {routes.some(r => r.id === 'championship') && (
                  <p className="text-[10px] text-slate-500 italic">
                    💡 Note: The Championship Route is automatically connected to the game progression. When you advance the qualifying winners, the system will route them to the Championship Route. You can rename it or delete it in the list below.
                  </p>
                )}
              </div>

              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {routes.map(r => (
                  <div key={r.id} className="glass-card p-6 rounded-3xl border border-slate-900 text-left flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start">
                        <h4 className="text-base font-bold text-slate-200">{r.name}</h4>
                        <div className="flex gap-1.5">
                          <button onClick={() => { setRouteForm({ id: r.id, name: r.name }); setShowRouteModal(true); }} className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-purple-400"><Edit3 className="w-3.5 h-3.5" /></button>
                          <button onClick={() => deleteRoute(r.id)} className="p-1.5 hover:bg-red-950/20 rounded-lg text-slate-500 hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-1">Route ID: {r.id}</p>
                    </div>
                    <div className="mt-4 border-t border-slate-900 pt-3 flex justify-between items-center text-xs text-slate-400">
                      <span>Total Clues: {clues.filter(c => c.route_id === r.id).length}</span>
                      <span>Teams: {teams.filter(t => t.route_id === r.id).length}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: Clues & QRs */}
          {activeTab === 'clues' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <button onClick={() => { setClueForm({ id: null, route_id: '', sequence: '', clue_text: '', answer: '', hint: '', location_name: '', enabled: true }); setShowClueModal(true); }} className="px-4 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-purple-500/15"><Plus className="w-4 h-4" /> Add QR Clue</button>
              </div>

              {/* Championship Clues status card */}
              <div className="glass-card p-6 rounded-3xl border border-slate-900 text-left space-y-3">
                <div className="flex justify-between items-center">
                  <div>
                    <h4 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                      🏆 Championship Round Clues Status
                    </h4>
                    <p className="text-xs text-slate-400 mt-1">
                      {clues.some(c => c.route_id === 'championship')
                        ? `Configured: ${clues.filter(c => c.route_id === 'championship').length} clues are active on the championship route.` 
                        : "Not Configured: There are no clues assigned to the Championship route yet."
                      }
                    </p>
                  </div>
                  {clues.some(c => c.route_id === 'championship') ? (
                    <span className="px-3 py-1 bg-green-500/10 border border-green-500/20 text-green-400 rounded-xl text-[10px] font-black uppercase">
                      ✅ Configured
                    </span>
                  ) : (
                    <button 
                      onClick={handleGenerateChampionshipClues}
                      className="px-4 py-2 bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-400 hover:to-amber-400 text-slate-950 font-bold rounded-xl text-xs transition-all shadow-md shadow-yellow-500/10"
                    >
                      ⚡ Auto-Generate Default Clues
                    </button>
                  )}
                </div>
                {clues.some(c => c.route_id === 'championship') && (
                  <p className="text-[10px] text-slate-500 italic">
                    💡 Note: To modify or append more clues, click "Add QR Clue" above and select "Championship Route" in the dropdown, or edit/delete existing ones from the list below.
                  </p>
                )}
              </div>

              <div className="glass-card rounded-3xl border border-slate-900 overflow-hidden text-left">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="bg-slate-900/60 text-[10px] text-slate-500 font-bold uppercase border-b border-slate-900">
                        <th className="py-4 px-6">Route</th>
                        <th className="py-4 px-6">Seq</th>
                        <th className="py-4 px-6">Location</th>
                        <th className="py-4 px-6">Riddle / Hint</th>
                        <th className="py-4 px-6">Placement</th>
                        <th className="py-4 px-6">Status</th>
                        <th className="py-4 px-6">QR Code details</th>
                        <th className="py-4 px-6 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clues.map(c => (
                        <tr key={c.id} className="border-b border-slate-900/30 hover:bg-slate-900/10">
                          <td className="py-4 px-6 font-bold text-slate-300">{getRouteName(c.route_id)}</td>
                          <td className="py-4 px-6 font-mono text-purple-400 font-bold">#{c.sequence}</td>
                          <td className="py-4 px-6 text-slate-200 font-bold">{c.location_name}</td>
                          <td className="py-4 px-6 max-w-xs">
                            <div className="text-slate-300 leading-relaxed italic">"{c.clue_text}"</div>
                            <div className="text-slate-500 mt-1">Hint: {c.hint || 'None'}</div>
                          </td>
                          <td className="py-4 px-6">
                            <select value={c.placement_status || 'not_placed'} onChange={e => updatePlacementStatus(c.id, e.target.value)} className="px-2 py-1 bg-slate-950 border border-slate-900 text-xs text-slate-300 outline-none rounded-lg">
                              <option value="not_placed">Not Placed</option>
                              <option value="placed">Placed</option>
                              <option value="verified">Verified</option>
                            </select>
                          </td>
                          <td className="py-4 px-6">
                            <button onClick={() => toggleClueEnabled(c.id, c.enabled)} className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase border ${c.enabled ? 'bg-green-500/10 text-green-400 border-green-500/15' : 'bg-red-500/10 text-red-400 border-red-500/15'}`}>{c.enabled ? 'Active' : 'Disabled'}</button>
                          </td>
                          <td className="py-4 px-6 font-mono text-[10px] text-slate-400">
                            <div>QR: {c.qr_id}</div>
                          </td>
                          <td className="py-4 px-6 text-right">
                            <div className="inline-flex gap-1.5">
                              <button onClick={() => printQR(c)} className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-blue-400 rounded-lg"><Printer className="w-3.5 h-3.5" /></button>
                              <button onClick={() => regenerateClueQR(c.id)} className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-amber-400 rounded-lg"><RefreshCw className="w-3.5 h-3.5" /></button>
                              <button onClick={() => { setClueForm({ id: c.id, route_id: c.route_id, sequence: c.sequence, clue_text: c.clue_text, answer: c.answer, hint: c.hint || '', location_name: c.location_name, qr_id: c.qr_id, enabled: c.enabled }); setShowClueModal(true); }} className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-purple-400 rounded-lg"><Edit3 className="w-3.5 h-3.5" /></button>
                              <button onClick={() => deleteClue(c.id)} className="p-1.5 hover:bg-red-950/20 text-slate-500 hover:text-red-400 rounded-lg"><Trash2 className="w-3.5 h-3.5" /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: Event Control Center */}
          {activeTab === 'event' && (
            <div className="space-y-8">
              {/* Event Statistics Grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <div className="glass-card p-4 rounded-2xl text-left border border-slate-900">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Scan Success Rate</span>
                  <div className="text-xl font-extrabold mt-1 text-slate-100">{currentStats.successRateVal}%</div>
                  <span className="text-[9px] text-slate-500">{currentStats.totalScansVal} Total Scans</span>
                </div>
                <div className="glass-card p-4 rounded-2xl text-left border border-slate-900">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Wrong QR Scans</span>
                  <div className="text-xl font-extrabold mt-1 text-red-400">{currentStats.wrongScansVal}</div>
                  <span className="text-[9px] text-slate-500">Route / sequence faults</span>
                </div>
                <div className="glass-card p-4 rounded-2xl text-left border border-slate-900">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Total Hints Used</span>
                  <div className="text-xl font-extrabold mt-1 text-amber-400">{currentStats.totalHints}</div>
                  <span className="text-[9px] text-slate-500">Across all teams</span>
                </div>
                <div className="glass-card p-4 rounded-2xl text-left border border-slate-900">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Active Users</span>
                  <div className="text-xl font-extrabold mt-1 text-purple-400">{currentStats.running}</div>
                  <span className="text-[9px] text-slate-500">Playing right now</span>
                </div>
                <div className="glass-card p-4 rounded-2xl text-left border border-slate-900 col-span-2">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Fastest / Slowest Timings</span>
                  <div className="text-xs font-semibold text-slate-300 mt-1 flex flex-col gap-0.5">
                    <div className="truncate">⚡ Fast: <span className="text-green-400 font-bold">{currentStats.fastTeam}</span></div>
                    <div className="truncate">🐢 Slow: <span className="text-red-400 font-bold">{currentStats.slowTeam}</span></div>
                  </div>
                </div>
              </div>

              {/* Event Lifecycle and Control Grid */}
              <div className="grid lg:grid-cols-3 gap-8">
                {/* Configuration & Settings Section */}
                <div className="lg:col-span-2 space-y-6 text-left">
                  <div className="glass-card p-6 rounded-3xl border border-slate-900 space-y-4">
                    <h3 className="text-base font-bold flex items-center gap-2 text-slate-200">
                      <Settings className="w-4 h-4 text-purple-400" /> Event Settings Config
                    </h3>
                    <form onSubmit={saveEventConfiguration} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Event Name</label>
                          <input type="text" value={eventConfig.name} onChange={(e) => setEventConfig({ ...eventConfig, name: e.target.value })} className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-900 text-slate-100 outline-none text-xs focus:border-purple-500 transition-colors" required />
                        </div>
                        <div className="col-span-2">
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Description</label>
                          <textarea value={eventConfig.description} onChange={(e) => setEventConfig({ ...eventConfig, description: e.target.value })} className="w-full px-4 py-2 rounded-xl bg-slate-950 border border-slate-900 text-slate-100 outline-none text-xs focus:border-purple-500 transition-colors" rows="2" />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Venue</label>
                          <input type="text" value={eventConfig.venue} onChange={(e) => setEventConfig({ ...eventConfig, venue: e.target.value })} className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-900 text-slate-100 outline-none text-xs focus:border-purple-500 transition-colors" />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Max Teams Limit</label>
                          <input type="number" value={eventConfig.max_teams} onChange={(e) => setEventConfig({ ...eventConfig, max_teams: parseInt(e.target.value) })} className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-900 text-slate-100 outline-none text-xs focus:border-purple-500 transition-colors" />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Number of Routes</label>
                          <input type="number" value={eventConfig.num_routes} onChange={(e) => setEventConfig({ ...eventConfig, num_routes: parseInt(e.target.value) })} className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-900 text-slate-100 outline-none text-xs focus:border-purple-500 transition-colors" />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Clues Per Route</label>
                          <input type="number" value={eventConfig.num_clues_per_route} onChange={(e) => setEventConfig({ ...eventConfig, num_clues_per_route: parseInt(e.target.value) })} className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-900 text-slate-100 outline-none text-xs focus:border-purple-500 transition-colors" />
                        </div>
                        <div className="col-span-2">
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Final Destination Room</label>
                          <input type="text" value={eventConfig.final_destination} onChange={(e) => setEventConfig({ ...eventConfig, final_destination: e.target.value })} className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-900 text-slate-100 outline-none text-xs focus:border-purple-500 transition-colors" placeholder="e.g. Seminar Hall 2" />
                        </div>
                      </div>

                      <h4 className="text-xs font-bold text-slate-400 border-t border-slate-900 pt-4 mt-2">Scheduled Event Timers</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Scheduled Start Time</label>
                          <input type="datetime-local" value={eventConfig.event_start} onChange={(e) => setEventConfig({ ...eventConfig, event_start: e.target.value })} className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-900 text-slate-300 outline-none text-xs focus:border-purple-500 transition-colors" />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Scheduled End Time</label>
                          <input type="datetime-local" value={eventConfig.event_end} onChange={(e) => setEventConfig({ ...eventConfig, event_end: e.target.value })} className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-900 text-slate-300 outline-none text-xs focus:border-purple-500 transition-colors" />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Max Duration (Mins)</label>
                          <input type="number" value={eventConfig.max_time_limit_minutes} onChange={(e) => setEventConfig({ ...eventConfig, max_time_limit_minutes: parseInt(e.target.value) })} className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-900 text-slate-100 outline-none text-xs focus:border-purple-500 transition-colors" />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Grace Period (Mins)</label>
                          <input type="number" value={eventConfig.grace_time_minutes} onChange={(e) => setEventConfig({ ...eventConfig, grace_time_minutes: parseInt(e.target.value) })} className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-900 text-slate-100 outline-none text-xs focus:border-purple-500 transition-colors" />
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 mt-2 bg-slate-900/30 p-4 rounded-xl border border-slate-900/50">
                        <label className="flex items-center gap-2 text-xs font-semibold text-slate-300 cursor-pointer">
                          <input type="checkbox" checked={eventConfig.countdown_timer_active} onChange={(e) => setEventConfig({ ...eventConfig, countdown_timer_active: e.target.checked })} className="rounded bg-slate-950 border-slate-800 text-purple-600 focus:ring-0" />
                          Display Countdown Timer on Dashboards
                        </label>
                        <label className="flex items-center gap-2 text-xs font-semibold text-slate-300 cursor-pointer">
                          <input type="checkbox" checked={eventConfig.auto_close_on_expiry} onChange={(e) => setEventConfig({ ...eventConfig, auto_close_on_expiry: e.target.checked })} className="rounded bg-slate-950 border-slate-800 text-purple-600 focus:ring-0" />
                          Auto-Close Event when time expires
                        </label>
                      </div>

                      <div className="flex justify-between items-center border-t border-slate-900 pt-4 mt-2">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Manual Status Override</label>
                          <select value={eventConfig.status} onChange={(e) => setEventConfig({ ...eventConfig, status: e.target.value })} className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-900 text-xs text-slate-300 outline-none">
                            <option value="draft">Draft</option>
                            <option value="registration_open">Registration Open</option>
                            <option value="registration_closed">Registration Closed</option>
                            <option value="ready">Ready</option>
                            <option value="running">Running</option>
                            <option value="qualifying">Qualifying Round</option>
                            <option value="waiting_championship">Waiting for Championship</option>
                            <option value="championship">Championship Round</option>
                            <option value="paused">Paused</option>
                            <option value="completed">Completed</option>
                            <option value="timeout">Timed Out (Timeout)</option>
                            <option value="archived">Archived</option>
                          </select>
                        </div>
                        <button type="submit" className="px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 font-bold text-xs text-white transition-all shadow-md shadow-purple-500/10">Save Configurations</button>
                      </div>
                    </form>
                  </div>
                </div>
 
                {/* Event Actions & Selected Team Controls */}
                <div className="space-y-6 text-left">
                  <div className="glass-card p-6 rounded-3xl border border-slate-900 space-y-4">
                    <h3 className="text-base font-bold flex items-center gap-2 text-slate-200">
                      <Play className="w-4 h-4 text-purple-400" /> Event Control Switches
                    </h3>
                    
                    <div className="grid grid-cols-2 gap-3">
                      {!['running', 'qualifying', 'championship'].includes(eventConfig.status) ? (
                        <button onClick={() => triggerEventAction('start')} className="flex items-center justify-center gap-2 py-3 rounded-xl bg-green-600 hover:bg-green-500 text-white text-xs font-bold transition-all"><Play className="w-4 h-4" /> Start Event</button>
                      ) : (
                        <button onClick={() => triggerEventAction('pause')} className="flex items-center justify-center gap-2 py-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition-all"><Pause className="w-4 h-4" /> Pause Event</button>
                      )}
                      
                      {eventConfig.status === 'paused' && (
                        <button onClick={() => triggerEventAction('resume')} className="flex items-center justify-center gap-2 py-3 rounded-xl bg-green-600 hover:bg-green-500 text-white text-xs font-bold transition-all animate-pulse"><Play className="w-4 h-4" /> Resume Event</button>
                      )}
 
                      <button onClick={() => triggerEventAction('end')} disabled={eventConfig.status === 'completed'} className="flex items-center justify-center gap-2 py-3 rounded-xl bg-red-650/10 border border-red-500/20 text-red-400 hover:bg-red-650 hover:text-white disabled:opacity-50 disabled:hover:bg-red-650/10 disabled:hover:text-red-400 text-xs font-bold transition-all"><Square className="w-4 h-4" /> End Event</button>
                      
                      <button onClick={() => triggerEventAction('timeout')} disabled={eventConfig.status === 'timeout'} className="flex items-center justify-center gap-2 py-3 rounded-xl bg-amber-600/10 border border-amber-500/20 text-amber-400 hover:bg-amber-600 hover:text-white disabled:opacity-50 disabled:hover:bg-amber-600/10 disabled:hover:text-amber-400 text-xs font-bold transition-all"><Clock className="w-4 h-4" /> Timeout Event</button>

                      {eventConfig.scans_locked ? (
                        <button onClick={() => triggerEventAction('unlock_scans')} className="flex items-center justify-center gap-2 py-3 rounded-xl bg-green-600 hover:bg-green-500 text-white text-xs font-bold transition-all"><Unlock className="w-4 h-4" /> Unlock Scans</button>
                      ) : (
                        <button onClick={() => triggerEventAction('lock_scans')} className="flex items-center justify-center gap-2 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-all"><Lock className="w-4 h-4" /> Lock Scans</button>
                      )}

                      {eventConfig.leaderboard_frozen ? (
                        <button onClick={() => triggerEventAction('unfreeze_leaderboard')} className="flex items-center justify-center gap-2 py-3 rounded-xl bg-green-600 hover:bg-green-500 text-white text-xs font-bold transition-all"><Unlock className="w-4 h-4" /> Unfreeze Leaderboard</button>
                      ) : (
                        <button onClick={() => triggerEventAction('freeze_leaderboard')} className="flex items-center justify-center gap-2 py-3 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800 text-xs font-bold transition-all"><Lock className="w-4 h-4" /> Freeze Leaderboard</button>
                      )}

                      {eventConfig.leaderboard_hidden ? (
                        <button onClick={() => triggerEventAction('show_leaderboard')} className="flex items-center justify-center gap-2 py-3 rounded-xl bg-green-600 hover:bg-green-500 text-white text-xs font-bold transition-all"><Eye className="w-4 h-4" /> Expose Leaderboard</button>
                      ) : (
                        <button onClick={() => triggerEventAction('hide_leaderboard')} className="flex items-center justify-center gap-2 py-3 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800 text-xs font-bold transition-all"><Eye className="w-4 h-4" /> Hide Leaderboard</button>
                      )}
                    </div>

                    <div className="flex gap-2 border-t border-slate-900 pt-4 mt-2">
                      <button onClick={() => triggerEventAction('soft_reset')} className="flex-1 py-2 text-center rounded-xl bg-yellow-600/10 border border-yellow-500/20 text-yellow-400 hover:bg-yellow-600 hover:text-slate-950 text-[10px] font-extrabold uppercase transition-all">Soft Reset</button>
                      <button onClick={() => triggerEventAction('full_reset')} className="flex-1 py-2 text-center rounded-xl bg-red-650/10 border border-red-500/25 text-red-400 hover:bg-red-650 hover:text-white text-[10px] font-extrabold uppercase transition-all">Full Reset</button>
                    </div>
                  </div>

                  {/* Backup and restore panel */}
                  <div className="glass-card p-6 rounded-3xl border border-slate-900 space-y-4">
                    <h3 className="text-base font-bold flex items-center gap-2 text-slate-200">
                      <Database className="w-4 h-4 text-purple-400" /> Event Data Backups
                    </h3>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <button onClick={handleBackupDownload} className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-850 hover:text-purple-400 text-xs font-semibold transition-all"><Download className="w-3.5 h-3.5" /> Backup Config</button>
                      
                      <label className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-850 hover:text-purple-400 text-xs font-semibold cursor-pointer transition-all">
                        <Upload className="w-3.5 h-3.5" /> Restore Config
                        <input type="file" accept=".json" onChange={handleBackupUpload} className="hidden" />
                      </label>

                      <button onClick={downloadAuditLogs} className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-850 hover:text-green-400 text-xs font-semibold transition-all"><FileText className="w-3.5 h-3.5" /> Export Audit CSV</button>

                      <button onClick={downloadScanLogs} className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-850 hover:text-green-400 text-xs font-semibold transition-all"><FileText className="w-3.5 h-3.5" /> Export Scans CSV</button>
                    </div>
                  </div>

                  {/* Selected Team Actions Panel */}
                  <div className="glass-card p-6 rounded-3xl border border-slate-900 space-y-4">
                    <h3 className="text-base font-bold flex items-center gap-2 text-slate-200">
                      <Users className="w-4 h-4 text-purple-400" /> Selected Team Overrides
                    </h3>
                    
                    <div className="space-y-4">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Select Target Team</label>
                        <select value={selectedTeamId} onChange={(e) => setSelectedTeamId(e.target.value)} className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-900 text-xs text-slate-300 outline-none">
                          <option value="">-- Select Team --</option>
                          {teams.map(t => (
                            <option key={t.id} value={t.id}>{t.team_name} ({t.team_code}) - {t.status}</option>
                          ))}
                        </select>
                      </div>

                      {selectedTeamId && (
                        <div className="space-y-3 bg-slate-900/20 p-4 rounded-2xl border border-slate-900/50">
                          <div className="flex gap-2">
                            <button onClick={() => triggerTeamOverride(selectedTeamId, 'unlock_next')} className="flex-1 py-2 rounded-lg bg-purple-600/10 border border-purple-500/25 text-purple-400 hover:bg-purple-600 hover:text-white text-[10px] font-bold transition-all">Unlock Next QR</button>
                            <button onClick={() => triggerTeamOverride(selectedTeamId, 'skip_current')} className="flex-1 py-2 rounded-lg bg-purple-600/10 border border-purple-500/25 text-purple-400 hover:bg-purple-600 hover:text-white text-[10px] font-bold transition-all">Skip Current Clue</button>
                          </div>

                          <div className="flex gap-2">
                            <button onClick={() => triggerTeamOverride(selectedTeamId, 'pause')} className="flex-1 py-2 rounded-lg bg-amber-600/10 border border-amber-500/25 text-amber-400 hover:bg-amber-650 hover:text-white text-[10px] font-bold transition-all">Pause Team</button>
                            <button onClick={() => triggerTeamOverride(selectedTeamId, 'resume')} className="flex-1 py-2 rounded-lg bg-green-600/10 border border-green-500/25 text-green-400 hover:bg-green-650 hover:text-white text-[10px] font-bold transition-all">Resume Team</button>
                          </div>

                          <div className="flex gap-2">
                            <button onClick={() => triggerTeamOverride(selectedTeamId, 'restart')} className="flex-1 py-2 rounded-lg bg-red-600/10 border border-red-500/25 text-red-400 hover:bg-red-650 hover:text-white text-[10px] font-bold transition-all">Reset Team</button>
                            <button onClick={() => triggerTeamOverride(selectedTeamId, 'mark_completed')} className="flex-1 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white text-[10px] font-bold transition-all">Mark Finished</button>
                          </div>

                          <div className="grid grid-cols-2 gap-3 border-t border-slate-900 pt-3 mt-2">
                            <div>
                              <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Add Bonus Mins</label>
                              <div className="flex gap-1.5">
                                <input type="number" value={bonusTimeInput} onChange={(e) => setBonusTimeInput(parseInt(e.target.value))} className="w-16 px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-center text-xs text-slate-200 outline-none" />
                                <button onClick={() => triggerTeamOverride(selectedTeamId, 'bonus_time', { bonus_time_minutes: bonusTimeInput })} className="px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-500 text-white font-semibold text-[10px]">Award</button>
                              </div>
                            </div>
                            <div>
                              <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Apply Penalty Mins</label>
                              <div className="flex gap-1.5">
                                <input type="number" value={penaltyTimeInput} onChange={(e) => setPenaltyTimeInput(parseInt(e.target.value))} className="w-16 px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-center text-xs text-slate-200 outline-none" />
                                <button onClick={() => triggerTeamOverride(selectedTeamId, 'time_penalty', { penalty_minutes: penaltyTimeInput })} className="px-3 py-1.5 rounded-lg bg-red-650 hover:bg-red-600 text-white font-semibold text-[10px]">Apply</button>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Audit Trail List */}
              <div className="glass-card p-6 rounded-3xl border border-slate-900 text-left">
                <h3 className="text-base font-bold mb-4 flex items-center gap-2 text-slate-200">
                  <FileText className="w-5 h-5 text-purple-400" /> Complete System Audit Trail
                </h3>
                <div className="overflow-y-auto max-h-[350px] divide-y divide-slate-900/60 text-xs border border-slate-900 rounded-2xl p-4 bg-slate-950/40">
                  {auditLogs.length === 0 ? (
                    <p className="text-center py-6 text-slate-500">No actions recorded in audit log yet.</p>
                  ) : (
                    auditLogs.map((log) => (
                      <div key={log.id} className="py-3.5 flex flex-col md:flex-row md:justify-between md:items-start gap-2">
                        <div className="space-y-1">
                          <span className="inline-flex px-2 py-0.5 rounded bg-slate-900 text-purple-400 font-mono text-[9px] uppercase mr-2 border border-slate-800">{log.action_type}</span>
                          {log.affected_team && (
                            <span className="inline-flex px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 font-mono text-[9px] uppercase mr-2 border border-blue-500/15">Team: {log.affected_team}</span>
                          )}
                          <span className="text-slate-300 font-semibold">{log.details}</span>
                        </div>
                        <div className="text-right text-[10px] text-slate-500 font-mono">
                          {log.performed_by} • IP: {log.ip_address || '-'} • {safeFormatTime(log.timestamp, true)}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: Championship Round Dashboard */}
          {activeTab === 'championship' && (
            <div className="space-y-8 animate-fadeIn text-left">
              {/* Championship Overview Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="glass-card p-6 rounded-3xl border border-yellow-500/20 text-left relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-yellow-500/5 rounded-full blur-xl"></div>
                  <span className="text-[10px] text-yellow-400 font-black uppercase tracking-wider block">Round Status</span>
                  <div className="text-2xl font-black mt-2 text-slate-100 uppercase">{eventConfig.status === 'championship' ? '🔥 Finals Active' : eventConfig.status?.replace('_', ' ')}</div>
                  <span className="text-[10px] text-slate-500 font-bold uppercase mt-1 block">Round: {eventConfig.current_round}</span>
                </div>
                
                <div className="glass-card p-6 rounded-3xl border border-slate-900 text-left">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Championship Finalists</span>
                  <div className="text-2xl font-extrabold mt-2 text-slate-100">
                    {teams.filter(t => t.route_id === 'championship' || t.is_finalist).length} / 3
                  </div>
                  <span className="text-[10px] text-purple-400 font-bold uppercase mt-1 block">Promoted Block Winners</span>
                </div>

                <div className="glass-card p-6 rounded-3xl border border-slate-900 text-left">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Finalist Finished</span>
                  <div className="text-2xl font-extrabold mt-2 text-green-400">
                    {teams.filter(t => (t.route_id === 'championship' || t.is_finalist) && t.status === 'finished').length}
                  </div>
                  <span className="text-[10px] text-slate-500 font-bold uppercase mt-1 block">Finished Route</span>
                </div>

                <div className="glass-card p-6 rounded-3xl border border-slate-900 text-left">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Championship Winner</span>
                  <div className="text-lg font-black mt-2 text-yellow-400 truncate">
                    {eventData?.championship_winner_name ? `🏆 ${eventData.championship_winner_name}` : 'Pending...'}
                  </div>
                  <span className="text-[10px] text-slate-500 font-bold uppercase mt-1 block">Grand Champion</span>
                </div>
              </div>

              {/* Championship controls & Live progress timeline */}
              <div className="grid lg:grid-cols-3 gap-8">
                {/* Controls & Announcements */}
                <div className="lg:col-span-1 space-y-6">
                  {/* Controls Card */}
                  <div className="glass-card p-6 rounded-3xl border border-slate-900 space-y-4">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
                      <Settings className="w-4 h-4 text-purple-400" /> Controls Panel
                    </h3>
                    
                    <div className="flex flex-col gap-2">
                      {eventConfig.status !== 'championship' ? (
                        <button 
                          onClick={handleAdvanceToChampionship} 
                          className="flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-400 hover:to-amber-400 text-slate-950 text-xs font-black uppercase tracking-wider transition-all shadow-lg hover:shadow-yellow-500/20"
                        >
                          <Play className="w-4 h-4" /> Start Championship
                        </button>
                      ) : (
                        <button 
                          onClick={() => triggerEventAction('pause')} 
                          className="flex items-center justify-center gap-2 py-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition-all"
                        >
                          <Pause className="w-4 h-4" /> Pause Championship
                        </button>
                      )}
                      
                      {eventConfig.status === 'paused' && (
                        <button 
                          onClick={() => triggerEventAction('resume')} 
                          className="flex items-center justify-center gap-2 py-3 rounded-xl bg-green-600 hover:bg-green-500 text-white text-xs font-bold transition-all animate-pulse"
                        >
                          <Play className="w-4 h-4" /> Resume Championship
                        </button>
                      )}

                      <button 
                        onClick={() => triggerEventAction('end')} 
                        disabled={eventConfig.status === 'completed'} 
                        className="flex items-center justify-center gap-2 py-3 rounded-xl bg-red-600/10 border border-red-500/20 text-red-400 hover:bg-red-650 hover:text-white disabled:opacity-50 text-xs font-bold transition-all"
                      >
                        <Square className="w-4 h-4" /> End Championship
                      </button>

                      <div className="border-t border-slate-900 pt-4 mt-2">
                        <button 
                          onClick={() => triggerEventAction('championship_soft_reset')} 
                          className="w-full py-2.5 rounded-xl bg-yellow-600/10 border border-yellow-500/20 text-yellow-400 hover:bg-yellow-600 hover:text-slate-950 text-xs font-extrabold uppercase transition-all"
                        >
                          🔄 Soft Reset Championship Only
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Winner Banner Card */}
                  {eventData?.championship_winner_id && (
                    <div className="glass-card p-6 rounded-3xl border border-yellow-500/20 bg-yellow-500/5 text-center space-y-4 animate-bounce relative overflow-hidden">
                      <Trophy className="w-12 h-12 text-yellow-400 mx-auto filter drop-shadow-[0_0_10px_rgba(234,179,8,0.4)]" />
                      <div>
                        <h4 className="text-sm font-black text-yellow-400 uppercase tracking-widest">🏆 Champion Declared</h4>
                        <p className="text-xl font-extrabold text-white mt-1">{eventData.championship_winner_name}</p>
                      </div>
                      <p className="text-[10px] text-slate-400">Winning scans are now disabled.</p>
                    </div>
                  )}

                  {/* Broadcast Panel */}
                  <div className="glass-card p-6 rounded-3xl border border-slate-900">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200 mb-4 flex items-center gap-2">
                      📢 Championship Broadcast Panel
                    </h3>
                    <form onSubmit={handleChampionshipBroadcast} className="space-y-4">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Recipient Target</label>
                        <select 
                          value={champBroadcastTarget} 
                          onChange={(e) => setChampBroadcastTarget(e.target.value)} 
                          className="w-full px-3 py-2 bg-slate-950 border border-slate-900 text-xs text-slate-300 outline-none rounded-xl"
                        >
                          <option value="all_finalists">All Finalists (Round 2)</option>
                          <option value="one_finalist">Single Finalist (Targeted Clue Hint)</option>
                          <option value="everyone">Everyone (All 15 Teams)</option>
                        </select>
                      </div>

                      {champBroadcastTarget === 'one_finalist' && (
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Select Finalist</label>
                          <select 
                            value={champSelectedFinalistId} 
                            onChange={(e) => setChampSelectedFinalistId(e.target.value)} 
                            className="w-full px-3 py-2 bg-slate-950 border border-slate-900 text-xs text-slate-300 outline-none rounded-xl"
                          >
                            <option value="">-- Choose Team --</option>
                            {teams.filter(t => t.route_id === 'championship' || t.is_finalist).map(f => (
                              <option key={f.id} value={f.id}>{f.team_name} ({f.team_code})</option>
                            ))}
                          </select>
                        </div>
                      )}

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Message</label>
                        <textarea 
                          rows="2"
                          placeholder="Type hint or announcement..."
                          value={champBroadcastHintText}
                          onChange={(e) => setChampBroadcastHintText(e.target.value)}
                          className="w-full px-4 py-2 bg-slate-950 border border-slate-900 text-slate-100 outline-none text-xs focus:border-purple-500 rounded-xl"
                          required
                        />
                      </div>

                      <div className="flex items-center justify-between py-1 bg-slate-950/30 px-3 rounded-xl border border-slate-900/50 mb-1">
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <input 
                            type="checkbox"
                            checked={champBroadcastAutoHide}
                            onChange={(e) => setChampBroadcastAutoHide(e.target.checked)}
                            className="w-3.5 h-3.5 rounded bg-slate-950 border border-slate-900 accent-purple-650"
                          />
                          <span className="text-[10px] font-bold text-slate-400 uppercase">Enable Auto-hide</span>
                        </label>
                        {champBroadcastAutoHide && (
                          <div className="flex items-center gap-1.5">
                            <input 
                              type="number"
                              min="1"
                              max="120"
                              value={champBroadcastDuration}
                              onChange={(e) => setChampBroadcastDuration(Number(e.target.value))}
                              className="w-14 px-2 py-1 bg-slate-950 border border-slate-900 text-xs text-center text-slate-100 rounded-lg outline-none focus:border-purple-500 font-mono"
                            />
                            <span className="text-[9px] font-bold text-slate-500 uppercase">Min</span>
                          </div>
                        )}
                      </div>

                      <button 
                        type="submit" 
                        className="w-full py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl text-xs transition-all shadow-md shadow-purple-500/10"
                      >
                        Send Broadcast
                      </button>
                    </form>
                  </div>
                </div>

                {/* Live Progress Timeline & Finalists standings */}
                <div className="lg:col-span-2 space-y-6">
                  {/* Timeline */}
                  <div className="glass-card p-6 rounded-3xl border border-slate-900 text-left">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200 mb-4 flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-ping"></span> Live Finalists Progress Timeline
                    </h3>
                    <div className="space-y-5">
                      {teams.filter(t => t.route_id === 'championship' || t.is_finalist).length === 0 ? (
                        <p className="text-xs text-slate-500 py-4">No finalists initialized yet.</p>
                      ) : (
                        teams.filter(t => t.route_id === 'championship' || t.is_finalist).map((f, i) => {
                          const routeClues = clues.filter(c => c.route_id === f.route_id);
                          const total = routeClues.length || 3;
                          const completed = f.status === 'finished' ? total : Math.max(0, (f.current_sequence || 1) - 1);
                          const progress = Math.round((completed / total) * 100);
                          return (
                            <div key={i} className="space-y-1.5">
                              <div className="flex justify-between items-center text-xs">
                                <span className="font-bold text-slate-200">{f.team_name}</span>
                                <span className="font-mono text-slate-400 font-semibold">{completed} / {total} Clues ({progress}%)</span>
                              </div>
                              <div className="flex items-center gap-3">
                                <div className="flex-1 bg-slate-950 border border-slate-900 h-3 rounded-full overflow-hidden">
                                  <div className="bg-gradient-to-r from-purple-500 to-pink-500 h-full rounded-full transition-all duration-500" style={{ width: `${progress}%` }}></div>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* Finalists Table Cards */}
                  <div className="glass-card p-6 rounded-3xl border border-slate-900 text-left">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200 mb-4">
                      Qualified Finalists Status
                    </h3>
                    <div className="grid md:grid-cols-3 gap-4">
                      {teams.filter(t => t.route_id === 'championship' || t.is_finalist).map((f, idx) => {
                        const routeClues = clues.filter(c => c.route_id === f.route_id);
                        const total = routeClues.length || 3;
                        const completed = f.status === 'finished' ? total : Math.max(0, (f.current_sequence || 1) - 1);
                        const progress = Math.round((completed / total) * 100);
                        
                        let cardBorder = 'border-slate-950 bg-slate-950/20';
                        let statusColor = 'text-slate-450 bg-slate-900/40';
                        if (f.status === 'active') { cardBorder = 'border-green-500/25 bg-green-500/5'; statusColor = 'text-green-400 bg-green-500/10'; }
                        else if (f.status === 'finished') { cardBorder = 'border-blue-500/25 bg-blue-500/5'; statusColor = 'text-blue-400 bg-blue-500/10'; }
                        else if (f.status === 'waiting') { cardBorder = 'border-amber-500/25 bg-amber-500/5'; statusColor = 'text-amber-400 bg-amber-500/10'; }
                        else if (f.status === 'eliminated') { cardBorder = 'border-red-500/25 bg-red-500/5'; statusColor = 'text-red-400 bg-red-500/10'; }
                        
                        return (
                          <div key={idx} className={`p-4 rounded-2xl border ${cardBorder} space-y-3 transition-all`}>
                            <div>
                              <p className="text-xs font-black text-slate-200 truncate">{f.team_name}</p>
                              <p className="text-[9px] text-slate-500 font-bold uppercase mt-0.5">Route: {f.original_route_id?.toUpperCase()?.replace('_', ' ') || 'QUALIFIED'}</p>
                            </div>
                            <div className="space-y-1 text-[10px] text-slate-400">
                              <div>Clue: <span className="font-semibold text-slate-300">{f.status === 'finished' ? 'Finished' : `Clue #${f.current_sequence || 1}`}</span></div>
                              <div>Progress: <span className="font-semibold text-purple-400">{progress}% Done</span></div>
                              <div>Duration: <span className="font-semibold text-slate-300 font-mono">{f.status === 'finished' || f.status === 'active' ? `${Math.floor(calculateElapsedSeconds(f)/60)}m ${calculateElapsedSeconds(f)%60}s` : '-'}</span></div>
                            </div>
                            <span className={`inline-flex px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${statusColor}`}>
                              {f.status}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Standings Table */}
                  <div className="glass-card rounded-3xl border border-slate-900 overflow-hidden text-left">
                    <div className="px-6 py-4 border-b border-slate-900 flex justify-between items-center">
                      <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200">
                        🏆 Championship Live Standings
                      </h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left">
                        <thead>
                          <tr className="bg-slate-900/40 text-[10px] text-slate-500 font-bold uppercase border-b border-slate-900">
                            <th className="py-3 px-6 text-center">Rank</th>
                            <th className="py-3 px-6">Team</th>
                            <th className="py-3 px-6">Current Clue</th>
                            <th className="py-3 px-6">Progress</th>
                            <th className="py-3 px-6 text-right">Elapsed Time</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sortedLeaderboard.filter(t => t.route_id === 'championship').map((team, idx) => (
                            <tr key={team.id} className="border-b border-slate-900/20 hover:bg-slate-900/10">
                              <td className="py-3.5 px-6 text-center font-bold text-yellow-400">#{idx + 1}</td>
                              <td className="py-3.5 px-6 font-bold text-slate-200">{team.team_name}</td>
                              <td className="py-3.5 px-6 font-mono text-slate-400">{team.status === 'finished' ? 'Finished' : `Clue ${team.current_sequence || 1}`}</td>
                              <td className="py-3.5 px-6 text-purple-400 font-bold">
                                {Math.round(getTeamProgressPercent(team))}% ({team.status === 'finished' ? (clues.filter(c => c.route_id === team.route_id).length || 3) : Math.max(0, (team.current_sequence || 1) - 1)} / {clues.filter(c => c.route_id === team.route_id).length || 3})
                              </td>
                              <td className="py-3.5 px-6 text-right font-mono text-slate-300 pr-6">
                                {team.status === 'finished' || team.status === 'active' ? `${Math.floor(calculateElapsedSeconds(team)/60)}m ${calculateElapsedSeconds(team)%60}s` : '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* MODALS */}
      {/* 1. Add/Edit Team Modal */}
      {showTeamModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card w-full max-w-lg p-6 rounded-3xl border border-slate-850 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold">{teamForm.id ? 'Edit Team Details' : 'Register New Team'}</h3>
              <button onClick={() => setShowTeamModal(false)} className="p-1 text-slate-400 hover:text-slate-200"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={saveTeam} className="space-y-4 text-left">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Team Name</label>
                  <input type="text" value={teamForm.team_name} onChange={(e) => setTeamForm({ ...teamForm, team_name: e.target.value })} className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 text-xs outline-none focus:border-purple-500" required />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">College Name</label>
                  <input type="text" value={teamForm.college_name} onChange={(e) => setTeamForm({ ...teamForm, college_name: e.target.value })} className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 text-xs outline-none focus:border-purple-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Department</label>
                  <input type="text" value={teamForm.department} onChange={(e) => setTeamForm({ ...teamForm, department: e.target.value })} className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 text-xs outline-none focus:border-purple-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Leader Name</label>
                  <input type="text" value={teamForm.leader_name} onChange={(e) => setTeamForm({ ...teamForm, leader_name: e.target.value })} className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 text-xs outline-none focus:border-purple-500" required />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Leader Email</label>
                  <input type="email" value={teamForm.leader_email} onChange={(e) => setTeamForm({ ...teamForm, leader_email: e.target.value })} className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 text-xs outline-none focus:border-purple-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Leader Phone</label>
                  <input type="text" value={teamForm.phone} onChange={(e) => setTeamForm({ ...teamForm, phone: e.target.value })} className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 text-xs outline-none focus:border-purple-500" required />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Number of Members</label>
                  <input type="number" min="1" max="10" value={teamForm.num_members} onChange={(e) => setTeamForm({ ...teamForm, num_members: parseInt(e.target.value) })} className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 text-xs outline-none focus:border-purple-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Assigned Route</label>
                  <select value={teamForm.route_id} onChange={(e) => setTeamForm({ ...teamForm, route_id: e.target.value })} className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 text-xs outline-none">
                    <option value="">-- None --</option>
                    {routes.map(r => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Member Names (comma-separated)</label>
                <input type="text" value={teamForm.member_names} onChange={(e) => setTeamForm({ ...teamForm, member_names: e.target.value })} placeholder="John, Jane, Bob..." className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 text-xs outline-none focus:border-purple-500" />
              </div>
              {teamForm.id && (
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Team Status</label>
                  <select value={teamForm.status} onChange={(e) => setTeamForm({ ...teamForm, status: e.target.value })} className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 text-xs outline-none">
                    <option value="registered">Registered</option>
                    <option value="checked_in">Checked In</option>
                    <option value="active">Active</option>
                    <option value="finished">Finished</option>
                    <option value="paused">Paused</option>
                    <option value="disqualified">Disqualified</option>
                  </select>
                </div>
              )}
              <div className="flex justify-end gap-2 border-t border-slate-900 pt-4 mt-6">
                <button type="button" onClick={() => setShowTeamModal(false)} className="px-4 py-2 bg-slate-900 hover:bg-slate-850 rounded-xl text-slate-400 text-xs font-bold">Cancel</button>
                <button type="submit" className="px-5 py-2 bg-purple-600 hover:bg-purple-500 rounded-xl text-white text-xs font-bold">Save Details</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Route Modal */}
      {showRouteModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card w-full max-w-sm p-6 rounded-3xl border border-slate-850">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold">{routeForm.id ? 'Edit Route' : 'Create Route'}</h3>
              <button onClick={() => setShowRouteModal(false)} className="p-1 text-slate-400 hover:text-slate-200"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={saveRoute} className="space-y-4 text-left">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Route Name</label>
                <input type="text" value={routeForm.name} onChange={(e) => setRouteForm({ ...routeForm, name: e.target.value })} className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 text-xs outline-none focus:border-purple-500" required />
              </div>
              <div className="flex justify-end gap-2 border-t border-slate-900 pt-4 mt-6">
                <button type="button" onClick={() => setShowRouteModal(false)} className="px-4 py-2 bg-slate-900 hover:bg-slate-850 rounded-xl text-slate-400 text-xs font-bold">Cancel</button>
                <button type="submit" className="px-5 py-2 bg-purple-600 hover:bg-purple-500 rounded-xl text-white text-xs font-bold">Save Route</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Clue Modal */}
      {showClueModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card w-full max-w-md p-6 rounded-3xl border border-slate-850">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold">{clueForm.id ? 'Edit Clue Clue' : 'Create Clue Clue'}</h3>
              <button onClick={() => setShowClueModal(false)} className="p-1 text-slate-400 hover:text-slate-200"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={saveClue} className="space-y-4 text-left">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Assigned Route</label>
                  <select value={clueForm.route_id} onChange={(e) => setClueForm({ ...clueForm, route_id: e.target.value })} className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 text-xs outline-none" required>
                    <option value="">-- Choose Route --</option>
                    {routes.map(r => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Sequence Number</label>
                  <input type="number" min="1" value={clueForm.sequence} onChange={(e) => setClueForm({ ...clueForm, sequence: e.target.value })} className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 text-xs outline-none focus:border-purple-500" required />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Location Name</label>
                <input type="text" value={clueForm.location_name} onChange={(e) => setClueForm({ ...clueForm, location_name: e.target.value })} className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 text-xs outline-none focus:border-purple-500" required />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Riddle Clue Text</label>
                <textarea value={clueForm.clue_text} onChange={(e) => setClueForm({ ...clueForm, clue_text: e.target.value })} className="w-full px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 text-xs outline-none focus:border-purple-500" rows="3" required />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Answer Location</label>
                <input type="text" value={clueForm.answer} onChange={(e) => setClueForm({ ...clueForm, answer: e.target.value })} className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 text-xs outline-none focus:border-purple-500" required />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Hint text (optional)</label>
                <input type="text" value={clueForm.hint} onChange={(e) => setClueForm({ ...clueForm, hint: e.target.value })} className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 text-xs outline-none focus:border-purple-500" />
              </div>
              <div className="flex justify-end gap-2 border-t border-slate-900 pt-4 mt-6">
                <button type="button" onClick={() => setShowClueModal(false)} className="px-4 py-2 bg-slate-900 hover:bg-slate-850 rounded-xl text-slate-400 text-xs font-bold">Cancel</button>
                <button type="submit" className="px-5 py-2 bg-purple-600 hover:bg-purple-500 rounded-xl text-white text-xs font-bold">Save Clue</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Generate Routes Modal */}
      {showGenerateModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card w-full max-w-sm p-6 rounded-3xl border border-slate-850">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold">Bulk Generate Routes</h3>
              <button onClick={() => setShowGenerateModal(false)} className="p-1 text-slate-400 hover:text-slate-200"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleBulkGenerateRoutes} className="space-y-4 text-left">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Number of Routes</label>
                <input type="number" min="1" max="10" value={generateForm.num_routes} onChange={(e) => setGenerateForm({ ...generateForm, num_routes: parseInt(e.target.value) })} className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 text-xs outline-none focus:border-purple-500" required />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Route Name Prefix</label>
                <input type="text" value={generateForm.route_prefix} onChange={(e) => setGenerateForm({ ...generateForm, route_prefix: e.target.value })} className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 text-xs outline-none focus:border-purple-500" required />
              </div>
              <div className="flex justify-end gap-2 border-t border-slate-900 pt-4 mt-6">
                <button type="button" onClick={() => setShowGenerateModal(false)} className="px-4 py-2 bg-slate-900 hover:bg-slate-850 rounded-xl text-slate-400 text-xs font-bold">Cancel</button>
                <button type="submit" className="px-5 py-2 bg-purple-600 hover:bg-purple-500 rounded-xl text-white text-xs font-bold">Generate</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
