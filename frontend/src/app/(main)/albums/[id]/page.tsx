'use client';
import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function AlbumRedirect() {
  const { id } = useParams();
  const router = useRouter();

  useEffect(() => {
    router.replace(`/events/albums/${id}`);
  }, [id, router]);

  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
