import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Download,
  Copy,
  Check,
  Scissors,
  RefreshCw,
  Printer,
  Building2,
  User,
  CheckCircle2,
  Clock,
  Layers,
  Calendar
} from 'lucide-react';
import { toPng } from 'html-to-image';
import { KnittingStatusOrder } from '../types';
import { calculateKnittingCondition, sortKnittingItems } from '../lib/knittingStatusStore';
import { getCompanyLogo } from '../lib/logoStore';

interface KnittingOrderSnippingModalProps {
  order: KnittingStatusOrder | null;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Converts Base64 Data URL to a Blob
 */
function dataUrlToBlob(dataUrl: string): Blob {
  const arr = dataUrl.split(',');
  const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/png';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
}

/**
 * Rounds up Average Production Per Day to the next whole integer
 */
function roundUpAvg(val: number | string | undefined): number {
  const num = Number(val) || 0;
  return num > 0 ? Math.ceil(num) : 0;
}

export const KnittingOrderSnippingModal: React.FC<KnittingOrderSnippingModalProps> = ({
  order,
  isOpen,
  onClose
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [imageBlob, setImageBlob] = useState<Blob | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedImage, setCopiedImage] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [customLogo] = useState<string | null>(() => getCompanyLogo());

  const fileName = order
    ? `Order_${order.orderNo}_Knitting_Details_${new Date().toISOString().slice(0, 10)}.png`
    : 'Order_Knitting_Details.png';

  // Capture the rendered card into image data
  const captureCard = async (): Promise<{ dataUrl: string; blob: Blob } | null> => {
    if (!cardRef.current) return null;
    try {
      // Ensure the captured width covers the full table width (1220px) so no column is clipped
      const captureWidth = Math.max(cardRef.current.scrollWidth, 1220);
      const dataUrl = await toPng(cardRef.current, {
        pixelRatio: 2,
        backgroundColor: '#ffffff',
        skipFonts: true,
        cacheBust: true,
        width: captureWidth
      });
      const blob = dataUrlToBlob(dataUrl);
      return { dataUrl, blob };
    } catch (err) {
      console.warn('Image capture failed:', err);
      return null;
    }
  };

  // Pre-generate image in background when opened
  useEffect(() => {
    if (isOpen && order) {
      setImageDataUrl(null);
      setImageBlob(null);
      setIsGenerating(true);

      const timer = setTimeout(async () => {
        const res = await captureCard();
        if (res) {
          setImageDataUrl(res.dataUrl);
          setImageBlob(res.blob);
        }
        setIsGenerating(false);
      }, 400);

      return () => clearTimeout(timer);
    }
  }, [isOpen, order]);

  if (!isOpen || !order) return null;

  const items = sortKnittingItems(order.items || []);
  const condition = calculateKnittingCondition(order.greyQty, order.knitBalance);

  const totals = items.reduce(
    (acc, itm) => ({
      reqQty: acc.reqQty + (Number(itm.reqQty) || 0),
      greyQty: acc.greyQty + (Number(itm.greyQty) || 0),
      production: acc.production + (Number(itm.production) || 0),
      hold: acc.hold + (Number(itm.hold) || 0),
      reject: acc.reject + (Number(itm.reject) || 0),
      itmQty: acc.itmQty + (Number(itm.itmQty) || 0),
      knitBalance: acc.knitBalance + (Number(itm.knitBalance) || 0),
      avgProdPerDay: acc.avgProdPerDay + (Number(itm.avgProdPerDay) || 0)
    }),
    { reqQty: 0, greyQty: 0, production: 0, hold: 0, reject: 0, itmQty: 0, knitBalance: 0, avgProdPerDay: 0 }
  );

  const handleDownload = async () => {
    let url = imageDataUrl;
    if (!url) {
      setIsGenerating(true);
      const res = await captureCard();
      setIsGenerating(false);
      if (res) {
        url = res.dataUrl;
        setImageDataUrl(res.dataUrl);
        setImageBlob(res.blob);
      }
    }

    if (url) {
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setStatusMessage('Downloaded PNG image!');
      setTimeout(() => setStatusMessage(null), 3000);
    }
  };

  const handleCopyImage = async () => {
    let blob = imageBlob;
    if (!blob) {
      setIsGenerating(true);
      const res = await captureCard();
      setIsGenerating(false);
      if (res) {
        blob = res.blob;
        setImageDataUrl(res.dataUrl);
        setImageBlob(res.blob);
      }
    }

    if (!blob) {
      handleDownload();
      return;
    }

    try {
      if (navigator.clipboard && window.ClipboardItem) {
        const item = new ClipboardItem({ 'image/png': blob });
        await navigator.clipboard.write([item]);
        setCopiedImage(true);
        setStatusMessage('Copied HD image to clipboard! Ready to paste into WhatsApp / Teams.');
        setTimeout(() => {
          setCopiedImage(false);
          setStatusMessage(null);
        }, 3500);
      } else {
        handleDownload();
      }
    } catch (err) {
      console.warn('Clipboard image write failed, falling back to download:', err);
      handleDownload();
    }
  };

  const handlePrint = () => {
    if (!cardRef.current) {
      window.print();
      return;
    }

    try {
      const oldFrame = document.getElementById('knitting-print-frame');
      if (oldFrame) {
        oldFrame.remove();
      }

      const printFrame = document.createElement('iframe');
      printFrame.id = 'knitting-print-frame';
      printFrame.setAttribute('style', 'position:fixed;right:0;bottom:0;width:0;height:0;border:none;opacity:0;pointer-events:none;');
      document.body.appendChild(printFrame);

      const frameDoc = printFrame.contentWindow?.document;
      if (!frameDoc) {
        window.print();
        return;
      }

      const cardClone = cardRef.current.cloneNode(true) as HTMLElement;
      cardClone.style.minWidth = '0';
      cardClone.style.width = '100%';
      cardClone.style.maxWidth = '100%';
      cardClone.style.margin = '0';
      cardClone.style.padding = '4px 6px';
      cardClone.style.boxShadow = 'none';
      cardClone.style.border = 'none';
      cardClone.style.backgroundColor = '#ffffff';
      cardClone.style.color = '#0f172a';

      // Remove overflow-hidden from any element to prevent Chrome print fragmentation bug
      cardClone.querySelectorAll('*').forEach((el) => {
        const htmlEl = el as HTMLElement;
        if (htmlEl.classList.contains('overflow-hidden')) {
          htmlEl.classList.remove('overflow-hidden');
        }
        if (htmlEl.style.overflow === 'hidden') {
          htmlEl.style.overflow = 'visible';
        }
      });

      // Remove fixed inline pixel widths on th and td so table fits 100% within portrait A4
      cardClone.querySelectorAll('th, td').forEach((el) => {
        const cell = el as HTMLElement;
        cell.style.width = '';
        cell.style.minWidth = '0';
        cell.style.maxWidth = 'none';
      });

      const styleTags = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
        .map(el => el.outerHTML)
        .join('\n');

      frameDoc.open();
      frameDoc.write(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>EPYLLION KNITEX LIMITED - Order ${order.orderNo}</title>
  ${styleTags}
  <style>
    @page {
      size: portrait;
      margin: 5mm 6mm;
    }
    *, *::before, *::after {
      box-sizing: border-box !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      overflow: visible !important;
    }
    html, body {
      margin: 0 !important;
      padding: 0 !important;
      background: #ffffff !important;
      color: #0f172a !important;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
      font-size: 9.5px !important;
      line-height: 1.25 !important;
      width: 100% !important;
      height: 100% !important;
      max-height: 100% !important;
      overflow: hidden !important;
    }
    .print-sheet {
      width: 100% !important;
      max-width: 100% !important;
      margin: 0 !important;
      padding: 0 !important;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
      page-break-after: avoid !important;
      break-after: avoid !important;
    }
    [id^="knitting-snip-card"] {
      min-width: 0 !important;
      width: 100% !important;
      max-width: 100% !important;
      box-shadow: none !important;
      border: none !important;
      margin: 0 !important;
      padding: 0 !important;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
      page-break-after: avoid !important;
      break-after: avoid !important;
    }
    .grid-cols-7 {
      display: grid !important;
      grid-template-columns: repeat(7, minmax(0, 1fr)) !important;
      gap: 3px !important;
    }
    .grid-cols-7 > div {
      padding: 3px 2px !important;
      border-radius: 4px !important;
    }
    .grid-cols-7 .text-sm {
      font-size: 11px !important;
      margin-top: 1px !important;
    }
    .grid-cols-7 .text-\\[10px\\] {
      font-size: 7.5px !important;
    }
    table {
      width: 100% !important;
      max-width: 100% !important;
      table-layout: fixed !important;
      border-collapse: collapse !important;
      margin: 3px 0 !important;
      font-size: 8px !important;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    thead th {
      background-color: #f1f5f9 !important;
      color: #0f172a !important;
      font-weight: 800 !important;
      padding: 3px 1.5px !important;
      font-size: 7.5px !important;
      line-height: 1.15 !important;
      border-bottom: 1.5px solid #cbd5e1 !important;
      border-top: 1px solid #cbd5e1 !important;
      vertical-align: middle !important;
      white-space: normal !important;
      word-break: break-word !important;
    }
    tbody td {
      padding: 2.5px 1.5px !important;
      font-size: 8px !important;
      line-height: 1.15 !important;
      border-bottom: 1px solid #e2e8f0 !important;
      vertical-align: middle !important;
      white-space: normal !important;
      word-break: break-word !important;
    }
    tfoot td {
      background-color: #f1f5f9 !important;
      border-top: 1.5px solid #cbd5e1 !important;
      font-weight: 800 !important;
      padding: 3px 1.5px !important;
      font-size: 8px !important;
      line-height: 1.15 !important;
    }
    /* Fixed 100% proportional column distribution across all 17 columns */
    table th:nth-child(1), table td:nth-child(1) { width: 3% !important; text-align: center; }
    table th:nth-child(2), table td:nth-child(2) { width: 10% !important; }
    table th:nth-child(3), table td:nth-child(3) { width: 5.5% !important; }
    table th:nth-child(4), table td:nth-child(4) { width: 6.5% !important; }
    table th:nth-child(5), table td:nth-child(5) { width: 4.5% !important; text-align: center; }
    table th:nth-child(6), table td:nth-child(6) { width: 4.5% !important; text-align: center; }
    table th:nth-child(7), table td:nth-child(7) { width: 13% !important; }
    table th:nth-child(8), table td:nth-child(8) { width: 6% !important; text-align: center; }
    table th:nth-child(9), table td:nth-child(9) { width: 6.5% !important; text-align: center; }
    table th:nth-child(10), table td:nth-child(10) { width: 6.5% !important; text-align: center; }
    table th:nth-child(11), table td:nth-child(11) { width: 6.5% !important; text-align: right; }
    table th:nth-child(12), table td:nth-child(12) { width: 6.5% !important; text-align: right; }
    table th:nth-child(13), table td:nth-child(13) { width: 6.5% !important; text-align: right; }
    table th:nth-child(14), table td:nth-child(14) { width: 4% !important; text-align: right; }
    table th:nth-child(15), table td:nth-child(15) { width: 4% !important; text-align: right; }
    table th:nth-child(16), table td:nth-child(16) { width: 7% !important; text-align: right; }
    table th:nth-child(17), table td:nth-child(17) { width: 7% !important; text-align: right; }
  </style>
</head>
<body>
  <div class="print-sheet">
    ${cardClone.outerHTML}
  </div>
</body>
</html>`);
      frameDoc.close();

      setTimeout(() => {
        try {
          printFrame.contentWindow?.focus();
          printFrame.contentWindow?.print();
        } catch (e) {
          console.error('Print iframe error, using fallback:', e);
          window.print();
        } finally {
          setTimeout(() => {
            if (document.body.contains(printFrame)) {
              document.body.removeChild(printFrame);
            }
          }, 4000);
        }
      }, 350);
    } catch (err) {
      console.error('Error during print:', err);
      window.print();
    }
  };

  return (
    <div
      className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-xs animate-fade-in"
      onClick={onClose}
      id="knitting-order-snipping-modal"
    >
      <div
        className="knitting-modal-box relative w-full max-w-[1300px] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-indigo-500/40 flex flex-col max-h-[94vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Header */}
        <div className="knitting-modal-header px-4 py-3 bg-gradient-to-r from-indigo-700 via-indigo-800 to-blue-800 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-white/15 text-indigo-200 shadow-xs">
              <Scissors className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm tracking-tight flex items-center gap-2">
                <span>Snipping Tool</span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/25 text-emerald-200 border border-emerald-400/30">
                  HD Snapshot
                </span>
                {isGenerating && (
                  <span className="text-[10px] text-indigo-200/90 flex items-center gap-1 animate-pulse">
                    <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                    <span>Rendering HD...</span>
                  </span>
                )}
              </h3>
              <p className="text-[11px] text-indigo-100/80 truncate max-w-[280px] sm:max-w-md">
                Order {order.orderNo} · {order.buyerName} · Fabric &amp; Production Details
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyImage}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer ${
                copiedImage
                  ? 'bg-emerald-500 text-white'
                  : 'bg-white/20 hover:bg-white/30 text-white'
              }`}
              title="Copy HD snapshot to clipboard for WhatsApp/Email"
            >
              {copiedImage ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedImage ? 'Copied!' : 'Copy Image'}</span>
            </button>

            <button
              type="button"
              onClick={handleDownload}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-white/20 hover:bg-white/30 text-white transition-all shadow-xs cursor-pointer"
              title="Download snapshot as PNG"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="p-1.5 rounded-lg text-indigo-100 hover:text-white hover:bg-white/10 transition-colors cursor-pointer hidden sm:flex"
              title="Print"
            >
              <Printer className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-indigo-100 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              title="Close Snipping Tool"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Feedback Alert Banner */}
        {statusMessage && (
          <div className="px-4 py-2 bg-emerald-50 border-b border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>{statusMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setStatusMessage(null)}
              className="text-emerald-700 hover:text-emerald-900"
            >
              ✕
            </button>
          </div>
        )}

        {/* Snipping Preview & Capture Canvas Area */}
        <div className="knitting-modal-content flex-1 p-3 sm:p-5 overflow-y-auto overflow-x-auto bg-slate-100 dark:bg-slate-950 flex flex-col items-center">
          {/* Capture Card Container: spacious width 1220px so Balance & Avg Prod/Day columns are 100% visible and never clipped */}
          <div
            ref={cardRef}
            id={`knitting-snip-card-${order.orderNo}`}
            className="printable-snip-card bg-white text-slate-900 rounded-xl p-5 sm:p-6 shadow-md border border-slate-200 shrink-0"
            style={{ width: '1220px', minWidth: 'min(100%, 1220px)', color: '#0f172a', backgroundColor: '#ffffff' }}
          >
            {/* Header: Company Logo In E letter + Brand Info + Order Condition */}
            <div
              className="flex items-center justify-between pb-3.5 mb-4 border-b-2"
              style={{ borderBottomColor: '#15803d' }}
            >
              <div className="flex items-center gap-3.5">
                {/* Company Logo in E letter badge */}
                {customLogo ? (
                  <div className="flex items-center justify-center p-1 rounded-xl bg-white border border-slate-200 shadow-xs">
                    <img
                      src={customLogo}
                      alt="Epyllion Knitex Ltd."
                      className="h-10 w-auto max-w-[130px] max-h-11 object-contain"
                    />
                  </div>
                ) : (
                  <div
                    className="flex items-center justify-center shrink-0 shadow-xs"
                    title="Epyllion Knitex Logo"
                  >
                    <svg
                      width="44"
                      height="44"
                      viewBox="0 0 44 44"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      className="rounded-xl overflow-hidden shadow-xs"
                    >
                      {/* Brand green background badge */}
                      <rect width="44" height="44" rx="10" fill="#15803D" />
                      
                      {/* Epyllion Sunburst Rays */}
                      <path d="M 25 13 C 27 10 31 8 35 7" stroke="#FBBF24" strokeWidth="2" strokeLinecap="round" fill="none" />
                      <path d="M 27 16 C 32 13 36 11 40 10" stroke="#F59E0B" strokeWidth="2.4" strokeLinecap="round" fill="none" />
                      <path d="M 28 20 C 33 17 38 14 42 13" stroke="#FBBF24" strokeWidth="2" strokeLinecap="round" fill="none" />
                      
                      {/* Green leaf shape */}
                      <path d="M 9 27 C 7 19 16 11 24 17 C 26 19 28 22 26 27 C 20.5 29 15 29 9 27 Z" fill="#22C55E" />
                      <path d="M 11 26 C 15 22 20 22 24 26" stroke="#FFFFFF" strokeWidth="1.3" strokeLinecap="round" fill="none" />
                      
                      {/* Dynamic Golden Arc */}
                      <path d="M 7 32 C 15 26 26 20 37 23" stroke="#F59E0B" strokeWidth="2.2" strokeLinecap="round" fill="none" />
                      
                      {/* Official E Monogram */}
                      <text
                        x="13"
                        y="29"
                        fontFamily="system-ui, -apple-system, sans-serif"
                        fontSize="18"
                        fontWeight="900"
                        fill="#FFFFFF"
                      >
                        E
                      </text>
                    </svg>
                  </div>
                )}

                <div>
                  <div className="text-lg font-black tracking-tight text-slate-900" style={{ color: '#0f172a' }}>
                    EPYLLION KNITEX LIMITED
                  </div>
                  <div className="text-xs font-bold text-emerald-800 flex items-center gap-1.5" style={{ color: '#166534' }}>
                    <span>Knitting Status Report</span>
                    <span className="text-slate-300">•</span>
                    <span className="text-slate-700 font-semibold" style={{ color: '#334155' }}>
                      Order Details: {order.orderNo}
                    </span>
                  </div>
                </div>
              </div>

              <div className="text-right flex flex-col items-end gap-1">
                {condition === 'Complete' && (
                  <span
                    className="inline-flex items-center gap-1 text-[11px] font-bold px-3 py-1 rounded-full"
                    style={{ backgroundColor: '#ecfdf5', color: '#065f46', border: '1px solid #6ee7b7' }}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    Complete (Balance &lt; 3)
                  </span>
                )}
                {condition === 'Running' && (
                  <span
                    className="inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1 rounded-full"
                    style={{ backgroundColor: '#eff6ff', color: '#1e40af', border: '1px solid #93c5fd' }}
                  >
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#2563eb' }} />
                    Running (Grey Qty &gt; Balance)
                  </span>
                )}
                {condition === 'Pending' && (
                  <span
                    className="inline-flex items-center gap-1 text-[11px] font-bold px-3 py-1 rounded-full"
                    style={{ backgroundColor: '#fffbeb', color: '#92400e', border: '1px solid #fcd34d' }}
                  >
                    <Clock className="w-3.5 h-3.5 text-amber-600" />
                    Pending (Grey Qty = Balance)
                  </span>
                )}
                <div className="text-[10px] text-slate-500 font-medium" style={{ color: '#64748b' }}>
                  {new Date().toLocaleString([], { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>

            {/* Buyer & Leader Meta */}
            <div
              className="flex flex-wrap items-center gap-4 text-xs font-semibold p-2.5 rounded-lg mb-4"
              style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', color: '#334155' }}
            >
              <div className="flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-emerald-700" />
                <span>Buyer:</span>
                <strong className="text-slate-900" style={{ color: '#0f172a' }}>{order.buyerName || 'N/A'}</strong>
              </div>
              <span>•</span>
              <div className="flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-emerald-700" />
                <span>Team Leader:</span>
                <strong className="text-slate-900" style={{ color: '#0f172a' }}>{order.teamLeader || 'N/A'}</strong>
              </div>
              <span>•</span>
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-emerald-700" />
                <span>Knit Start:</span>
                <strong className="font-mono text-slate-800" style={{ color: '#1e293b' }}>
                  {order.knitStartDate || 'Not set'}
                </strong>
              </div>
              <span>•</span>
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-emerald-700" />
                <span>Knit End:</span>
                <strong className="font-mono text-slate-800" style={{ color: '#1e293b' }}>
                  {order.knitEndDate || 'Not set'}
                </strong>
              </div>
            </div>

            {/* Layer 1: Quantities Summary Cards */}
            <div className="mb-4">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2" style={{ color: '#64748b' }}>
                Layer 1: Order Quantities &amp; Progress Summary
              </div>
              <div className="grid grid-cols-7 gap-2.5 text-center">
                <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50" style={{ backgroundColor: '#f8fafc', borderColor: '#e2e8f0' }}>
                  <div className="text-[10px] font-bold uppercase text-slate-500">Req. Qty</div>
                  <div className="text-sm font-black text-slate-800 mt-0.5 font-mono">
                    {order.reqQty ? order.reqQty.toLocaleString() : '0'} <span className="text-[10px] font-normal">kg</span>
                  </div>
                </div>

                <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50" style={{ backgroundColor: '#f8fafc', borderColor: '#e2e8f0' }}>
                  <div className="text-[10px] font-bold uppercase text-slate-500">Grey Qty</div>
                  <div className="text-sm font-black text-slate-800 mt-0.5 font-mono">
                    {order.greyQty ? order.greyQty.toLocaleString() : '0'} <span className="text-[10px] font-normal">kg</span>
                  </div>
                </div>

                <div className="p-2.5 rounded-lg border border-emerald-200 bg-emerald-50/60" style={{ backgroundColor: '#ecfdf5', borderColor: '#a7f3d0' }}>
                  <div className="text-[10px] font-bold uppercase text-emerald-700">Production</div>
                  <div className="text-sm font-black text-emerald-700 mt-0.5 font-mono">
                    {order.production ? order.production.toLocaleString() : '0'} <span className="text-[10px] font-normal">kg</span>
                  </div>
                </div>

                <div className="p-2.5 rounded-lg border border-amber-200 bg-amber-50/60" style={{ backgroundColor: '#fffbeb', borderColor: '#fde68a' }}>
                  <div className="text-[10px] font-bold uppercase text-amber-700">Knit Balance</div>
                  <div className="text-sm font-black text-amber-800 mt-0.5 font-mono">
                    {order.knitBalance ? order.knitBalance.toLocaleString() : '0'} <span className="text-[10px] font-normal">kg</span>
                  </div>
                </div>

                <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50" style={{ backgroundColor: '#f8fafc', borderColor: '#e2e8f0' }}>
                  <div className="text-[10px] font-bold uppercase text-amber-600">Hold</div>
                  <div className="text-sm font-black text-amber-700 mt-0.5 font-mono">
                    {totals.hold ? totals.hold.toLocaleString() : '0'} <span className="text-[10px] font-normal">kg</span>
                  </div>
                </div>

                <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50" style={{ backgroundColor: '#f8fafc', borderColor: '#e2e8f0' }}>
                  <div className="text-[10px] font-bold uppercase text-red-600">Reject</div>
                  <div className="text-sm font-black text-red-600 mt-0.5 font-mono">
                    {totals.reject ? totals.reject.toLocaleString() : '0'} <span className="text-[10px] font-normal">kg</span>
                  </div>
                </div>

                {/* Avg Prod/Day: Rounded Up cleanly to next integer without decimals */}
                <div className="p-2.5 rounded-lg border border-blue-200 bg-blue-50/60" style={{ backgroundColor: '#eff6ff', borderColor: '#bfdbfe' }}>
                  <div className="text-[10px] font-bold uppercase text-blue-700">Avg Prod/Day</div>
                  <div className="text-sm font-black text-blue-800 mt-0.5 font-mono">
                    {roundUpAvg(totals.avgProdPerDay).toLocaleString()} <span className="text-[10px] font-normal">kg</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Layer 2: Fabric & Color Specifications Table */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-700" style={{ color: '#334155' }}>
                  <Layers className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Layer 2: Fabric &amp; Color Specifications ({items.length} items)</span>
                </div>
              </div>

              {items.length === 0 ? (
                <div className="text-center py-4 text-xs text-slate-400 border border-dashed border-slate-200 rounded-lg">
                  No fabric items registered for this order.
                </div>
              ) : (
                <div className="rounded-lg border border-slate-300 overflow-hidden" style={{ borderColor: '#cbd5e1' }}>
                  <table className="w-full text-left text-[10px] border-collapse" style={{ width: '100%', tableLayout: 'auto' }}>
                    <thead>
                      <tr
                        style={{ backgroundColor: '#f1f5f9', color: '#1e293b', borderBottom: '2px solid #cbd5e1' }}
                        className="font-bold uppercase tracking-wider text-[9px]"
                      >
                        <th className="py-2 px-2 text-center" style={{ width: '30px' }}>#</th>
                        <th className="py-2 px-2" style={{ width: '90px' }}>Color</th>
                        <th className="py-2 px-2" style={{ width: '65px' }}>M/C Type</th>
                        <th className="py-2 px-2" style={{ width: '65px' }}>Fab. Type</th>
                        <th className="py-2 px-2 text-center" style={{ width: '45px' }}>FGSM</th>
                        <th className="py-2 px-2 text-center" style={{ width: '50px' }}>F. Width</th>
                        <th className="py-2 px-2" style={{ width: '170px' }}>Yarn Count</th>
                        <th className="py-2 px-2 text-center" style={{ width: '70px' }}>Gauge &amp; Dia</th>
                        <th className="py-2 px-2 text-center" style={{ width: '85px' }}>Knit Start</th>
                        <th className="py-2 px-2 text-center" style={{ width: '85px' }}>Knit End</th>
                        <th className="py-2 px-2 text-right" style={{ width: '70px' }}>Req. Qty</th>
                        <th className="py-2 px-2 text-right" style={{ width: '70px' }}>Grey Qty</th>
                        <th className="py-2 px-2 text-right" style={{ width: '75px' }}>Production</th>
                        <th className="py-2 px-2 text-right" style={{ width: '50px' }}>Hold</th>
                        <th className="py-2 px-2 text-right" style={{ width: '50px' }}>Reject</th>
                        <th className="py-2 px-2 text-right font-black" style={{ width: '90px', color: '#b45309' }}>Balance</th>
                        <th className="py-2 px-2 text-right font-black" style={{ width: '95px', color: '#1d4ed8' }}>Avg/Day</th>
                      </tr>
                    </thead>
                    <tbody style={{ color: '#0f172a' }}>
                      {items.map((itm, idx) => {
                        const hasActivity = (Number(itm.production || 0) > 0) || (Number(itm.hold || 0) > 0);
                        const isEven = idx % 2 === 0;

                        return (
                          <tr
                            key={idx}
                            style={{
                              backgroundColor: isEven ? '#ffffff' : '#f8fafc',
                              borderBottom: '1px solid #e2e8f0'
                            }}
                          >
                            <td className="py-1.5 px-2 text-center font-mono text-slate-400">{idx + 1}</td>
                            <td className="py-1.5 px-2 font-bold text-slate-900">{itm.color || '-'}</td>
                            <td className="py-1.5 px-2 text-slate-700">{itm.mcType || '-'}</td>
                            <td className="py-1.5 px-2 text-slate-700">{itm.fabType || '-'}</td>
                            <td className="py-1.5 px-2 text-center font-mono text-slate-600">{itm.fgsm || '-'}</td>
                            <td className="py-1.5 px-2 text-center font-mono text-slate-600">{itm.fWidth || '-'}</td>
                            <td className="py-1.5 px-2 text-slate-600" title={itm.yarnCount}>
                              {itm.yarnCount || '-'}
                            </td>
                            <td className="py-1.5 px-2 text-center font-mono text-slate-600">{itm.gaugeDia || '-'}</td>

                            {/* Knit Start Date */}
                            <td className="py-1.5 px-2 text-center font-mono text-slate-700 whitespace-nowrap">
                              {hasActivity ? (itm.knitStartDate || '-') : '-'}
                            </td>

                            {/* Knit End Date */}
                            <td className="py-1.5 px-2 text-center font-mono text-slate-700 whitespace-nowrap">
                              {hasActivity ? (itm.knitEndDate || '-') : '-'}
                            </td>

                            <td className="py-1.5 px-2 text-right font-mono text-slate-700">
                              {itm.reqQty ? itm.reqQty.toLocaleString() : '-'}
                            </td>
                            <td className="py-1.5 px-2 text-right font-mono font-semibold text-slate-900">
                              {itm.greyQty ? itm.greyQty.toLocaleString() : '-'}
                            </td>
                            <td className="py-1.5 px-2 text-right font-mono font-bold" style={{ color: '#4f46e5' }}>
                              {itm.production ? itm.production.toLocaleString() : '-'}
                            </td>
                            <td className="py-1.5 px-2 text-right font-mono text-amber-600">
                              {itm.hold ? itm.hold.toLocaleString() : '-'}
                            </td>
                            <td className="py-1.5 px-2 text-right font-mono text-red-500">
                              {itm.reject ? itm.reject.toLocaleString() : '-'}
                            </td>

                            {/* Balance Column: Crystal Clear & Fully Legible */}
                            <td
                              className="py-1.5 px-2 text-right font-mono font-black"
                              style={{ color: itm.knitBalance < 3 ? '#059669' : '#d97706' }}
                            >
                              {itm.knitBalance !== undefined ? itm.knitBalance.toLocaleString() : '-'}
                            </td>

                            {/* Avg. Prod/Day: Rounded up cleanly, 100% visible */}
                            <td className="py-1.5 px-2 text-right font-mono font-bold" style={{ color: '#1e40af' }}>
                              {itm.avgProdPerDay ? `${roundUpAvg(itm.avgProdPerDay).toLocaleString()} Kg` : '-'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    {/* Specifications Total Footer Row */}
                    <tfoot>
                      <tr
                        style={{
                          backgroundColor: '#f1f5f9',
                          borderTop: '2px solid #cbd5e1',
                          fontWeight: 'bold',
                          color: '#0f172a'
                        }}
                      >
                        <td colSpan={10} className="py-2 px-2 text-right uppercase tracking-wider text-[9px] font-black text-slate-600">
                          Specifications Total:
                        </td>
                        <td className="py-2 px-2 text-right font-mono font-black">{totals.reqQty.toLocaleString()}</td>
                        <td className="py-2 px-2 text-right font-mono font-black">{totals.greyQty.toLocaleString()}</td>
                        <td className="py-2 px-2 text-right font-mono font-black" style={{ color: '#4f46e5' }}>
                          {totals.production.toLocaleString()}
                        </td>
                        <td className="py-2 px-2 text-right font-mono font-black text-amber-600">
                          {totals.hold.toLocaleString()}
                        </td>
                        <td className="py-2 px-2 text-right font-mono font-black text-red-500">
                          {totals.reject.toLocaleString()}
                        </td>
                        <td className="py-2 px-2 text-right font-mono font-black" style={{ color: totals.knitBalance < 3 ? '#059669' : '#d97706' }}>
                          {totals.knitBalance.toLocaleString()}
                        </td>
                        <td className="py-2 px-2 text-right font-mono font-black" style={{ color: '#1e40af' }}>
                          {roundUpAvg(totals.avgProdPerDay).toLocaleString()} Kg
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>

            {/* Bottom Card Footer Stamp with User Requested Replacement Text */}
            <div
              className="mt-4 pt-3 flex items-center justify-between text-[10px] text-slate-500 border-t border-slate-200"
              style={{ borderTopColor: '#e2e8f0', color: '#64748b' }}
            >
              <span className="font-semibold text-slate-700" style={{ color: '#334155' }}>
                Epyllion Knitex Limited-Knitting Department.
              </span>
              <span>Confidential &amp; Verified Floor Data</span>
            </div>
          </div>
        </div>

        {/* Modal Bottom Footer Actions */}
        <div className="knitting-modal-actions p-3 sm:p-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Click <strong>Copy Image</strong> to paste directly into WhatsApp or emails.
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-indigo-600/40 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-xs font-bold text-indigo-700 dark:text-indigo-300 transition-all shadow-xs cursor-pointer"
              title="Print 1-Sheet Portrait or Save as PDF"
            >
              <Printer className="w-4 h-4" />
              <span>Print Sheet</span>
            </button>

            <button
              type="button"
              onClick={handleCopyImage}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer ${
                copiedImage
                  ? 'bg-emerald-600 text-white'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white'
              }`}
            >
              {copiedImage ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{copiedImage ? 'Copied to Clipboard!' : 'Copy Image to Clipboard'}</span>
            </button>

            <button
              type="button"
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all shadow-xs cursor-pointer"
            >
              <Download className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Download PNG</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-xs font-bold text-slate-800 dark:text-slate-200 transition-all cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
