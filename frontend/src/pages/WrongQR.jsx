import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AlertCircle, ArrowLeft } from 'lucide-react';

export default function WrongQR() {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Extract error message from router navigation state (e.g. from ScanView)
  const message = location.state?.message || "Wrong QR. Please find your assigned QR.";

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center p-6 text-center">
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-80 h-80 rounded-full glow-blue animate-pulse-slow pointer-events-none"></div>

      <div className="z-10 max-w-md w-full glass-card p-8 rounded-3xl border border-red-500/20 shadow-2xl">
        <div className="inline-flex p-4 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 mb-6">
          <AlertCircle className="w-12 h-12" />
        </div>

        <h2 className="text-3xl font-extrabold text-slate-100 mb-4">Invalid Scan!</h2>
        <p className="text-slate-400 text-base mb-8 leading-relaxed">
          {message}
        </p>

        <button 
          onClick={() => navigate('/dashboard')}
          className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl bg-slate-800 border border-slate-700 hover:bg-slate-700 hover:border-slate-600 text-slate-200 font-semibold transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </button>
      </div>
    </div>
  );
}
