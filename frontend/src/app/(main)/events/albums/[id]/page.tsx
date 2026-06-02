'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/axios';
import { useAuthStore } from '@/store/authStore';
import { Album, Media } from '@/types';
import {
  ArrowLeft, Upload, QrCode, Image, Trash2, Lock, Globe,
  ShieldAlert, Clock, XCircle,
} from 'lucide-react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import MediaCard from '@/components/media/MediaCard';
import MediaLightbox from '@/components/media/MediaLightbox';
import ShareAlbumModal from '@/components/albums/ShareAlbumModal';

export default function AlbumDetailPage() {
  const { id } = useParams();
  const { user } = useAuthStore();
  const router = useRouter();
  const [album, setAlbum] = useState<Album | null>(null);
  const [media, setMedia] = useState<Media[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMedia, setSelectedMedia] = useState<Media | null>(null);
  const [showShare, setShowShare] = useState(false);
  const [deletingAlbum, setDeletingAlbum] = useState(false);
  // Access-control states
  const [accessDenied, setAccessDenied] = useState(false);
  const [requestStatus, setRequestStatus] = useState<string | null>(null);
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    const init = async () => {
      const loaded = await fetchAlbum();
      if (loaded) fetchMedia();
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  /** Returns true when album loaded successfully, false otherwise. */
  const fetchAlbum = async (): Promise<boolean> => {
    try {
      const res = await api.get(`/albums/${id}`);
      setAlbum(res.data.data);
      return true;
    } catch (error: any) {
      if (error.response?.status === 403) {
        setAccessDenied(true);
        setRequestStatus(error.response?.data?.requestStatus ?? null);
      } else if (error.response?.status === 404) {
        toast.error('Album not found');
        router.push('/events');
      } else {
        toast.error(error.response?.data?.message || 'Failed to load album');
        router.push('/events');
      }
      return false;
    } finally {
      setLoading(false);
    }
  };

  const fetchMedia = async () => {
    try {
      const res = await api.get(`/media?albumId=${id}&limit=100`);
      setMedia(res.data.data || []);
    } catch (error) {
      console.error(error);
    }
  };

  const handleRequestAccess = async () => {
    setRequesting(true);
    try {
      await api.post(`/albums/${id}/request-access`);
      toast.success('Access request sent to Admin!');
      setRequestStatus('PENDING');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to send request');
    } finally {
      setRequesting(false);
    }
  };

  const handleDeleteAlbum = async () => {
    if (!album) return;
    if (
      !confirm(
        `Delete album "${album.name}"? This will remove all media inside it and cannot be undone.`
      )
    )
      return;
    setDeletingAlbum(true);
    try {
      await api.delete(`/albums/${id}`);
      toast.success('Album deleted');
      router.push(album.eventId ? `/events/${album.eventId}` : '/events');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to delete album');
      setDeletingAlbum(false);
    }
  };

  const handleMediaDelete = async (mediaId: string) => {
    if (!confirm('Are you sure you want to delete this media?')) return;
    try {
      await api.delete(`/media/${mediaId}`);
      toast.success('Media deleted');
      setMedia((prev) => prev.filter((m) => m.id !== mediaId));
      if (selectedMedia?.id === mediaId) setSelectedMedia(null);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to delete');
    }
  };

  // ── Loading skeleton ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-1/3 bg-slate-800 rounded animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-square bg-slate-800 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  // ── Access Denied UI ──────────────────────────────────────────────────────
  if (accessDenied) {
    return (
      <div className="space-y-4">
        <Link
          href="/events"
          className="flex items-center gap-2 text-slate-400 hover:text-slate-200"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Events
        </Link>
        <div className="flex flex-col items-center justify-center py-20 text-center card mt-6">
          <ShieldAlert className="w-16 h-16 text-slate-500 mb-4" />
          <h1 className="text-2xl font-bold mb-2">Access Restricted</h1>
          <p className="text-slate-400 max-w-md mb-6">
            This album is private. You do not have permission to view its contents.
          </p>
          {user?.role === 'PHOTOGRAPHER' && (
            <>
              {requestStatus === 'PENDING' && (
                <div className="flex items-center gap-2 px-4 py-2 bg-yellow-900/30 border border-yellow-700/50 rounded-lg text-yellow-400 mb-4">
                  <Clock className="w-4 h-4" />
                  <span className="text-sm">Access request pending admin review</span>
                </div>
              )}
              {requestStatus === 'REJECTED' && (
                <div className="flex flex-col items-center gap-3 mb-4">
                  <div className="flex items-center gap-2 px-4 py-2 bg-red-900/30 border border-red-700/50 rounded-lg text-red-400">
                    <XCircle className="w-4 h-4" />
                    <span className="text-sm">Your previous request was rejected</span>
                  </div>
                  <button
                    onClick={handleRequestAccess}
                    disabled={requesting}
                    className="btn-primary text-sm"
                  >
                    {requesting ? 'Sending…' : 'Request Access Again'}
                  </button>
                </div>
              )}
              {!requestStatus && (
                <button
                  onClick={handleRequestAccess}
                  disabled={requesting}
                  className="btn-primary"
                >
                  {requesting ? 'Sending…' : 'Request Access from Admin'}
                </button>
              )}
            </>
          )}
          <button onClick={() => router.back()} className="btn-secondary mt-4">
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (!album) return null;

  const eventCreatorId = (album.event as any)?.creatorId;
  const canManage = user?.role === 'ADMIN' || (eventCreatorId && user?.id === eventCreatorId);
  const canUpload = user && ['ADMIN', 'PHOTOGRAPHER'].includes(user.role);

  return (
    <div className="space-y-6">
      <Link
        href={`/events/${album.eventId}`}
        className="flex items-center gap-2 text-slate-400 hover:text-slate-200"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Event
      </Link>

      {/* Album Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold">{album.name}</h1>
            {album.visibility === 'PRIVATE' ? (
              <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-red-900/40 text-red-400 border border-red-800/50">
                <Lock className="w-3 h-3" /> Private
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-900/40 text-green-400 border border-green-800/50">
                <Globe className="w-3 h-3" /> Public
              </span>
            )}
          </div>
          {album.description && (
            <p className="text-slate-400 mt-1">{album.description}</p>
          )}
          <p className="text-sm text-slate-500 mt-1">
            {media.length} items • {album.event?.name}
          </p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          {/* Share button — shows QR + link + guest access controls */}
          <button onClick={() => setShowShare(true)} className="btn-secondary text-sm">
            <QrCode className="w-4 h-4" /> Share
          </button>
          {canUpload && (
            <Link href={`/upload?albumId=${id}`} className="btn-primary text-sm">
              <Upload className="w-4 h-4" /> Upload
            </Link>
          )}
          {canManage && (
            <button
              onClick={handleDeleteAlbum}
              disabled={deletingAlbum}
              className="btn-danger text-sm"
              title="Delete album"
            >
              <Trash2 className="w-4 h-4" />
              <span className="hidden sm:inline">Delete Album</span>
            </button>
          )}
        </div>
      </div>

      {/* Media Grid */}
      {media.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
          {media.map((item, i) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.02 }}
              className="cursor-pointer relative group"
            >
              <div onClick={() => setSelectedMedia(item)}>
                <MediaCard media={item} compact />
              </div>
              {(user?.id === (item as any).uploaderId ||
                user?.role === 'ADMIN') && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleMediaDelete(item.id);
                  }}
                  className="absolute top-1 right-1 p-1.5 bg-red-600 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Delete media"
                >
                  <Trash2 className="w-3 h-3 text-white" />
                </button>
              )}
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 card">
          <Image className="w-16 h-16 text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">No media yet</h3>
          <p className="text-slate-400 mb-4">Upload photos and videos to this album</p>
          {canUpload && (
            <Link href={`/upload?albumId=${id}`} className="btn-primary">
              <Upload className="w-4 h-4" /> Upload Media
            </Link>
          )}
        </div>
      )}

      {/* Lightbox */}
      {selectedMedia && (
        <MediaLightbox
          media={selectedMedia}
          allMedia={media}
          onClose={() => setSelectedMedia(null)}
          onNavigate={(m) => setSelectedMedia(m)}
          onDelete={(deletedId) => {
            setMedia((prev) => prev.filter((m) => m.id !== deletedId));
            setSelectedMedia(null);
          }}
        />
      )}

      {/* Share Modal — QR + link + guest access controls */}
      {showShare && album && (
        <ShareAlbumModal
          album={album as any}
          canManage={!!canManage}
          onClose={() => setShowShare(false)}
        />
      )}
    </div>
  );
}
