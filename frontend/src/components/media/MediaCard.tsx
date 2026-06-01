'use client';
import { Media } from '@/types';
import { Heart, MessageCircle, Play } from 'lucide-react';

interface Props {
  media: Media;
  compact?: boolean;
}

export default function MediaCard({ media, compact }: Props) {
  const isVideo = media.mediaType === 'VIDEO';

  return (
    <div className="relative group rounded-lg overflow-hidden bg-slate-800 aspect-square">
      {/* Image/Thumbnail */}
      {media.thumbnailUrl || media.url ? (
        <img
          src={media.thumbnailUrl || media.url}
          alt={media.originalName}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-slate-800">
          {isVideo ? <Play className="w-8 h-8 text-slate-600" /> : <Heart className="w-8 h-8 text-slate-600" />}
        </div>
      )}

      {/* Video indicator */}
      {isVideo && (
        <div className="absolute top-2 left-2">
          <div className="w-6 h-6 bg-black/60 rounded-full flex items-center justify-center">
            <Play className="w-3 h-3 text-white fill-white" />
          </div>
        </div>
      )}

      {/* Hover overlay */}
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors duration-200 flex items-end">
        <div className="w-full p-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          {!compact && (
            <div className="flex items-center gap-3 text-xs text-white">
              <span className="flex items-center gap-1">
                <Heart className="w-3 h-3" /> {media._count?.likes || 0}
              </span>
              <span className="flex items-center gap-1">
                <MessageCircle className="w-3 h-3" /> {media._count?.comments || 0}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Tags */}
      {!compact && media.tags && media.tags.length > 0 && (
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="flex gap-1 flex-wrap justify-end">
            {media.tags.slice(0, 2).map((tag) => (
              <span key={tag} className="text-[9px] bg-black/60 text-white px-1.5 py-0.5 rounded">
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}