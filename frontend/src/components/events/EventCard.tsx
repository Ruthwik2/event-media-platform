'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Event } from '@/types';
import { Calendar, MapPin, Image, Lock, FolderOpen, QrCode } from 'lucide-react';
import { format } from 'date-fns';
import { useAuthStore } from '@/store/authStore';
import api from '@/lib/axios';
import ShareEventModal from '@/components/events/ShareEventModal';

interface Props {
  event: Event;
}

// The set of private-event IDs this photographer has been APPROVED for. Fetched
// once (concurrent cards share the in-flight request) from an endpoint that has
// always existed, so the lock clears as soon as access is granted — even if the
// newer getEvents `hasAccess` annotation isn't deployed yet. Cleared after each
// resolve so a later page visit re-fetches fresh approvals.
let approvedEventsInFlight: Promise<Set<string>> | null = null;
function getApprovedEventIds(): Promise<Set<string>> {
  if (!approvedEventsInFlight) {
    approvedEventsInFlight = api
      .get('/events/my-access-requests?status=APPROVED')
      .then((res) => {
        const rows = res.data?.data || [];
        return new Set<string>(
          rows
            .filter((r: any) => r.type === 'EVENT' && r.status === 'APPROVED')
            .map((r: any) => String(r.targetId))
        );
      })
      .catch(() => new Set<string>())
      .finally(() => {
        approvedEventsInFlight = null;
      });
  }
  return approvedEventsInFlight;
}

export default function EventCard({ event }: Props) {
  const { user } = useAuthStore();
  const [showShare, setShowShare] = useState(false);

  const isPrivate = event.visibility === 'PRIVATE';
  const isOwner =
    user?.role === 'ADMIN' || user?.id === (event.creator as any)?.id;

  // For a photographer on a private event they don't own, look up whether their
  // event access request was approved (via the always-deployed endpoint).
  const [approvedEventIds, setApprovedEventIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    let active = true;
    if (user?.role === 'PHOTOGRAPHER' && isPrivate && !isOwner) {
      getApprovedEventIds().then((ids) => {
        if (active) setApprovedEventIds(ids);
      });
    }
    return () => {
      active = false;
    };
  }, [user?.role, isPrivate, isOwner]);

  // Access = backend annotation (getEvents) OR the approved-requests lookup above.
  // Once granted, drop the "request access" lock so the cover photo shows through.
  const hasAccess =
    (event as any).hasAccess === true || approvedEventIds.has(String(event.id));
  const showRequestHint =
    isPrivate &&
    user?.role === 'PHOTOGRAPHER' &&
    user?.id !== (event.creator as any)?.id &&
    !hasAccess;
  // Anyone who can see the event (admins, photographers, club members) can share
  // its QR/link. VIEWERs and photographers still locked out of a private event
  // (showRequestHint) don't get the button. Guest-access controls stay owner-only
  // via canManage below.
  const canShare =
    isOwner || (!!user && user.role !== 'VIEWER' && !showRequestHint);

  return (
    <>
      <Link href={`/events/${event.id}`}>
        <div className="card overflow-hidden transition-all duration-200 group cursor-pointer h-full hover:border-primary-500/30">
          {/* Cover */}
          <div className="h-40 relative overflow-hidden bg-gradient-to-br from-primary-50 to-primary-100">
            {event.coverImage ? (
              <img
                src={event.coverImage}
                alt={event.name}
                className={`w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-400 ${isPrivate && !isOwner && !hasAccess ? 'opacity-50' : ''}`}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center border border-[#e7e3dd]">
                  <Calendar className="w-6 h-6 text-primary-600" />
                </div>
              </div>
            )}

            {/* Gradient overlay — only meaningful over a real cover image */}
            {event.coverImage && (
              <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent" />
            )}

            {/* Visibility badge */}
            <div className="absolute top-3 right-3">
              <span className={event.visibility === 'PUBLIC' ? 'badge-public' : 'badge-private'}>
                {event.visibility === 'PUBLIC' ? 'Public' : 'Private'}
              </span>
            </div>

            {/* Category badge */}
            {event.category && (
              <div className="absolute bottom-3 left-3">
                <span className="text-[10px] px-2 py-1 bg-white/90 backdrop-blur-sm text-[#4a4540] rounded-lg border border-[#e7e3dd] font-medium">
                  {event.category}
                </span>
              </div>
            )}

            {/* QR Share button — visible on hover for anyone who can access the event */}
            {canShare && (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowShare(true);
                }}
                title="Share QR"
                className="absolute bottom-3 right-3 p-1.5 rounded-lg bg-white border border-[#e7e3dd] text-slate-400 hover:text-primary-400 hover:border-primary-500/50 hover:bg-primary-600/20 opacity-0 group-hover:opacity-100 transition-all backdrop-blur-sm z-10"
              >
                <QrCode className="w-3.5 h-3.5" />
              </button>
            )}

            {showRequestHint && (
              <div className="absolute inset-0 flex items-center justify-center bg-[#f0ede8]">
                <div className="w-10 h-10 bg-white rounded-2xl flex items-center justify-center border border-[#e7e3dd] shadow-sm">
                  <Lock className="w-5 h-5 text-primary-600" />
                </div>
              </div>
            )}
          </div>

          {/* Content */}
          <div className="p-4 pt-3.5">
            <h3 className="font-semibold text-sm text-[#2a2724] line-clamp-1 group-hover:text-primary-400 transition-colors duration-150 leading-snug">
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
            <div className="flex items-center gap-3 mt-3.5 pt-3 border-t border-[#e7e3dd] text-xs text-slate-600">
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

      {/* Share modal — rendered outside the <Link> to avoid nested navigation */}
      {showShare && (
        <ShareEventModal
          event={{
            id: event.id,
            name: event.name,
            visibility: event.visibility as 'PUBLIC' | 'PRIVATE',
          }}
          canManage={isOwner}
          onClose={() => setShowShare(false)}
        />
      )}
    </>
  );
}
