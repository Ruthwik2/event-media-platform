'use client';
import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/axios';
import { Media } from '@/types';
import { Search, Filter, Image } from 'lucide-react';
import { motion } from 'framer-motion';
import MediaCard from '@/components/media/MediaCard';
import MediaLightbox from '@/components/media/MediaLightbox';
import InfiniteScroll from 'react-infinite-scroll-component';

export default function GalleryPage() {
  const [media, setMedia] = useState<Media[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [search, setSearch] = useState('');
  const [tags, setTags] = useState('');
  const [mediaType, setMediaType] = useState('');
  const [selectedMedia, setSelectedMedia] = useState<Media | null>(null);
  const [layout, setLayout] = useState('grid');

  useEffect(() => {
    const storedLayout = localStorage.getItem('galleryLayout') || 'grid';
    setLayout(storedLayout);

    const handleStorage = (event: StorageEvent) => {
      if (event.key === 'galleryLayout' && event.newValue) {
        setLayout(event.newValue);
      }
    };

    const handleLayoutEvent = (event: Event) => {
      const customEvent = event as CustomEvent<string>;
      if (customEvent.detail) {
        setLayout(customEvent.detail);
      }
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener('galleryLayoutChange', handleLayoutEvent as EventListener);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('galleryLayoutChange', handleLayoutEvent as EventListener);
    };
  }, []);

  const handleLayoutChange = (value: string) => {
    setLayout(value);
    localStorage.setItem('galleryLayout', value);
    window.dispatchEvent(new CustomEvent('galleryLayoutChange', { detail: value }));
  };

  useEffect(() => {
    setMedia([]);
    setPage(1);
    setHasMore(true);
    fetchMedia(1, true);
  }, [search, tags, mediaType]);

  const fetchMedia = async (pageNum: number, reset = false) => {
    try {
      const params = new URLSearchParams();
      params.append('page', pageNum.toString());
      params.append('limit', '20');
      if (search) params.append('search', search);
      if (tags) params.append('tags', tags);
      if (mediaType) params.append('mediaType', mediaType);

      const res = await api.get(`/media?${params.toString()}`);
      const newMedia = res.data.data || [];

      if (reset) {
        setMedia(newMedia);
      } else {
        setMedia((prev) => [...prev, ...newMedia]);
      }

      setHasMore(newMedia.length === 20);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const loadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchMedia(nextPage);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Gallery</h1>
        <p className="text-slate-400 text-sm">Browse all public media</p>
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search by name, caption, tags..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-9"
          />
        </div>
        <input
          type="text"
          placeholder="Tags (comma-separated)"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          className="input w-auto min-w-[160px]"
        />
        <select
          value={mediaType}
          onChange={(e) => setMediaType(e.target.value)}
          className="input w-auto"
        >
          <option value="">All Types</option>
          <option value="PHOTO">Photos</option>
          <option value="VIDEO">Videos</option>
        </select>
        <select
          value={layout}
          onChange={(e) => handleLayoutChange(e.target.value)}
          className="input w-auto"
        >
          <option value="grid">Grid</option>
          <option value="masonry">Masonry</option>
          <option value="list">List</option>
        </select>
      </div>

      {/* Gallery Grid with Infinite Scroll */}
      {loading && media.length === 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
          {Array.from({ length: 20 }).map((_, i) => (
            <div key={i} className="aspect-square bg-slate-800 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : media.length > 0 ? (
        <InfiniteScroll
          dataLength={media.length}
          next={loadMore}
          hasMore={hasMore}
          loader={
            <div className="text-center py-4">
              <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          }
          endMessage={
            <p className="text-center text-slate-500 py-4 text-sm">You&apos;ve seen it all!</p>
          }
        >
          <div className={layout === 'list' ? 'space-y-3' : layout === 'masonry' ? 'masonry-grid' : 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2'}>
            {media.map((item, i) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: Math.min(i * 0.02, 0.5) }}
                onClick={() => setSelectedMedia(item)}
                className={layout === 'masonry' ? 'masonry-item cursor-pointer' : 'cursor-pointer'}
              >
                {layout === 'list' ? (
                  <div className="card p-3 flex items-center gap-3 hover:border-primary-700 transition-colors">
                    <div className="w-16 h-16 rounded-lg overflow-hidden bg-slate-800 flex-shrink-0">
                      {item.thumbnailUrl || item.url ? (
                        <img
                          src={item.thumbnailUrl || item.url}
                          alt={item.originalName}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Image className="w-5 h-5 text-slate-500" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{item.originalName}</p>
                      {item.caption && (
                        <p className="text-xs text-slate-400 truncate">{item.caption}</p>
                      )}
                      <p className="text-xs text-slate-500 mt-1">{item.mediaType}</p>
                    </div>
                  </div>
                ) : (
                  <MediaCard media={item} />
                )}
              </motion.div>
            ))}
          </div>
        </InfiniteScroll>
      ) : (
        <div className="text-center py-16 card">
          <Image className="w-16 h-16 text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">No media found</h3>
          <p className="text-slate-400">Try adjusting your search or filters</p>
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
            setSelectedMedia(null);
          }}
        />
      )}
    </div>
  );
}