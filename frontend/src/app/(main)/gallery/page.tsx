'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import api from '@/lib/axios';
import { Media } from '@/types';
import { Search, Image, X, Heart, MessageCircle, Play, Camera, Film } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import MediaLightbox from '@/components/media/MediaLightbox';
import InfiniteScroll from 'react-infinite-scroll-component';

const LIMIT = 30;

function SkeletonTile() {
  return (
    <div className="aspect-square bg-slate-800 animate-pulse" />
  );
}

interface InstaCardProps {
  media: Media;
  isNew: boolean;
  index: number;
  onClick: () => void;
}

function InstaCard({ media, isNew, index, onClick }: InstaCardProps) {
  const isVideo = media.mediaType === 'VIDEO';
  const [imgError, setImgError] = useState(false);
  const src = media.thumbnailUrl || media.url;

  return (
    <motion.div
      initial={isNew ? { opacity: 0 } : false}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25, delay: isNew ? (index % LIMIT) * 0.015 : 0 }}
      className="aspect-square relative group cursor-pointer overflow-hidden bg-slate-900"
      onClick={onClick}
    >
      {/* Image */}
      {!imgError && src ? (
        <img
          src={src}
          alt={media.originalName}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
          onError={() => setImgError(true)}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-slate-800">
          {isVideo
            ? <Film className="w-8 h-8 text-slate-600" />
            : <Camera className="w-8 h-8 text-slate-600" />
          }
        </div>
      )}

      {/* Video indicator */}
      {isVideo && (
        <div className="absolute top-2 right-2 pointer-events-none">
          <Play className="w-4 h-4 text-white drop-shadow-lg fill-white" />
        </div>
      )}

      {/* Instagram-style hover overlay */}
      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-5">
        <span className="flex items-center gap-1.5 text-white font-semibold text-sm">
          <Heart className="w-5 h-5 fill-white" />
          {(media._count?.likes ?? 0).toLocaleString()}
        </span>
        <span className="flex items-center gap-1.5 text-white font-semibold text-sm">
          <MessageCircle className="w-5 h-5 fill-white" />
          {(media._count?.comments ?? 0).toLocaleString()}
        </span>
      </div>

      {/* Multi-image indicator (top-right corner, like Instagram carousel dot) */}
      {/* Could be used for albums in the future */}
    </motion.div>
  );
}

export default function GalleryPage() {
  const [media, setMedia] = useState<Media[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [total, setTotal] = useState(0);

  const [search, setSearch] = useState('');
  const [mediaType, setMediaType] = useState('');
  const [selectedMedia, setSelectedMedia] = useState<Media | null>(null);

  const animatedIds = useRef<Set<string>>(new Set());
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => setDebouncedSearch(search), 400);
    return () => { if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current); };
  }, [search]);

  useEffect(() => {
    setMedia([]);
    setPage(1);
    setHasMore(true);
    animatedIds.current.clear();
    setLoading(true);
    fetchMedia(1, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, mediaType]);

  const fetchMedia = useCallback(async (pageNum: number, reset = false) => {
    try {
      const params = new URLSearchParams();
      params.append('page', pageNum.toString());
      params.append('limit', LIMIT.toString());
      if (debouncedSearch) params.append('search', debouncedSearch);
      if (mediaType) params.append('mediaType', mediaType);

      const res = await api.get(`/media?${params.toString()}`);
      const newMedia: Media[] = res.data.data || [];
      const pagination = res.data.pagination;

      if (reset) {
        setMedia(newMedia);
      } else {
        setMedia((prev) => [...prev, ...newMedia]);
      }
      setHasMore(pageNum < (pagination?.totalPages ?? 1));
      setTotal(pagination?.total ?? 0);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, mediaType]);

  const loadMore = () => {
    const next = page + 1;
    setPage(next);
    fetchMedia(next);
  };

  const hasActiveFilters = search || mediaType;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Gallery</h1>
        <p className="text-slate-400 text-sm mt-0.5">
          {total > 0 ? `${total.toLocaleString()} public photos & videos` : 'Browse all public media'}
        </p>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search photos & videos…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-9 pr-8"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex gap-2">
          {(['', 'PHOTO', 'VIDEO'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setMediaType(type)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                mediaType === type
                  ? 'bg-primary-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700'
              }`}
            >
              {type === '' ? 'All' : type === 'PHOTO' ? 'Photos' : 'Videos'}
            </button>
          ))}
        </div>

        <AnimatePresence>
          {hasActiveFilters && (
            <motion.button
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              onClick={() => { setSearch(''); setMediaType(''); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-slate-400 hover:text-slate-200 bg-slate-800 hover:bg-slate-700 transition-all"
            >
              <X className="w-3.5 h-3.5" /> Clear
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Grid */}
      {loading && media.length === 0 ? (
        /* Initial skeleton */
        <div className="grid grid-cols-3 gap-[3px]">
          {Array.from({ length: LIMIT }).map((_, i) => <SkeletonTile key={i} />)}
        </div>
      ) : media.length > 0 ? (
        <InfiniteScroll
          dataLength={media.length}
          next={loadMore}
          hasMore={hasMore}
          loader={
            <div className="grid grid-cols-3 gap-[3px] mt-[3px]">
              {Array.from({ length: 9 }).map((_, i) => <SkeletonTile key={i} />)}
            </div>
          }
          endMessage={
            <p className="text-center text-slate-500 py-10 text-sm">
              {total > 0 ? `All ${total.toLocaleString()} items loaded` : "You've seen it all!"}
            </p>
          }
          scrollThreshold={0.85}
        >
          <div className="grid grid-cols-3 gap-[3px]">
            {media.map((item, idx) => {
              const isNew = !animatedIds.current.has(item.id);
              if (isNew) animatedIds.current.add(item.id);
              return (
                <InstaCard
                  key={item.id}
                  media={item}
                  isNew={isNew}
                  index={idx}
                  onClick={() => setSelectedMedia(item)}
                />
              );
            })}
          </div>
        </InfiniteScroll>
      ) : (
        /* Empty state */
        <div className="text-center py-20 card">
          <Image className="w-14 h-14 text-slate-700 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No media found</h3>
          <p className="text-slate-400 text-sm max-w-xs mx-auto">
            {hasActiveFilters
              ? 'No results match your current filters. Try broadening your search.'
              : 'No public media has been uploaded yet.'}
          </p>
          {hasActiveFilters && (
            <button
              onClick={() => { setSearch(''); setMediaType(''); }}
              className="btn-secondary mt-4 text-sm"
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {selectedMedia && (
        <MediaLightbox
          media={selectedMedia}
          allMedia={media}
          onClose={() => setSelectedMedia(null)}
          onNavigate={(m) => setSelectedMedia(m)}
          onDelete={(id) => {
            setMedia((prev) => prev.filter((m) => m.id !== id));
            setTotal((t) => t - 1);
            setSelectedMedia(null);
          }}
        />
      )}
    </div>
  );
}
