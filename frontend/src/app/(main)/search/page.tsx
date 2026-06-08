'use client';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import api from '@/lib/axios';
import { Media } from '@/types';
import { Search, Image } from 'lucide-react';
import MediaCard from '@/components/media/MediaCard';
import MediaLightbox from '@/components/media/MediaLightbox';

const EMPTY_FILTERS = {
  tags: '',
  eventName: '',
  albumName: '',
  uploadDate: '',
  username: '',
};

export default function SearchPage() {
  const searchParams = useSearchParams();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Media[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<Media | null>(null);
  const [filters, setFilters] = useState(EMPTY_FILTERS);

  // Hydrate query + every filter from the URL, then auto-search. Tag links
  // (e.g. /search?tags=person) and other deep links land here — previously
  // only `q` was read, so arriving via a tag chip searched for nothing.
  useEffect(() => {
    const urlQuery = searchParams.get('q') || '';
    const urlFilters = {
      tags: searchParams.get('tags') || '',
      eventName: searchParams.get('eventName') || '',
      albumName: searchParams.get('albumName') || '',
      uploadDate: searchParams.get('uploadDate') || '',
      username: searchParams.get('username') || '',
    };
    setQuery(urlQuery);
    setFilters(urlFilters);
    if (urlQuery || Object.values(urlFilters).some(Boolean)) {
      handleSearch(urlQuery, urlFilters);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const handleSearch = async (
    searchQuery?: string,
    searchFilters: typeof EMPTY_FILTERS = filters
  ) => {
    const sq = searchQuery ?? query;
    if (!sq && !Object.values(searchFilters).some(Boolean)) return;

    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (sq) params.append('q', sq);
      if (searchFilters.tags) params.append('tags', searchFilters.tags);
      if (searchFilters.eventName) params.append('eventName', searchFilters.eventName);
      if (searchFilters.albumName) params.append('albumName', searchFilters.albumName);
      if (searchFilters.uploadDate) params.append('uploadDate', searchFilters.uploadDate);
      if (searchFilters.username) params.append('username', searchFilters.username);

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

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
          <div>
            <label className="label">Tags</label>
            <input
              type="text"
              placeholder="mountains, people..."
              value={filters.tags}
              onChange={(e) => setFilters({ ...filters, tags: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
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
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="input"
            />
          </div>
          <div>
            <label className="label">Album Name</label>
            <input
              type="text"
              placeholder="Day 1 Photos..."
              value={filters.albumName}
              onChange={(e) => setFilters({ ...filters, albumName: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="input"
            />
          </div>
          <div>
            <label className="label">Upload Date</label>
            <input
              type="date"
              value={filters.uploadDate}
              onChange={(e) => setFilters({ ...filters, uploadDate: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
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
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="input"
            />
          </div>
        </div>
      </div>

      {/* Results */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-square skeleton rounded-xl" />
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