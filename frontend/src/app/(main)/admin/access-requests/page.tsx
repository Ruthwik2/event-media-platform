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
ShieldCheck, Clock, CheckCircle, XCircle, Calendar, Image as ImageIcon,
} from 'lucide-react';
type FilterType = 'PENDING' | 'APPROVED' | 'REJECTED' | 'ALL';
export default function AccessRequestsPage() {
const { user } = useAuthStore();
const router = useRouter();
const [requests, setRequests] = useState<AccessRequest[]>([]);
const [loading, setLoading] = useState(true);
const [filter, setFilter] = useState<FilterType>('PENDING');
const [processing, setProcessing] = useState<string | null>(null);
useEffect(() => {
if (user && user.role !== 'ADMIN') {
router.push('/');
return;
}
if (user) fetchRequests();
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [user, filter]);
const fetchRequests = async () => {
setLoading(true);
try {
const [eventRes, albumRes] = await Promise.all([
api.get(`/events/access-requests?status=${filter}`),
api.get(`/albums/access-requests?status=${filter}`),
]);
const combined: AccessRequest[] = [
...(eventRes.data.data || []),
...(albumRes.data.data || []),
].sort(
(a, b) =>
new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
);
setRequests(combined);
} catch {
toast.error('Failed to load access requests');
} finally {
setLoading(false);
}
};
const handleDecision = async (
request: AccessRequest,
status: 'APPROVED' | 'REJECTED'
) => {
setProcessing(request.id);
try {
const endpoint =
request.type === 'EVENT'
? `/events/access-requests/${request.id}`
: `/albums/access-requests/${request.id}`;
await api.patch(endpoint, { status });
toast.success(`Request ${status.toLowerCase()}`);
// Remove from list if filter is PENDING (or refresh for other filters)
if (filter === 'PENDING') {
setRequests((prev) => prev.filter((r) => r.id !== request.id));
} else {
fetchRequests();
}
} catch (error: any) {
toast.error(error.response?.data?.message || 'Failed to process request');
} finally {
setProcessing(null);
}
};
const StatusBadge = ({ status }: { status: string }) => {
if (status === 'PENDING')
return (
<span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-yellow-900/40 text-yellow-400 border border-yellow-700/50">
<Clock className="w-3 h-3" /> Pending
</span>
);
if (status === 'APPROVED')
return (
<span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-900/40 text-green-400 border border-green-800/50">
<CheckCircle className="w-3 h-3" /> Approved
</span>
);
return (
<span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-red-900/40 text-red-400 border border-red-800/50">
<XCircle className="w-3 h-3" /> Rejected
</span>
);
};
return (
<div className="max-w-4xl mx-auto space-y-6">
{/* Header */}
<div>
<h1 className="text-2xl font-bold flex items-center gap-2">
<ShieldCheck className="w-6 h-6 text-primary-400" />
Access Requests
</h1>
<p className="text-slate-400 text-sm mt-1">
Manage photographer access requests for private events and albums
</p>
</div>
{/* Filter Tabs */}
<div className="flex gap-1 border-b border-slate-700">
{(['PENDING', 'APPROVED', 'REJECTED', 'ALL'] as FilterType[]).map((f) => (
<button
key={f}
onClick={() => setFilter(f)}
className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
filter === f
? 'border-primary-500 text-primary-400'
: 'border-transparent text-slate-400 hover:text-slate-200'
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
<div key={i} className="h-24 bg-slate-800 rounded-xl animate-pulse" />
))}
</div>
) : requests.length === 0 ? (
<div className="text-center py-16 card">
<ShieldCheck className="w-16 h-16 text-slate-600 mx-auto mb-4" />
<h3 className="text-lg font-medium mb-2">No requests</h3>
<p className="text-slate-400">
No {filter === 'ALL' ? '' : filter.toLowerCase()} access requests
</p>
</div>
) : (
<div className="space-y-3">
{requests.map((request, i) => (
<motion.div
key={request.id}
initial={{ opacity: 0, y: 10 }}
animate={{ opacity: 1, y: 0 }}
transition={{ delay: i * 0.03 }}
className="card p-4"
>
<div className="flex items-start justify-between gap-4">
{/* Left: user + details */}
<div className="flex items-start gap-3 min-w-0">
<div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-blue-600 flex items-center justify-center text-sm font-bold flex-shrink-0">
{(request as any).user?.fullName?.[0] ?? '?'}
</div>
<div className="min-w-0">
<div className="flex items-center gap-2 flex-wrap">
<span className="font-medium">
{(request as any).user?.fullName}
</span>
<span className="text-xs text-slate-400">
@{(request as any).user?.username}
</span>
<StatusBadge status={request.status} />
<span
className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${
request.type === 'EVENT'
? 'bg-blue-900/40 text-blue-400 border-blue-800/50'
: 'bg-purple-900/40 text-purple-400 border-purple-800/50'
}`}
>
{request.type === 'EVENT' ? (
<Calendar className="w-3 h-3" />
) : (
<ImageIcon className="w-3 h-3" />
)}
{request.type}
</span>
</div>
<p className="text-sm text-slate-400 mt-1">
Requested access to:{' '}
<span className="text-slate-200 font-medium">
{(request as any).target?.name ?? 'Unknown'}
</span>
{request.type === 'ALBUM' &&
(request as any).target?.event && (
<span className="text-slate-500">
{' '}
({(request as any).target.event.name})
</span>
)}
</p>
<p className="text-xs text-slate-500 mt-1">
{formatDistanceToNow(new Date(request.createdAt), {
addSuffix: true,
})}
</p>
</div>
</div>
{/* Right: action buttons (only for PENDING) */}
{request.status === 'PENDING' && (
<div className="flex gap-2 flex-shrink-0">
<button
onClick={() => handleDecision(request, 'APPROVED')}
disabled={processing === request.id}
className="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-sm rounded-lg transition-colors"
>
<CheckCircle className="w-4 h-4" />
Approve
</button>
<button
onClick={() => handleDecision(request, 'REJECTED')}
disabled={processing === request.id}
className="flex items-center gap-1 px-3 py-1.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-sm rounded-lg transition-colors"
>
<XCircle className="w-4 h-4" />
Reject
</button>
</div>
)}
</div>
</motion.div>
))}
</div>
)}
</div>
);
}