'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/axios';
import { useAuthStore } from '@/store/authStore';
import { AccessRequest } from '@/types';
import { formatDistanceToNow } from 'date-fns';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  ShieldCheck, Clock, CheckCircle, XCircle, Calendar,
  Image as ImageIcon, Users,
} from 'lucide-react';

type FilterType = 'PENDING' | 'APPROVED' | 'REJECTED' | 'ALL';
type TabType = 'media' | 'members';

interface MemberRequest {
  id: string;
  userId: string;
  status: string;
  createdAt: string;
  user: {
    id: string;
    username: string;
    fullName: string;
    avatar?: string;
    email: string;
    createdAt: string;
    isApproved: boolean;
  };
}

export default function AccessRequestsPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [tab, setTab] = useState<TabType>('members');

  // Media access state
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [filter, setFilter] = useState<FilterType>('PENDING');
  const [processing, setProcessing] = useState<string | null>(null);

  // Membership state
  const [members, setMembers] = useState<MemberRequest[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [memberFilter, setMemberFilter] = useState<FilterType>('PENDING');
  const [processingMember, setProcessingMember] = useState<string | null>(null);
  const [pendingMemberCount, setPendingMemberCount] = useState(0);

  useEffect(() => {
    if (user && user.role !== 'ADMIN') { router.push('/'); return; }
    if (user) {
      // Always load pending count for badge
      api.get('/auth/membership-requests?status=PENDING')
        .then(r => setPendingMemberCount((r.data.data || []).length))
        .catch(() => {});
      if (tab === 'media') fetchRequests();
      else fetchMembers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, filter, memberFilter, tab]);

  const fetchRequests = async () => {
    setLoadingRequests(true);
    try {
      const [eventRes, albumRes] = await Promise.allSettled([
        api.get(`/events/access-requests?status=${filter}`),
        api.get(`/albums/access-requests?status=${filter}`),
      ]);
      const eventData = eventRes.status === 'fulfilled' ? (eventRes.value.data.data || []) : [];
      const albumData = albumRes.status === 'fulfilled' ? (albumRes.value.data.data || []) : [];
      const combined: AccessRequest[] = [...eventData, ...albumData].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setRequests(combined);
    } catch { toast.error('Failed to load access requests'); }
    finally { setLoadingRequests(false); }
  };

  const fetchMembers = async () => {
    setLoadingMembers(true);
    try {
      const res = await api.get(`/auth/membership-requests?status=${memberFilter}`);
      const data = res.data.data || [];
      setMembers(data);
      if (memberFilter === 'PENDING') setPendingMemberCount(data.length);
    } catch { toast.error('Failed to load membership requests'); }
    finally { setLoadingMembers(false); }
  };

  const handleDecision = async (request: AccessRequest, status: 'APPROVED' | 'REJECTED') => {
    setProcessing(request.id);
    try {
      const endpoint = request.type === 'EVENT'
        ? `/events/access-requests/${request.id}`
        : `/albums/access-requests/${request.id}`;
      await api.patch(endpoint, { status });
      toast.success(`Request ${status.toLowerCase()}`);
      if (filter === 'PENDING') setRequests(prev => prev.filter(r => r.id !== request.id));
      else fetchRequests();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to process request');
    } finally { setProcessing(null); }
  };

  const handleMemberDecision = async (req: MemberRequest, status: 'APPROVED' | 'REJECTED') => {
    setProcessingMember(req.id);
    try {
      await api.patch(`/auth/membership-requests/${req.id}`, { status });
      toast.success(status === 'APPROVED'
        ? `${req.user.fullName} approved — they can now access the platform`
        : `${req.user.fullName}'s membership declined`
      );
      if (memberFilter === 'PENDING') {
        setMembers(prev => prev.filter(m => m.id !== req.id));
        setPendingMemberCount(c => Math.max(0, c - 1));
      } else {
        fetchMembers();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to process membership');
    } finally { setProcessingMember(null); }
  };

  const StatusBadge = ({ status }: { status: string }) => {
    if (status === 'PENDING') return (
      <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-yellow-900/40 text-yellow-400 border border-yellow-700/50">
        <Clock className="w-3 h-3" /> Pending
      </span>
    );
    if (status === 'APPROVED') return (
      <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-900/40 text-green-400 border border-green-800/50">
        <CheckCircle className="w-3 h-3" /> Approved
      </span>
    );
    return (
      <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-red-900/40 text-red-400 border border-red-800/50">
        <XCircle className="w-3 h-3" /> Declined
      </span>
    );
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-primary-400" />
          Access Requests
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Manage club member approvals and photographer access requests
        </p>
      </div>

      {/* Main Tabs */}
      <div className="flex gap-1 border-b border-slate-700">
        <button
          onClick={() => setTab('members')}
          className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'members' ? 'border-primary-500 text-primary-400' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Users className="w-4 h-4" />
          Club Members
          {pendingMemberCount > 0 && (
            <span className="ml-1 px-1.5 py-0.5 text-xs bg-amber-500 text-black rounded-full font-bold leading-none">
              {pendingMemberCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab('media')}
          className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'media' ? 'border-primary-500 text-primary-400' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Calendar className="w-4 h-4" />
          Event / Album Access
        </button>
      </div>

      {/* ── MEMBERS TAB ── */}
      {tab === 'members' && (
        <>
          <div className="flex gap-1 border-b border-slate-700/50">
            {(['PENDING', 'APPROVED', 'REJECTED', 'ALL'] as FilterType[]).map(f => (
              <button key={f} onClick={() => setMemberFilter(f)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  memberFilter === f ? 'border-primary-500 text-primary-400' : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                {f.charAt(0) + f.slice(1).toLowerCase()}
              </button>
            ))}
          </div>

          {loadingMembers ? (
            <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-24 bg-slate-800 rounded-xl animate-pulse" />)}</div>
          ) : members.length === 0 ? (
            <div className="text-center py-16 card">
              <Users className="w-16 h-16 text-slate-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No membership requests</h3>
              <p className="text-slate-400">No {memberFilter === 'ALL' ? '' : memberFilter.toLowerCase()} membership requests.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {members.map((member, i) => (
                <motion.div key={member.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }} className="card p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                      {member.user.avatar ? (
                        <img src={member.user.avatar} alt={member.user.fullName} className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-blue-600 flex items-center justify-center text-sm font-bold flex-shrink-0">
                          {member.user.fullName?.[0] ?? '?'}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium">{member.user.fullName}</span>
                          <span className="text-xs text-slate-400">@{member.user.username}</span>
                          <StatusBadge status={member.status} />
                          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-900/40 text-blue-400 border border-blue-800/50">
                            Viewer → Club Member
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">{member.user.email}</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Registered {formatDistanceToNow(new Date(member.user.createdAt), { addSuffix: true })}
                          {' · '}Requested {formatDistanceToNow(new Date(member.createdAt), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                    {member.status === 'PENDING' && (
                      <div className="flex gap-2 flex-shrink-0">
                        <button onClick={() => handleMemberDecision(member, 'APPROVED')} disabled={processingMember === member.id}
                          className="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-sm rounded-lg transition-colors">
                          <CheckCircle className="w-4 h-4" /> Approve
                        </button>
                        <button onClick={() => handleMemberDecision(member, 'REJECTED')} disabled={processingMember === member.id}
                          className="flex items-center gap-1 px-3 py-1.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-sm rounded-lg transition-colors">
                          <XCircle className="w-4 h-4" /> Decline
                        </button>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── MEDIA ACCESS TAB ── */}
      {tab === 'media' && (
        <>
          <div className="flex gap-1 border-b border-slate-700/50">
            {(['PENDING', 'APPROVED', 'REJECTED', 'ALL'] as FilterType[]).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  filter === f ? 'border-primary-500 text-primary-400' : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                {f.charAt(0) + f.slice(1).toLowerCase()}
              </button>
            ))}
          </div>

          {loadingRequests ? (
            <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-24 bg-slate-800 rounded-xl animate-pulse" />)}</div>
          ) : requests.length === 0 ? (
            <div className="text-center py-16 card">
              <ShieldCheck className="w-16 h-16 text-slate-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No requests</h3>
              <p className="text-slate-400">No {filter === 'ALL' ? '' : filter.toLowerCase()} access requests</p>
            </div>
          ) : (
            <div className="space-y-3">
              {requests.map((request, i) => (
                <motion.div key={request.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }} className="card p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-blue-600 flex items-center justify-center text-sm font-bold flex-shrink-0">
                        {(request as any).user?.fullName?.[0] ?? '?'}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium">{(request as any).user?.fullName}</span>
                          <span className="text-xs text-slate-400">@{(request as any).user?.username}</span>
                          <StatusBadge status={request.status} />
                          <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${
                            request.type === 'EVENT' ? 'bg-blue-900/40 text-blue-400 border-blue-800/50' : 'bg-purple-900/40 text-purple-400 border-purple-800/50'
                          }`}>
                            {request.type === 'EVENT' ? <Calendar className="w-3 h-3" /> : <ImageIcon className="w-3 h-3" />}
                            {request.type}
                          </span>
                        </div>
                        <p className="text-sm text-slate-400 mt-1">
                          Requested access to:{' '}
                          <span className="text-slate-200 font-medium">{(request as any).target?.name ?? 'Unknown'}</span>
                          {request.type === 'ALBUM' && (request as any).target?.event && (
                            <span className="text-slate-500"> ({(request as any).target.event.name})</span>
                          )}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          {formatDistanceToNow(new Date(request.createdAt), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                    {request.status === 'PENDING' && (
                      <div className="flex gap-2 flex-shrink-0">
                        <button onClick={() => handleDecision(request, 'APPROVED')} disabled={processing === request.id}
                          className="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-sm rounded-lg transition-colors">
                          <CheckCircle className="w-4 h-4" /> Approve
                        </button>
                        <button onClick={() => handleDecision(request, 'REJECTED')} disabled={processing === request.id}
                          className="flex items-center gap-1 px-3 py-1.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-sm rounded-lg transition-colors">
                          <XCircle className="w-4 h-4" /> Reject
                        </button>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
