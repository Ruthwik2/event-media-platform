'use client';
import { useState } from 'react';
import api from '@/lib/axios';
import { X } from 'lucide-react';
import toast from 'react-hot-toast';
import { Event } from '@/types';
import { CATEGORIES } from '@/lib/categories';

interface Props {
  event: Event;
  onClose: () => void;
  onUpdated: (event: Event) => void;
}

// Convert an ISO date string to the value a datetime-local input expects
// (YYYY-MM-DDTHH:mm) in the user's local timezone.
const toLocalInput = (iso?: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export default function EditEventModal({ event, onClose, onUpdated }: Props) {
  const [formData, setFormData] = useState({
    name: event.name || '',
    description: event.description || '',
    category: event.category || '',
    startDate: toLocalInput(event.startDate),
    endDate: toLocalInput(event.endDate),
    location: event.location || '',
    visibility: event.visibility || 'PUBLIC',
  });
  const [coverImage, setCoverImage] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.endDate && formData.startDate && formData.endDate < formData.startDate) {
      toast.error('End date cannot be before the start date');
      return;
    }
    setLoading(true);
    try {
      const data = new FormData();
      // Send every editable field. Empty optional fields are still sent so the
      // backend can clear them (e.g. removing a description or location).
      data.append('name', formData.name);
      data.append('description', formData.description);
      data.append('category', formData.category);
      if (formData.startDate) data.append('startDate', formData.startDate);
      if (formData.endDate) data.append('endDate', formData.endDate);
      data.append('location', formData.location);
      data.append('visibility', formData.visibility);
      if (coverImage) data.append('coverImage', coverImage);

      const res = await api.put(`/events/${event.id}`, data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success('Event updated');
      onUpdated(res.data.data);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to update event');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="glass-panel p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">Edit Event</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-[#f0ede8] rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

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
              className="input min-h-[90px] resize-y"
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
            {(coverImage || event.coverImage) && (
              <img
                src={coverImage ? URL.createObjectURL(coverImage) : event.coverImage}
                alt="Cover preview"
                className="mt-2 h-32 w-full object-cover rounded-lg border border-[#e7e3dd]"
              />
            )}
            <p className="text-xs text-slate-500 mt-1">Leave empty to keep the current cover.</p>
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="btn-primary flex-1 justify-center">
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
