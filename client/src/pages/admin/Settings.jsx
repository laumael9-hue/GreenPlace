import { useState, useEffect, useCallback } from 'react';
import api from '../../lib/api';
import Card, { CardHeader, CardTitle } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import {
  Settings, Save, Loader2, AlertTriangle, CheckCircle,
  Building2, ShoppingBag, MessageCircle, Shield, Server,
} from 'lucide-react';

// Form groups: key -> { label, type, hint }
const GROUPS = [
  {
    title: 'General',
    icon: <Building2 className="w-4 h-4" />,
    fields: [
      { key: 'site_name', label: 'Site Name', type: 'text', hint: 'Application name shown in titles and receipts.' },
      { key: 'site_tagline', label: 'Tagline', type: 'text', hint: 'Short slogan shown on the landing page.' },
      { key: 'default_currency', label: 'Default Currency', type: 'text', hint: 'ISO currency code used across the platform.' },
    ],
  },
  {
    title: 'Marketplace',
    icon: <ShoppingBag className="w-4 h-4" />,
    fields: [
      { key: 'listing_max_images', label: 'Max Images per Listing', type: 'int', hint: 'Upper limit for uploaded product photos.' },
      { key: 'min_drop_off_weight_kg', label: 'Minimum Drop-off Weight (kg)', type: 'int', hint: 'Lightest scheduled drop-off accepted.' },
      { key: 'business_auto_approve', label: 'Auto-approve Businesses', type: 'bool', hint: 'Skip manual review of new business registrations.' },
    ],
  },
  {
    title: 'Forum',
    icon: <MessageCircle className="w-4 h-4" />,
    fields: [
      { key: 'forum_max_posts_per_day', label: 'Max Posts per User / Day', type: 'int', hint: 'Spam guard for forum activity.' },
    ],
  },
  {
    title: 'Moderation & Reviews',
    icon: <Shield className="w-4 h-4" />,
    fields: [
      { key: 'review_min_length', label: 'Minimum Review Length', type: 'int', hint: 'Minimum characters for a review body.' },
      { key: 'max_upload_size_mb', label: 'Max Upload Size (MB)', type: 'int', hint: 'Upper limit for file uploads.' },
    ],
  },
  {
    title: 'System',
    icon: <Server className="w-4 h-4" />,
    fields: [
      { key: 'maintenance_mode', label: 'Maintenance Mode', type: 'bool', hint: 'Block non-admin access while under maintenance.' },
      { key: 'paymongo_test_mode', label: 'PayMongo Test Mode', type: 'bool', hint: 'Use PayMongo test environment (no real charges).' },
      { key: 'notification_retention_days', label: 'Notification Retention (days)', type: 'int', hint: 'Days before old notifications are pruned.' },
    ],
  },
];

export default function SettingsPage() {
  const [values, setValues] = useState({});
  const [original, setOriginal] = useState({});
  const [descriptions, setDescriptions] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/admin/settings');
      const map = {};
      const descMap = {};
      (data.settings || []).forEach((s) => {
        map[s.key] = s.value;
        descMap[s.key] = s.description;
      });
      setValues(map);
      setOriginal(map);
      setDescriptions(descMap);
    } catch (err) {
      console.error('Failed to fetch settings:', err);
      setError(err.response?.data?.error || 'Failed to load settings.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const dirtyKeys = Object.keys(values).filter((key) => values[key] !== original[key]);

  const setValue = (key, value) => {
    setValues(prev => ({ ...prev, [key]: value }));
    setSuccess('');
  };

  const handleSave = async () => {
    if (dirtyKeys.length === 0) return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const payload = {};
      dirtyKeys.forEach((key) => { payload[key] = values[key]; });
      await api.put('/admin/settings', { settings: payload });
      setOriginal(values);
      setSuccess(`Saved ${dirtyKeys.length} setting${dirtyKeys.length > 1 ? 's' : ''}.`);
    } catch (err) {
      console.error('Failed to save settings:', err);
      setError(err.response?.data?.error || 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setValues(original);
    setError('');
    setSuccess('');
  };

  const renderField = (field) => {
    const value = values[field.key];
    if (value === undefined) {
      return (
        <div key={field.key} className="flex items-center justify-between gap-4 py-3">
          <div>
            <p className="text-sm font-medium text-gray-700">{field.label}</p>
            <p className="text-xs text-gray-400">{field.hint}</p>
          </div>
          <span className="text-xs text-gray-400">Not set</span>
        </div>
      );
    }

    if (field.type === 'bool') {
      const enabled = value === 'true';
      return (
        <div key={field.key} className="flex items-center justify-between gap-4 py-3">
          <div>
            <p className="text-sm font-medium text-gray-700">{field.label}</p>
            <p className="text-xs text-gray-400">{field.hint}</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            onClick={() => setValue(field.key, enabled ? 'false' : 'true')}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
              enabled ? 'bg-primary-600' : 'bg-gray-200'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                enabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      );
    }

    return (
      <div key={field.key} className="py-3">
        <label htmlFor={field.key} className="block text-sm font-medium text-gray-700 mb-1">
          {field.label}
        </label>
        <input
          id={field.key}
          type={field.type === 'int' ? 'number' : 'text'}
          min={field.type === 'int' ? '0' : undefined}
          value={value}
          onChange={(e) => setValue(field.key, e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
        <p className="text-xs text-gray-400 mt-1">{field.hint}</p>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">System Settings</h1>
          <p className="text-gray-500 mt-1">Configure application-wide behavior.</p>
        </div>
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">System Settings</h1>
          <p className="text-gray-500 mt-1">Configure application-wide behavior.</p>
        </div>
        <div className="flex items-center gap-2">
          {dirtyKeys.length > 0 && (
            <Button variant="ghost" size="sm" onClick={handleReset} disabled={saving}>
              Reset
            </Button>
          )}
          <Button
            variant="primary"
            size="sm"
            onClick={handleSave}
            disabled={saving || dirtyKeys.length === 0}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Saving...' : dirtyKeys.length > 0 ? `Save (${dirtyKeys.length})` : 'Save'}
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}
      {success && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700 flex items-center gap-2">
          <CheckCircle className="w-4 h-4 shrink-0" />
          {success}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {GROUPS.map((group) => (
          <Card key={group.title}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <span className="text-primary-600">{group.icon}</span>
                {group.title}
              </CardTitle>
            </CardHeader>
            <div className="divide-y divide-gray-100">
              {group.fields.map(renderField)}
            </div>
          </Card>
        ))}
      </div>

      <p className="text-xs text-gray-400 flex items-center gap-1">
        <Settings className="w-3.5 h-3.5" />
        Changes are recorded in the admin audit log. Keys: {Object.keys(descriptions).length} settings loaded.
      </p>
    </div>
  );
}
