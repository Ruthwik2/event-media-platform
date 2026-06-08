'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/axios';
import { useAuthStore } from '@/store/authStore';
import { Event, Album } from '@/types';
import {
  Calendar, User, Plus, ImageIcon, ArrowLeft, Trash2,
  Lock, Globe, ShieldAlert, Clock, XCircle, FolderOpen, Images,
  Pencil, Check, X as XIcon, QrCode,
} from 'lucide-react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import CreateAlbumModal from '@/components/albums/CreateAlbumModal';
import ShareEventModal from '@/components/events/ShareEventModal';

export default function EventDetailPage() {
  const { id } = useParams();
  const { user } = useAuthStore();
  const router = useRouter();
  const [event, setEvent] = useState<Event | null>(null);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateAlbum, setShowCreateAlbum] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [deletingAlbumId, setDeletingAlbumId] = useState<string | null>(null);
  const [confirmDeleteEvent, setConfirmDeleteEvent] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const [requestStatus, setRequestStatus] = useState<string | null>(null);
  const [requesting, setRequesting] = useState(false);

  // ── Rename state ─────────────────────────────────────────────────────────
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [renameSaving, setRenameSaving] = useState(false);

  useEffect(() => {
    fetchEvent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchEvent = async () => {
    try {
      const res = await api.get(`/events/${id}`);
      setEvent(res.data.data);
      setAlbums(res.data.data.albums || []);
    } catch (error: any) {
      if (error.response?.status === 403) {
        setAccessDenied(true);
        setRequestStatus(error.response?.data?.requestStatus ?? null);
      } else if (error.response?.status === 404) {
        toast.error('Event not found');
        router.push('/events');
      } else {
        toast.error(error.response?.data?.message || 'Failed to load event');
        router.push('/events');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRequestAccess = async () => {
    setRequesting(true);
    try {
      await api.post(`/events/${id}/request-access`);
      toast.success('Access request sent to Admin!');
      setRequestStatus('PENDING');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to send request');
    } finally {
      setRequesting(false);
    }
  };

  const handleDeleteEvent = async () => {
    try {
      await api.delete(`/events/${id}`);
      toast.success('Event deleted');
      router.push('/events');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to delete');
    }
  };

  const handleDeleteAlbum = async (albumId: string, albumName: string) => {
    if (!confirm(`Delete album "${albumName}"? This cannot be undone.`)) return;
    setDeletingAlbumId(albumId);
    try {
      await api.delete(`/albums/${albumId}`);
      toast.success('Album deleted');
      setAlbums((prev) => prev.filter((a) => a.id !== albumId));
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to delete album');
    } finally {
      setDeletingAlbumId(null);
    }
  };

  // ── Rename handlers ───────────────────────────────────────────────────────
  const startRename = () => {
    if (!event) return;
    setRenameValue(event.name);
    setIsRenaming(true);
  };

  const cancelRename = () => {
    setIsRenaming(false);
    setRenameValue('');
  };

  const saveRename = async () => {
    if (!event || !renameValue.trim()) return;
    if (renameValue.trim() === event.name) { cancelRename(); return; }
    setRenameSaving(true);
    try {
      const res = await api.patch(`/events/${id}/rename`, { name: renameValue.trim() });
      setEvent((prev) => prev ? { ...prev, name: res.data.data.name } : prev);
      toast.success('Event renamed');
      setIsRenaming(false);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to rename');
    } finally {
      setRenameSaving(false);
    }
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') saveRename();
    if (e.key === 'Escape') cancelRename();
  };

  // ── Loading skeleton ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto">
        <div className="h-8 w-32 bg-[#f8f7f5] rounded-lg animate-pulse" />
        <div className="h-56 bg-[#f8f7f5] rounded-2xl animate-pulse" />
        <div className="h-6 w-48 bg-[#f8f7f5] rounded animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-44 bg-[#f8f7f5] rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  // ── Access Denied UI ──────────────────────────────────────────────────────
  if (accessDenied) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="card p-10 max-w-md w-full">
          <div className="w-16 h-16 bg-red-900/30 rounded-2xl flex items-center justify-center mx-auto mb-5 ring-1 ring-red-800/40">
            <ShieldAlert className="w-8 h-8 text-red-400" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Access Restricted</h1>
          <p className="text-slate-400 mb-6 text-sm leading-relaxed">
            This event is private. You do not have permission to view its contents.
          </p>
          {user?.role === 'PHOTOGRAPHER' && (
            <div className="space-y-3 mb-6">
              {requestStatus === 'PENDING' && (
                <div className="flex items-center gap-2 px-4 py-3 bg-yellow-900/20 border border-yellow-700/40 rounded-xl text-yellow-400 text-sm">
                  <Clock className="w-4 h-4 flex-shrink-0" />
                  <span>Access request pending admin review</span>
                </div>
              )}
              {requestStatus === 'REJECTED' && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 px-4 py-3 bg-red-900/20 border border-red-700/40 rounded-xl text-red-400 text-sm">
                    <XCircle className="w-4 h-4 flex-shrink-0" />
                    <span>Your previous request was rejected</span>
                  </div>
                  <button onClick={handleRequestAccess} disabled={requesting} className="btn-primary w-full justify-center">
                    {requesting ? 'Sending…' : 'Request Access Again'}
                  </button>
                </div>
              )}
              {!requestStatus && (
                <button onClick={handleRequestAccess} disabled={requesting} className="btn-primary w-full justify-center">
                  {requesting ? 'Sending…' : 'Request Access from Admin'}
                </button>
              )}
            </div>
          )}
          <button onClick={() => router.push('/events')} className="btn-secondary w-full justify-center">
            <ArrowLeft className="w-4 h-4" /> Back to Events
          </button>
        </div>
      </div>
    );
  }

  if (!event) return null;

  const isOwner = user?.id === (event.creator as any)?.id || user?.role === 'ADMIN';
  const canCreateAlbum = user && ['ADMIN', 'PHOTOGRAPHER'].includes(user.role);
  const canDeleteAlbum = (_album: Album) =>
    user?.role === 'ADMIN' || user?.id === (event.creator as any)?.id;
  const visibleAlbums = albums.filter((album) => {
    if (album.visibility === 'PUBLIC') return true;
    if (!user || user?.role === 'VIEWER') return false;
    return true;
  });

  return (
    <div className="space-y-6 max-w-5xl mx-auto">

      {/* Back link */}
      <Link
        href="/events"
        className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-[#4a4540] transition-colors group"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
        Back to Events
      </Link>

      {/* ── Event Hero Card ── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="rounded-2xl overflow-hidden border border-[#e7e3dd]/80 bg-gradient-to-br from-primary-950/70 via-slate-900 to-primary-900/50"
      >
        {/* Hero body */}
        <div className="px-7 pt-7 pb-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              {/* Badges */}
              <div className="flex flex-wrap gap-2 mb-3">
                <span
                  className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${
                    event.visibility === 'PUBLIC'
                      ? 'bg-green-900/40 text-green-400 border-green-800/60'
                      : 'bg-red-900/40 text-red-400 border-red-800/60'
                  }`}
                >
                  {event.visibility === 'PUBLIC' ? (
                    <><Globe className="w-3 h-3" /> Public</>
                  ) : (
                    <><Lock className="w-3 h-3" /> Private</>
                  )}
                </span>
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border bg-[#f8f7f5] text-[#6b6560] border-[#e7e3dd]">
                  {event.category}
                </span>
              </div>

              {/* Inline rename or title */}
              {isRenaming ? (
                <div className="flex items-center gap-2 mt-1">
                  <input
                    autoFocus
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={handleRenameKeyDown}
                    className="flex-1 bg-[#f8f7f5] border border-primary-600 rounded-lg px-3 py-2 text-2xl font-extrabold text-[#2a2724] focus:outline-none focus:ring-2 focus:ring-primary-500 min-w-0"
                    maxLength={120}
                    disabled={renameSaving}
                  />
                  <button
                    onClick={saveRename}
                    disabled={renameSaving || !renameValue.trim()}
                    className="p-2 rounded-lg bg-primary-600 hover:bg-primary-500 text-white transition-colors disabled:opacity-50"
                    title="Save"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    onClick={cancelRename}
                    disabled={renameSaving}
                    className="p-2 rounded-lg bg-[#f0ede8] hover:bg-[#e7e3dd] text-[#6b6560] transition-colors"
                    title="Cancel"
                  >
                    <XIcon className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 group/title">
                  <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-[#2a2724]">
                    {event.name}
                  </h1>
                  {isOwner && (
                    <button
                      onClick={startRename}
                      title="Rename event"
                      className="p-1.5 rounded-lg text-slate-600 hover:text-[#4a4540] hover:bg-[#f0ede8]/60 transition-all opacity-0 group-hover/title:opacity-100"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}

              {event.description && (
                <p className="mt-2 text-slate-400 text-sm leading-relaxed max-w-xl">
                  {event.description}
                </p>
              )}
            </div>

            {/* Action buttons */}
            {isOwner && (
              <div className="flex-shrink-0 mt-1 flex items-center gap-2">
                {/* Share button */}
                <button
                  onClick={() => setShowShare(true)}
                  title="Share event"
                  className="p-2 hover:bg-primary-600/20 border border-[#e7e3dd]/80 hover:border-primary-500/50 text-slate-500 hover:text-primary-400 rounded-xl transition-all"
                >
                  <QrCode className="w-4 h-4" />
                </button>

                {/* Delete button */}
                {confirmDeleteEvent ? (
                  <div className="flex items-center gap-2 bg-white rounded-xl p-2 border border-red-200 shadow-lg">
                    <span className="text-xs text-red-600 px-1 font-medium">Delete event?</span>
                    <button
                      onClick={handleDeleteEvent}
                      className="text-xs bg-red-600 hover:bg-red-500 text-white px-2.5 py-1 rounded-lg transition-colors font-medium"
                    >
                      Yes
                    </button>
                    <button
                      onClick={() => setConfirmDeleteEvent(false)}
                      className="text-xs bg-[#f0ede8] hover:bg-[#e7e3dd] text-[#4a4540] px-2.5 py-1 rounded-lg transition-colors font-medium"
                    >
                      No
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmDeleteEvent(true)}
                    title="Delete event"
                    className="p-2 hover:bg-red-600/20 border border-[#e7e3dd]/80 hover:border-red-500/50 text-slate-500 hover:text-red-400 rounded-xl transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Meta strip */}
        <div className="flex flex-wrap gap-x-6 gap-y-2 px-7 py-4 border-t border-[#e7e3dd]/60 bg-[#faf9f7]">
          <span className="flex items-center gap-1.5 text-sm text-[#6b6560]">
            <Calendar className="w-3.5 h-3.5 text-primary-500" />
            {format(new Date(event.startDate), 'MMM dd, yyyy')}
            {event.endDate && <> – {format(new Date(event.endDate), 'MMM dd, yyyy')}</>}
          </span>
          <span className="flex items-center gap-1.5 text-sm text-[#6b6560]">
            <User className="w-3.5 h-3.5 text-primary-500" />
            {(event.creator as any)?.fullName}
          </span>
          <span className="flex items-center gap-1.5 text-sm text-[#6b6560]">
            <Images className="w-3.5 h-3.5 text-primary-500" />
            {visibleAlbums.length} {visibleAlbums.length === 1 ? 'Album' : 'Albums'}
          </span>
        </div>
      </motion.div>

      {/* ── Albums Section ── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-[#4a4540]">
            Albums
            <span className="ml-2 text-sm font-normal text-slate-500">
              ({visibleAlbums.length})
            </span>
          </h2>
          {canCreateAlbum && (
            <button
              onClick={() => setShowCreateAlbum(true)}
              className="btn-primary text-sm"
            >
              <Plus className="w-4 h-4" /> Create Album
            </button>
          )}
        </div>

        {visibleAlbums.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <AnimatePresence>
              {visibleAlbums.map((album, i) => (
                <motion.div
                  key={album.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: i * 0.05 }}
                  className="relative group"
                >
                  <Link href={`/events/albums/${album.id}`}>
                    <div className="rounded-2xl overflow-hidden border border-[#e7e3dd] bg-white hover:border-primary-400 hover:shadow-lg cursor-pointer transition-all duration-200 hover:-translate-y-0.5">
                      {/* Thumbnail */}
                      <div className="h-36 bg-[#f0ede8] relative overflow-hidden">
                        {album.coverImage ? (
                          <img
                            src={album.coverImage}
                            alt={album.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-[#f0ede8]">
                            <FolderOpen className="w-9 h-9 text-slate-400" />
                          </div>
                        )}
                        {album.coverImage && <div className="absolute inset-0 bg-gradient-to-t from-slate-900/40 via-transparent to-transparent" />}

                        {/* Visibility badge */}
                        <div className="absolute top-2.5 left-2.5">
                          {album.visibility === 'PRIVATE' ? (
                            <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-red-50/95 text-red-700 border border-red-200 backdrop-blur-sm">
                              <Lock className="w-2.5 h-2.5" /> Private
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-green-50/95 text-green-700 border border-green-200 backdrop-blur-sm">
                              <Globe className="w-2.5 h-2.5" /> Public
                            </span>
                          )}
                        </div>

                        {/* Media count */}
                        <div className="absolute bottom-2.5 right-2.5 flex items-center gap-1 text-xs text-[#4a4540] bg-white/90 border border-[#e7e3dd] backdrop-blur-sm px-2 py-0.5 rounded-md">
                          <ImageIcon className="w-3 h-3" />
                          {(album as any)._count?.media || 0}
                        </div>
                      </div>

                      {/* Album info */}
                      <div className="px-4 py-3">
                        <h3 className="font-semibold text-[#2a2724] truncate">{album.name}</h3>
                        {album.description && (
                          <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                            {album.description}
                          </p>
                        )}
                        <p className="text-xs text-slate-600 mt-1">
                          {format(new Date(album.createdAt), 'MMM dd, yyyy')}
                        </p>
                      </div>
                    </div>
                  </Link>

                  {/* Delete album button */}
                  {canDeleteAlbum(album) && (
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        handleDeleteAlbum(album.id, album.name);
                      }}
                      disabled={deletingAlbumId === album.id}
                      title="Delete album"
                      className="absolute top-2.5 right-2.5 p-1.5 bg-white/90 hover:bg-red-600 border border-[#e7e3dd] hover:border-red-500 text-slate-500 hover:text-white rounded-lg opacity-0 group-hover:opacity-100 transition-all disabled:opacity-50 z-10 backdrop-blur-sm"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16 rounded-2xl border border-dashed border-[#e7e3dd] bg-[#f0ede8]"
          >
            <div className="w-16 h-16 bg-[#f8f7f5] rounded-2xl flex items-center justify-center mx-auto mb-4 ring-1 ring-slate-700/50">
              <FolderOpen className="w-8 h-8 text-slate-600" />
            </div>
            <p className="font-semibold text-[#6b6560] mb-1">No albums yet</p>
            <p className="text-sm text-slate-500 mb-5 max-w-xs mx-auto">
              Create an album to start organising media for this event
            </p>
            {canCreateAlbum && (
              <button
                onClick={() => setShowCreateAlbum(true)}
                className="btn-primary text-sm mx-auto"
              >
                <Plus className="w-4 h-4" /> Create First Album
              </button>
            )}
          </motion.div>
        )}
      </div>

      {showCreateAlbum && (
        <CreateAlbumModal
          eventId={id as string}
          onClose={() => setShowCreateAlbum(false)}
          onCreated={() => {
            setShowCreateAlbum(false);
            fetchEvent();
          }}
        />
      )}

      {showShare && event && (
        <ShareEventModal
          event={{ id: event.id, name: event.name, visibility: event.visibility as 'PUBLIC' | 'PRIVATE' }}
          canManage={isOwner}
          onClose={() => setShowShare(false)}
        />
      )}
    </div>
  );
}
