'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/axios';
import { useAuthStore } from '@/store/authStore';
import { AccessRequest } from '@/types';
import { formatDistanceToNow } from 'date-fns';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  ShieldCheck,
  Clock,
  CheckCircle,
  XCircle,
  Calendar,
  Image as ImageIcon,
  RefreshCw,
  Lock,
} from 'lucide-react';

type FilterType = 'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED';

export default function MyAccessRequestsPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('ALL');
  const [reRequestingId, setReRequestingId] = useState<string | null>(null);

  useEffect(() => {
    if (user && user.role !== 'PHOTOGRAPHER' && user.role !== 'CLUB_MEMBER') {
      router.push('/');
      return;
    }
    if (user) fetchRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, filter]);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const res = await api.get(
        `/events/my-access-requests?status=${filter}`
      );
      setRequests(res.data.data || []);
    } catch {
      toast.error('Failed to load your access requests');
    } finally {
      setLoading(false);
    }
  };

  const handleReRequest = async (request: AccessRequest) => {
    setReRequestingId(request.id);
    try {
      const endpoint =
        request.type === 'EVENT'
          ? `/events/${request.targetId}/request-access`
          : `/albums/${request.targetId}/request-access`;
      await api.post(endpoint);
      toast.success('Access request re-submitted!');
      fetchRequests();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to re-submit request');
    } finally {
      setReRequestingId(null);
    }
  };

  const StatusBadge = ({ status }: { status: string }) => {
    if (status === 'PENDING')
      return (
        <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
          <Clock className="w-3 h-3" /> Pending
        </span>
      );
    if (status === 'APPROVED')
      return (
        <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CheckCircle className="w-3 h-3" /> Approved
        </span>
      );
    return (
      <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">
        <XCircle className="w-3 h-3" /> Rejected
      </span>
    );
  };

  const targetLink = (request: AccessRequest) => {
    if (!request.target) return null;
    const href =
      request.type === 'EVENT'
        ? `/events/${request.targetId}`
        : `/events/albums/${request.targetId}`;
    return href;
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Lock className="w-6 h-6 text-primary-400" />
          My Access Requests
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Track your requests to access private events and albums
        </p>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-1 border-b border-[#e7e3dd]">
        {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as FilterType[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              filter === f
                ? 'border-primary-500 text-primary-400'
                : 'border-transparent text-slate-400 hover:text-[#2a2724]'
            }`}
          >
            {f.charAt(0) + f.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 skeleton" />
          ))}
        </div>
      ) : requests.length === 0 ? (
        <div className="text-center py-16 card">
          <ShieldCheck className="w-16 h-16 text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">No access requests</h3>
          <p className="text-slate-400 text-sm mb-6">
            {filter === 'ALL'
              ? "You haven't requested access to any private events or albums yet."
              : `No ${filter.toLowerCase()} requests.`}
          </p>
          <Link href="/events" className="btn-primary text-sm">
            Browse Events
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((request, i) => {
            const link = targetLink(request);
            return (
              <motion.div
                key={request.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="card p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  {/* Icon + Info */}
                  <div className="flex items-start gap-3 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                        request.type === 'EVENT'
                          ? 'bg-primary-900/50'
                          : 'bg-primary-900/50'
                      }`}
                    >
                      {request.type === 'EVENT' ? (
                        <Calendar className="w-5 h-5 text-primary-400" />
                      ) : (
                        <ImageIcon className="w-5 h-5 text-primary-400" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span
                          className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${
                            request.type === 'EVENT'
                              ? 'bg-primary-900/40 text-primary-400 border-primary-800/50'
                              : 'bg-primary-900/40 text-primary-400 border-primary-800/50'
                          }`}
                        >
                          {request.type === 'EVENT' ? (
                            <Calendar className="w-3 h-3" />
                          ) : (
                            <ImageIcon className="w-3 h-3" />
                          )}
                          {request.type}
                        </span>
                        <StatusBadge status={request.status} />
                      </div>
                      <p className="text-sm font-medium">
                        {link ? (
                          <Link
                            href={link}
                            className="hover:text-primary-400 transition-colors"
                          >
                            {request.target?.name ?? 'Unknown'}
                          </Link>
                        ) : (
                          request.target?.name ?? 'Unknown'
                        )}
                      </p>
                      {request.type === 'ALBUM' && (request.target as any)?.event && (
                        <p className="text-xs text-slate-500 mt-0.5">
                          in {(request.target as any).event.name}
                        </p>
                      )}
                      <p className="text-xs text-slate-500 mt-1">
                        Requested{' '}
                        {formatDistanceToNow(new Date(request.createdAt), {
                          addSuffix: true,
                        })}
                      </p>
                    </div>
                  </div>

                  {/* Action */}
                  <div className="flex-shrink-0">
                    {request.status === 'APPROVED' && link && (
                      <Link
                        href={link}
                        className="flex items-center gap-1 px-3 py-1.5 bg-green-700 hover:bg-green-600 text-white text-sm rounded-lg transition-colors"
                      >
                        <CheckCircle className="w-4 h-4" />
                        View
                      </Link>
                    )}
                    {request.status === 'REJECTED' && (
                      <button
                        onClick={() => handleReRequest(request)}
                        disabled={reRequestingId === request.id}
                        className="flex items-center gap-1 px-3 py-1.5 bg-[#f0ede8] hover:bg-[#e7e3dd] disabled:opacity-50 text-white text-sm rounded-lg transition-colors"
                      >
                        <RefreshCw
                          className={`w-4 h-4 ${
                            reRequestingId === request.id ? 'animate-spin' : ''
                          }`}
                        />
                        Re-request
                      </button>
                    )}
                    {request.status === 'PENDING' && (
                      <span className="text-xs text-yellow-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Awaiting review
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
