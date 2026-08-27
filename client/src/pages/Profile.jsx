import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import Card, { CardHeader, CardTitle } from '../components/ui/Card';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import Avatar from '../components/ui/Avatar';
import Modal from '../components/ui/Modal';
import { Camera, Trash2, Save, Loader2, Clock } from 'lucide-react';

export default function Profile() {
  const { profile, updateProfile, fetchProfile, logout } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [form, setForm] = useState({
    firstName: profile?.first_name || '',
    lastName: profile?.last_name || '',
    phone: profile?.phone || '',
    address: profile?.address || '',
    city: profile?.city || '',
    province: profile?.province || '',
    bio: profile?.bio || '',
  });

  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [success, setSuccess] = useState('');
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  const isPendingDeletion = profile?.pending_deletion_at && !profile?.deleted_at;

  const getDeletionDate = () => {
    if (!profile?.pending_deletion_at) return null;
    const date = new Date(profile.pending_deletion_at);
    date.setDate(date.getDate() + 30);
    return date;
  };

  const getDaysRemaining = () => {
    const deletionDate = getDeletionDate();
    if (!deletionDate) return 0;
    return Math.ceil((deletionDate - new Date()) / (1000 * 60 * 60 * 24));
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validate = () => {
    const newErrors = {};
    if (!form.firstName.trim()) newErrors.firstName = 'First name is required';
    if (!form.lastName.trim()) newErrors.lastName = 'Last name is required';
    if (form.phone && !/^[\d\s\-+()]{7,20}$/.test(form.phone)) {
      newErrors.phone = 'Invalid phone number';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setSaving(true);
    setSuccess('');
    try {
      await updateProfile({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        phone: form.phone.trim() || null,
        address: form.address.trim() || null,
        city: form.city.trim() || null,
        province: form.province.trim() || null,
        bio: form.bio.trim() || null,
      });
      setSuccess('Profile updated successfully');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setErrors({ submit: err.response?.data?.error || 'Failed to update profile' });
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setErrors({ avatar: 'File must be less than 5MB' });
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => setAvatarPreview(reader.result);
    reader.readAsDataURL(file);

    setUploading(true);
    setErrors({ avatar: '' });

    try {
      const formData = new FormData();
      formData.append('avatar', file);

      await api.post('/users/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      await fetchProfile();
      setSuccess('Avatar updated successfully');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setErrors({ avatar: err.response?.data?.error || 'Failed to upload avatar' });
      setAvatarPreview(null);
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveAvatar = async () => {
    setRemoving(true);
    try {
      await api.delete('/users/avatar');
      setAvatarPreview(null);
      await fetchProfile();
      setSuccess('Avatar removed');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setErrors({ avatar: err.response?.data?.error || 'Failed to remove avatar' });
    } finally {
      setRemoving(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE') return;

    setDeleting(true);
    try {
      await api.post('/users/self-delete');
      await logout();
      navigate('/');
    } catch (err) {
      setErrors({ delete: err.response?.data?.error || 'Failed to delete account' });
      setDeleting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Profile</h1>
        <p className="text-gray-500 mt-1">Manage your account information.</p>
      </div>

      {isPendingDeletion && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-amber-800">Account Pending Deletion</h3>
              <p className="text-sm text-amber-700 mt-1">
                Your account is scheduled for permanent deletion on{' '}
                <strong>{getDeletionDate()?.toLocaleDateString()}</strong>
                {' '}({getDaysRemaining()} days remaining).
              </p>
              <p className="text-sm text-amber-600 mt-1">
                Contact support to cancel this deletion. After 30 days, your data
                will be permanently anonymized and cannot be recovered.
              </p>
            </div>
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Profile Picture</CardTitle>
        </CardHeader>
        <div className="flex items-center gap-6">
          <div className="relative">
            <Avatar
              src={avatarPreview || profile?.avatar_url}
              name={`${form.firstName} ${form.lastName}`}
              size="xl"
            />
            {uploading && (
              <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center">
                <Loader2 className="w-6 h-6 text-white animate-spin" />
              </div>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp"
              className="hidden"
              onChange={handleAvatarChange}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || isPendingDeletion}
            >
              <Camera className="w-4 h-4" />
              {uploading ? 'Uploading...' : 'Change Photo'}
            </Button>
            {(profile?.avatar_url || avatarPreview) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRemoveAvatar}
                disabled={removing || isPendingDeletion}
                className="text-red-600 hover:text-red-700"
              >
                <Trash2 className="w-4 h-4" />
                Remove
              </Button>
            )}
            {errors.avatar && <p className="text-xs text-red-600">{errors.avatar}</p>}
            <p className="text-xs text-gray-400">JPG, PNG or WebP. Max 5MB.</p>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Personal Information</CardTitle>
        </CardHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {errors.submit && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {errors.submit}
            </div>
          )}
          {success && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
              {success}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="First Name"
              name="firstName"
              value={form.firstName}
              onChange={handleChange}
              error={errors.firstName}
              required
              disabled={isPendingDeletion}
            />
            <Input
              label="Last Name"
              name="lastName"
              value={form.lastName}
              onChange={handleChange}
              error={errors.lastName}
              required
              disabled={isPendingDeletion}
            />
          </div>

          <Input
            label="Email"
            value={profile?.email || ''}
            disabled
            className="opacity-60"
          />

          <Input
            label="Phone"
            name="phone"
            value={form.phone}
            onChange={handleChange}
            error={errors.phone}
            placeholder="+63 9XX XXX XXXX"
            disabled={isPendingDeletion}
          />

          <Input
            label="Address"
            name="address"
            value={form.address}
            onChange={handleChange}
            placeholder="Street address"
            disabled={isPendingDeletion}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="City"
              name="city"
              value={form.city}
              onChange={handleChange}
              placeholder="Cebu City"
              disabled={isPendingDeletion}
            />
            <Input
              label="Province"
              name="province"
              value={form.province}
              onChange={handleChange}
              placeholder="Cebu"
              disabled={isPendingDeletion}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Bio</label>
            <textarea
              name="bio"
              rows={3}
              value={form.bio}
              onChange={handleChange}
              placeholder="Tell us about yourself..."
              disabled={isPendingDeletion}
              className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 sm:text-sm transition-colors resize-none disabled:opacity-50 disabled:bg-gray-50"
            />
          </div>

          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={saving || isPendingDeletion}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Changes
            </Button>
          </div>
        </form>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Account Details</CardTitle>
        </CardHeader>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Role</span>
            <span className="font-medium text-gray-900 capitalize">{profile?.role}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Status</span>
            {isPendingDeletion ? (
              <span className="font-medium text-amber-600">Pending Deletion</span>
            ) : (
              <span className={`font-medium ${profile?.is_active ? 'text-green-600' : 'text-red-600'}`}>
                {profile?.is_active ? 'Active' : 'Inactive'}
              </span>
            )}
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Member since</span>
            <span className="font-medium text-gray-900">
              {profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : 'N/A'}
            </span>
          </div>
        </div>
      </Card>

      {!isPendingDeletion && (
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="text-red-600">Danger Zone</CardTitle>
          </CardHeader>
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              Delete your account and all associated personal data.
              You have 30 days to contact support to reverse this before
              your data is permanently anonymized.
            </p>
            <Button
              variant="danger"
              size="sm"
              onClick={() => { setShowDeleteModal(true); setDeleteConfirmText(''); }}
            >
              <Trash2 className="w-4 h-4" />
              Delete Account
            </Button>
          </div>
        </Card>
      )}

      <Modal open={showDeleteModal} onClose={() => setShowDeleteModal(false)} maxWidth="max-w-md">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Delete Your Account</h3>
              <p className="text-sm text-gray-500">30-day grace period</p>
            </div>
          </div>

          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-sm text-amber-800">
              <strong>What happens when you delete your account:</strong>
            </p>
            <ul className="text-sm text-amber-700 mt-2 space-y-1 list-disc list-inside">
              <li>You will be immediately logged out</li>
              <li>You cannot log back in</li>
              <li>Your data is preserved for 30 days</li>
              <li>Contact support within 30 days to cancel</li>
              <li>After 30 days: name, email, phone are anonymized</li>
              <li>Active orders and drop-offs will be cancelled</li>
              <li>Your listings will be archived</li>
            </ul>
          </div>

          {errors.delete && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {errors.delete}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Type <span className="font-bold">DELETE</span> to confirm
            </label>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="Type DELETE"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setShowDeleteModal(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleDeleteAccount}
              disabled={deleting || deleteConfirmText !== 'DELETE'}
            >
              {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Clock className="w-4 h-4" />}
              {deleting ? 'Scheduling...' : 'Schedule Deletion (30 days)'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
