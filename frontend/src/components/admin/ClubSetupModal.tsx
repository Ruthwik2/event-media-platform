'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, Building2, CheckCircle2, X } from 'lucide-react';
import api from '@/lib/axios';

interface ClubSetupModalProps {
  onComplete: (clubName: string) => void;
  onDismiss?: () => void;
}

export default function ClubSetupModal({ onComplete, onDismiss }: ClubSetupModalProps) {
  const [clubName, setClubName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const handleSubmit = async () => {
    const trimmed = clubName.trim();
    if (!trimmed) {
      setError('Please enter a club name');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await api.put('/settings/club', { clubName: trimmed });
      setSaved(true);
      setTimeout(() => onComplete(trimmed), 1200);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to save. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          onClick={onDismiss}
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 20 }}
          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          className="relative w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden"
        >
          {/* Accent bar */}
          <div className="h-1 w-full bg-gradient-to-r from-blue-500 via-blue-400 to-cyan-400" />

          <div className="p-7">
            {/* Header */}
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center">
                  <Camera className="w-6 h-6 text-blue-400" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Welcome, Admin!</h2>
                  <p className="text-xs text-slate-400 mt-0.5">Let's set up your platform</p>
                </div>
              </div>
              {onDismiss && (
                <button
                  onClick={onDismiss}
                  className="text-slate-500 hover:text-slate-300 transition-colors p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Body */}
            {saved ? (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center py-6 gap-3"
              >
                <CheckCircle2 className="w-14 h-14 text-green-400" />
                <p className="text-white font-semibold text-lg">Saved!</p>
                <p className="text-slate-400 text-sm text-center">
                  <span className="text-white font-medium">{clubName}</span> is now your club name.
                  It will appear on the homepage and in all photo watermarks.
                </p>
              </motion.div>
            ) : (
              <>
                <div className="mb-2">
                  <p className="text-slate-300 text-sm leading-relaxed mb-4">
                    Set your <span className="text-blue-400 font-medium">club name</span> — it will be
                    displayed on the homepage for all users and automatically embedded in every
                    watermark when photos are downloaded.
                  </p>

                  {/* Preview watermark badge */}
                  <div className="mb-5 rounded-xl overflow-hidden bg-slate-800 border border-slate-700">
                    <div className="px-4 py-2 border-b border-slate-700">
                      <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Watermark Preview</p>
                    </div>
                    <div className="p-4 flex items-center gap-3">
                      {/* OnePlus-style icon */}
                      <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gray-900 flex items-center justify-center gap-1.5 border border-gray-700">
                        <div className="w-3.5 h-3.5 rounded-full border-2 border-white flex items-center justify-center">
                          <div className="w-1.5 h-1.5 rounded-full bg-white" />
                        </div>
                        <div className="w-0 h-0 border-l-[6px] border-l-white border-y-[4px] border-y-transparent" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-bold leading-tight truncate">
                          {clubName.trim() || <span className="text-slate-500 italic">Your Club Name</span>}
                          {clubName.trim() && <span className="text-slate-400 font-normal">  •  Event Name</span>}
                        </p>
                        <div className="h-px bg-slate-600 my-1" />
                        <p className="text-slate-400 text-xs">
                          @username  ·  {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}  ·  PHOTOGRAPHER
                        </p>
                      </div>
                    </div>
                  </div>

                  <label className="block text-sm font-medium text-slate-300 mb-2 flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-slate-400" />
                    Club / Organisation Name
                  </label>
                  <input
                    type="text"
                    value={clubName}
                    onChange={(e) => { setClubName(e.target.value); setError(''); }}
                    onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                    placeholder="e.g. Photography Club, NIT Warangal"
                    className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors text-sm"
                    autoFocus
                  />
                  {error && (
                    <p className="mt-2 text-red-400 text-xs flex items-center gap-1">
                      <span>⚠</span> {error}
                    </p>
                  )}
                </div>

                <div className="flex gap-3 mt-6">
                  {onDismiss && (
                    <button
                      onClick={onDismiss}
                      className="flex-1 py-2.5 rounded-lg border border-slate-600 text-slate-300 text-sm hover:bg-slate-800 transition-colors"
                    >
                      Skip for now
                    </button>
                  )}
                  <button
                    onClick={handleSubmit}
                    disabled={loading || !clubName.trim()}
                    className="flex-1 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm transition-colors"
                  >
                    {loading ? 'Saving…' : 'Save Club Name'}
                  </button>
                </div>
              </>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
