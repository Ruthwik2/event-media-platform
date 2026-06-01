'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/axios';
import { useAuthStore } from '@/store/authStore';
import { Event, Album } from '@/types';
import { Calendar, MapPin, User, Plus, Image, ArrowLeft, Trash2, Lock, Globe } from 'lucide-react';
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
  const [accessDenied, setAccessDenied] = useState(false);

  useEffect(() => {
    fetchEvent();
  }, [id]);

  const fetchEvent = async () => {
    try {
      const res = await api.get(`/events/${id}`);
      setEvent(res.data.data);
      setAlbums(res.data.data.albums || []);
    } catch (error: any) {
      // IF it is an access denied error, stop the redirect!
      if (error.response?.status === 403) {
        setAccessDenied(true); 
      } else {
        // Only toast and redirect if it's genuinely missing
        toast.error('Event not found');
        router.push('/events');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteEvent = async () => {
    if (!confirm('Are you sure you want to delete this event?')) return;
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

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-64 bg-slate-800 rounded-xl animate-pulse" />
        <div className="h-8 w-1/3 bg-slate-800 rounded animate-pulse" />
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center card mt-10">
        <Lock className="w-16 h-16 text-slate-500 mb-4" />
        <h1 className="text-3xl font-bold mb-2">Access Restricted</h1>
        <p className="text-slate-400 max-w-md mb-6">
          This event is private. You do not have permission to view its contents.
        </p>
        {user?.role === 'PHOTOGRAPHER' && (
          <button
            onClick={async () => {
              try {
                await api.post(`/events/${id}/request-access`);
                toast.success('Access request sent to Admin!');
              } catch (err: any) {
                toast.error(err.response?.data?.message || 'Already requested');
              }
            }}
            className="btn-primary"
          >
            Request Access from Admin
          </button>
        )}
        <button onClick={() => router.push('/events')} className="btn-secondary mt-4">
          Back to Events
        </button>
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
    <div className="space-y-6">
      <Link href="/events" className="flex items-center gap-2 text-slate-400 hover:text-slate-200">
        <ArrowLeft className="w-4 h-4" /> Back to Events
      </Link>

      <div className="card overflow-hidden">
        {event.coverImage && (
          <div className="h-48 md:h-64 relative">
            <img src={event.coverImage} alt={event.name} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900 to-transparent" />
          </div>
        )}
        <div className="p-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className={event.visibility === 'PUBLIC' ? 'badge-public' : 'badge-private'}>
                  {event.visibility}
                </span>
                <span className="badge bg-primary-900/50 text-primary-400 border border-primary-800">
                  {event.category}
                </span>
              </div>
              <h1 className="text-2xl md:text-3xl font-bold">{event.name}</h1>
              {event.description && (
                <p className="text-slate-400 mt-2 max-w-2xl">{event.description}</p>
              )}
              <div className="flex flex-wrap gap-4 mt-4 text-sm text-slate-400">
                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  {format(new Date(event.startDate), 'MMM dd, yyyy')}
                </span>
                {event.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-4 h-4" />
                    {event.location}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <User className="w-4 h-4" />
                  {(event.creator as any)?.fullName}
                </span>
              </div>
            </div>
            {isOwner && (
              <button onClick={handleDeleteEvent} className="btn-danger text-sm">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Albums ({visibleAlbums.length})</h2>
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
                  <div className="card p-4 hover:border-primary-700 transition-colors cursor-pointer">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-slate-800 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Image className="w-6 h-6 text-slate-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium truncate">{album.name}</h3>
                          {album.visibility === 'PRIVATE' ? (
                            <span className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-red-900/40 text-red-400 border border-red-800/50 flex-shrink-0">
                              <Lock className="w-2.5 h-2.5" /> Private
                            </span>
                          ) : (
                            <span className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-green-900/40 text-green-400 border border-green-800/50 flex-shrink-0">
                              <Globe className="w-2.5 h-2.5" /> Public
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-slate-400">
                          {(album as any)._count?.media || 0} items
                        </p>
                      </div>
                    </div>
                    {album.description && (
                      <p className="text-sm text-slate-500 mt-2 line-clamp-2">{album.description}</p>
                    )}
                  </div>
                </Link>

                {canDeleteAlbum(album) && (
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      handleDeleteAlbum(album.id, album.name);
                    }}
                    disabled={deletingAlbumId === album.id}
                    className="absolute top-2 right-2 p-1.5 bg-red-600 hover:bg-red-500 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50 z-10"
                    title="Delete album"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-white" />
                  </button>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      ) : (
        <div className="text-center py-12 card">
          <Image className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400">No albums yet</p>
          {canCreateAlbum && (
            <button onClick={() => setShowCreateAlbum(true)} className="btn-primary text-sm mt-3">
              Create First Album
            </button>
          )}
        </div>
      )}

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