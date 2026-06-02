'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import api from '@/lib/axios';
import { Media } from '@/types';
import { Search, Image, LayoutGrid, Columns, List, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import MediaCard from '@/components/media/MediaCard';
import MediaLightbox from '@/components/media/MediaLightbox';
import InfiniteScroll from 'react-infinite-scroll-component';

const LIMIT = 24;

// Skeleton card for loading states
function SkeletonCard({ tall = false }: { tall?: boolean }) {
  return (
    <div
      className={`bg-slate-800 rounded-xl animate-pulse ${tall ? '' : 'aspect-square'}`}
      style={tall ? { height: `${180 + Math.random() * 120}px` } : undefined}
    />
  );
}

export default function GalleryPage() {
  const [media, setMedia] = useState<Media[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [total, setTotal] = useState(0);

  // Filters
  const [search, setSearch] = useState('');
  const [mediaType, setMediaType] = useState('');
  const [layout, setLayout] = useState<'grid' | 'masonry' | 'list'>('grid');

  // Track which IDs have already been animated to avoid re-animating on scroll
  const animatedIds = useRef<Set<string>>(new Set());

  const [selectedMedia, setSelectedMedia] = useState<Media | null>(null);

  // Debounce: only fire search effect 400ms after user stops typing
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => setDebouncedSearch(search), 400);
    return () => { if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current); };
  }, [search]);

  // Persist layout preference
  useEffect(() => {
    const stored = localStorage.getItem('galleryLayout') as typeof layout | null;
    if (stored) setLayout(stored);
  }, []);

  const handleLayoutChange = (value: typeof layout) => {
    setLayout(value);
    localStorage.setItem('galleryLayout', value);
  };

  // Reset + fetch when filters change
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

      // Use totalPages from API — correct even when last page has exactly LIMIT items
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

  const clearFilters = () => {
    setSearch('');
    setMediaType('');
  };

  const hasActiveFilters = search || mediaType;

  // Skeleton counts per layout
  const skeletonCount = layout === 'list' ? 8 : LIMIT;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Gallery</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            {total > 0 ? `${total.toLocaleString()} public photos & videos` : 'Browse all public media'}
          </p>
        </div>

        {/* Layout toggle — icon buttons */}
        <div className="flex items-center gap-1 p-1 bg-slate-800 rounded-lg flex-shrink-0">
          {([
            { value: 'grid', icon: LayoutGrid, label: 'Grid' },
            { value: 'masonry', icon: Columns, label: 'Masonry' },
            { value: 'list', icon: List, label: 'List' },
          ] as const).map(({ value, icon: Icon, label }) => (
            <button
              key={value}
              onClick={() => handleLayoutChange(value)}
              title={label}
              className={`p-1.5 rounded-md transition-all ${
                layout === value
                  ? 'bg-slate-600 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <Icon className="w-4 h-4" />
            </button>
          ))}
        </div>
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
              onClick={clearFilters}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-slate-400 hover:text-slate-200 bg-slate-800 hover:bg-slate-700 transition-all"
            >
              <X className="w-3.5 h-3.5" /> Clear
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Initial loading skeleton */}
      {loading && media.length === 0 ? (
        <div className={
          layout === 'list'
            ? 'space-y-2'
            : layout === 'masonry'
            ? 'masonry-grid'
            : 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2'
        }>
          {Array.from({ length: skeletonCount }).map((_, i) => (
            <SkeletonCard key={i} tall={layout === 'masonry'} />
          ))}
        </div>
      ) : media.length > 0 ? (
        <InfiniteScroll
          dataLength={media.length}
          next={loadMore}
          hasMore={hasMore}
          loader={
            /* Skeleton rows instead of a lone spinner */
            <div className={
              layout === 'list'
                ? 'space-y-2 mt-2'
                : layout === 'masonry'
                ? 'masonry-grid mt-2'
                : 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 mt-2'
            }>
              {Array.from({ length: layout === 'list' ? 4 : 6 }).map((_, i) => (
                <SkeletonCard key={i} tall={layout === 'masonry'} />
              ))}
            </div>
          }
          endMessage={
            <p className="text-center text-slate-500 py-8 text-sm">
              {total > 0 ? `All ${total.toLocaleString()} items loaded` : "You've seen it all!"}
            </p>
          }
          scrollThreshold={0.85}
        >
          <div className={
            layout === 'list'
              ? 'space-y-2'
              : layout === 'masonry'
              ? 'masonry-grid'
              : 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2'
          }>
            {media.map((item) => {
              const isNew = !animatedIds.current.has(item.id);
              if (isNew) animatedIds.current.add(item.id);

              return (
                <motion.div
                  key={item.id}
                  // Only animate items that haven't been seen before
                  initial={isNew ? { opacity: 0, scale: 0.95 } : false}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.2 }}
                  onClick={() => setSelectedMedia(item)}
                  className={layout === 'masonry' ? 'masonry-item cursor-pointer' : 'cursor-pointer'}
                >
                  {layout === 'list' ? (
                    <div className="card p-3 flex items-center gap-3 hover:border-primary-700/50 transition-colors">
                      <div className="w-14 h-14 rounded-lg overflow-hidden bg-slate-800 flex-shrink-0">
                        <MediaCard media={item} compact thumbnailOnly />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{item.originalName}</p>
                        {item.caption && (
                          <p className="text-xs text-slate-400 truncate mt-0.5">{item.caption}</p>
                        )}
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-[10px] text-slate-500 uppercase tracking-wide">{item.mediaType}</span>
                          {item.uploader && (
                            <span className="text-[10px] text-slate-500">by {item.uploader.fullName || item.uploader.username}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <MediaCard media={item} naturalHeight={layout === 'masonry'} />
                  )}
                </motion.div>
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
            <button onClick={clearFilters} className="btn-secondary mt-4 text-sm">
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
