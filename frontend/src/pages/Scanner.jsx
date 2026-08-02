import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';
import { 
  Compass, Camera, AlertCircle, RefreshCw, ArrowLeft, 
  HelpCircle, CheckCircle, Zap, ShieldAlert, Award, Lock, Sparkles
} from 'lucide-react';
import { doc, getDoc, addDoc, collection, writeBatch, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function Scanner() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const scannerRef = useRef(null);
  const { user } = useAuth();

  // Scanning State
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  // Scan Result States
  const [resultState, setResultState] = useState('scanning'); // scanning, success, wrong_route, already_scanned, invalid_qr
  const [verifiedClue, setVerifiedClue] = useState(null);
  const [showHint, setShowHint] = useState(false);
  const [errorDetails, setErrorDetails] = useState('');

  const validateQRLocal = async (qrId, token, device) => {
    const eventSnap = await getDoc(doc(db, 'events', 'active_event'));
    if (!eventSnap.exists()) {
      throw new Error('No active event configured.');
    }
    const eventData = eventSnap.data();

    if (['draft', 'registration_open', 'registration_closed', 'ready'].includes(eventData.status)) {
      throw new Error('AITHERON ML 2026 has not started yet. QR scanning is disabled.');
    } else if (eventData.status === 'paused') {
      throw new Error('AITHERON ML 2026 is paused. Checkpoint scanning is suspended.');
    } else if (['completed', 'archived', 'timeout'].includes(eventData.status)) {
      throw new Error('AITHERON ML 2026 has ended. Scanning is inactive.');
    } else if (!['running', 'qualifying', 'championship'].includes(eventData.status)) {
      throw new Error('QR scanning is not active at this time.');
    }

    if (eventData.scans_locked) {
      throw new Error('Scanning is locked. Contact coordinator.');
    }

    const teamId = user?.uid;
    if (!teamId) {
      throw new Error('User not authenticated.');
    }
    const teamSnap = await getDoc(doc(db, 'teams', teamId));
    if (!teamSnap.exists()) {
      throw new Error('Team document not found.');
    }
    const teamData = teamSnap.data();

    if (teamData.status === 'disqualified') {
      throw new Error('Disqualified teams cannot scan checkpoints.');
    }

    const qrSnap = await getDoc(doc(db, 'qrCodes', qrId));
    if (!qrSnap.exists()) {
      await addDoc(collection(db, 'scanLogs'), {
        team_id: teamId,
        team_name: teamData.team_name,
        qr_id: qrId,
        status: 'invalid_sequence',
        timestamp: serverTimestamp(),
        device: device || 'Unknown',
        ip_address: '127.0.0.1'
      });
      throw new Error('Invalid QR code.');
    }
    const qrData = qrSnap.data();

    if (qrData.secret_token !== token) {
      throw new Error('Invalid QR secret token.');
    }

    const clueSnap = await getDoc(doc(db, 'clues', qrData.clue_id));
    if (!clueSnap.exists()) {
      throw new Error('Associated clue not found.');
    }
    const clueData = clueSnap.data();

    if (clueData.route_id !== teamData.route_id) {
      await addDoc(collection(db, 'scanLogs'), {
        team_id: teamId,
        team_name: teamData.team_name,
        qr_id: qrId,
        status: 'wrong_route',
        timestamp: serverTimestamp(),
        device: device || 'Unknown',
        ip_address: '127.0.0.1'
      });
      return { status: 'wrong_route', message: 'This QR does not belong to your assigned route.', clue: { id: qrData.clue_id, ...clueData } };
    }

    const currentSeq = teamData.current_sequence;

    const cluesQuerySnap = await getDocs(query(collection(db, 'clues'), where('route_id', '==', teamData.route_id)));
    const totalClues = cluesQuerySnap.size || 3;

    const targetSeq = clueData.sequence;
    const expectedTargetSeq = currentSeq < totalClues ? currentSeq + 1 : 1;

    if (targetSeq !== expectedTargetSeq) {
      const isAlreadyScanned = currentSeq > 1 && (targetSeq !== 1 && targetSeq <= currentSeq);
      
      if (isAlreadyScanned) {
        return { status: 'already_scanned', message: 'You have already solved this checkpoint.', clue: { id: qrData.clue_id, ...clueData } };
      } else {
        await addDoc(collection(db, 'scanLogs'), {
          team_id: teamId,
          team_name: teamData.team_name,
          qr_id: qrId,
          status: 'invalid_sequence',
          timestamp: serverTimestamp(),
          device: device || 'Unknown',
          ip_address: '127.0.0.1'
        });
        return { status: 'invalid_sequence', message: 'Checkpoint scanned out of order.', clue: { id: qrData.clue_id, ...clueData } };
      }
    }

    const isFirstClue = teamData.status === 'registered' || teamData.status === 'checked_in' || teamData.status === 'waiting';
    const isLastClue = currentSeq >= totalClues;

    const updates = {};
    let statusResult = 'success';
    const batch = writeBatch(db);

    if (isFirstClue) {
      updates.status = 'active';
      updates.start_time = serverTimestamp();
      statusResult = 'success';
    }

    let auditDetails = `Team scanned checkpoint clue #${currentSeq}.`;
    let actionType = 'team_scan';

    if (isLastClue) {
      updates.status = 'finished';
      updates.finish_time = serverTimestamp();
      statusResult = 'finished';

      if (teamData.route_id === 'championship') {
        // Championship Route completion
        const evSnapForWin = await getDoc(doc(db, 'events', 'active_event'));
        const evDataForWin = evSnapForWin.exists() ? evSnapForWin.data() : eventData;
        if (!evDataForWin.championship_winner_id) {
          updates.is_grand_winner = true;
          batch.update(doc(db, 'events', 'active_event'), {
            championship_winner_id: teamId,
            championship_winner_name: teamData.team_name
          });
          auditDetails = 'Team won the Championship Round and is crowned the Grand Champion!';
          actionType = 'team_finish';
        } else {
          updates.is_grand_winner = false;
          auditDetails = 'Team finished the Championship Route (placed after winner).';
          actionType = 'team_finish';
        }
      } else {
        // Qualifying Route completion
        const routeSnap = await getDoc(doc(db, 'routes', teamData.route_id));
        if (routeSnap.exists() && !routeSnap.data().winner_team_id) {
          updates.is_qualifying_winner = true;
          batch.update(doc(db, 'routes', teamData.route_id), {
            winner_team_id: teamId,
            winner_team_name: teamData.team_name,
            winner_finish_time: serverTimestamp()
          });
          auditDetails = 'Team completed their route as the Block Winner!';
          actionType = 'team_finish';
        } else {
          updates.is_qualifying_winner = false;
          auditDetails = 'Team completed their route (did not qualify for finals).';
          actionType = 'team_finish';
        }
      }
    } else {
      updates.current_sequence = currentSeq + 1;
    }

    // Dynamic progress calculation stored on document
    const finalSeq = isLastClue ? currentSeq : (updates.current_sequence || currentSeq);
    const finalStatus = isLastClue ? 'finished' : (updates.status || teamData.status);
    const completedCluesCount = finalStatus === 'finished' ? totalClues : Math.max(0, finalSeq - 1);
    const progressPercent = Math.round((completedCluesCount / totalClues) * 100);

    updates.progress_percent = progressPercent;
    updates.completed_clues = completedCluesCount;
    updates.total_clues = totalClues;

    batch.update(doc(db, 'teams', teamId), updates);

    batch.set(doc(collection(db, 'scanLogs')), {
      team_id: teamId,
      team_name: teamData.team_name,
      qr_id: qrId,
      status: 'valid',
      timestamp: serverTimestamp(),
      device: device || 'Unknown',
      ip_address: '127.0.0.1'
    });

    if (isFirstClue) {
      auditDetails = 'Team started the treasure hunt.';
      actionType = 'team_start';
    }

    batch.set(doc(collection(db, 'auditLogs')), {
      action_type: actionType,
      performed_by: teamData.leader_name || 'Team',
      timestamp: serverTimestamp(),
      ip_address: '127.0.0.1',
      affected_team: teamData.team_name,
      details: auditDetails
    });

    const elapsedSeconds = isLastClue 
      ? Math.max(0, Math.floor((Date.now() - (teamData.start_time ? (teamData.start_time.toMillis ? teamData.start_time.toMillis() : teamData.start_time.seconds * 1000) : Date.now())) / 1000)) 
      : 0;
    
    batch.set(doc(db, 'leaderboard', teamId), {
      team_name: teamData.team_name,
      college_name: teamData.college_name || "",
      status: updates.status || teamData.status,
      current_sequence: updates.current_sequence || teamData.current_sequence,
      elapsed_seconds: elapsedSeconds - ((teamData.bonus_time_minutes || 0) * 60) + ((teamData.time_penalty_minutes || 0) * 60),
      hints_used: teamData.hints_used || 0,
      finish_time: isLastClue ? serverTimestamp() : null,
      is_qualifying_winner: updates.is_qualifying_winner !== undefined ? updates.is_qualifying_winner : (teamData.is_qualifying_winner || false),
      is_grand_winner: updates.is_grand_winner !== undefined ? updates.is_grand_winner : (teamData.is_grand_winner || false),
      route_id: teamData.route_id,
      progress_percent: progressPercent,
      completed_clues: completedCluesCount,
      total_clues: totalClues
    }, { merge: true });

    await batch.commit();

    return { status: statusResult, clue: { id: qrData.clue_id, ...clueData, totalClues } };
  };

  // Start the QR Scanner
  const startScanner = async () => {
    setResultState('scanning');
    setErrorMsg(null);
    setTorchOn(false);

    try {
      const html5Qrcode = new Html5Qrcode("reader");
      scannerRef.current = html5Qrcode;

      await html5Qrcode.start(
        { facingMode: "environment" },
        {
          fps: 15,
          qrbox: (width, height) => {
            const size = Math.min(width, height) * 0.65;
            return { width: size, height: size };
          }
        },
        onScanSuccess,
        onScanFailure
      );

      setIsCameraActive(true);

      setTimeout(() => {
        try {
          const track = html5Qrcode.getActiveTrack();
          if (track) {
            const capabilities = track.getCapabilities();
            if (capabilities && capabilities.torch) {
              setHasTorch(true);
            }
          }
        } catch (e) {
          console.log("Torch capability check failed:", e);
        }
      }, 1000);

    } catch (err) {
      console.error("Camera start failed:", err);
      setErrorMsg("Failed to start camera. Please check permissions.");
    }
  };

  useEffect(() => {
    const qrId = searchParams.get('qr_id');
    const token = searchParams.get('token');

    if (qrId && token) {
      const verifyDirectLink = async () => {
        setLoading(true);
        try {
          const res = await validateQRLocal(qrId, token, 'Browser QR Link');
          const { status, message, clue } = res;
          setLoading(false);
          if (status === 'success' || status === 'finished') {
            setVerifiedClue(clue);
            setResultState('success');
            toast.success(message || 'QR Verified Successfully!');
          } else if (status === 'already_scanned') {
            setVerifiedClue(clue);
            setResultState('already_scanned');
          } else {
            setErrorDetails(message || 'Invalid scan parameter.');
            setResultState('invalid_qr');
          }
        } catch (err) {
          setLoading(false);
          const message = err.message || 'Verification failed.';
          if (message.includes('route')) {
            setResultState('wrong_route');
            setErrorDetails(message);
          } else if (message.includes('already')) {
            setResultState('already_scanned');
          } else if (message.includes('disqualified')) {
            setResultState('invalid_qr');
            setErrorDetails('Your team has been disqualified. Contact event coordinators.');
          } else {
            setResultState('invalid_qr');
            setErrorDetails(message);
          }
        }
      };
      verifyDirectLink();
    } else {
      startScanner();
    }

    return () => {
      stopScanner();
    };
  }, [searchParams]);

  const stopScanner = async () => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      try {
        await scannerRef.current.stop();
      } catch (err) {
        console.error("Scanner stop error:", err);
      }
    }
    setIsCameraActive(false);
    setHasTorch(false);
  };

  // Success Scanner Hook
  const onScanSuccess = async (decodedText) => {
    await stopScanner();
    setLoading(true);

    try {
      const url = new URL(decodedText);
      const qrId = url.searchParams.get('qr_id');
      const token = url.searchParams.get('token');

      if (!qrId || !token) {
        throw new Error("Invalid QR Code structure.");
      }

      const res = await validateQRLocal(qrId, token, 'Mobile Camera');
      const { status, message, clue } = res;

      setLoading(false);

      if (status === 'success' || status === 'finished') {
        setVerifiedClue(clue);
        setResultState('success');
        toast.success(message || 'QR Verified Successfully!');
      } else if (status === 'already_scanned') {
        setVerifiedClue(clue);
        setResultState('already_scanned');
        toast.error('QR Already Scanned.');
      } else {
        setErrorDetails(message || 'Invalid scan parameter.');
        setResultState('invalid_qr');
      }

    } catch (err) {
      setLoading(false);
      const message = err.message || 'QR Code recognition failed.';

      if (message.includes('route')) {
        setResultState('wrong_route');
        setErrorDetails(message);
      } else if (message.includes('already')) {
        setResultState('already_scanned');
      } else if (message.includes('disqualified')) {
        setResultState('invalid_qr');
        setErrorDetails('Your team has been disqualified. Contact event coordinators.');
      } else {
        setResultState('invalid_qr');
        setErrorDetails(message);
      }
    }
  };


  const onScanFailure = (error) => {
    // Normal failure searching for QR codes, quiet logs to avoid noise
  };

  // Toggle Torch
  const toggleTorch = async () => {
    if (!scannerRef.current || !isCameraActive) return;
    try {
      const newTorchState = !torchOn;
      await scannerRef.current.applyVideoConstraints({
        advanced: [{ torch: newTorchState }]
      });
      setTorchOn(newTorchState);
    } catch (e) {
      toast.error("Flashlight control not supported on this browser.");
    }
  };

  const getScannerProgress = () => {
    if (!verifiedClue) return { progress: 0, completed: 0, total: 3 };
    const total = verifiedClue.totalClues || 3;
    const completed = verifiedClue.sequence === 1 ? total : Math.max(0, verifiedClue.sequence - 1);
    const progress = Math.round((completed / total) * 100);
    return { progress, completed, total };
  };

  return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-8 flex flex-col items-center justify-center relative text-slate-100 overflow-hidden">
      {/* Glow backgrounds */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 glow-purple opacity-30 pointer-events-none"></div>

      <div className="z-10 max-w-md w-full flex flex-col items-center">
        {/* Event Header */}
        <div className="mb-6 text-center">
          <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500 tracking-wider">
            AITHERON ML 2026
          </h1>
          <p className="text-xs text-slate-500 uppercase tracking-widest mt-1">Symposium Treasure Hunt</p>
        </div>

        {/* 1. SCANNING INTERFACE */}
        {resultState === 'scanning' && (
          <div className="w-full glass-card p-6 rounded-3xl border border-slate-900 shadow-2xl relative flex flex-col items-center">
            {/* Header back row */}
            <div className="flex justify-between items-center w-full mb-4">
              <button 
                onClick={() => navigate('/dashboard')}
                className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" /> Cancel
              </button>
              <div className="text-xs text-slate-500 font-semibold uppercase">Built-in Scanner</div>
            </div>

            {/* Camera Viewfinder */}
            <div className="w-full relative aspect-square rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 flex items-center justify-center">
              {loading && (
                <div className="absolute inset-0 bg-slate-950/80 z-30 flex flex-col items-center justify-center p-6 text-center">
                  <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                  <p className="text-sm text-slate-300 font-semibold">Validating QR Code...</p>
                  <p className="text-xs text-slate-500 mt-1">Verifying route and security tokens...</p>
                </div>
              )}

              {errorMsg ? (
                <div className="p-6 text-center space-y-4">
                  <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
                  <p className="text-sm text-slate-300">{errorMsg}</p>
                  <button 
                    onClick={startScanner}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-xl text-xs font-bold transition-all"
                  >
                    Try Again
                  </button>
                </div>
              ) : (
                <div id="reader" className="w-full h-full relative">
                  {/* Custom Scanner Line Animation Overlay */}
                  <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-purple-500 to-pink-500 shadow-[0_0_10px_#a855f7] top-1/2 animate-scanLine z-20 pointer-events-none"></div>
                </div>
              )}
            </div>

            {/* Flashlight Toggle */}
            {hasTorch && (
              <button 
                onClick={toggleTorch}
                className={`mt-4 px-4 py-2 rounded-xl flex items-center gap-2 text-xs font-bold border transition-all ${torchOn ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' : 'bg-slate-900 border-slate-800 text-slate-400'}`}
              >
                <Zap className="w-4 h-4" />
                {torchOn ? 'Flashlight On' : 'Turn On Flashlight'}
              </button>
            )}

            <p className="text-xs text-slate-500 text-center mt-5 leading-relaxed">
              Position your camera over the official checkpoint QR code. Scanning will proceed automatically.
            </p>
          </div>
        )}

        {/* 2. SUCCESS CLUE CARD */}
        {resultState === 'success' && verifiedClue && (
          <div className="w-full glass-card p-8 rounded-3xl border border-green-500/20 shadow-2xl animate-scaleUp text-left space-y-6">
            <div className="text-center pb-2 border-b border-slate-900">
              <div className="p-3 bg-green-500/10 border border-green-500/25 rounded-full inline-flex text-green-400 mb-3">
                <CheckCircle className="w-10 h-10" />
              </div>
              <h2 className="text-xl font-bold text-slate-100">QR Verified Successfully</h2>
              <p className="text-xs text-slate-500 font-mono mt-0.5">Route: {verifiedClue.route_name}</p>
            </div>

            <div className="space-y-4">
              <span className="inline-flex px-3 py-1 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20">
                CLUE #{verifiedClue.sequence}
              </span>
              
              {/* Clue text */}
              <div className="bg-slate-950/60 border border-slate-900 p-5 rounded-2xl italic text-slate-200 font-medium text-base leading-relaxed">
                "{verifiedClue.clue_text}"
              </div>

              {/* Progress Bar */}
              <div className="space-y-2 border-t border-slate-900/60 pt-4">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-slate-400">Route Progress</span>
                  <span className="font-bold text-purple-400">{getScannerProgress().progress}%</span>
                </div>
                <div className="w-full bg-slate-950 border border-slate-900 h-2.5 rounded-full overflow-hidden">
                  <div 
                    className="bg-gradient-to-r from-purple-500 to-pink-500 h-full rounded-full transition-all duration-500" 
                    style={{ width: `${getScannerProgress().progress}%` }}
                  ></div>
                </div>
                <p className="text-[10px] text-slate-450 font-bold uppercase tracking-wider mt-1 text-purple-300">
                  Completed: {getScannerProgress().completed} / {getScannerProgress().total} Clues
                </p>
              </div>

              {/* Hint Box */}
              {verifiedClue.hint ? (
                <div>
                  <button
                    onClick={() => setShowHint(!showHint)}
                    className="inline-flex items-center gap-2 text-xs font-semibold text-purple-400 hover:text-purple-300 transition-colors"
                  >
                    <HelpCircle className="w-4 h-4" />
                    {showHint ? 'Hide Hint' : 'Need a hint?'}
                  </button>
                  {showHint && (
                    <div className="mt-2.5 p-4 rounded-xl bg-purple-950/20 border border-purple-500/15 text-purple-300 text-xs leading-relaxed animate-fadeIn">
                      💡 <strong>Hint:</strong> {verifiedClue.hint}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-[11px] text-slate-600">No hints available for this clue.</p>
              )}
            </div>

            <button 
              onClick={() => navigate('/dashboard')}
              className="w-full py-3 bg-purple-600 hover:bg-purple-500 rounded-xl text-sm font-bold text-white transition-all mt-4"
            >
              Go to Dashboard
            </button>
          </div>
        )}

        {/* 3. WRONG ROUTE CARD */}
        {resultState === 'wrong_route' && (
          <div className="w-full glass-card p-8 rounded-3xl border border-red-500/20 shadow-2xl animate-scaleUp text-center space-y-6">
            <div className="p-3 bg-red-500/10 border border-red-500/25 rounded-full inline-flex text-red-500 mb-2">
              <ShieldAlert className="w-12 h-12" />
            </div>
            
            <div>
              <h2 className="text-xl font-bold text-slate-200">Invalid QR</h2>
              <p className="text-sm text-slate-400 mt-3 leading-relaxed">
                This QR does not belong to your assigned route.
              </p>
              <p className="text-xs text-slate-500 mt-2">
                Please locate your team's QR code and try again.
              </p>
            </div>

            <div className="flex flex-col gap-2 pt-4">
              <button 
                onClick={startScanner}
                className="w-full py-3 bg-red-600 hover:bg-red-500 rounded-xl text-sm font-bold text-white transition-all"
              >
                Return to Scanner
              </button>
              <button 
                onClick={() => navigate('/dashboard')}
                className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-slate-400 rounded-xl text-xs font-semibold transition-all"
              >
                Go to Dashboard
              </button>
            </div>
          </div>
        )}

        {/* 4. ALREADY SCANNED CARD */}
        {resultState === 'already_scanned' && (
          <div className="w-full glass-card p-8 rounded-3xl border border-amber-500/20 shadow-2xl animate-scaleUp text-center space-y-6">
            <div className="p-3 bg-amber-500/10 border border-amber-500/25 rounded-full inline-flex text-amber-500 mb-2">
              <AlertCircle className="w-12 h-12 text-amber-400" />
            </div>

            <div>
              <h2 className="text-xl font-bold text-slate-200">QR Already Scanned</h2>
              <p className="text-sm text-slate-400 mt-2 leading-relaxed">
                You have already solved this location's clue.
              </p>
              <p className="text-xs text-slate-500 mt-2 font-semibold text-amber-400">
                Proceed to the next clue.
              </p>
            </div>

            <button 
              onClick={() => navigate('/dashboard')}
              className="w-full py-3 bg-amber-500 hover:bg-amber-400 hover:text-slate-950 font-bold rounded-xl text-sm transition-all"
            >
              Go to Dashboard
            </button>
          </div>
        )}

        {/* 5. INVALID QR/DAMAGED CARD */}
        {resultState === 'invalid_qr' && (
          <div className="w-full glass-card p-8 rounded-3xl border border-red-500/20 shadow-2xl animate-scaleUp text-center space-y-6">
            <div className="p-3 bg-red-500/10 border border-red-500/25 rounded-full inline-flex text-red-500 mb-2">
              <Lock className="w-12 h-12" />
            </div>

            <div>
              <h2 className="text-xl font-bold text-slate-200">Invalid QR Code</h2>
              <p className="text-sm text-slate-400 mt-3 leading-relaxed">
                {errorDetails || "Unable to recognize this QR code."}
              </p>
              <p className="text-xs text-slate-500 mt-2">
                Please contact an event coordinator if the problem persists.
              </p>
            </div>

            <div className="flex flex-col gap-2 pt-4">
              <button 
                onClick={startScanner}
                className="w-full py-3 bg-purple-600 hover:bg-purple-500 rounded-xl text-sm font-bold text-white transition-all"
              >
                Return to Scanner
              </button>
              <button 
                onClick={() => navigate('/dashboard')}
                className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-slate-400 rounded-xl text-xs font-semibold transition-all"
              >
                Go to Dashboard
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
