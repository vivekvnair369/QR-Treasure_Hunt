import React from 'react';

export default function Footer() {
  return (
    <footer className="w-full py-6 text-center text-[11px] text-slate-650 font-medium tracking-wider uppercase border-t border-slate-900/30 bg-slate-950/20 backdrop-blur-sm z-20 mt-8">
      © {new Date().getFullYear()} Aitheron ML. Developed by <span className="text-slate-400 hover:text-purple-400 transition-colors font-bold">Vivek V Nair</span>
    </footer>
  );
}
