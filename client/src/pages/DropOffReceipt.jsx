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
  scheduled: '#d97706',
  in_transit: '#2563eb',
  received: '#2563eb',
  processed: '#16a34a',
  cancelled: '#dc2626',
};

const statusTailwind = {
  scheduled: 'text-yellow-600',
  in_transit: 'text-blue-600',
  received: 'text-blue-600',
  processed: 'text-green-600',
  cancelled: 'text-red-600',
};

const fmt = (amount) => parseFloat(amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : '—';

const PRINT_STYLES = `
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#111827;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .r{max-width:700px;margin:0 auto;padding:28px 36px}
  .hd{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:12px;border-bottom:1px solid #e5e7eb;margin-bottom:16px}
  .br{display:flex;align-items:center;gap:10px}
  .lg{width:32px;height:32px;background:#16a34a;border-radius:6px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:bold;font-size:14px}
  .bn{font-size:16px;font-weight:700;color:#111827}
  .bs{font-size:10px;color:#9ca3af}
  .tt{font-size:16px;font-weight:700;letter-spacing:.05em;color:#111827}
  .g2{display:grid;grid-template-columns:1fr 1fr;gap:16px}
  .mb{margin-bottom:14px;padding-bottom:14px;border-bottom:1px solid #f3f4f6}
  .lb{font-size:9px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:.05em;margin-bottom:3px}
  .vl{font-size:12px;font-weight:500;color:#111827}
  .vb{font-size:12px;font-weight:700;color:#111827}
  .sb{font-size:10px;color:#6b7280;margin-top:1px}
  .tr{text-align:right}
  .st{font-size:9px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px}
  .sv{font-size:12px;font-weight:700}
  table{width:100%;border-collapse:collapse;margin-bottom:14px}
  th{font-size:9px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;text-align:left;padding:5px 0;border-bottom:1px solid #e5e7eb}
  td{font-size:12px;padding:6px 0;border-bottom:1px solid #f9fafb;color:#111827}
  .tc{text-align:center}.tr2{text-align:right}
  .tb{font-weight:500}
  .tot{display:flex;justify-content:flex-end;margin-bottom:14px;padding-bottom:14px;border-bottom:1px solid #f3f4f6}
  .tbx{width:220px}
  .trow{display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px;color:#111827}
  .tm{color:#6b7280}
  .tdv{border-top:1px solid #e5e7eb;margin:5px 0;padding-top:5px}
  .ttot{font-size:14px;font-weight:700;color:#16a34a}
  .nt{margin-bottom:14px;padding-bottom:14px;border-bottom:1px solid #f3f4f6}
  .ntx{font-size:12px;color:#374151}
  .ft{text-align:center;padding-top:14px;border-top:1px solid #f3f4f6}
  .ft p{font-size:10px;color:#9ca3af}
  .ft .fs{font-size:9px;color:#d1d5db;margin-top:2px}
  @page{margin:.4in;size:A4}
`;

function esc(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function buildPrintHtml(dropOff, { fmt, fmtDate, statusLabel, statusColor, residentName, residentPhone }) {
  const items = (dropOff.drop_off_items || []).map(item => `
    <tr>
      <td class="tb">${esc(item.material_name)}</td>
      <td class="tc">${parseFloat(item.quantity).toFixed(1)} ${esc(item.unit)}</td>
      <td class="tr2">₱${fmt(item.estimated_value)}</td>
      <td class="tb tr2">₱${fmt(item.actual_value || item.estimated_value)}</td>
    </tr>`).join('');

  const notesSection = dropOff.notes ? `
    <div class="nt"><div class="st">Notes</div><div class="ntx">${esc(dropOff.notes)}</div></div>` : '';

  const facilityNotesSection = dropOff.business_notes ? `
    <div class="nt"><div class="st">Facility Notes</div><div class="ntx">${esc(dropOff.business_notes)}</div></div>` : '';

  return `<!DOCTYPE html><html><head><title>GreenPlace-DropOff-${esc(dropOff.reference_number)}</title>
<style>${PRINT_STYLES}</style></head><body><div class="r">
  <div class="hd">
    <div class="br"><div class="lg">G</div><div><div class="bn">GreenPlace</div><div class="bs">Sustainable Living Platform</div></div></div>
    <div class="tt">DROP-OFF RECEIPT</div>
  </div>
  <div class="g2 mb">
    <div><div class="lb">Receipt No.</div><div class="vb" style="font-family:monospace">${esc(dropOff.reference_number)}</div></div>
    <div class="tr"><div class="lb">Date</div><div class="vl">${fmtDate(dropOff.created_at)}</div></div>
  </div>
  <div class="mb">
    <div class="lb">Status</div>
    <div class="sv" style="color:${statusColor}">${statusLabel}</div>
  </div>
  <div class="g2 mb">
    <div><div class="lb">Submitted By</div><div class="vl">${esc(residentName)}</div>
      ${residentPhone ? `<div class="sb">${esc(residentPhone)}</div>` : ''}</div>
    <div><div class="lb">Facility</div><div class="vl">${esc(dropOff.business?.name)}</div>
      ${dropOff.business?.address ? `<div class="sb">${esc(dropOff.business.address)}</div>` : ''}
      ${dropOff.business?.phone ? `<div class="sb">${esc(dropOff.business.phone)}</div>` : ''}</div>
  </div>
  <div class="st">Materials</div>
  <table>
    <thead><tr><th>Material</th><th class="tc">Quantity</th><th class="tr2">Est. Value</th><th class="tr2">Actual Value</th></tr></thead>
    <tbody>${items}</tbody>
  </table>
  <div class="tot"><div class="tbx">
    <div class="trow"><span class="tm">Total Weight</span><span>${parseFloat(dropOff.total_weight_kg || 0).toFixed(1)} kg</span></div>
    <div class="trow"><span class="tm">Estimated Value</span><span>₱${fmt(dropOff.estimated_value)}</span></div>
    <div class="trow tdv"><span style="font-weight:700">Actual Payout</span><span class="ttot">₱${fmt(dropOff.actual_value || dropOff.estimated_value)}</span></div>
  </div></div>
  ${notesSection}${facilityNotesSection}
  <div class="ft"><p>Thank you for recycling and supporting sustainable living in Metro Cebu.</p><p class="fs">GreenPlace — Connecting communities with eco-friendly waste management</p></div>
</div></body></html>`;
}

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

  const statusLabel = statusLabels[dropOff?.status] || 'Pending';
  const statusColor = statusColors[dropOff?.status] || '#d97706';
  const twColor = statusTailwind[dropOff?.status] || 'text-yellow-600';
  const residentName = dropOff?.resident
    ? `${dropOff.resident.first_name} ${dropOff.resident.last_name}`
    : dropOff?.guest_name || '—';
  const residentPhone = dropOff?.resident?.phone || dropOff?.guest_phone || null;

  const handlePrint = useCallback(() => {
    if (!dropOff) return;
    const html = buildPrintHtml(dropOff, { fmt, fmtDate, statusLabel, statusColor, residentName, residentPhone });

    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:none;';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(html);
    doc.close();

    iframe.contentWindow.focus();
    iframe.contentWindow.print();
    setTimeout(() => { document.body.removeChild(iframe); }, 1500);
  }, [dropOff, statusLabel, statusColor, residentName, residentPhone]);

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

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden p-8">
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

          <div className="pb-4 border-b border-gray-100 mb-4">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Status</p>
            <p className={`text-sm font-bold ${twColor}`}>{statusLabel}</p>
          </div>

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

          <div className="flex justify-end mb-4 pb-4 border-b border-gray-100">
            <div className="w-52 space-y-1.5">
              <div className="flex justify-between text-sm"><span className="text-gray-500">Total Weight</span><span className="text-gray-700">{parseFloat(dropOff.total_weight_kg || 0).toFixed(1)} kg</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-500">Estimated Value</span><span className="text-gray-700">₱{fmt(dropOff.estimated_value)}</span></div>
              <div className="border-t border-gray-200 pt-2 flex justify-between"><span className="text-sm font-bold text-gray-900">Actual Payout</span><span className="text-base font-bold text-primary-600">₱{fmt(dropOff.actual_value || dropOff.estimated_value)}</span></div>
            </div>
          </div>

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

          <div className="text-center pt-2">
            <p className="text-xs text-gray-400">Thank you for recycling and supporting sustainable living in Metro Cebu.</p>
            <p className="text-[10px] text-gray-300 mt-0.5">GreenPlace — Connecting communities with eco-friendly waste management</p>
          </div>
        </div>
      </div>
    </div>
  );
}
