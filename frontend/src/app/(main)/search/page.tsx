'use client';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import api from '@/lib/axios';
import { Media } from '@/types';
import { Search, Image } from 'lucide-react';
import MediaCard from '@/components/media/MediaCard';
import MediaLightbox from '@/components/media/MediaLightbox';

export default function SearchPage() {
  const searchParams = useSearchParams();
  const q = searchParams.get('q') || '';
  const [query, setQuery] = useState(q);
  const [results, setResults] = useState<Media[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<Media | null>(null);
  const [filters, setFilters] = useState({
    tags: '',
    eventName: '',
    uploadDate: '',
    username: '',
  });

  useEffect(() => {
    if (q) {
      setQuery(q);
      handleSearch(q);
    }
  }, [q]);

  const handleSearch = async (searchQuery?: string) => {
    const sq = searchQuery || query;
    if (!sq && !filters.tags && !filters.eventName && !filters.uploadDate && !filters.username) return;

    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (sq) params.append('q', sq);
      if (filters.tags) params.append('tags', filters.tags);
      if (filters.eventName) params.append('eventName', filters.eventName);
      if (filters.uploadDate) params.append('uploadDate', filters.uploadDate);
      if (filters.username) params.append('username', filters.username);

      const res = await api.get(`/media/search?${params.toString()}`);
      setResults(res.data.data || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Advanced Search</h1>
        <p className="text-slate-400 text-sm">Search by tags, event, date, or username</p>
      </div>

      {/* Search Form */}
      <div className="card p-4 space-y-4">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="input pl-9"
            />
          </div>
          <button onClick={() => handleSearch()} className="btn-primary">
            Search
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="label">Tags</label>
            <input
              type="text"
              placeholder="mountains, people..."
              value={filters.tags}
              onChange={(e) => setFilters({ ...filters, tags: e.target.value })}
              className="input"
            />
          </div>
          <div>
            <label className="label">Event Name</label>
            <input
              type="text"
              placeholder="Cultural Fest..."
              value={filters.eventName}
              onChange={(e) => setFilters({ ...filters, eventName: e.target.value })}
              className="input"
            />
          </div>
          <div>
            <label className="label">Upload Date</label>
            <input
              type="date"
              value={filters.uploadDate}
              onChange={(e) => setFilters({ ...filters, uploadDate: e.target.value })}
              className="input"
            />
          </div>
          <div>
            <label className="label">Username</label>
            <input
              type="text"
              placeholder="photographer1..."
              value={filters.username}
              onChange={(e) => setFilters({ ...filters, username: e.target.value })}
              className="input"
            />
          </div>
        </div>
      </div>

      {/* Results */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-square bg-slate-800 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : results.length > 0 ? (
        <>
          <p className="text-sm text-slate-400">{results.length} result(s) found</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
            {results.map((item) => (
              <div key={item.id} onClick={() => setSelectedMedia(item)} className="cursor-pointer">
                <MediaCard media={item} />
              </div>
            ))}
          </div>
        </>
      ) : query || Object.values(filters).some(Boolean) ? (
        <div className="text-center py-16 card">
          <Image className="w-16 h-16 text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">No results found</h3>
          <p className="text-slate-400">Try different search terms or filters</p>
        </div>
      ) : null}

      {selectedMedia && (
        <MediaLightbox
          media={selectedMedia}
          allMedia={results}
          onClose={() => setSelectedMedia(null)}
          onNavigate={(m) => setSelectedMedia(m)}
          onDelete={(id) => {
            setResults((prev) => prev.filter((m) => m.id !== id));
            setSelectedMedia(null);
          }}
        />
      )}
    </div>
  );
}