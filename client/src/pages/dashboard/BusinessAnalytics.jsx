import { useState, useEffect, useCallback } from 'react';
import { DollarSign, ClipboardList, List, Star, Package, Weight } from 'lucide-react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import api from '../../lib/api';
import StatCard from '../../components/ui/StatCard';
import Card, { CardHeader, CardTitle } from '../../components/ui/Card';

const RANGE_OPTIONS = [
  { days: 7, label: '7 days', short: '7d' },
  { days: 30, label: '30 days', short: '30d' },
  { days: 90, label: '90 days', short: '90d' },
  { days: 365, label: '1 year', short: '1y' },
];

const fmtPeso = (v) =>
  `₱${Number(v || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtDateLabel = (key) =>
  new Date(`${key}T00:00:00Z`).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });

const truncate = (label, max = 18) =>
  label.length > max ? `${label.slice(0, max)}…` : label;

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm px-3 py-2 text-xs">
      <p className="font-medium text-gray-900 mb-1">{fmtDateLabel(label)}</p>
      {payload.map((entry) => (
        <p key={entry.dataKey} style={{ color: entry.color }} className="flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
          {entry.dataKey === 'revenue'
            ? `Revenue: ${fmtPeso(entry.value)}`
            : `${entry.name}: ${entry.value}`}
        </p>
      ))}
    </div>
  );
}

export default function BusinessAnalytics() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);
  const [error, setError] = useState('');

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/businesses/my/stats', { params: { days } });
      setStats(data.stats);
      setError('');
    } catch (err) {
      console.error('Error:', err);
      setError(err.response?.data?.error || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 bg-gray-100 rounded-xl" />
          ))}
        </div>
        <div className="h-80 bg-gray-100 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          <p className="text-gray-500 mt-1">View your business performance metrics.</p>
        </div>
        <Card>
          <div className="text-center py-12">
            <p className="text-sm text-red-600 font-medium">{error}</p>
            <button
              type="button"
              onClick={fetchStats}
              className="mt-4 text-sm text-primary-600 hover:text-primary-700 font-medium"
            >
              Try again
            </button>
          </div>
        </Card>
      </div>
    );
  }

  const summary = stats?.summary || {};
  const trend = stats?.trend || [];
  const topProducts = stats?.topProducts || [];
  const ratingBreakdown = stats?.ratingBreakdown || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const maxRatingCount = Math.max(1, ...Object.values(ratingBreakdown));
  const maxProductRevenue = Math.max(1, ...topProducts.map((p) => Number(p.revenue) || 0));
  const rangeLabel = RANGE_OPTIONS.find((o) => o.days === days)?.label || `${days} days`;
  const rangeShort = RANGE_OPTIONS.find((o) => o.days === days)?.short || `${days}d`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          <p className="text-gray-500 mt-1">View your business performance metrics.</p>
        </div>
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 self-start">
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.days}
              type="button"
              onClick={() => setDays(opt.days)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                days === opt.days
                  ? 'bg-white text-primary-600 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<DollarSign className="w-6 h-6" />}
          label={`Revenue (${rangeShort})`}
          value={fmtPeso(summary.revenue)}
          change={`${summary.completedCount || 0} completed orders`}
          changeType="neutral"
        />
        <StatCard
          icon={<ClipboardList className="w-6 h-6" />}
          label={`Orders (${rangeShort})`}
          value={String(summary.orderCount || 0)}
          change={`${summary.pendingCount || 0} pending`}
          changeType={(summary.pendingCount || 0) > 0 ? 'warning' : 'neutral'}
        />
        <StatCard
          icon={<List className="w-6 h-6" />}
          label="Active Listings"
          value={String(summary.activeListings || 0)}
          change={summary.activeListings > 0 ? 'Live on marketplace' : 'Create your first listing'}
          changeType="neutral"
        />
        <StatCard
          icon={<Star className="w-6 h-6" />}
          label="Avg Rating"
          value={(Number(summary.ratingAvg) || 0).toFixed(1)}
          change={`${summary.ratingCount || 0} reviews`}
          changeType="neutral"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Revenue & Orders Trend</CardTitle>
        </CardHeader>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={trend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={fmtDateLabel}
                tick={{ fontSize: 11, fill: '#6b7280' }}
                tickLine={false}
                axisLine={{ stroke: '#e5e7eb' }}
                minTickGap={24}
              />
              <YAxis
                yAxisId="revenue"
                tickFormatter={(v) => `₱${v.toLocaleString('en-PH')}`}
                tick={{ fontSize: 11, fill: '#6b7280' }}
                tickLine={false}
                axisLine={false}
                width={70}
              />
              <YAxis
                yAxisId="orders"
                orientation="right"
                allowDecimals={false}
                tick={{ fontSize: 11, fill: '#6b7280' }}
                tickLine={false}
                axisLine={false}
                width={30}
              />
              <Tooltip content={<ChartTooltip />} />
              <Bar yAxisId="orders" dataKey="orders" name="Orders" fill="#93c5fd" radius={[3, 3, 0, 0]} />
              <Line
                yAxisId="revenue"
                type="monotone"
                dataKey="revenue"
                name="Revenue"
                stroke="#16a34a"
                strokeWidth={2}
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Package className="w-5 h-5 text-primary-600" />
              <CardTitle>Top Products</CardTitle>
            </div>
          </CardHeader>
          {topProducts.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">
              No completed sales in the last {rangeLabel}.
            </p>
          ) : (
            <ul className="space-y-4">
              {topProducts.map((product, index) => (
                <li key={`${product.title}-${index}`}>
                  <div className="flex items-center justify-between text-sm mb-1.5">
                    <span className="font-medium text-gray-900 truncate pr-3">
                      {truncate(product.title, 32)}
                    </span>
                    <span className="text-gray-500 flex-shrink-0 ml-2">
                      {product.quantity} sold · {fmtPeso(product.revenue)}
                    </span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary-500 rounded-full"
                      style={{
                        width: `${Math.max(4, (Number(product.revenue) / maxProductRevenue) * 100)}%`,
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Star className="w-5 h-5 text-amber-500" />
              <CardTitle>Rating Breakdown</CardTitle>
            </div>
          </CardHeader>
          {(summary.ratingCount || 0) === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">No reviews yet.</p>
          ) : (
            <ul className="space-y-3">
              {[5, 4, 3, 2, 1].map((star) => (
                <li key={star} className="flex items-center gap-3 text-sm">
                  <span className="w-8 text-gray-600 flex-shrink-0">{star} star</span>
                  <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-400 rounded-full"
                      style={{
                        width: `${(ratingBreakdown[star] / maxRatingCount) * 100}%`,
                      }}
                    />
                  </div>
                  <span className="w-8 text-right text-gray-500 flex-shrink-0">
                    {ratingBreakdown[star]}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Weight className="w-5 h-5 text-primary-600" />
            <CardTitle>Drop-offs</CardTitle>
          </div>
        </CardHeader>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-500">Drop-offs ({rangeShort})</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{summary.dropOffCount || 0}</p>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-500">Total Weight</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {Number(summary.dropOffWeightKg || 0).toLocaleString('en-PH', {
                minimumFractionDigits: 1,
                maximumFractionDigits: 1,
              })}{' '}
              <span className="text-sm font-medium text-gray-500">kg</span>
            </p>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-500">Avg Weight per Drop-off</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {summary.dropOffCount > 0
                ? (Number(summary.dropOffWeightKg || 0) / summary.dropOffCount).toLocaleString(
                    'en-PH',
                    { minimumFractionDigits: 1, maximumFractionDigits: 1 }
                  )
                : '0.0'}{' '}
              <span className="text-sm font-medium text-gray-500">kg</span>
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
