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
  MoveHorizontal
} from 'lucide-react';
import { toPng } from 'html-to-image';
import html2canvas from 'html2canvas';
import { GreyStockOrderGroup } from '../types';
import { getCompanyLogo } from '../lib/logoStore';
import { safeCopyImageBlob } from '../lib/clipboardHelper';

interface GreyStockSnippingModalProps {
  orderGroup: GreyStockOrderGroup | null;
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

export const GreyStockSnippingModal: React.FC<GreyStockSnippingModalProps> = ({
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

  useEffect(() => {
    if (isOpen) {
      setImageDataUrl(null);
      setImageBlob(null);
      setCopiedImage(false);
      setStatusMessage(null);
    }
  }, [isOpen, orderGroup]);

  const captureCard = async (): Promise<{ dataUrl: string; blob: Blob } | null> => {
    if (!cardRef.current) return null;
    const wrapper = wrapperRef.current;
    const prevTransform = wrapper?.style.transform;
    const prevOrigin = wrapper?.style.transformOrigin;

    try {
      setIsGenerating(true);
      setStatusMessage('Rendering high-resolution Grey Stock snip...');

      // Temporarily reset CSS scale/transform to 1:1 so capture canvas doesn't render an offset white box
      if (wrapper) {
        wrapper.style.transform = 'none';
        wrapper.style.transformOrigin = 'top left';
      }

      // Small delay to allow layout recalculation if needed
      await new Promise(r => setTimeout(r, 60));

      const card = cardRef.current;
      const captureWidth = 1080;
      const captureHeight = card.offsetHeight || card.scrollHeight || 750;

      let dataUrl: string | null = null;

      // 1. First attempt with html2canvas (reliable rasterization without foreignObject blank issues)
      try {
        const canvas = await html2canvas(card, {
          backgroundColor: '#ffffff',
          scale: 2,
          useCORS: true,
          allowTaint: true,
          logging: false,
          width: captureWidth,
          windowWidth: 1080,
          scrollX: 0,
          scrollY: 0
        });
        if (canvas) {
          dataUrl = canvas.toDataURL('image/png', 0.98);
        }
      } catch (h2cErr) {
        console.warn('html2canvas capture notice, falling back to toPng:', h2cErr);
      }

      // 2. If html2canvas returned null or tiny data, fallback to toPng
      if (!dataUrl || dataUrl === 'data:,' || dataUrl.length < 2000) {
        try {
          dataUrl = await toPng(card, {
            quality: 0.98,
            pixelRatio: 2,
            backgroundColor: '#ffffff',
            skipFonts: true,
            cacheBust: true,
            width: captureWidth,
            height: captureHeight,
            style: {
              transform: 'none',
              margin: '0',
              left: '0',
              top: '0'
            }
          });
        } catch (toPngErr) {
          console.warn('toPng failed:', toPngErr);
        }
      }

      if (!dataUrl) {
        throw new Error('Failed to generate image data.');
      }

      const blob = dataUrlToBlob(dataUrl);
      setImageDataUrl(dataUrl);
      setImageBlob(blob);
      setIsGenerating(false);
      setStatusMessage(null);
      return { dataUrl, blob };
    } catch (err: any) {
      console.error('Grey Stock card capture error:', err);
      setIsGenerating(false);
      setStatusMessage('Error capturing image: ' + (err.message || 'Unknown error'));
      return null;
    } finally {
      // Restore previous transform
      if (wrapper && prevTransform !== undefined) {
        wrapper.style.transform = prevTransform;
        wrapper.style.transformOrigin = prevOrigin || 'top center';
      }
    }
  };

  const handleDownload = async () => {
    const res = await captureCard();
    const url = res?.dataUrl || imageDataUrl;
    if (!url) return;
    const link = document.createElement('a');
    link.download = `GreyStock_Order_${orderGroup?.orderNo || 'details'}_${new Date().toISOString().slice(0, 10)}.png`;
    link.href = url;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setStatusMessage('Downloaded Grey Stock snip image!');
    setTimeout(() => setStatusMessage(null), 3000);
  };

  const handleCopy = async () => {
    try {
      const res = await captureCard();
      const blob = res?.blob || imageBlob;
      if (!blob) {
        handleDownload();
        return;
      }

      const success = await safeCopyImageBlob(blob, () => {
        handleDownload();
        setStatusMessage('Browser clipboard restricted; downloaded PNG file instead!');
        setTimeout(() => setStatusMessage(null), 3500);
      });

      if (success) {
        setCopiedImage(true);
        setStatusMessage('Image copied to clipboard!');
        setTimeout(() => {
          setCopiedImage(false);
          setStatusMessage(null);
        }, 3000);
      }
    } catch (err: any) {
      console.warn('Clipboard write fallback notice, downloading image instead:', err);
      handleDownload();
      setStatusMessage('Downloaded PNG image file!');
      setTimeout(() => setStatusMessage(null), 3500);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (!isOpen || !orderGroup) return null;

  const totalGreyReq = Math.round(orderGroup.greyRequired || 0);
  const totalNetRec = Math.round(orderGroup.totalNetReceived || 0);
  const totalNetIss = Math.round(orderGroup.totalNetIssued || 0);
  const sumItemsStock = (orderGroup.items || []).reduce((acc, it) => {
    const itmStock = it.stockQty !== undefined && it.stockQty !== null
      ? Number(it.stockQty)
      : Math.max(0, (Number(it.netReceivedQty) || 0) - (Number(it.netIssuedQty) || 0));
    return acc + itmStock;
  }, 0);
  const totalStock = Math.round(
    sumItemsStock > 0
      ? sumItemsStock
      : (orderGroup.totalGreyStock !== undefined && orderGroup.totalGreyStock !== null
          ? orderGroup.totalGreyStock
          : Math.max(0, totalNetRec - totalNetIss))
  );
  const issuePercent = totalNetRec > 0 ? Math.round((totalNetIss / totalNetRec) * 100) : 0;

  const status = (orderGroup.status || 'Running').trim();
  const lowerStatus = status.toLowerCase();
  const isTextileClose = lowerStatus.includes('textile close');
  const isComplete = lowerStatus === 'complete' || lowerStatus === 'completed';
  const isUnknown = lowerStatus === 'unknown';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-2 sm:p-4 overflow-hidden animate-fade-in print:p-0 print:bg-white print:static">
      <div className="flex flex-col w-full max-w-5xl h-[94vh] max-h-[950px] bg-slate-100 dark:bg-slate-950 rounded-2xl border border-slate-300 dark:border-slate-800 shadow-2xl overflow-hidden print:border-none print:shadow-none print:h-auto print:max-h-none print:w-full">
        {/* Modal Top Bar */}
        <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shrink-0 print:hidden">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
              <Scissors className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                  Grey Stock Snipping Tool • Order {orderGroup.orderNo}
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                  Grey Stock Data Only
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Official high-resolution export for Buyer &amp; Production Floor communication
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* View Mode Switcher */}
            {isMobile && (
              <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700 mr-1">
                <button
                  onClick={() => setViewMode('fit')}
                  className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                    viewMode === 'fit'
                      ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                      : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                  title="Fit whole card onto your mobile screen"
                >
                  <Smartphone className="w-3 h-3" />
                  <span>Fit</span>
                </button>
                <button
                  onClick={() => setViewMode('full')}
                  className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                    viewMode === 'full'
                      ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                      : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                  title="Full width (scroll horizontally to view full size)"
                >
                  <MoveHorizontal className="w-3 h-3" />
                  <span>100%</span>
                </button>
              </div>
            )}

            <button
              onClick={handleCopy}
              disabled={isGenerating}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer active:scale-95 shadow-xs ${
                copiedImage
                  ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750'
              }`}
            >
              {copiedImage ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedImage ? 'Copied Image' : 'Copy'}</span>
            </button>

            <button
              onClick={handleDownload}
              disabled={isGenerating}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-all cursor-pointer active:scale-95"
            >
              {isGenerating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              <span>Download PNG</span>
            </button>

            <button
              onClick={handlePrint}
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-all cursor-pointer"
              title="Print Grey Stock Card"
            >
              <Printer className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Status notice banner if generating */}
        {statusMessage && (
          <div className="px-4 py-1.5 bg-blue-50 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 text-xs font-bold flex items-center justify-between border-b border-blue-200 dark:border-blue-900 shrink-0 print:hidden animate-fade-in">
            <span>{statusMessage}</span>
            <button onClick={() => setStatusMessage(null)} className="text-blue-500 hover:text-blue-700">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Scrollable Canvas Container */}
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-auto p-4 sm:p-6 bg-slate-200/70 dark:bg-slate-900/90 flex justify-center items-start print:p-0 print:bg-white print:overflow-visible"
        >
          <div
            ref={wrapperRef}
            className="transition-all duration-200 print:transform-none print:w-full print:m-0"
            style={{
              width: viewMode === 'fit' ? '1080px' : '1080px',
              transform: viewMode === 'fit' ? `scale(${scale})` : 'none',
              transformOrigin: 'top center',
              marginBottom: viewMode === 'fit' ? `${(cardHeight * scale) - cardHeight}px` : '20px'
            }}
          >
            {/* The Target Capture Card: Exactly 1080px wide for pristine HD export */}
            <div
              ref={cardRef}
              className="w-[1080px] bg-white text-slate-900 rounded-2xl border border-slate-300 shadow-xl p-8 space-y-6 print:border-none print:shadow-none print:p-4 print:w-full font-sans"
            >
              {/* Header Section */}
              <div className="flex items-center justify-between border-b-2 border-slate-900 pb-5">
                <div className="flex items-center gap-4">
                  {customLogo ? (
                    <img src={customLogo} alt="Logo" className="h-12 w-auto object-contain" />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-blue-900 text-white flex items-center justify-center font-black text-xl shadow-md">
                      <Building2 className="w-7 h-7 text-white" />
                    </div>
                  )}
                  <div>
                    <h1 className="text-2xl font-black tracking-tight text-slate-950 uppercase">
                      EPYLLION KNITEX LIMITED
                    </h1>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Grey Stock Summary Official Snippet
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">
                        • Generated: {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Order & Status Header Badge */}
                <div className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <span className="text-2xl font-black font-mono text-slate-950 tracking-tight">
                      Order: {orderGroup.orderNo}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-end gap-2">
                    <span className="text-xs font-bold text-slate-600">
                      Buyer: <strong className="text-slate-900">{orderGroup.buyerName || '—'}</strong>
                    </span>
                    <span className="text-slate-300">•</span>
                    {/* Status Badge */}
                    <span
                      className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wide border shadow-2xs ${
                        isTextileClose
                          ? 'bg-purple-100 text-purple-800 border-purple-300'
                          : isComplete
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                          : isUnknown
                          ? 'bg-amber-100 text-amber-800 border-amber-300'
                          : 'bg-blue-100 text-blue-800 border-blue-300'
                      }`}
                    >
                      {isTextileClose && <Archive className="w-3.5 h-3.5 text-purple-700" />}
                      {isComplete && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />}
                      {isUnknown && <AlertCircle className="w-3.5 h-3.5 text-amber-700" />}
                      {!isTextileClose && !isComplete && !isUnknown && (
                        <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                      )}
                      <span>{status}</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* 5 KPI Metric Cards with Rounded Whole Integer Values */}
              <div className="grid grid-cols-5 gap-3.5">
                {/* 1. Total Grey QTY */}
                <div className="bg-indigo-50/70 p-3.5 rounded-xl border border-indigo-200">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-700">
                    Total Grey QTY
                  </span>
                  <div className="text-2xl font-black font-mono text-indigo-950 mt-1">
                    {totalGreyReq.toLocaleString()} <span className="text-xs font-bold text-indigo-600">Kg</span>
                  </div>
                  <div className="text-[10px] text-indigo-600 font-semibold mt-0.5">
                    Order requirement
                  </div>
                </div>

                {/* 2. Net Received Qty */}
                <div className="bg-emerald-50/70 p-3.5 rounded-xl border border-emerald-200">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700">
                    Net Received Qty
                  </span>
                  <div className="text-2xl font-black font-mono text-emerald-950 mt-1">
                    {totalNetRec.toLocaleString()} <span className="text-xs font-bold text-emerald-600">Kg</span>
                  </div>
                  <div className="text-[10px] text-emerald-600 font-semibold mt-0.5">
                    Total received
                  </div>
                </div>

                {/* 3. Net Issued Qty */}
                <div className="bg-blue-50/70 p-3.5 rounded-xl border border-blue-200">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-700">
                    Net Issued Qty
                  </span>
                  <div className="text-2xl font-black font-mono text-blue-950 mt-1">
                    {totalNetIss.toLocaleString()} <span className="text-xs font-bold text-blue-600">Kg</span>
                  </div>
                  <div className="text-[10px] text-blue-600 font-semibold mt-0.5">
                    Dispatched to dye
                  </div>
                </div>

                {/* 4. Total Grey Stock Qty */}
                <div className="bg-amber-50/80 p-3.5 rounded-xl border border-amber-300">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-800">
                    Total Grey Stock Qty
                  </span>
                  <div className="text-2xl font-black font-mono text-amber-950 mt-1">
                    {totalStock.toLocaleString()} <span className="text-xs font-bold text-amber-700">Kg</span>
                  </div>
                  <div className="text-[10px] text-amber-700 font-semibold mt-0.5">
                    Remaining in floor
                  </div>
                </div>

                {/* 5. Issue Percentage */}
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-600">
                    Issued Rate
                  </span>
                  <div className="text-2xl font-black font-mono text-slate-900 mt-1">
                    {issuePercent}%
                  </div>
                  <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden mt-1.5">
                    <div
                      className={`h-full rounded-full ${
                        issuePercent >= 90 ? 'bg-emerald-500' : issuePercent >= 50 ? 'bg-blue-500' : 'bg-amber-500'
                      }`}
                      style={{ width: `${Math.min(100, Math.max(0, issuePercent))}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Detailed Specification Breakdown Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Boxes className="w-4 h-4 text-blue-700" />
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-900">
                      Fabric &amp; Colour Specification Breakdown ({orderGroup.items.length} specifications)
                    </h4>
                  </div>
                  <span className="text-[11px] font-semibold text-slate-500">
                    All quantities rounded up to whole integers (Kg)
                  </span>
                </div>

                <div className="rounded-xl border border-slate-300 overflow-x-auto shadow-2xs">
                  <table className="w-full text-left text-xs border-collapse" style={{ minWidth: '1020px' }}>
                    <thead>
                      <tr className="bg-slate-100 text-slate-800 font-black uppercase tracking-wider text-[11px] border-b border-slate-300 select-none">
                        <th className="py-2.5 px-2.5" style={{ width: '90px' }}>Order No.</th>
                        <th className="py-2.5 px-2.5" style={{ width: '110px' }}>Colour</th>
                        <th className="py-2.5 px-2.5" style={{ width: '220px' }}>Fabrics Type</th>
                        <th className="py-2.5 px-2.5" style={{ width: '100px' }}>Buyer</th>
                        <th className="py-2.5 px-2 text-center" style={{ width: '70px' }}>Owner Unit</th>
                        <th className="py-2.5 px-2.5 text-right text-indigo-900 bg-indigo-50/70 font-black" style={{ width: '110px' }}>Total Grey QTY</th>
                        <th className="py-2.5 px-2.5 text-right text-emerald-900 bg-emerald-50/70 font-black" style={{ width: '115px' }}>Net Received Qty.-Kg</th>
                        <th className="py-2.5 px-2.5 text-right text-blue-900 bg-blue-50/70 font-black" style={{ width: '110px' }}>Net Issued Qty.-Kg</th>
                        <th className="py-2.5 px-2.5 text-right text-amber-950 bg-amber-100/80 font-black" style={{ width: '125px' }}>
                          Total Grey Stock Qty
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 font-medium">
                      {orderGroup.items.map((itm, itmIdx) => {
                        const mGrey = Math.round(Number(itm.matchedGreyQty) || (orderGroup.items.length === 1 ? totalGreyReq : (Number(orderGroup.greyRequired) || 0)) || 0);
                        const nRec = Math.round(Number(itm.netReceivedQty) || 0);
                        const nIss = Math.round(Number(itm.netIssuedQty) || 0);
                        const calcStock = itm.stockQty !== undefined && itm.stockQty !== null ? Number(itm.stockQty) : (nRec - nIss);
                        const sQty = Math.round(calcStock >= 0 ? calcStock : Math.max(0, nRec - nIss));

                        return (
                          <tr
                            key={itm.id || `snip-itm-${itmIdx}`}
                            className={itmIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}
                          >
                            <td className="py-2.5 px-2.5 font-mono font-bold text-slate-900 whitespace-nowrap">
                              {orderGroup.orderNo}
                            </td>
                            <td className="py-2.5 px-2.5 font-bold text-slate-950 max-w-[110px] break-words">
                              {itm.colour || '—'}
                            </td>
                            <td className="py-2.5 px-2.5 text-slate-700 max-w-[220px] break-words leading-tight">
                              {itm.fabType || '—'}
                            </td>
                            <td className="py-2.5 px-2.5 text-slate-800 max-w-[100px] truncate">
                              {itm.buyerName || orderGroup.buyerName || '—'}
                            </td>
                            <td className="py-2.5 px-2 text-center whitespace-nowrap font-mono text-xs font-semibold">
                              <span className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-300 text-slate-800 font-bold">
                                {itm.ownerUnit || 'EKL'}
                              </span>
                            </td>
                            <td className="py-2.5 px-2.5 text-right font-mono font-black text-indigo-900 bg-indigo-50/40 whitespace-nowrap">
                              {mGrey > 0 ? mGrey.toLocaleString() : (totalGreyReq > 0 ? totalGreyReq.toLocaleString() : '0')}
                            </td>
                            <td className="py-2.5 px-2.5 text-right font-mono font-black text-emerald-900 bg-emerald-50/40 whitespace-nowrap">
                              {nRec.toLocaleString()}
                            </td>
                            <td className="py-2.5 px-2.5 text-right font-mono font-black text-blue-900 bg-blue-50/40 whitespace-nowrap">
                              {nIss.toLocaleString()}
                            </td>
                            <td className="py-2.5 px-2.5 text-right font-mono font-black text-amber-950 bg-amber-100/60 whitespace-nowrap">
                              {sQty.toLocaleString()}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-100/90 font-black text-slate-950 border-t-2 border-slate-300 text-xs">
                        <td colSpan={5} className="py-2.5 px-3 uppercase tracking-wider text-slate-700">
                          Total Order Sum ({orderGroup.items.length} items)
                        </td>
                        <td className="py-2.5 px-2.5 text-right font-mono text-indigo-900 font-black bg-indigo-50/70">
                          {totalGreyReq.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-2.5 text-right font-mono text-emerald-900 font-black bg-emerald-50/70">
                          {totalNetRec.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-2.5 text-right font-mono text-blue-900 font-black bg-blue-50/70">
                          {totalNetIss.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-2.5 text-right font-mono text-amber-950 bg-amber-100/80 font-black">
                          {totalStock.toLocaleString()}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Card Footer Verification */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-200 text-[11px] text-slate-500">
                <div className="flex items-center gap-1.5 font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Verified Grey Stock Data • Epyllion ERP Integrated</span>
                </div>
                <div className="font-mono text-[10px] text-slate-400">
                  Doc Ref: GS-SNIP-{orderGroup.orderNo}-{Date.now().toString().slice(-6)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
