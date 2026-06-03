'use client';
import Link from 'next/link';
import { Event } from '@/types';
import { Calendar, MapPin, Image, Lock, FolderOpen } from 'lucide-react';
import { format } from 'date-fns';
import { useAuthStore } from '@/store/authStore';

interface Props {
  event: Event;
}

export default function EventCard({ event }: Props) {
  const { user } = useAuthStore();
  const isPrivate = event.visibility === 'PRIVATE';
  const showRequestHint =
    isPrivate &&
    user?.role === 'PHOTOGRAPHER' &&
    user?.id !== (event.creator as any)?.id;

  return (
    <Link href={`/events/${event.id}`}>
      <div className="card overflow-hidden transition-all duration-200 group cursor-pointer h-full hover:border-primary-500/30">
        {/* Cover */}
        <div className="h-40 relative overflow-hidden bg-gradient-to-br from-slate-900 to-[#080d14]">
          {event.coverImage ? (
            <img
              src={event.coverImage}
              alt={event.name}
              className={`w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-400 ${isPrivate ? 'opacity-50' : ''}`}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <div className="w-12 h-12 bg-white/[0.04] rounded-2xl flex items-center justify-center border border-white/[0.06]">
                <Calendar className="w-6 h-6 text-slate-700" />
              </div>
            </div>
          )}

          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#080d14]/90 via-transparent to-transparent" />

          {/* Visibility badge */}
          <div className="absolute top-3 right-3">
            <span className={event.visibility === 'PUBLIC' ? 'badge-public' : 'badge-private'}>
              {event.visibility === 'PUBLIC' ? 'Public' : 'Private'}
            </span>
          </div>

          {/* Category badge */}
          {event.category && (
            <div className="absolute bottom-3 left-3">
              <span className="text-[10px] px-2 py-1 bg-black/50 backdrop-blur-sm text-slate-300 rounded-lg border border-white/[0.08] font-medium">
                {event.category}
              </span>
            </div>
          )}

          {showRequestHint && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-900/40">
              <div className="w-10 h-10 bg-black/50 backdrop-blur-sm rounded-2xl flex items-center justify-center border border-white/10">
                <Lock className="w-5 h-5 text-slate-400" />
              </div>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-4 pt-3.5">
          <h3 className="font-semibold text-sm text-slate-100 line-clamp-1 group-hover:text-primary-400 transition-colors duration-150 leading-snug">
            {event.name}
          </h3>
          {event.description && (
            <p className="text-xs text-slate-600 line-clamp-2 mt-1.5 leading-relaxed">{event.description}</p>
          )}
          {showRequestHint && (
            <p className="text-xs text-amber-500/80 mt-2 flex items-center gap-1.5 font-medium">
              <Lock className="w-3 h-3" /> Click to request access
            </p>
          )}
          <div className="flex items-center gap-3 mt-3.5 pt-3 border-t border-white/[0.05] text-xs text-slate-600">
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3 h-3" />
              {format(new Date(event.startDate), 'MMM dd, yyyy')}
            </span>
            {event.location && (
              <span className="flex items-center gap-1.5">
                <MapPin className="w-3 h-3" />
                <span className="truncate max-w-[90px]">{event.location}</span>
              </span>
            )}
            <span className="flex items-center gap-1.5 ml-auto text-slate-700">
              <FolderOpen className="w-3 h-3" />
              {event._count?.albums || 0}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
