'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import api from '@/lib/axios';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  Clock, CheckCircle, XCircle, RefreshCw, LogOut, Camera,
  ShieldAlert, Bell,
} from 'lucide-react';

type RequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | null;

export default function PendingApprovalPage() {
  const { user, logout, fetchProfile } = useAuthStore();
  const router = useRouter();
  const [requestStatus, setRequestStatus] = useState<RequestStatus>(null);
  const [loading, setLoading] = useState(true);
  const [reRequesting, setReRequesting] = useState(false);

  useEffect(() => {
    if (!user) {
      router.replace('/login');
      return;
    }
    // If somehow approved (e.g. another tab approved them), redirect to home
    if (user.role !== 'CLUB_MEMBER') {
      router.replace('/');
      return;
    }
    if (user.isApproved) {
      router.replace('/');
      return;
    }
    fetchStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      // Check my membership requests
      const res = await api.get('/events/my-access-requests?status=ALL');
      const all = res.data.data || [];
      const membership = all.find((r: any) => r.type === 'MEMBERSHIP');
      if (membership) {
        setRequestStatus(membership.status);
        // If approved on server but not yet reflected in local state, refresh profile
        if (membership.status === 'APPROVED') {
          await fetchProfile();
          router.replace('/');
          return;
        }
      } else {
        setRequestStatus('PENDING'); // newly registered, request created at registration
      }
    } catch {
      setRequestStatus('PENDING');
    } finally {
      setLoading(false);
    }
  };

  const handleReRequest = async () => {
    setReRequesting(true);
    try {
      await api.post('/auth/membership-request');
      toast.success('Re-submitted! An admin will review your request shortly.');
      setRequestStatus('PENDING');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to re-submit request');
    } finally {
      setReRequesting(false);
    }
  };

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const handleRefresh = async () => {
    await fetchProfile();
    await fetchStatus();
    if (user?.isApproved) {
      router.replace('/');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8 bg-gradient-to-br from-slate-950 via-slate-900 to-primary-950">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-primary-500 to-primary-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Camera className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">EventMedia</h1>
        </div>

        <div className="card p-6 space-y-5">
          {loading ? (
            <div className="flex flex-col items-center py-8 gap-3">
              <div className="w-10 h-10 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
              <p className="text-slate-400 text-sm">Checking your status…</p>
            </div>
          ) : requestStatus === 'REJECTED' ? (
            <>
              {/* Rejected state */}
              <div className="flex flex-col items-center text-center gap-3 py-2">
                <div className="w-14 h-14 rounded-full bg-red-900/30 border border-red-700/40 flex items-center justify-center">
                  <XCircle className="w-7 h-7 text-red-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">Membership Declined</h2>
                  <p className="text-slate-400 text-sm mt-1 leading-relaxed">
                    Your membership request was declined by an admin. You can request again —
                    make sure your account details are complete.
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-[#e7e3dd] bg-[#f0ede8] p-4">
                <p className="text-xs text-slate-400 leading-relaxed">
                  If you believe this was a mistake, click <strong className="text-[#4a4540]">Request Again</strong> below
                  and an admin will review your account.
                </p>
              </div>

              <button
                onClick={handleReRequest}
                disabled={reRequesting}
                className="w-full btn-primary flex items-center justify-center gap-2 py-2.5"
              >
                {reRequesting ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                {reRequesting ? 'Submitting…' : 'Request Again'}
              </button>
            </>
          ) : (
            <>
              {/* Pending state */}
              <div className="flex flex-col items-center text-center gap-3 py-2">
                <div className="w-14 h-14 rounded-full bg-amber-900/30 border border-amber-200 flex items-center justify-center">
                  <ShieldAlert className="w-7 h-7 text-amber-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">Awaiting Approval</h2>
                  <p className="text-slate-400 text-sm mt-1 leading-relaxed">
                    Your club membership account is pending admin approval. You'll be notified
                    once an admin reviews your request.
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-400 flex-shrink-0" />
                  <span className="text-xs font-medium text-amber-700">What happens next?</span>
                </div>
                <ul className="text-xs text-amber-600 space-y-1 ml-6 list-disc leading-relaxed">
                  <li>An admin will review your membership request</li>
                  <li>You'll receive a notification when a decision is made</li>
                  <li>Once approved, you can access all club events and media</li>
                </ul>
              </div>

              <div className="flex items-start gap-2 p-3 rounded-lg bg-[#f0ede8] border border-[#e7e3dd]">
                <Bell className="w-4 h-4 text-primary-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-slate-400 leading-relaxed">
                  Logged in as <strong className="text-[#4a4540]">{user?.fullName}</strong>{' '}
                  ({user?.username}). You can check back later or click refresh below to see if
                  your status has changed.
                </p>
              </div>

              <button
                onClick={handleRefresh}
                className="w-full btn-secondary flex items-center justify-center gap-2 text-sm py-2.5"
              >
                <RefreshCw className="w-4 h-4" />
                Check Status
              </button>
            </>
          )}

          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 text-sm text-slate-500 hover:text-[#4a4540] transition-colors py-1"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </motion.div>
    </div>
  );
}
