'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/axios';
import { useAuthStore } from '@/store/authStore';
import { Event, Album } from '@/types';
import {
  Calendar, MapPin, User, Plus, ImageIcon, ArrowLeft, Trash2,
  Lock, Globe, ShieldAlert, Clock, XCircle, FolderOpen, Images,
} from 'lucide-react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import CreateAlbumModal from '@/components/albums/CreateAlbumModal';

export default function EventDetailPage() {
  const { id } = useParams();
  const { user } = useAuthStore();
  const router = useRouter();
  const [event, setEvent] = useState<Event | null>(null);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateAlbum, setShowCreateAlbum] = useState(false);
  const [deletingAlbumId, setDeletingAlbumId] = useState<string | null>(null);
  const [confirmDeleteEvent, setConfirmDeleteEvent] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const [requestStatus, setRequestStatus] = useState<string | null>(null);
  const [requesting, setRequesting] = useState(false);

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

  // ── Loading skeleton ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-32 bg-slate-800 rounded-lg animate-pulse" />
        <div className="h-56 bg-slate-800 rounded-2xl animate-pulse" />
        <div className="h-6 w-48 bg-slate-800 rounded animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1,2,3].map(i => <div key={i} className="h-28 bg-slate-800 rounded-xl animate-pulse" />)}
        </div>
      </div>
    );
  }

  // ── Access Denied UI ──────────────────────────────────────────────────────
  if (accessDenied) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="card p-10 max-w-md w-full">
          <div className="w-16 h-16 bg-red-900/30 rounded-2xl flex items-center justify-center mx-auto mb-5">
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
  const canDeleteAlbum = (album: Album) =>
    user?.role === 'ADMIN' || user?.id === (event.creator as any)?.id;
  const visibleAlbums = albums.filter((album) => {
    if (album.visibility === 'PUBLIC') return true;
    if (!user || user?.role === 'VIEWER') return false;
    return true;
  });

  return (
    <div className="space-y-6 max-w-5xl mx-auto">

      {/* Back link */}
      <Link href="/events" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200 transition-colors group">
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
        Back to Events
      </Link>

      {/* Event Hero Card */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="card overflow-hidden"
      >
        {/* Cover image OR gradient banner */}
        {event.coverImage ? (
          <div className="h-52 md:h-72 relative">
            <img src={event.coverImage} alt={event.name} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-transparent" />
            {/* Title overlaid on image */}
            <div className="absolute bottom-0 left-0 right-0 p-6">
              <div className="flex flex-wrap gap-2 mb-3">
                <span className={event.visibility === 'PUBLIC' ? 'badge-public' : 'badge-private'}>
                  {event.visibility}
                </span>
                <span className="badge bg-primary-900/60 text-primary-300 border border-primary-700/50">
                  {event.category}
                </span>
              </div>
              <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">{event.name}</h1>
            </div>
            {isOwner && (
              <div className="absolute top-4 right-4">
                {confirmDeleteEvent ? (
                  <div className="flex items-center gap-2 bg-slate-900/90 backdrop-blur rounded-xl p-2 border border-red-800/60">
                    <span className="text-xs text-red-400 px-1">Delete event?</span>
                    <button onClick={handleDeleteEvent} className="text-xs bg-red-600 hover:bg-red-500 text-white px-2 py-1 rounded-lg transition-colors">Yes</button>
                    <button onClick={() => setConfirmDeleteEvent(false)} className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 px-2 py-1 rounded-lg transition-colors">No</button>
                  </div>
                ) : (
                  <button onClick={() => setConfirmDeleteEvent(true)} className="p-2 bg-slate-900/70 hover:bg-red-600 border border-slate-700 hover:border-red-500 text-slate-400 hover:text-white rounded-xl transition-all backdrop-blur" title="Delete event">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          /* No cover: gradient banner with title */
          <div className="relative bg-gradient-to-br from-primary-900/60 via-slate-800 to-blue-900/40 p-6 md:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap gap-2 mb-3">
                  <span className={event.visibility === 'PUBLIC' ? 'badge-public' : 'badge-private'}>
                    {event.visibility}
                  </span>
                  <span className="badge bg-primary-900/60 text-primary-300 border border-primary-700/50">
                    {event.category}
                  </span>
                </div>
                <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">{event.name}</h1>
              </div>
              {isOwner && (
                <div className="flex-shrink-0">
                  {confirmDeleteEvent ? (
                    <div className="flex items-center gap-2 bg-slate-900/80 rounded-xl p-2 border border-red-800/60">
                      <span className="text-xs text-red-400 px-1">Delete?</span>
                      <button onClick={handleDeleteEvent} className="text-xs bg-red-600 hover:bg-red-500 text-white px-2 py-1 rounded-lg transition-colors">Yes</button>
                      <button onClick={() => setConfirmDeleteEvent(false)} className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 px-2 py-1 rounded-lg transition-colors">No</button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmDeleteEvent(true)} className="p-2 hover:bg-red-600/20 border border-slate-700 hover:border-red-500/50 text-slate-400 hover:text-red-400 rounded-xl transition-all" title="Delete event">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Event details row */}
        <div className="px-6 py-5 space-y-4">
          {event.description && (
            <p className="text-slate-400 leading-relaxed">{event.description}</p>
          )}
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-400">
            <span className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-primary-400" />
              {format(new Date(event.startDate), 'MMM dd, yyyy')}
              {event.endDate && <> – {format(new Date(event.endDate), 'MMM dd, yyyy')}</>}
            </span>
            {event.location && (
              <span className="flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-primary-400" />
                {event.location}
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <User className="w-4 h-4 text-primary-400" />
              {(event.creator as any)?.fullName}
            </span>
            <span className="flex items-center gap-1.5">
              <Images className="w-4 h-4 text-primary-400" />
              {visibleAlbums.length} {visibleAlbums.length === 1 ? 'Album' : 'Albums'}
            </span>
          </div>
        </div>
      </motion.div>

      {/* Albums section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">
            Albums
            <span className="ml-2 text-sm font-normal text-slate-400">({visibleAlbums.length})</span>
          </h2>
          {canCreateAlbum && (
            <button onClick={() => setShowCreateAlbum(true)} className="btn-primary text-sm">
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
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: i * 0.05 }}
                  className="relative group"
                >
                  <Link href={`/events/albums/${album.id}`}>
                    <div className="card p-0 overflow-hidden hover:border-primary-700/60 transition-all hover:shadow-lg hover:shadow-primary-900/20 cursor-pointer">
                      {/* Album thumbnail / placeholder */}
                      <div className="h-32 bg-slate-800 relative overflow-hidden">
                        {album.coverImage ? (
                          <img src={album.coverImage} alt={album.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900">
                            <FolderOpen className="w-10 h-10 text-slate-600" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 to-transparent" />
                        {/* Visibility badge on thumbnail */}
                        <div className="absolute top-2 left-2">
                          {album.visibility === 'PRIVATE' ? (
                            <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md bg-slate-900/80 text-red-400 border border-red-800/50 backdrop-blur-sm">
                              <Lock className="w-2.5 h-2.5" /> Private
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md bg-slate-900/80 text-green-400 border border-green-800/50 backdrop-blur-sm">
                              <Globe className="w-2.5 h-2.5" /> Public
                            </span>
                          )}
                        </div>
                        {/* Media count on thumbnail */}
                        <div className="absolute bottom-2 right-2 text-xs text-slate-300 bg-slate-900/70 backdrop-blur-sm px-2 py-0.5 rounded-md flex items-center gap-1">
                          <ImageIcon className="w-3 h-3" />
                          {(album as any)._count?.media || 0}
                        </div>
                      </div>

                      {/* Album info */}
                      <div className="p-3">
                        <h3 className="font-semibold truncate">{album.name}</h3>
                        {album.description && (
                          <p className="text-xs text-slate-500 mt-1 line-clamp-2">{album.description}</p>
                        )}
                        <p className="text-xs text-slate-500 mt-1">
                          {format(new Date(album.createdAt), 'MMM dd, yyyy')}
                        </p>
                      </div>
                    </div>
                  </Link>

                  {/* Delete album button */}
                  {canDeleteAlbum(album) && (
                    <button
                      onClick={(e) => { e.preventDefault(); handleDeleteAlbum(album.id, album.name); }}
                      disabled={deletingAlbumId === album.id}
                      className="absolute top-2 right-2 p-1.5 bg-slate-900/80 hover:bg-red-600 border border-slate-700 hover:border-red-500 text-slate-400 hover:text-white rounded-lg opacity-0 group-hover:opacity-100 transition-all disabled:opacity-50 z-10 backdrop-blur-sm"
                      title="Delete album"
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
            className="card text-center py-16"
          >
            <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <FolderOpen className="w-8 h-8 text-slate-600" />
            </div>
            <p className="font-medium text-slate-300 mb-1">No albums yet</p>
            <p className="text-sm text-slate-500 mb-5">Create an album to start organising media for this event</p>
            {canCreateAlbum && (
              <button onClick={() => setShowCreateAlbum(true)} className="btn-primary text-sm mx-auto">
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
          onCreated={() => { setShowCreateAlbum(false); fetchEvent(); }}
        />
      )}
    </div>
  );
}
