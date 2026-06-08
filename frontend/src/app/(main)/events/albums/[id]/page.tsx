'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/axios';
import { useAuthStore } from '@/store/authStore';
import { Album, Media } from '@/types';
import {
  ArrowLeft, Upload, QrCode, ImageIcon, Trash2, Lock, Globe,
  ShieldAlert, Clock, XCircle, Info, Pencil,
  LayoutGrid, LayoutDashboard, List,
} from 'lucide-react';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import MediaCard from '@/components/media/MediaCard';
import MediaLightbox from '@/components/media/MediaLightbox';
import ShareAlbumModal from '@/components/albums/ShareAlbumModal';
import CreateAlbumModal from '@/components/albums/CreateAlbumModal';

type GalleryLayout = 'grid' | 'masonry' | 'list';
const LAYOUTS: { key: GalleryLayout; label: string; icon: typeof LayoutGrid }[] = [
  { key: 'grid', label: 'Grid', icon: LayoutGrid },
  { key: 'masonry', label: 'Masonry', icon: LayoutDashboard },
  { key: 'list', label: 'List', icon: List },
];

export default function AlbumDetailPage() {
  const { id } = useParams();
  const { user } = useAuthStore();
  const router = useRouter();
  const [album, setAlbum] = useState<Album | null>(null);
  const [media, setMedia] = useState<Media[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMedia, setSelectedMedia] = useState<Media | null>(null);
  const [showShare, setShowShare] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [deletingAlbum, setDeletingAlbum] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const [requestStatus, setRequestStatus] = useState<string | null>(null);
  const [requesting, setRequesting] = useState(false);


  // ── Gallery layout (per-album, remembered in the browser) ──────────────────
  const [layout, setLayout] = useState<GalleryLayout>('grid');
  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem(`albumLayout:${id}`) : null;
    if (saved === 'grid' || saved === 'masonry' || saved === 'list') setLayout(saved);
  }, [id]);
  const changeLayout = (next: GalleryLayout) => {
    setLayout(next);
    if (typeof window !== 'undefined') localStorage.setItem(`albumLayout:${id}`, next);
  };

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


  // ── Loading skeleton ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-5 max-w-5xl mx-auto">
        <div className="h-8 w-1/3 skeleton rounded-lg" />
        <div className="h-24 skeleton rounded-2xl" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-square skeleton rounded-xl" />
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
          <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-5 ring-1 ring-red-200">
            <ShieldAlert className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Access Restricted</h1>
          <p className="text-slate-400 max-w-sm mb-6 text-sm leading-relaxed">
            This album is private. You do not have permission to view its contents.
          </p>
          {user?.role === 'PHOTOGRAPHER' && (
            <>
              {requestStatus === 'PENDING' && (
                <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-700 mb-4 text-sm">
                  <Clock className="w-4 h-4 flex-shrink-0" />
                  <span>Access request pending admin review</span>
                </div>
              )}
              {requestStatus === 'REJECTED' && (
                <div className="flex flex-col items-center gap-3 mb-4">
                  <div className="flex items-center gap-2 px-4 py-2.5 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
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
            {/* Title */}
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-extrabold text-[#2a2724] tracking-tight">{album.name}</h1>
            </div>

            {album.visibility === 'PRIVATE' ? (
              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200">
                <Lock className="w-3 h-3" /> Private
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                <Globe className="w-3 h-3" /> Public
              </span>
            )}
            {album.category && (
              <span className="inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full bg-[#f0ede8] text-[#6b6560] border border-[#e7e3dd]">
                {album.category}
              </span>
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
              onClick={() => setShowEdit(true)}
              className="btn-secondary text-sm"
            >
              <Pencil className="w-4 h-4" />
              <span className="hidden sm:inline">Edit</span>
            </button>
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
        <>
          {/* Layout toolbar — choose how this album's media is displayed */}
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-[#4a4540]">Media</h2>
            <div className="inline-flex items-center gap-0.5 rounded-lg border border-[#e7e3dd] bg-white p-0.5">
              {LAYOUTS.map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => changeLayout(key)}
                  title={`${label} layout`}
                  aria-pressed={layout === key}
                  className={`p-1.5 rounded-md transition-colors ${
                    layout === key
                      ? 'bg-primary-600 text-white'
                      : 'text-slate-500 hover:bg-[#f0ede8] hover:text-[#4a4540]'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </button>
              ))}
            </div>
          </div>

          {layout === 'list' ? (
            <div className="space-y-2">
              {media.map((item) => {
                const canDelete = user?.id === (item as any).uploaderId || user?.role === 'ADMIN';
                return (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 p-2 rounded-xl border border-[#e7e3dd] bg-white hover:border-primary-400 transition-colors relative group"
                  >
                    <div
                      onClick={() => setSelectedMedia(item)}
                      className="w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden cursor-pointer bg-[#f0ede8]"
                    >
                      <MediaCard media={item} thumbnailOnly />
                    </div>
                    <div
                      onClick={() => setSelectedMedia(item)}
                      className="min-w-0 flex-1 cursor-pointer"
                    >
                      <p className="text-sm font-medium text-[#2a2724] truncate">
                        {item.caption || item.originalName}
                      </p>
                      <p className="text-xs text-slate-500 truncate">
                        {item.uploader?.fullName || item.uploader?.username || 'Unknown'}
                        {' · '}
                        {format(new Date(item.createdAt), 'MMM dd, yyyy')}
                      </p>
                    </div>
                    {canDelete && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleMediaDelete(item.id); }}
                        className="p-2 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Delete media"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div
              className={
                layout === 'masonry'
                  ? 'columns-2 sm:columns-3 md:columns-4 lg:columns-5 gap-2'
                  : 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2'
              }
            >
              {media.map((item, i) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, scale: 0.93 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.02 }}
                  className={`cursor-pointer relative group ${
                    layout === 'masonry' ? 'mb-2 break-inside-avoid' : ''
                  }`}
                >
                  <div onClick={() => setSelectedMedia(item)}>
                    <MediaCard media={item} compact naturalHeight={layout === 'masonry'} />
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
          )}
        </>
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
              Supports JPG, PNG, MP4 and more · Up to 1 GB per file
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

      {showEdit && album && (
        <CreateAlbumModal
          eventId={album.eventId}
          album={album}
          onClose={() => setShowEdit(false)}
          onCreated={() => {
            setShowEdit(false);
            fetchAlbum();
          }}
        />
      )}
    </div>
  );
}
