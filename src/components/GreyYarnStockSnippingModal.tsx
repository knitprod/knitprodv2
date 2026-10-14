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
  Boxes,
  Archive,
  AlertCircle,
  CheckCircle2,
  Smartphone,
  MoveHorizontal,
  Layers
} from 'lucide-react';
import { toPng } from 'html-to-image';
import html2canvas from 'html2canvas';
import { GreyYarnStockOrderGroup } from '../lib/greyYarnStockStore';
import { getCompanyLogo } from '../lib/logoStore';
import { safeCopyImageBlob } from '../lib/clipboardHelper';

interface GreyYarnStockSnippingModalProps {
  orderGroup: GreyYarnStockOrderGroup | null;
  isOpen: boolean;
  onClose: () => void;
}

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

export const GreyYarnStockSnippingModal: React.FC<GreyYarnStockSnippingModalProps> = ({
  orderGroup,
  isOpen,
  onClose
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [imageBlob, setImageBlob] = useState<Blob | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedImage, setCopiedImage] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [customLogo] = useState<string | null>(() => getCompanyLogo());

  const [viewMode, setViewMode] = useState<'fit' | 'full'>('fit');
  const [scale, setScale] = useState<number>(1);
  const [cardHeight, setCardHeight] = useState<number>(0);
  const [isMobile, setIsMobile] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth < 1220 : false
  );

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 1220);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const calculateFitScale = () => {
    if (!scrollContainerRef.current || !cardRef.current) return;
    const containerW = scrollContainerRef.current.clientWidth;
    const cardW = 1080;
    const naturalHeight = cardRef.current.scrollHeight;
    setCardHeight(naturalHeight);

    if (containerW < cardW + 32) {
      const targetScale = Math.max(0.28, Math.min(1, (containerW - 32) / cardW));
      setScale(targetScale);
    } else {
      setScale(1);
    }
  };

  useEffect(() => {
    if (isOpen && orderGroup) {
      const timer = setTimeout(() => {
        calculateFitScale();
      }, 100);
      window.addEventListener('resize', calculateFitScale);
      return () => {
        clearTimeout(timer);
        window.removeEventListener('resize', calculateFitScale);
      };
    }
  }, [isOpen, orderGroup]);

  const generateScreenshot = async () => {
    if (!cardRef.current) return;
    setIsGenerating(true);
    setStatusMessage('Generating high-res snapshot...');

    try {
      // Temporarily ensure card is rendered at 100% natural resolution for clean capture
      const prevTransform = cardRef.current.style.transform;
      cardRef.current.style.transform = 'none';

      let dataUrl: string | null = null;
      try {
        dataUrl = await toPng(cardRef.current, {
          quality: 0.98,
          pixelRatio: 2,
          backgroundColor: '#FFFFFF',
          cacheBust: true
        });
      } catch (err) {
        console.warn('toPng fallback to html2canvas:', err);
        const canvas = await html2canvas(cardRef.current, {
          scale: 2,
          useCORS: true,
          backgroundColor: '#FFFFFF',
          logging: false
        });
        dataUrl = canvas.toDataURL('image/png');
      }

      // Restore scaling
      cardRef.current.style.transform = prevTransform;

      if (dataUrl) {
        setImageDataUrl(dataUrl);
        const blob = dataUrlToBlob(dataUrl);
        setImageBlob(blob);
        setStatusMessage('Snapshot ready!');
      }
    } catch (e: any) {
      console.error('Screenshot error:', e);
      setStatusMessage('Snapshot generation failed. You can print directly.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyImage = async () => {
    if (!imageBlob && !imageDataUrl) {
      await generateScreenshot();
    }
    const blobToCopy = imageBlob || (imageDataUrl ? dataUrlToBlob(imageDataUrl) : null);
    if (!blobToCopy) return;

    const success = await safeCopyImageBlob(blobToCopy);
    if (success) {
      setCopiedImage(true);
      setStatusMessage('✓ Copied to clipboard! Paste into WhatsApp, Teams, or Excel.');
      setTimeout(() => setCopiedImage(false), 3000);
    } else {
      setStatusMessage('Direct clipboard write restricted by browser. Downloading image...');
      handleDownload();
    }
  };

  const handleDownload = () => {
    if (!imageDataUrl && !imageBlob) {
      generateScreenshot().then(() => {
        setTimeout(triggerDownload, 300);
      });
      return;
    }
    triggerDownload();
  };

  const triggerDownload = () => {
    const url = imageDataUrl;
    if (!url) return;
    const link = document.createElement('a');
    link.download = `Grey_Yarn_Stock_Order_${orderGroup?.orderNo || 'summary'}_${new Date().toISOString().split('T')[0]}.png`;
    link.href = url;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setStatusMessage('Downloaded successfully!');
  };

  const handlePrint = () => {
    window.print();
  };

  if (!isOpen || !orderGroup) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/70 backdrop-blur-xs animate-fade-in">
      <div 
        className="w-full max-w-6xl max-h-[96vh] flex flex-col bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-scale-up"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Top Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 shadow-2xs">
              <Scissors className="h-4.5 w-4.5" />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                Grey Yarn Stock Snipping Tool
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold">
                  Order #{orderGroup.orderNo}
                </span>
              </h2>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Generate high-resolution image to share on Teams, Email, or WhatsApp
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* View Mode Toggle */}
            <div className="flex items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-0.5 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setViewMode('fit')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  viewMode === 'fit' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Fit Screen
              </button>
              <button
                type="button"
                onClick={() => setViewMode('full')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  viewMode === 'full' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                100% Full
              </button>
            </div>

            {/* Actions */}
            <button
              type="button"
              onClick={handleCopyImage}
              disabled={isGenerating}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition-all shadow-xs cursor-pointer active:scale-95 disabled:opacity-50"
            >
              {copiedImage ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedImage ? 'Copied Image!' : 'Copy Image'}</span>
            </button>

            <button
              type="button"
              onClick={handleDownload}
              disabled={isGenerating}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all cursor-pointer disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download PNG</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="p-1.5 rounded-xl text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Print Order Snip"
            >
              <Printer className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Status Toast Line if present */}
        {statusMessage && (
          <div className="bg-indigo-50 dark:bg-indigo-950/60 border-b border-indigo-100 dark:border-indigo-900 px-4 py-1.5 text-center text-xs font-semibold text-indigo-700 dark:text-indigo-300">
            {statusMessage}
          </div>
        )}

        {/* Scrollable Visual Area */}
        <div 
          ref={scrollContainerRef}
          className="flex-1 overflow-auto p-4 sm:p-6 bg-slate-100/70 dark:bg-slate-950/80 flex items-start justify-center"
        >
          <div 
            ref={wrapperRef}
            style={{
              width: viewMode === 'fit' ? `${1080 * scale}px` : '1080px',
              height: viewMode === 'fit' && cardHeight ? `${cardHeight * scale}px` : 'auto',
              transition: 'width 0.2s ease, height 0.2s ease'
            }}
            className="relative"
          >
            {/* The Actual Rendered Card */}
            <div
              ref={cardRef}
              id={`grey-yarn-snip-card-${orderGroup.orderNo}`}
              style={{
                width: '1080px',
                transform: viewMode === 'fit' ? `scale(${scale})` : 'none',
                transformOrigin: 'top left',
                transition: 'transform 0.2s ease'
              }}
              className="bg-white text-slate-900 rounded-3xl border border-slate-200 shadow-xl p-8 space-y-6"
            >
              {/* Card Official Header */}
              <div className="flex items-center justify-between border-b-2 border-slate-200 pb-5">
                <div className="flex items-center gap-4">
                  {customLogo ? (
                    <img src={customLogo} alt="Epyllion Logo" className="h-12 w-auto object-contain" />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0F4C81] text-white font-black text-xl shadow-md">
                      EK
                    </div>
                  )}
                  <div>
                    <h1 className="text-xl font-black tracking-tight text-slate-900 uppercase">
                      EPYLLION KNITEX LIMITED
                    </h1>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs font-bold text-indigo-700 uppercase tracking-wider bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200">
                        Grey Yarn Stock Summary Report
                      </span>
                      <span className="text-xs text-slate-500 font-medium">
                        Knitting Status Tracking Module
                      </span>
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-xs text-slate-400 font-medium">Generated On</div>
                  <div className="text-sm font-bold text-slate-800">
                    {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                  </div>
                </div>
              </div>

              {/* Order Info Banner */}
              <div className="grid grid-cols-4 gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Order Number</span>
                  <span className="text-base font-black text-slate-900 font-mono">#{orderGroup.orderNo}</span>
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Buyer Name</span>
                  <span className="text-sm font-bold text-slate-800 truncate block">{orderGroup.buyerName}</span>
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Order Status</span>
                  <span className="inline-block mt-0.5 px-2 py-0.5 text-xs font-black rounded-md bg-indigo-100 text-indigo-800">
                    {orderGroup.status}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Completion Date</span>
                  <span className="text-sm font-bold text-slate-800 font-mono">{orderGroup.completionDate || '—'}</span>
                </div>
              </div>

              {/* 1st Layer KPI Metric Summary */}
              <div className="grid grid-cols-7 gap-3">
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-center">
                  <span className="text-[9px] font-bold uppercase text-slate-500 block">Booking QTY</span>
                  <span className="text-sm font-black font-mono text-slate-800">
                    {Math.round(orderGroup.totalBookingQty).toLocaleString()} <span className="text-[9px] text-slate-400 font-normal">kg</span>
                  </span>
                </div>
                <div className="p-3 rounded-2xl bg-indigo-50 border border-indigo-200 text-center">
                  <span className="text-[9px] font-bold uppercase text-indigo-700 block">Yarn Required</span>
                  <span className="text-sm font-black font-mono text-indigo-900">
                    {Math.round(orderGroup.totalYarnRequired).toLocaleString()} <span className="text-[9px] text-indigo-400 font-normal">kg</span>
                  </span>
                </div>
                <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-center">
                  <span className="text-[9px] font-bold uppercase text-emerald-700 block">Net Received</span>
                  <span className="text-sm font-black font-mono text-emerald-800">
                    {Math.round(orderGroup.totalNetReceived).toLocaleString()} <span className="text-[9px] text-emerald-500 font-normal">kg</span>
                  </span>
                </div>
                <div className="p-3 rounded-2xl bg-blue-50 border border-blue-200 text-center">
                  <span className="text-[9px] font-bold uppercase text-blue-700 block">Net Issued</span>
                  <span className="text-sm font-black font-mono text-blue-800">
                    {Math.round(orderGroup.totalNetIssued).toLocaleString()} <span className="text-[9px] text-blue-500 font-normal">kg</span>
                  </span>
                </div>
                <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-center">
                  <span className="text-[9px] font-bold uppercase text-rose-700 block">Excess Issued</span>
                  <span className="text-sm font-black font-mono text-rose-800">
                    {Math.round(orderGroup.totalExcessIssued).toLocaleString()} <span className="text-[9px] text-rose-500 font-normal">kg</span>
                  </span>
                </div>
                <div className="p-3 rounded-2xl bg-amber-50 border border-amber-300 text-center">
                  <span className="text-[9px] font-black uppercase text-amber-800 block">Stock QTY</span>
                  <span className="text-sm font-black font-mono text-amber-900">
                    {Math.round(orderGroup.totalStockQty).toLocaleString()} <span className="text-[9px] text-amber-600 font-normal">kg</span>
                  </span>
                </div>
                <div className="p-3 rounded-2xl bg-purple-50 border border-purple-200 text-center">
                  <span className="text-[9px] font-bold uppercase text-purple-700 block">Issue Balance</span>
                  <span className="text-sm font-black font-mono text-purple-900">
                    {Math.round(orderGroup.totalIssuedBalance).toLocaleString()} <span className="text-[9px] text-purple-500 font-normal">kg</span>
                  </span>
                </div>
              </div>

              {/* 2nd Layer Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider text-slate-700">
                  <div className="flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-indigo-600" />
                    <span>2nd Layer: Physical Yarn Count, Lot &amp; Spinner Specifications</span>
                  </div>
                  <span className="text-slate-400 font-mono text-[11px]">
                    {orderGroup.items.length} lots listed
                  </span>
                </div>

                <div className="overflow-hidden rounded-2xl border border-slate-200">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
                        <th className="py-2 px-3">Physical Yarn Count</th>
                        <th className="py-2 px-3 font-mono">Physical Yarn Lot</th>
                        <th className="py-2 px-3">Spinner</th>
                        <th className="py-2 px-3 text-right">Booking QTY</th>
                        <th className="py-2 px-3 text-right">Yarn Required</th>
                        <th className="py-2 px-3 text-right text-emerald-700">Total Received</th>
                        <th className="py-2 px-3 text-right text-blue-700">Total Issued</th>
                        <th className="py-2 px-3 text-right text-rose-700">Excess Issued</th>
                        <th className="py-2 px-3 text-right text-amber-800 bg-amber-50/60 font-black">Total Stock QTY</th>
                        <th className="py-2 px-3 text-right text-purple-700">Issued Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-[11px]">
                      {orderGroup.items.map((itm, i) => (
                        <tr key={itm.id || i} className={i % 2 === 1 ? 'bg-slate-50/50' : 'bg-white'}>
                          <td className="py-2 px-3 font-semibold text-slate-900">{itm.physicalYarnCount}</td>
                          <td className="py-2 px-3 font-mono text-slate-700">{itm.physicalYarnLot || '—'}</td>
                          <td className="py-2 px-3 text-slate-600">{itm.spinner || '—'}</td>
                          <td className="py-2 px-3 text-right font-mono text-slate-600">{Math.round(itm.bookingQty || 0).toLocaleString()}</td>
                          <td className="py-2 px-3 text-right font-mono text-slate-800 font-semibold">{Math.round(itm.yarnRequired || 0).toLocaleString()}</td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-emerald-700">{Math.round(itm.totalReceived || 0).toLocaleString()}</td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-blue-700">{Math.round(itm.totalIssued || 0).toLocaleString()}</td>
                          <td className="py-2 px-3 text-right font-mono font-semibold text-rose-700">{Math.round(itm.excessIssued || 0).toLocaleString()}</td>
                          <td className="py-2 px-3 text-right font-mono font-black text-amber-800 bg-amber-50/40">{Math.round(itm.totalStockQty || 0).toLocaleString()}</td>
                          <td className="py-2 px-3 text-right font-mono font-semibold text-purple-700">{Math.round(itm.issuedBalance || 0).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-100 font-black text-[11px] text-slate-900 border-t border-slate-300">
                        <td colSpan={3} className="py-2 px-3 text-right uppercase tracking-wider">
                          1st Layer Sum Total:
                        </td>
                        <td className="py-2 px-3 text-right font-mono">{Math.round(orderGroup.totalBookingQty).toLocaleString()}</td>
                        <td className="py-2 px-3 text-right font-mono">{Math.round(orderGroup.totalYarnRequired).toLocaleString()}</td>
                        <td className="py-2 px-3 text-right font-mono text-emerald-700">{Math.round(orderGroup.totalNetReceived).toLocaleString()}</td>
                        <td className="py-2 px-3 text-right font-mono text-blue-700">{Math.round(orderGroup.totalNetIssued).toLocaleString()}</td>
                        <td className="py-2 px-3 text-right font-mono text-rose-700">{Math.round(orderGroup.totalExcessIssued).toLocaleString()}</td>
                        <td className="py-2 px-3 text-right font-mono text-amber-900 bg-amber-100/60 font-black">{Math.round(orderGroup.totalStockQty).toLocaleString()}</td>
                        <td className="py-2 px-3 text-right font-mono text-purple-700">{Math.round(orderGroup.totalIssuedBalance).toLocaleString()}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Card Footer Watermark */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[10px] text-slate-400 font-medium">
                <span>Epyllion Knitex Ltd. • Enterprise Production &amp; Inventory Management</span>
                <span>Confidential Internal Document</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
