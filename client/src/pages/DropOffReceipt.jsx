import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Printer, Leaf, AlertTriangle, MapPin } from 'lucide-react';
import api from '../lib/api';
import Button from '../components/ui/Button';

const statusConfig = {
  scheduled: { label: 'Pending', color: 'text-yellow-600' },
  in_transit: { label: 'In Transit', color: 'text-blue-600' },
  received: { label: 'Received', color: 'text-blue-600' },
  processed: { label: 'Completed', color: 'text-green-600' },
  cancelled: { label: 'Cancelled', color: 'text-red-600' },
};

export default function DropOffReceipt() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [dropOff, setDropOff] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchDropOff = async () => {
      try {
        const { data } = await api.get(`/drop-offs/${id}`);
        setDropOff(data.dropOff);
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to load receipt');
      } finally {
        setLoading(false);
      }
    };
    fetchDropOff();
  }, [id]);

  const handlePrint = () => {
    document.title = `GreenPlace-DropOff-${dropOff?.reference_number || 'Receipt'}`;
    window.print();
    setTimeout(() => { document.title = 'GreenPlace'; }, 1000);
  };

  const formatCurrency = (amount) => {
    return parseFloat(amount || 0).toLocaleString('en-PH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-PH', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleString('en-PH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const statusInfo = statusConfig[dropOff?.status] || statusConfig.scheduled;
  const residentName = dropOff?.resident
    ? `${dropOff.resident.first_name} ${dropOff.resident.last_name}`
    : dropOff?.guest_name || '—';
  const residentPhone = dropOff?.resident?.phone || dropOff?.guest_phone || null;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center no-print">
        <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
      </div>
    );
  }

  if (error && !dropOff) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center no-print">
        <div className="text-center max-w-md mx-4">
          <AlertTriangle className="w-12 h-12 text-red-300 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Error</h2>
          <p className="text-gray-500 mb-6">{error}</p>
          <Button onClick={() => navigate('/drop-offs')}>Back to Drop-offs</Button>
        </div>
      </div>
    );
  }

  if (!dropOff) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Non-print header */}
      <div className="no-print bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link
            to="/drop-offs"
            className="flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700 font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Drop-offs
          </Link>
          <Button onClick={handlePrint} size="sm">
            <Printer className="w-4 h-4" />
            Print Receipt
          </Button>
        </div>
      </div>

      {/* Receipt content */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 print-area">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden print:shadow-none print:border-none print:rounded-none">

          {/* Header */}
          <div className="px-8 pt-8 pb-6 border-b border-gray-200">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary-600 rounded-lg flex items-center justify-center">
                  <Leaf className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">GreenPlace</h1>
                  <p className="text-xs text-gray-500">Sustainable Living Platform</p>
                </div>
              </div>
              <div className="text-right">
                <h2 className="text-lg font-bold text-gray-900 tracking-wide">DROP-OFF RECEIPT</h2>
              </div>
            </div>
          </div>

          {/* Receipt Info */}
          <div className="px-8 py-6 border-b border-gray-100">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Receipt No.</p>
                <p className="text-sm font-bold text-gray-900 font-mono">{dropOff.reference_number}</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Date</p>
                <p className="text-sm text-gray-700">{formatDate(dropOff.created_at)}</p>
              </div>
            </div>
            <div className="mt-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Status</p>
              <p className={`text-sm font-bold capitalize ${statusInfo.color}`}>{statusInfo.label}</p>
            </div>
          </div>

          {/* Submitted By & Facility */}
          <div className="px-8 py-6 border-b border-gray-100">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Submitted By</p>
                <p className="text-sm font-medium text-gray-900">{residentName}</p>
                {residentPhone && (
                  <p className="text-xs text-gray-500 mt-1">{residentPhone}</p>
                )}
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Facility</p>
                <p className="text-sm font-medium text-gray-900">{dropOff.business?.name}</p>
                {dropOff.business?.address && (
                  <p className="text-xs text-gray-500 mt-1 flex items-start gap-1">
                    <MapPin className="w-3 h-3 mt-0.5 flex-shrink-0" />
                    {dropOff.business.address}
                  </p>
                )}
                {dropOff.business?.phone && (
                  <p className="text-xs text-gray-500 mt-1">{dropOff.business.phone}</p>
                )}
              </div>
            </div>
          </div>

          {/* Materials */}
          <div className="px-8 py-6 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Materials</p>
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider pb-2">Material</th>
                  <th className="text-center text-xs font-semibold text-gray-500 uppercase tracking-wider pb-2 w-24">Quantity</th>
                  <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wider pb-2 w-28">Est. Value</th>
                  <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wider pb-2 w-28">Actual Value</th>
                </tr>
              </thead>
              <tbody>
                {(dropOff.drop_off_items || []).map((item) => (
                  <tr key={item.id} className="border-b border-gray-50">
                    <td className="py-3">
                      <p className="text-sm font-medium text-gray-900">{item.material_name}</p>
                      {item.notes && (
                        <p className="text-xs text-gray-400 mt-0.5">{item.notes}</p>
                      )}
                    </td>
                    <td className="py-3 text-center">
                      <span className="text-sm text-gray-600">{parseFloat(item.quantity).toFixed(1)} {item.unit}</span>
                    </td>
                    <td className="py-3 text-right">
                      <span className="text-sm text-gray-600">₱{formatCurrency(item.estimated_value)}</span>
                    </td>
                    <td className="py-3 text-right">
                      <span className="text-sm font-medium text-gray-900">₱{formatCurrency(item.actual_value || item.estimated_value)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="px-8 py-6 border-b border-gray-100">
            <div className="w-full max-w-xs ml-auto space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Total Weight</span>
                <span className="text-gray-700">{parseFloat(dropOff.total_weight_kg || 0).toFixed(1)} kg</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Estimated Value</span>
                <span className="text-gray-700">₱{formatCurrency(dropOff.estimated_value)}</span>
              </div>
              <div className="border-t border-gray-200 pt-2 flex justify-between">
                <span className="text-sm font-bold text-gray-900">Actual Payout</span>
                <span className="text-base font-bold text-primary-600">₱{formatCurrency(dropOff.actual_value || dropOff.estimated_value)}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          {dropOff.notes && (
            <div className="px-8 py-6 border-b border-gray-100">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Notes</p>
              <p className="text-sm text-gray-700">{dropOff.notes}</p>
            </div>
          )}

          {/* Facility Notes */}
          {dropOff.business_notes && (
            <div className="px-8 py-6 border-b border-gray-100">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Facility Notes</p>
              <p className="text-sm text-gray-700">{dropOff.business_notes}</p>
            </div>
          )}

          {/* Processing Info */}
          <div className="px-8 py-6 border-b border-gray-100">
            <div className="grid grid-cols-2 gap-6">
              {dropOff.received_at && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Received At</p>
                  <p className="text-sm text-gray-700">{formatDateTime(dropOff.received_at)}</p>
                </div>
              )}
              {dropOff.processed_at && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Processed At</p>
                  <p className="text-sm text-gray-700">{formatDateTime(dropOff.processed_at)}</p>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="px-8 py-6 text-center">
            <p className="text-xs text-gray-400">
              Thank you for recycling and supporting sustainable living in Metro Cebu.
            </p>
            <p className="text-xs text-gray-300 mt-1">
              GreenPlace — Connecting communities with eco-friendly waste management
            </p>
          </div>
        </div>
      </div>

      {/* Print-specific styles */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print-area,
          .print-area * {
            visibility: visible;
          }
          .print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 0;
            margin: 0;
          }
          .no-print {
            display: none !important;
          }
          .print-area .bg-white {
            border: none !important;
            box-shadow: none !important;
            border-radius: 0 !important;
          }
          @page {
            margin: 0.5in;
            size: A4;
          }
        }
      `}</style>
    </div>
  );
}
