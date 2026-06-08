'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/axios';
import { useAuthStore } from '@/store/authStore';
import { Media } from '@/types';
import { Camera, Image, Upload, CheckCircle, AlertTriangle, ScanFace } from 'lucide-react';
import MediaCard from '@/components/media/MediaCard';
import MediaLightbox from '@/components/media/MediaLightbox';
import toast from 'react-hot-toast';

export default function MyPhotosPage() {
  const { user, updateUser } = useAuthStore();
  const [media, setMedia] = useState<Media[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMedia, setSelectedMedia] = useState<Media | null>(null);
  const [uploading, setUploading] = useState(false);
  const [faceRecognitionEnabled, setFaceRecognitionEnabled] = useState(false);
  const [hasSelfie, setHasSelfie] = useState(false);

  useEffect(() => {
    fetchMyPhotos();
  }, []);

  const fetchMyPhotos = async () => {
    setLoading(true);
    try {
      const res = await api.get('/media/my-photos');
      setMedia(res.data.data || []);
      setFaceRecognitionEnabled(res.data.faceRecognitionEnabled || false);
      setHasSelfie(res.data.hasSelfie || false);
    } catch (error: any) {
      if (error.response?.status !== 400) console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelfieUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setUploading(true);
    const formData = new FormData();
    formData.append('selfie', file);
    try {
      const res = await api.post('/auth/selfie', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const { referenceSelfie, faceId } = res.data?.data || {};
      if (referenceSelfie || faceId) {
        updateUser({
          ...(referenceSelfie && { referenceSelfie }),
          ...(faceId !== undefined && { faceId }),
        });
      }
      if (faceId) {
        toast.success('Selfie uploaded! Scanning your photos in the background…');
        setTimeout(() => fetchMyPhotos(), 3000);
      } else {
        toast.error(
          res.data?.message ||
            'No face detected. Please upload a clear, front-facing photo with good lighting.'
        );
        fetchMyPhotos();
      }
    } catch (error: any) {
      toast.error(
        error.response?.data?.message || error.message || 'Upload failed. Please try again.',
        { duration: 8000 }
      );
      fetchMyPhotos();
    } finally {
      setUploading(false);
    }
  };

  const selfieUrl = user?.referenceSelfie;
  const btnLabel = uploading ? 'Uploading…' : hasSelfie && !faceRecognitionEnabled ? 'Retry Selfie' : 'Update Selfie';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ScanFace className="w-6 h-6 text-primary-400" /> My Photos
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Photos found of you across all events using AI face recognition
        </p>
      </div>

      {/* Face Recognition Setup card */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Camera className="w-4 h-4 text-[#6b6560]" />
          <span className="font-medium text-[#4a4540]">Face Recognition Setup</span>
          {faceRecognitionEnabled && (
            <span className="badge-status-active ml-auto flex items-center gap-1 text-xs px-2 py-0.5 rounded-full">
              <CheckCircle className="w-3 h-3" /> Active
            </span>
          )}
          {hasSelfie && !faceRecognitionEnabled && (
            <span className="badge-status-warning ml-auto flex items-center gap-1 text-xs px-2 py-0.5 rounded-full">
              <AlertTriangle className="w-3 h-3" /> Not indexed
            </span>
          )}
        </div>

        <div className="flex items-center gap-5">
          {/* Selfie preview */}
          <div className="shrink-0">
            {selfieUrl ? (
              <img
                src={selfieUrl}
                alt="Your selfie"
                className="w-20 h-20 rounded-full object-cover border-2 border-slate-600"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-[#f0ede8] border-2 border-dashed border-slate-500 flex items-center justify-center">
                <Camera className="w-7 h-7 text-slate-500" />
              </div>
            )}
          </div>

          {/* Description + button */}
          <div className="flex-1 min-w-0">
            <p className="text-sm text-[#6b6560] mb-3">
              {faceRecognitionEnabled
                ? 'Your face is indexed. Photos of you from all events appear below automatically.'
                : hasSelfie
                ? 'Selfie saved but face indexing failed. Try again with a clear, well-lit front-facing photo.'
                : 'Upload a clear selfie to automatically find photos of you from all events using AI facial recognition.'}
            </p>
            <label
              className={`btn-primary text-sm cursor-pointer inline-flex items-center gap-2 ${
                uploading ? 'opacity-60 pointer-events-none' : ''
              }`}
            >
              <Upload className="w-4 h-4" />
              {btnLabel}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleSelfieUpload}
                className="hidden"
                disabled={uploading}
              />
            </label>
          </div>
        </div>
      </div>

      {/* Photos grid */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-square bg-[#f8f7f5] rounded-xl animate-pulse" />
          ))}
        </div>
      ) : media.length > 0 ? (
        <>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-400">{media.length} photo{media.length !== 1 ? 's' : ''} found</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
            {media.map((item) => (
              <div key={item.id} onClick={() => setSelectedMedia(item)} className="cursor-pointer">
                <MediaCard media={item} />
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="text-center py-16 card">
          <Image className="w-16 h-16 text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">No photos found yet</h3>
          <p className="text-slate-400 text-sm max-w-sm mx-auto">
            {faceRecognitionEnabled
              ? 'No photos with your face have been found yet. More will appear as event photos are uploaded.'
              : 'Upload a selfie above to start finding photos of you across all events.'}
          </p>
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
