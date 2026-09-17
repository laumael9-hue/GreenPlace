import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Printer, AlertTriangle } from 'lucide-react';
import api from '../lib/api';
import Button from '../components/ui/Button';

const statusLabels = {
  scheduled: 'Pending',
  in_transit: 'In Transit',
  received: 'Received',
  processed: 'Completed',
  cancelled: 'Cancelled',
};

const statusColors = {
  scheduled: 'text-yellow-600',
  in_transit: 'text-blue-600',
  received: 'text-blue-600',
  processed: 'text-green-600',
  cancelled: 'text-red-600',
};

const PRINT_STYLES = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #111827; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .receipt { max-width: 700px; margin: 0 auto; padding: 24px 32px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 14px; padding-bottom: 14px; border-bottom: 1px solid #e5e7eb; }
  .brand { display: flex; align-items: center; gap: 10px; }
  .logo { width: 32px; height: 32px; background: #16a34a; border-radius: 6px; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 14px; }
  .brand-name { font-size: 16px; font-weight: 700; color: #111827; }
  .brand-sub { font-size: 10px; color: #9ca3af; }
  .title { font-size: 16px; font-weight: 700; letter-spacing: 0.05em; color: #111827; }
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .mb-section { margin-bottom: 14px; padding-bottom: 14px; border-bottom: 1px solid #f3f4f6; }
  .label { font-size: 9px; font-weight: 600; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 3px; }
  .value { font-size: 12px; font-weight: 500; color: #111827; }
  .value-bold { font-size: 12px; font-weight: 700; color: #111827; }
  .sub { font-size: 10px; color: #6b7280; margin-top: 1px; }
  .text-right { text-align: right; }
  .status-line { margin-bottom: 14px; padding-bottom: 14px; border-bottom: 1px solid #f3f4f6; }
  .status-value { font-size: 12px; font-weight: 700; }
  .section-title { font-size: 9px; font-weight: 600; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
  th { font-size: 9px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; text-align: left; padding: 5px 0; border-bottom: 1px solid #e5e7eb; }
  th.c { text-align: center; } th.r { text-align: right; }
  td { font-size: 12px; padding: 6px 0; border-bottom: 1px solid #f9fafb; color: #111827; }
  td.c { text-align: center; } td.r { text-align: right; }
  td.bold { font-weight: 500; }
  .totals { display: flex; justify-content: flex-end; margin-bottom: 14px; padding-bottom: 14px; border-bottom: 1px solid #f3f4f6; }
  .totals-box { width: 220px; }
  .totals-row { display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 3px; color: #111827; }
  .totals-muted { color: #6b7280; }
  .totals-divider { border-top: 1px solid #e5e7eb; margin: 5px 0; padding-top: 5px; }
  .totals-total { font-size: 14px; font-weight: 700; color: #16a34a; }
  .notes-box { margin-bottom: 14px; padding-bottom: 14px; border-bottom: 1px solid #f3f4f6; }
  .notes-text { font-size: 12px; color: #374151; }
  .footer { text-align: center; padding-top: 14px; border-top: 1px solid #f3f4f6; }
  .footer p { font-size: 10px; color: #9ca3af; }
  .footer .sub { font-size: 9px; color: #d1d5db; margin-top: 2px; }
  @page { margin: 0.4in; size: A4; }
`;

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

  const handlePrint = useCallback(() => {
    const printArea = document.querySelector('.print-area');
    if (!printArea || !dropOff) return;

    const fileName = `GreenPlace-DropOff-${dropOff.reference_number || 'Receipt'}`;
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:none;';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(`<!DOCTYPE html><html><head><title>${fileName}</title><style>${PRINT_STYLES}</style></head><body>${printArea.innerHTML}</body></html>`);
    doc.close();

    iframe.contentWindow.focus();
    iframe.contentWindow.print();
    setTimeout(() => { document.body.removeChild(iframe); }, 1500);
  }, [dropOff]);

  const fmt = (amount) => parseFloat(amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : '—';

  const statusLabel = statusLabels[dropOff?.status] || 'Pending';
  const statusColor = statusColors[dropOff?.status] || 'text-yellow-600';
  const residentName = dropOff?.resident
    ? `${dropOff.resident.first_name} ${dropOff.resident.last_name}`
    : dropOff?.guest_name || '—';
  const residentPhone = dropOff?.resident?.phone || dropOff?.guest_phone || null;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
      </div>
    );
  }

  if (error && !dropOff) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
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
      {/* Screen header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link to="/drop-offs" className="flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700 font-medium">
            <ArrowLeft className="w-4 h-4" />
            Back to Drop-offs
          </Link>
          <Button onClick={handlePrint} size="sm">
            <Printer className="w-4 h-4" />
            Print Receipt
          </Button>
        </div>
      </div>

      {/* Receipt */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <div className="print-area bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden p-8">

          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-gray-200 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">G</span>
              </div>
              <div>
                <p className="text-lg font-bold text-gray-900">GreenPlace</p>
                <p className="text-xs text-gray-400">Sustainable Living Platform</p>
              </div>
            </div>
            <h2 className="text-lg font-bold text-gray-900 tracking-wide">DROP-OFF RECEIPT</h2>
          </div>

          {/* Receipt No + Date */}
          <div className="grid grid-cols-2 gap-4 pb-4 border-b border-gray-100 mb-4">
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Receipt No.</p>
              <p className="text-sm font-bold text-gray-900 font-mono">{dropOff.reference_number}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Date</p>
              <p className="text-sm text-gray-700">{fmtDate(dropOff.created_at)}</p>
            </div>
          </div>

          {/* Status */}
          <div className="pb-4 border-b border-gray-100 mb-4">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Status</p>
            <p className={`text-sm font-bold ${statusColor}`}>{statusLabel}</p>
          </div>

          {/* Submitted By + Facility */}
          <div className="grid grid-cols-2 gap-4 pb-4 border-b border-gray-100 mb-4">
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Submitted By</p>
              <p className="text-sm font-medium text-gray-900">{residentName}</p>
              {residentPhone && <p className="text-xs text-gray-500 mt-0.5">{residentPhone}</p>}
            </div>
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Facility</p>
              <p className="text-sm font-medium text-gray-900">{dropOff.business?.name}</p>
              {dropOff.business?.address && <p className="text-xs text-gray-500 mt-0.5">{dropOff.business.address}</p>}
              {dropOff.business?.phone && <p className="text-xs text-gray-500">{dropOff.business.phone}</p>}
            </div>
          </div>

          {/* Materials */}
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Materials</p>
          <table className="w-full mb-4">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left text-[10px] font-semibold text-gray-500 uppercase pb-1.5">Material</th>
                <th className="text-center text-[10px] font-semibold text-gray-500 uppercase pb-1.5 w-20">Quantity</th>
                <th className="text-right text-[10px] font-semibold text-gray-500 uppercase pb-1.5 w-24">Est. Value</th>
                <th className="text-right text-[10px] font-semibold text-gray-500 uppercase pb-1.5 w-24">Actual Value</th>
              </tr>
            </thead>
            <tbody>
              {(dropOff.drop_off_items || []).map((item) => (
                <tr key={item.id} className="border-b border-gray-50">
                  <td className="py-2 text-sm font-medium text-gray-900">{item.material_name}</td>
                  <td className="py-2 text-sm text-gray-600 text-center">{parseFloat(item.quantity).toFixed(1)} {item.unit}</td>
                  <td className="py-2 text-sm text-gray-600 text-right">₱{fmt(item.estimated_value)}</td>
                  <td className="py-2 text-sm font-medium text-gray-900 text-right">₱{fmt(item.actual_value || item.estimated_value)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div className="flex justify-end mb-4 pb-4 border-b border-gray-100">
            <div className="w-52 space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Total Weight</span>
                <span className="text-gray-700">{parseFloat(dropOff.total_weight_kg || 0).toFixed(1)} kg</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Estimated Value</span>
                <span className="text-gray-700">₱{fmt(dropOff.estimated_value)}</span>
              </div>
              <div className="border-t border-gray-200 pt-2 flex justify-between">
                <span className="text-sm font-bold text-gray-900">Actual Payout</span>
                <span className="text-base font-bold text-primary-600">₱{fmt(dropOff.actual_value || dropOff.estimated_value)}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          {dropOff.notes && (
            <div className="pb-4 border-b border-gray-100 mb-4">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Notes</p>
              <p className="text-sm text-gray-700">{dropOff.notes}</p>
            </div>
          )}

          {dropOff.business_notes && (
            <div className="pb-4 border-b border-gray-100 mb-4">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Facility Notes</p>
              <p className="text-sm text-gray-700">{dropOff.business_notes}</p>
            </div>
          )}

          {/* Footer */}
          <div className="text-center pt-2">
            <p className="text-xs text-gray-400">Thank you for recycling and supporting sustainable living in Metro Cebu.</p>
            <p className="text-[10px] text-gray-300 mt-0.5">GreenPlace — Connecting communities with eco-friendly waste management</p>
          </div>
        </div>
      </div>
    </div>
  );
}
