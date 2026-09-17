import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Printer, AlertTriangle } from 'lucide-react';
import api from '../lib/api';
import Button from '../components/ui/Button';

const paymentStatusLabels = {
  pending: 'Pending',
  paid: 'Paid',
  failed: 'Failed',
  refunded: 'Refunded',
};

const paymentStatusColors = {
  pending: '#d97706',
  paid: '#16a34a',
  failed: '#dc2626',
  refunded: '#dc2626',
};

const fmt = (amount) => parseFloat(amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : '—';
const fmtDateTime = (d) => d ? new Date(d).toLocaleString('en-PH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

const PRINT_STYLES = `
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#111827;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .r{max-width:700px;margin:0 auto;padding:28px 36px}
  .hd{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:12px;border-bottom:1px solid #e5e7eb;margin-bottom:16px}
  .br{display:flex;align-items:center;gap:10px}
  .lg{width:32px;height:32px;background:#16a34a;border-radius:6px;display:flex;align-items:center;justify-content:center}
  .lg svg{width:20px;height:20px;color:#fff}
  .bn{font-size:16px;font-weight:700;color:#111827}
  .bs{font-size:10px;color:#9ca3af}
  .tt{font-size:16px;font-weight:700;letter-spacing:.05em;color:#111827}
  .bm{background:#fffbeb;border:1px solid #fcd34d;border-radius:6px;padding:8px 12px;margin-bottom:14px}
  .bm-t{font-size:12px;font-weight:700;color:#92400e}
  .bm-d{font-size:10px;color:#a16207}
  .g2{display:grid;grid-template-columns:1fr 1fr;gap:16px}
  .mb{margin-bottom:14px;padding-bottom:14px;border-bottom:1px solid #f3f4f6}
  .lb{font-size:9px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:.05em;margin-bottom:3px}
  .vl{font-size:12px;font-weight:500;color:#111827}
  .vb{font-size:12px;font-weight:700;color:#111827}
  .sb{font-size:10px;color:#6b7280;margin-top:1px}
  .tr{text-align:right}
  .st{font-size:9px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px}
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
  .pr{display:flex;justify-content:space-between;align-items:center;font-size:12px;margin-bottom:3px}
  .pl{color:#6b7280}
  .pv{font-weight:500;color:#111827}
  .pf{font-size:10px;font-family:monospace;background:#f9fafb;padding:2px 6px;border-radius:3px;color:#374151}
  .ft{text-align:center;padding-top:14px;border-top:1px solid #f3f4f6}
  .ft p{font-size:10px;color:#9ca3af}
  .ft .fs{font-size:9px;color:#d1d5db;margin-top:2px}
  @page{margin:.4in;size:A4}
`;

function esc(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function buildPrintHtml(order, { fmt, fmtDate, fmtDateTime, isPayMongo, paymentLabel, transactionRef, latestPayment }) {
  const items = (order.items || []).map(item => `
    <tr>
      <td class="tb">${esc(item.title)}</td>
      <td class="tc">${item.quantity}</td>
      <td class="tr2">₱${fmt(item.price)}</td>
      <td class="tb tr2">₱${fmt(item.total)}</td>
    </tr>`).join('');

  const payStatus = paymentStatusLabels[order.payment_status] || order.payment_status;
  const payColor = paymentStatusColors[order.payment_status] || '#6b7280';

  const testBanner = isPayMongo ? `
    <div class="bm">
      <div class="bm-t">TEST MODE</div>
      <div class="bm-d">This is a test transaction — no real payment was processed.</div>
    </div>` : '';

  const refRow = isPayMongo && transactionRef ? `
    <div class="pr">
      <span class="pl">Transaction Reference</span>
      <span class="pf">${esc(transactionRef)}</span>
    </div>` : '';

  const paidRow = latestPayment?.paid_at ? `
    <div class="pr">
      <span class="pl">Paid At</span>
      <span>${fmtDateTime(latestPayment.paid_at)}</span>
    </div>` : '';

  return `<!DOCTYPE html><html><head><title>GreenPlace-Receipt-${esc(order.order_number)}</title>
<style>${PRINT_STYLES}</style></head><body><div class="r">
  <div class="hd">
    <div class="br"><div class="lg"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 20A7 7 0 0 1 9.8 6.9C15.5 4.9 17 3.5 19 1c1 2 2 4.5 2 8 0 5.5-4.78 11-10 11Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg></div><div><div class="bn">GreenPlace</div><div class="bs">Sustainable Living Platform</div></div></div>
    <div class="tt">RECEIPT</div>
  </div>
  ${testBanner}
  <div class="g2 mb">
    <div><div class="lb">Receipt No.</div><div class="vb">${esc(order.order_number)}</div></div>
    <div class="tr"><div class="lb">Date</div><div class="vl">${fmtDate(order.created_at)}</div></div>
  </div>
  <div class="g2 mb">
    <div><div class="lb">Bill To</div><div class="vl">${esc(order.buyer?.first_name)} ${esc(order.buyer?.last_name)}</div>
      ${order.buyer?.email ? `<div class="sb">${esc(order.buyer.email)}</div>` : ''}
      ${order.buyer?.phone ? `<div class="sb">${esc(order.buyer.phone)}</div>` : ''}</div>
    <div><div class="lb">Sold By</div><div class="vl">${esc(order.business?.name)}</div>
      ${order.business?.address ? `<div class="sb">${esc(order.business.address)}</div>` : ''}
      ${order.business?.phone ? `<div class="sb">${esc(order.business.phone)}</div>` : ''}</div>
  </div>
  <div class="st">Items</div>
  <table>
    <thead><tr><th>Item</th><th class="tc">Qty</th><th class="tr2">Price</th><th class="tr2">Total</th></tr></thead>
    <tbody>${items}</tbody>
  </table>
  <div class="tot"><div class="tbx">
    <div class="trow"><span class="tm">Subtotal</span><span>₱${fmt(order.subtotal)}</span></div>
    <div class="trow"><span class="tm">Shipping</span><span style="color:#16a34a;font-weight:500">Free</span></div>
    <div class="trow tdv"><span style="font-weight:700">Total</span><span class="ttot">₱${fmt(order.total)}</span></div>
  </div></div>
  <div class="st">Payment Details</div>
  <div class="pr"><span class="pl">Method</span><span class="pv">${esc(paymentLabel)}</span></div>
  <div class="pr"><span class="pl">Status</span><span class="pv" style="color:${payColor}">${payStatus}</span></div>
  ${refRow}${paidRow}
  <div class="ft"><p>Thank you for supporting sustainable living in Metro Cebu.</p><p class="fs">GreenPlace — Connecting communities with eco-friendly waste management</p></div>
</div></body></html>`;
}

export default function Receipt() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        const { data } = await api.get(`/orders/${id}`);
        setOrder(data.order);
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to load receipt');
      } finally {
        setLoading(false);
      }
    };
    fetchOrder();
  }, [id]);

  const isPayMongo = order?.payment_method?.startsWith('paymongo_');
  const paymentLabel = order?.payment_method?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || '—';
  const latestPayment = order?.payments?.[0];
  const transactionRef = latestPayment?.paymongo_payment_id || null;

  const handlePrint = useCallback(() => {
    if (!order) return;
    const html = buildPrintHtml(order, { fmt, fmtDate, fmtDateTime, isPayMongo, paymentLabel, transactionRef, latestPayment });

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
  }, [order, isPayMongo, paymentLabel, transactionRef, latestPayment]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
      </div>
    );
  }

  if (error && !order) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-4">
          <AlertTriangle className="w-12 h-12 text-red-300 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Error</h2>
          <p className="text-gray-500 mb-6">{error}</p>
          <Button onClick={() => navigate('/orders')}>Back to Orders</Button>
        </div>
      </div>
    );
  }

  if (!order) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link to={`/orders/${order.id}`} className="flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700 font-medium">
            <ArrowLeft className="w-4 h-4" />
            Back to Order
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
                <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 20A7 7 0 0 1 9.8 6.9C15.5 4.9 17 3.5 19 1c1 2 2 4.5 2 8 0 5.5-4.78 11-10 11Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>
              </div>
              <div>
                <p className="text-lg font-bold text-gray-900">GreenPlace</p>
                <p className="text-xs text-gray-400">Sustainable Living Platform</p>
              </div>
            </div>
            <h2 className="text-lg font-bold text-gray-900 tracking-wide">RECEIPT</h2>
          </div>

          {isPayMongo && (
            <div className="bg-amber-50 border border-amber-300 rounded-lg px-4 py-2 mb-4">
              <p className="text-sm font-bold text-amber-800">TEST MODE</p>
              <p className="text-xs text-amber-700">This is a test transaction — no real payment was processed.</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 pb-4 border-b border-gray-100 mb-4">
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Receipt No.</p>
              <p className="text-sm font-bold text-gray-900">{order.order_number}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Date</p>
              <p className="text-sm text-gray-700">{fmtDate(order.created_at)}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pb-4 border-b border-gray-100 mb-4">
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Bill To</p>
              <p className="text-sm font-medium text-gray-900">{order.buyer?.first_name} {order.buyer?.last_name}</p>
              {order.buyer?.email && <p className="text-xs text-gray-500 mt-0.5">{order.buyer.email}</p>}
              {order.buyer?.phone && <p className="text-xs text-gray-500">{order.buyer.phone}</p>}
            </div>
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Sold By</p>
              <p className="text-sm font-medium text-gray-900">{order.business?.name}</p>
              {order.business?.address && <p className="text-xs text-gray-500 mt-0.5">{order.business.address}</p>}
              {order.business?.phone && <p className="text-xs text-gray-500">{order.business.phone}</p>}
            </div>
          </div>

          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Items</p>
          <table className="w-full mb-4">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left text-[10px] font-semibold text-gray-500 uppercase pb-1.5">Item</th>
                <th className="text-center text-[10px] font-semibold text-gray-500 uppercase pb-1.5 w-14">Qty</th>
                <th className="text-right text-[10px] font-semibold text-gray-500 uppercase pb-1.5 w-24">Price</th>
                <th className="text-right text-[10px] font-semibold text-gray-500 uppercase pb-1.5 w-24">Total</th>
              </tr>
            </thead>
            <tbody>
              {order.items?.map((item) => (
                <tr key={item.id} className="border-b border-gray-50">
                  <td className="py-2 text-sm font-medium text-gray-900">{item.title}</td>
                  <td className="py-2 text-sm text-gray-600 text-center">{item.quantity}</td>
                  <td className="py-2 text-sm text-gray-600 text-right">₱{fmt(item.price)}</td>
                  <td className="py-2 text-sm font-medium text-gray-900 text-right">₱{fmt(item.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex justify-end mb-4 pb-4 border-b border-gray-100">
            <div className="w-52 space-y-1.5">
              <div className="flex justify-between text-sm"><span className="text-gray-500">Subtotal</span><span className="text-gray-700">₱{fmt(order.subtotal)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-500">Shipping</span><span className="text-green-600 font-medium">Free</span></div>
              <div className="border-t border-gray-200 pt-2 flex justify-between"><span className="text-sm font-bold text-gray-900">Total</span><span className="text-base font-bold text-primary-600">₱{fmt(order.total)}</span></div>
            </div>
          </div>

          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Payment Details</p>
          <div className="space-y-1.5 mb-4 pb-4 border-b border-gray-100">
            <div className="flex justify-between text-sm"><span className="text-gray-500">Method</span><span className="font-medium text-gray-900">{paymentLabel}</span></div>
            <div className="flex justify-between text-sm"><span className="text-gray-500">Status</span><span className="font-medium" style={{ color: paymentStatusColors[order.payment_status] }}>{paymentStatusLabels[order.payment_status] || order.payment_status}</span></div>
            {isPayMongo && transactionRef && (
              <div className="flex justify-between text-sm"><span className="text-gray-500">Transaction Reference</span><span className="text-xs font-mono text-gray-700 bg-gray-50 px-2 py-0.5 rounded">{transactionRef}</span></div>
            )}
            {latestPayment?.paid_at && (
              <div className="flex justify-between text-sm"><span className="text-gray-500">Paid At</span><span className="text-gray-700">{fmtDateTime(latestPayment.paid_at)}</span></div>
            )}
          </div>

          <div className="text-center pt-2">
            <p className="text-xs text-gray-400">Thank you for supporting sustainable living in Metro Cebu.</p>
            <p className="text-[10px] text-gray-300 mt-0.5">GreenPlace — Connecting communities with eco-friendly waste management</p>
          </div>
        </div>
      </div>
    </div>
  );
}
