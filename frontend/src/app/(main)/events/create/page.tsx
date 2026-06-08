'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/axios';
import { Calendar, MapPin, Tag, FileText, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

// Scrollable category options for the event form.
const CATEGORIES = [
  'Cultural', 'Sports', 'Technical', 'Workshop', 'Seminar', 'Conference',
  'Music', 'Dance', 'Drama', 'Art', 'Photography', 'Gaming', 'Hackathon',
  'Webinar', 'Festival', 'Competition', 'Exhibition', 'Meetup', 'Other',
];

// Format a Date as the value a datetime-local input expects: YYYY-MM-DDTHH:mm
const toLocalInput = (d: Date) => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export default function CreateEventPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: '',
    startDate: '',
    endDate: '',
    location: '',
    visibility: 'PUBLIC',
  });
  const [coverImage, setCoverImage] = useState<File | null>(null);

  // Pre-populate sensible start/end date-times (with hh:mm) after mount.
  // Done in an effect — not in useState — to avoid an SSR/client hydration
  // mismatch from calling new Date() during render.
  useEffect(() => {
    const start = new Date();
    start.setMinutes(0, 0, 0);
    start.setHours(start.getHours() + 1); // next full hour
    const end = new Date(start);
    end.setHours(end.getHours() + 2);
    setFormData((f) => ({
      ...f,
      startDate: f.startDate || toLocalInput(start),
      endDate: f.endDate || toLocalInput(end),
    }));
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // BUG FIX #4: validate that endDate is not before startDate before submitting.
    if (formData.endDate && formData.startDate && formData.endDate < formData.startDate) {
      toast.error('End date cannot be before the start date');
      return;
    }
    setLoading(true);
    try {
      const data = new FormData();
      Object.entries(formData).forEach(([key, value]) => {
        if (value) data.append(key, value);
      });
      if (coverImage) data.append('coverImage', coverImage);

      await api.post('/events', data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success('Event created!');
      router.push('/events');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to create event');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <Link href="/events" className="flex items-center gap-2 text-slate-400 hover:text-[#2a2724] mb-6">
        <ArrowLeft className="w-4 h-4" /> Back to Events
      </Link>

      <h1 className="text-2xl font-bold mb-6">Create Event</h1>

      <div className="card p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Event Name *</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className="input"
              placeholder="Annual Cultural Fest"
              required
            />
          </div>

          <div>
            <label className="label">Description</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              className="input min-h-[100px] resize-y"
              placeholder="Describe your event..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Category *</label>
              <select
                name="category"
                value={formData.category}
                onChange={handleChange}
                className="input"
                required
              >
                <option value="" disabled>Select a category...</option>
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Location</label>
              <input
                type="text"
                name="location"
                value={formData.location}
                onChange={handleChange}
                className="input"
                placeholder="Main Auditorium"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Start Date *</label>
              <input
                type="datetime-local"
                name="startDate"
                value={formData.startDate}
                onChange={handleChange}
                className="input"
                step={60}
                required
              />
            </div>
            <div>
              <label className="label">End Date</label>
              <input
                type="datetime-local"
                name="endDate"
                value={formData.endDate}
                onChange={handleChange}
                className="input"
                step={60}
                min={formData.startDate || undefined}
              />
            </div>
          </div>

          <div>
            <label className="label">Visibility</label>
            <select
              name="visibility"
              value={formData.visibility}
              onChange={handleChange}
              className="input"
            >
              <option value="PUBLIC">Public</option>
              <option value="PRIVATE">Private</option>
            </select>
          </div>

          <div>
            <label className="label">Cover Image</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setCoverImage(e.target.files?.[0] || null)}
              className="input"
            />
            {coverImage && (
              <img
                src={URL.createObjectURL(coverImage)}
                alt="Preview"
                className="mt-2 h-32 object-cover rounded-lg"
              />
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full justify-center py-2.5"
          >
            {loading ? 'Creating...' : 'Create Event'}
          </button>
        </form>
      </div>
    </div>
  );
}