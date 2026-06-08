'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/axios';
import { useAuthStore } from '@/store/authStore';
import { Album, Media } from '@/types';
import {
  ArrowLeft, Upload, QrCode, ImageIcon, Trash2, Lock, Globe,
  ShieldAlert, Clock, XCircle, Info, Pencil, Check, X as XIcon,
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
  const [accessDenied, setAccessDenied] = useState(false);
  const [requestStatus, setRequestStatus] = useState<string | null>(null);
  const [requesting, setRequesting] = useState(false);

  // ── Rename state ─────────────────────────────────────────────────────────
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [renameSaving, setRenameSaving] = useState(false);

  useEffect(() => {
    const init = async () => {
      const loaded = await fetchAlbum();
      if (loaded) fetchMedia();
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

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

  // ── Rename handlers ───────────────────────────────────────────────────────
  const startRename = () => {
    if (!album) return;
    setRenameValue(album.name);
    setIsRenaming(true);
  };

  const cancelRename = () => {
    setIsRenaming(false);
    setRenameValue('');
  };

  const saveRename = async () => {
    if (!album || !renameValue.trim()) return;
    if (renameValue.trim() === album.name) { cancelRename(); return; }
    setRenameSaving(true);
    try {
      const res = await api.patch(`/albums/${id}/rename`, { name: renameValue.trim() });
      setAlbum((prev) => prev ? { ...prev, name: res.data.data.name } : prev);
      toast.success('Album renamed');
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
      <div className="space-y-5 max-w-5xl mx-auto">
        <div className="h-8 w-1/3 bg-[#f8f7f5] rounded-lg animate-pulse" />
        <div className="h-24 bg-[#f8f7f5] rounded-2xl animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-square bg-[#f8f7f5] rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  // ── Access Denied UI ──────────────────────────────────────────────────────
  if (accessDenied) {
    return (
      <div className="space-y-4 max-w-5xl mx-auto">
        <Link
          href="/events"
          className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-[#4a4540] transition-colors group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          Back to Events
        </Link>
        <div className="flex flex-col items-center justify-center py-20 text-center card mt-6 rounded-2xl">
          <div className="w-16 h-16 bg-red-900/25 rounded-2xl flex items-center justify-center mx-auto mb-5 ring-1 ring-red-800/40">
            <ShieldAlert className="w-8 h-8 text-red-400" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Access Restricted</h1>
          <p className="text-slate-400 max-w-sm mb-6 text-sm leading-relaxed">
            This album is private. You do not have permission to view its contents.
          </p>
          {user?.role === 'PHOTOGRAPHER' && (
            <>
              {requestStatus === 'PENDING' && (
                <div className="flex items-center gap-2 px-4 py-2.5 bg-yellow-900/25 border border-yellow-700/40 rounded-xl text-yellow-400 mb-4 text-sm">
                  <Clock className="w-4 h-4 flex-shrink-0" />
                  <span>Access request pending admin review</span>
                </div>
              )}
              {requestStatus === 'REJECTED' && (
                <div className="flex flex-col items-center gap-3 mb-4">
                  <div className="flex items-center gap-2 px-4 py-2.5 bg-red-900/25 border border-red-700/40 rounded-xl text-red-400 text-sm">
                    <XCircle className="w-4 h-4 flex-shrink-0" />
                    <span>Your previous request was rejected</span>
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
    <div className="space-y-6 max-w-5xl mx-auto">
      <Link
        href={`/events/${album.eventId}`}
        className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-[#4a4540] transition-colors group"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
        Back to Event
      </Link>

      {/* ── Album Header Card ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex items-start justify-between gap-4 p-5 rounded-2xl border border-[#e7e3dd]/80 bg-[#f8f7f5]"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5 flex-wrap mb-1.5">
            {/* Inline rename or title */}
            {isRenaming ? (
              <div className="flex items-center gap-2 w-full">
                <input
                  autoFocus
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onKeyDown={handleRenameKeyDown}
                  className="flex-1 bg-[#f8f7f5] border border-primary-600 rounded-lg px-3 py-1.5 text-xl font-extrabold text-[#2a2724] focus:outline-none focus:ring-2 focus:ring-primary-500 min-w-0"
                  maxLength={120}
                  disabled={renameSaving}
                />
                <button
                  onClick={saveRename}
                  disabled={renameSaving || !renameValue.trim()}
                  className="p-1.5 rounded-lg bg-primary-600 hover:bg-primary-500 text-white transition-colors disabled:opacity-50"
                  title="Save"
                >
                  <Check className="w-4 h-4" />
                </button>
                <button
                  onClick={cancelRename}
                  disabled={renameSaving}
                  className="p-1.5 rounded-lg bg-[#f0ede8] hover:bg-[#e7e3dd] text-[#6b6560] transition-colors"
                  title="Cancel"
                >
                  <XIcon className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 group/title">
                <h1 className="text-2xl font-extrabold text-[#2a2724] tracking-tight">{album.name}</h1>
                {canManage && (
                  <button
                    onClick={startRename}
                    title="Rename album"
                    className="p-1.5 rounded-lg text-slate-500 hover:text-primary-600 hover:bg-[#f0ede8] transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}

            {!isRenaming && (
              album.visibility === 'PRIVATE' ? (
                <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-red-900/40 text-red-400 border border-red-800/50">
                  <Lock className="w-3 h-3" /> Private
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-green-900/40 text-green-400 border border-green-800/50">
                  <Globe className="w-3 h-3" /> Public
                </span>
              )
            )}
          </div>
          {album.description && (
            <p className="text-slate-400 text-sm mb-1 leading-relaxed">{album.description}</p>
          )}
          <p className="text-sm text-slate-600">
            {media.length} {media.length === 1 ? 'item' : 'items'} · {album.event?.name}
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={() => setShowShare(true)}
            className="btn-secondary text-sm"
          >
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
              className="btn-danger text-sm flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              <span className="hidden sm:inline">Delete Album</span>
            </button>
          )}
        </div>
      </motion.div>

      {/* ── Media Grid or Empty State ── */}
      {media.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
          {media.map((item, i) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, scale: 0.93 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.02 }}
              className="cursor-pointer relative group"
            >
              <div onClick={() => setSelectedMedia(item)}>
                <MediaCard media={item} compact />
              </div>
              {(user?.id === (item as any).uploaderId || user?.role === 'ADMIN') && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleMediaDelete(item.id);
                  }}
                  className="absolute top-1.5 right-1.5 p-1.5 bg-red-600 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                  title="Delete media"
                >
                  <Trash2 className="w-3 h-3 text-white" />
                </button>
              )}
            </motion.div>
          ))}
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="text-center py-20 rounded-2xl border border-dashed border-[#e7e3dd] bg-[#faf9f7]"
        >
          <div className="w-20 h-20 mx-auto mb-5 rounded-2xl bg-[#f0ede8] border border-[#e7e3dd] flex items-center justify-center">
            <ImageIcon className="w-9 h-9 text-slate-500" />
          </div>

          <h3 className="text-lg font-bold text-[#6b6560] mb-2">No media yet</h3>
          <p className="text-slate-500 text-sm mb-7 max-w-xs mx-auto leading-relaxed">
            Upload photos and videos to start filling this album
          </p>

          {canUpload && (
            <Link
              href={`/upload?albumId=${id}`}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-primary-700 to-primary-600 hover:from-primary-600 hover:to-primary-500 text-white font-semibold px-6 py-2.5 rounded-xl transition-all shadow-lg shadow-primary-900/30 hover:shadow-primary-900/50 hover:-translate-y-0.5"
            >
              <Upload className="w-4 h-4" /> Upload Media
            </Link>
          )}

          <div className="mt-6 inline-flex items-center gap-2 bg-[#f8f7f5] border border-[#e7e3dd] rounded-xl px-4 py-2.5">
            <Info className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
            <span className="text-xs text-slate-500">
              Supports JPG, PNG, MP4 and more · Up to 100 MB per file
            </span>
          </div>
        </motion.div>
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

      {/* Share Modal */}
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
