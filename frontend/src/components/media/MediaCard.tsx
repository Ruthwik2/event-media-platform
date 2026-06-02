'use client';
import { useState } from 'react';
import { Media } from '@/types';
import { Heart, MessageCircle, Play, Image as ImageIcon } from 'lucide-react';

interface Props {
  media: Media;
  compact?: boolean;
  // Used in masonry — removes aspect-square so image uses its natural height
  naturalHeight?: boolean;
  // Used in list view thumbnail slot — renders only the img, no overlay
  thumbnailOnly?: boolean;
}

export default function MediaCard({ media, compact, naturalHeight, thumbnailOnly }: Props) {
  const isVideo = media.mediaType === 'VIDEO';
  const [imgError, setImgError] = useState(false);

  const src = media.thumbnailUrl || media.url;

  if (thumbnailOnly) {
    return imgError || !src ? (
      <div className="w-full h-full flex items-center justify-center bg-slate-800">
        {isVideo ? <Play className="w-5 h-5 text-slate-600" /> : <ImageIcon className="w-5 h-5 text-slate-600" />}
      </div>
    ) : (
      <img
        src={src}
        alt={media.originalName}
        className="w-full h-full object-cover"
        loading="lazy"
        onError={() => setImgError(true)}
      />
    );
  }

  return (
    <div
      className={`relative group rounded-xl overflow-hidden bg-slate-800 ${
        naturalHeight ? '' : 'aspect-square'
      }`}
    >
      {/* Image / fallback */}
      {!imgError && src ? (
        <img
          src={src}
          alt={media.originalName}
          className={`w-full object-cover transition-transform duration-300 group-hover:scale-[1.03] ${
            naturalHeight ? 'h-auto' : 'h-full'
          }`}
          loading="lazy"
          onError={() => setImgError(true)}
        />
      ) : (
        <div className={`w-full flex items-center justify-center bg-slate-800/80 ${naturalHeight ? 'h-40' : 'h-full'}`}>
          {isVideo
            ? <Play className="w-8 h-8 text-slate-600" />
            : <ImageIcon className="w-8 h-8 text-slate-600" />
          }
        </div>
      )}

      {/* Video badge */}
      {isVideo && (
        <div className="absolute top-2 left-2">
          <div className="w-6 h-6 bg-black/60 backdrop-blur-sm rounded-full flex items-center justify-center">
            <Play className="w-3 h-3 text-white fill-white" />
          </div>
        </div>
      )}

      {/* Hover overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        {!compact && (
          <div className="absolute bottom-0 left-0 right-0 p-2.5">
            <div className="flex items-center gap-3 text-xs text-white/90">
              <span className="flex items-center gap-1">
                <Heart className="w-3 h-3" /> {media._count?.likes ?? 0}
              </span>
              <span className="flex items-center gap-1">
                <MessageCircle className="w-3 h-3" /> {media._count?.comments ?? 0}
              </span>
              {media.uploader && (
                <span className="ml-auto truncate max-w-[80px] text-white/70">
                  {media.uploader.fullName || media.uploader.username}
                </span>
              )}
            </div>
            {media.caption && (
              <p className="text-[10px] text-white/70 mt-1 truncate">{media.caption}</p>
            )}
          </div>
        )}
      </div>

      {/* Tags (top right, on hover) */}
      {!compact && media.tags && media.tags.length > 0 && (
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="flex gap-1 flex-wrap justify-end">
            {media.tags.slice(0, 2).map((tag) => (
              <span key={tag} className="text-[9px] bg-black/60 backdrop-blur-sm text-white px-1.5 py-0.5 rounded-full">
                #{tag}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
