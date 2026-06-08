'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import api from '@/lib/axios';
import { Lock, AlertTriangle, Image as ImageIcon, Download, ZoomIn, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Media {
  id: string;
  url: string;
  thumbnailUrl?: string;
  mediaType: 'PHOTO' | 'VIDEO';
  caption?: string;
  width?: number;
  height?: number;
  uploader: { username: string; fullName: string };
  createdAt: string;
}

interface Album {
  id: string;
  name: string;
  description?: string;
  visibility: 'PUBLIC' | 'PRIVATE';
  event?: { id: string; name: string; category: string };
  _count: { media: number };
}

type PageState = 'loading' | 'success' | 'not-found' | 'error';

export default function AlbumSharePage() {
  const { token } = useParams<{ token: string }>();
  const [pageState, setPageState] = useState<PageState>('loading');
  const [album, setAlbum] = useState<Album | null>(null);
  const [media, setMedia] = useState<Media[]>([]);
  const [lightbox, setLightbox] = useState<number | null>(null);

  useEffect(() => {
    if (!token) return;
    const load = async () => {
      try {
        const res = await api.get(`/albums/by-token/${token}`);
        setAlbum(res.data.data.album);
        setMedia(res.data.data.media);
        setPageState('success');
      } catch (err: any) {
        if (err.response?.status === 404) {
          setPageState('not-found');
        } else {
          setPageState('error');
        }
      }
    };
    load();
  }, [token]);

  // ── Lightbox navigation ───────────────────────────────────────────────────
  const photoMedia = media.filter((m) => m.mediaType === 'PHOTO');
  const lightboxItem = lightbox !== null ? photoMedia[lightbox] : null;

  const prevPhoto = () => setLightbox((p) => (p !== null && p > 0 ? p - 1 : p));
  const nextPhoto = () => setLightbox((p) => (p !== null && p < photoMedia.length - 1 ? p + 1 : p));

  useEffect(() => {
    if (lightbox === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') prevPhoto();
      if (e.key === 'ArrowRight') nextPhoto();
      if (e.key === 'Escape') setLightbox(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightbox]);

  // ── Loading ───────────────────────────────────────────────────────────────
  if (pageState === 'loading') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-400 text-sm">Loading shared album…</p>
        </div>
      </div>
    );
  }

  // ── Not found / revoked ───────────────────────────────────────────────────
  if (pageState === 'not-found') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-2xl bg-red-900/30 border border-red-700/40 flex items-center justify-center mx-auto mb-5">
            <Lock className="w-8 h-8 text-red-400" />
          </div>
          <h1 className="text-xl font-bold text-[#2a2724] mb-2">Link Not Found</h1>
          <p className="text-slate-400 text-sm leading-relaxed">
            This share link is invalid or has been revoked by the album owner.
            If you believe this is an error, contact the person who shared it with you.
          </p>
        </div>
      </div>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  if (pageState === 'error' || !album) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-[#2a2724] mb-2">Something Went Wrong</h1>
          <p className="text-slate-400 text-sm">Failed to load the album. Please try again.</p>
          <button onClick={() => window.location.reload()} className="btn-secondary mt-4 text-sm">
            Retry
          </button>
        </div>
      </div>
    );
  }

  // ── Success ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <div className="border-b border-[#e7e3dd] bg-slate-950/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-bold text-[#2a2724] truncate">{album.name}</h1>
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-900/40 text-emerald-600 border border-emerald-800/50 flex-shrink-0">
                Shared Album
              </span>
            </div>
            {album.event && (
              <p className="text-xs text-slate-500 mt-0.5">
                {album.event.name} · {album.event.category}
              </p>
            )}
          </div>
          <span className="text-xs text-slate-500 flex-shrink-0">{media.length} items</span>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Description */}
        {album.description && (
          <p className="text-slate-400 text-sm">{album.description}</p>
        )}

        {/* Guest access notice */}
        <div className="flex items-start gap-2 p-3 rounded-lg bg-[#f0ede8] border border-[#e7e3dd]">
          <Lock className="w-3.5 h-3.5 text-slate-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-slate-500 leading-relaxed">
            You're viewing a private album via a shared link. Please do not redistribute this link
            without the album owner's permission.
          </p>
        </div>

        {/* Media grid */}
        {media.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {media.map((item, i) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.02 }}
                className="relative group cursor-pointer aspect-square bg-[#f8f7f5] rounded-xl overflow-hidden"
                onClick={() => {
                  const photoIdx = photoMedia.findIndex((p) => p.id === item.id);
                  if (photoIdx !== -1) setLightbox(photoIdx);
                }}
              >
                {item.mediaType === 'PHOTO' ? (
                  <>
                    <img
                      src={item.thumbnailUrl || item.url}
                      alt={item.caption || 'Photo'}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                      <ZoomIn className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </>
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-[#f8f7f5]">
                    <span className="text-slate-500 text-xs">Video</span>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <ImageIcon className="w-12 h-12 text-slate-700 mx-auto mb-3" />
            <p className="text-slate-500 text-sm">No media in this album yet</p>
          </div>
        )}
      </div>

      {/* Lightbox */}
      <AnimatePresence>
        {lightbox !== null && lightboxItem && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4"
            onClick={() => setLightbox(null)}
          >
            <button
              onClick={() => setLightbox(null)}
              className="absolute top-4 right-4 p-2 rounded-lg bg-[#f8f7f5] hover:bg-[#f0ede8] transition-colors"
            >
              <X className="w-5 h-5 text-[#6b6560]" />
            </button>

            {lightbox > 0 && (
              <button
                onClick={(e) => { e.stopPropagation(); prevPhoto(); }}
                className="absolute left-4 p-2 rounded-lg bg-[#f8f7f5] hover:bg-[#f0ede8] transition-colors"
              >
                <ChevronLeft className="w-5 h-5 text-[#6b6560]" />
              </button>
            )}
            {lightbox < photoMedia.length - 1 && (
              <button
                onClick={(e) => { e.stopPropagation(); nextPhoto(); }}
                className="absolute right-4 p-2 rounded-lg bg-[#f8f7f5] hover:bg-[#f0ede8] transition-colors"
              >
                <ChevronRight className="w-5 h-5 text-[#6b6560]" />
              </button>
            )}

            <motion.img
              key={lightboxItem.id}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              src={lightboxItem.url}
              alt={lightboxItem.caption || 'Photo'}
              className="max-w-full max-h-full object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />

            {lightboxItem.caption && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-black/70 rounded-lg text-sm text-[#6b6560] text-center max-w-xs">
                {lightboxItem.caption}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
