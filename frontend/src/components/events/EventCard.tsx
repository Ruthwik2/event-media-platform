'use client';
import Link from 'next/link';
import { Event } from '@/types';
import { Calendar, MapPin, Image, Lock } from 'lucide-react';
import { format } from 'date-fns';
import { useAuthStore } from '@/store/authStore';

interface Props {
  event: Event;
}

export default function EventCard({ event }: Props) {
  const { user } = useAuthStore();
  const isPrivate = event.visibility === 'PRIVATE';
  // Photographers who don't own this private event will hit a 403 — show a hint
  const showRequestHint =
    isPrivate &&
    user?.role === 'PHOTOGRAPHER' &&
    user?.id !== (event.creator as any)?.id;

  return (
    <Link href={`/events/${event.id}`}>
      <div className="card overflow-hidden hover:border-primary-700 transition-all duration-200 group cursor-pointer h-full">
        {/* Cover */}
        <div className="h-36 bg-gradient-to-br from-slate-800 to-slate-900 relative overflow-hidden">
          {event.coverImage ? (
            <img
              src={event.coverImage}
              alt={event.name}
              className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 ${isPrivate ? 'opacity-60' : ''}`}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Calendar className="w-10 h-10 text-slate-700" />
            </div>
          )}
          <div className="absolute top-2 right-2">
            <span className={event.visibility === 'PUBLIC' ? 'badge-public' : 'badge-private'}>
              {event.visibility}
            </span>
          </div>
          {/* Lock overlay for private events the photographer can't access */}
          {showRequestHint && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-900/30">
              <Lock className="w-8 h-8 text-slate-400 opacity-70" />
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-slate-900 to-transparent" />
        </div>

        {/* Content */}
        <div className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] px-1.5 py-0.5 bg-primary-900/50 text-primary-400 rounded border border-primary-800">
              {event.category}
            </span>
          </div>
          <h3 className="font-semibold text-sm line-clamp-1 group-hover:text-primary-400 transition-colors">
            {event.name}
          </h3>
          {event.description && (
            <p className="text-xs text-slate-500 line-clamp-2 mt-1">{event.description}</p>
          )}
          {showRequestHint && (
            <p className="text-xs text-yellow-500/80 mt-2 flex items-center gap-1">
              <Lock className="w-3 h-3" /> Click to request access
            </p>
          )}
          <div className="flex items-center gap-3 mt-3 text-xs text-slate-400">
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {format(new Date(event.startDate), 'MMM dd')}
            </span>
            {event.location && (
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                <span className="truncate max-w-[100px]">{event.location}</span>
              </span>
            )}
            <span className="flex items-center gap-1 ml-auto">
              <Image className="w-3 h-3" />
              {event._count?.albums || 0} albums
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
