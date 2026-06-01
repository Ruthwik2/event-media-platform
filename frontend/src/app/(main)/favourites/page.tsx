'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/axios';
import { Media } from '@/types';
import { Heart, Image } from 'lucide-react';
import MediaCard from '@/components/media/MediaCard';
import MediaLightbox from '@/components/media/MediaLightbox';

export default function FavouritesPage() {
  const [media, setMedia] = useState<Media[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMedia, setSelectedMedia] = useState<Media | null>(null);

  useEffect(() => {
    fetchFavourites();
  }, []);

  const fetchFavourites = async () => {
    try {
      const res = await api.get('/media/favourites');
      setMedia(res.data.data || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Heart className="w-6 h-6 text-red-400" /> Favourites
        </h1>
        <p className="text-slate-400 text-sm">Your saved photos and videos</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-square bg-slate-800 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : media.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
          {media.map((item) => (
            <div key={item.id} onClick={() => setSelectedMedia(item)} className="cursor-pointer">
              <MediaCard media={item} />
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 card">
          <Heart className="w-16 h-16 text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">No favourites yet</h3>
          <p className="text-slate-400">Like media to see them here</p>
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