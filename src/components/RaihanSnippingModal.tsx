import React, { useState, useRef, useEffect } from 'react';
import { 
  X, 
  Download, 
  Share2, 
  Copy, 
  Check, 
  Scissors, 
  RefreshCw,
  Sparkles,
  Printer
} from 'lucide-react';
import { toPng } from 'html-to-image';
import { getCompanyLogo, initBrandingSync } from '../lib/logoStore';

interface RaihanSnippingModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  rawText: string;
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

export const RaihanSnippingModal: React.FC<RaihanSnippingModalProps> = ({
  isOpen,
  onClose,
  title,
  rawText
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [imageBlob, setImageBlob] = useState<Blob | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedImage, setCopiedImage] = useState(false);
  const [copiedText, setCopiedText] = useState(false);
  const [shareStatus, setShareStatus] = useState<string | null>(null);

  const [customLogo, setCustomLogo] = useState<string | null>(() => getCompanyLogo());

  useEffect(() => {
    initBrandingSync().catch(() => {});
    const handleUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<string | null>;
      setCustomLogo(customEvent.detail ?? getCompanyLogo());
    };
    window.addEventListener('company_logo_updated', handleUpdate);
    return () => window.removeEventListener('company_logo_updated', handleUpdate);
  }, []);

  const fileName = `Raihan_Summary_${title.replace(/[^a-zA-Z0-9_-]/g, '_')}_${new Date().toISOString().slice(0, 10)}.png`;

  // Render markdown with tables, headers, and total summaries
  const renderFormattedCardContent = (text: string) => {
    const lines = text.split('\n');
    const elements: React.ReactNode[] = [];
    let i = 0;

    const renderInline = (str: string) => {
      const parts = str.split(/(\*\*[^*]+\*\*)/g);
      return parts.map((part, pIdx) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={pIdx} className="font-bold text-slate-900">{part.slice(2, -2)}</strong>;
        }
        return part;
      });
    };

    while (i < lines.length) {
      const line = lines[i];
      const trimmed = line.trim();

      // Check for Markdown table
      if (trimmed.startsWith('|') && trimmed.endsWith('|') && trimmed.length > 2) {
        const tableLines: string[] = [];
        while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
          tableLines.push(lines[i].trim());
          i++;
        }

        if (tableLines.length >= 2) {
          const rawHeaders = tableLines[0].slice(1, -1).split('|').map(s => s.trim());
          const isDivider = tableLines[1].replace(/[-:\s|]/g, '').length === 0;
          const dataStartIdx = isDivider ? 2 : 1;
          const dataRows = tableLines.slice(dataStartIdx).map(tl => tl.slice(1, -1).split('|').map(s => s.trim()));

          elements.push(
            <div key={`table-${i}`} className="my-3 rounded-lg border border-slate-300 bg-white shadow-xs overflow-hidden">
              <table className="w-full text-xs text-left border-collapse table-auto">
                <thead className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300">
                  <tr>
                    {rawHeaders.map((h, hIdx) => {
                      const isNumeric = /qty|quantity|balance|production|req|gsm|width/i.test(h);
                      const isAllocatedYarn = /allocated yarn/i.test(h);
                      return (
                        <th 
                          key={hIdx} 
                          className={`px-3 py-2 border-r border-slate-200 last:border-r-0 ${
                            isNumeric ? 'text-right whitespace-nowrap' : isAllocatedYarn ? 'text-left min-w-[170px]' : 'text-left whitespace-nowrap'
                          }`}
                        >
                          {renderInline(h)}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {dataRows.map((row, rIdx) => {
                    const isTotalRow = row.some(cell => cell.includes('**Total**') || cell.trim().toLowerCase() === 'total');
                    return (
                      <tr
                        key={rIdx}
                        className={isTotalRow
                          ? "bg-emerald-50 font-bold border-t-2 border-emerald-400 text-emerald-950"
                          : (rIdx % 2 === 1 ? "bg-slate-50/70" : "bg-white")
                        }
                      >
                        {row.map((cell, cIdx) => {
                          const headerText = rawHeaders[cIdx] || '';
                          const isNumeric = /qty|quantity|balance|production|req|gsm|width/i.test(headerText);
                          const isAllocatedYarn = /allocated yarn/i.test(headerText);
                          return (
                            <td
                              key={cIdx}
                              className={`px-3 py-2 border-r border-slate-200 last:border-r-0 ${
                                isTotalRow ? 'font-bold text-emerald-950' : 'text-slate-800'
                              } ${
                                isNumeric ? 'text-right whitespace-nowrap' : isAllocatedYarn ? 'text-left min-w-[170px] whitespace-normal' : 'text-left whitespace-nowrap'
                              }`}
                            >
                              {renderInline(cell)}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
          continue;
        }
      }

      // Heading 4
      if (trimmed.startsWith('#### ')) {
        elements.push(
          <h4 key={`h4-${i}`} className="font-bold text-xs text-teal-800 mt-3 mb-1 flex items-center gap-1.5">
            {renderInline(trimmed.replace(/^####\s*/, ''))}
          </h4>
        );
        i++;
        continue;
      }

      // Heading 3
      if (trimmed.startsWith('### ')) {
        elements.push(
          <h3 key={`h3-${i}`} className="font-bold text-sm text-slate-900 mt-3.5 mb-1.5">
            {renderInline(trimmed.replace(/^###\s*/, ''))}
          </h3>
        );
        i++;
        continue;
      }

      // Bullet item
      const isBullet = trimmed.startsWith('•') || trimmed.startsWith('-');
      if (isBullet) {
        const cleanLine = trimmed.replace(/^[•\-]\s*/, '');
        elements.push(
          <div key={`bullet-${i}`} className="flex items-start gap-2 my-1 ml-1 text-slate-800">
            <span className="text-teal-600 font-bold shrink-0 mt-0.5">•</span>
            <span>{renderInline(cleanLine)}</span>
          </div>
        );
        i++;
        continue;
      }

      // Empty line
      if (!trimmed) {
        elements.push(<div key={`space-${i}`} className="h-2" />);
        i++;
        continue;
      }

      // Normal paragraph
      elements.push(
        <p key={`p-${i}`} className="my-1 text-slate-800">
          {renderInline(trimmed)}
        </p>
      );
      i++;
    }

    return elements;
  };

  // Capture the rendered card into image data
  const captureCard = async (): Promise<{ dataUrl: string; blob: Blob } | null> => {
    if (!cardRef.current) return null;
    try {
      const captureWidth = Math.max(cardRef.current.scrollWidth, 800);
      const dataUrl = await toPng(cardRef.current, {
        pixelRatio: 2.2,
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
    if (isOpen && rawText) {
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
      }, 300);

      return () => clearTimeout(timer);
    }
  }, [isOpen, rawText]);

  if (!isOpen) return null;

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
      handleCopyText();
      return;
    }

    try {
      if (navigator.clipboard && window.ClipboardItem) {
        const item = new ClipboardItem({ 'image/png': blob });
        await navigator.clipboard.write([item]);
        setCopiedImage(true);
        setTimeout(() => setCopiedImage(false), 2500);
      } else {
        handleCopyText();
      }
    } catch (err) {
      console.warn('Clipboard image write failed, falling back to download:', err);
      handleDownload();
    }
  };

  const handleCopyText = async () => {
    if (!rawText) return;
    try {
      await navigator.clipboard.writeText(rawText);
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 2500);
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  };

  const handleShare = async () => {
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

    try {
      if (blob && navigator.canShare) {
        const file = new File([blob], fileName, { type: 'image/png' });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: `Ask Raihan - ${title}`,
            text: `Epyllion Knitex ERP Summary: ${title}`
          });
          setShareStatus('Shared successfully!');
          setTimeout(() => setShareStatus(null), 3000);
          return;
        }
      }

      if (navigator.share) {
        await navigator.share({
          title: `Ask Raihan - ${title}`,
          text: rawText || `ERP Summary: ${title}`
        });
        setShareStatus('Shared!');
        setTimeout(() => setShareStatus(null), 3000);
      } else {
        handleDownload();
        setShareStatus('Downloaded to save & share!');
        setTimeout(() => setShareStatus(null), 3500);
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.warn('Share error:', err);
        handleDownload();
      }
    }
  };

  const handlePrint = () => {
    if (!cardRef.current) {
      window.print();
      return;
    }

    try {
      // Remove any existing print frame
      const oldFrame = document.getElementById('raihan-print-frame');
      if (oldFrame) {
        oldFrame.remove();
      }

      const printFrame = document.createElement('iframe');
      printFrame.id = 'raihan-print-frame';
      printFrame.setAttribute('style', 'position:fixed;top:-9999px;left:-9999px;width:210mm;height:297mm;border:none;visibility:hidden;');
      document.body.appendChild(printFrame);

      const frameDoc = printFrame.contentWindow?.document;
      if (!frameDoc) {
        window.print();
        return;
      }

      // Clone card and sanitize styles for 1-page portrait print
      const cardClone = cardRef.current.cloneNode(true) as HTMLElement;
      cardClone.style.minWidth = '0';
      cardClone.style.width = '100%';
      cardClone.style.maxWidth = '100%';
      cardClone.style.margin = '0';
      cardClone.style.padding = '8px 12px';
      cardClone.style.boxShadow = 'none';
      cardClone.style.border = 'none';
      cardClone.style.backgroundColor = '#ffffff';
      cardClone.style.color = '#0f172a';

      // Collect parent stylesheets and fonts
      const styleTags = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
        .map(el => el.outerHTML)
        .join('\n');

      frameDoc.open();
      frameDoc.write(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>EPYLLION KNITEX LIMITED - ${title || 'Production Summary'}</title>
  ${styleTags}
  <style>
    @page {
      size: portrait;
      margin: 8mm 10mm;
    }
    *, *::before, *::after {
      box-sizing: border-box !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    html, body {
      margin: 0 !important;
      padding: 0 !important;
      background: #ffffff !important;
      color: #0f172a !important;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
      font-size: 11.5px !important;
      line-height: 1.35 !important;
      width: 100% !important;
      height: auto !important;
      min-height: 0 !important;
      overflow: visible !important;
    }
    .print-sheet {
      width: 100% !important;
      max-width: 100% !important;
      margin: 0 auto !important;
      padding: 0 !important;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
      page-break-after: avoid !important;
      break-after: avoid !important;
    }
    #raihan-snip-capture-card {
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
    table {
      width: 100% !important;
      border-collapse: collapse !important;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
      margin: 6px 0 !important;
    }
    tr, th, td {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    th {
      background-color: #f1f5f9 !important;
      color: #0f172a !important;
      padding: 4px 6px !important;
      font-size: 10.5px !important;
    }
    td {
      padding: 4px 6px !important;
      font-size: 10.5px !important;
    }
    .border-b-2 {
      padding-bottom: 6px !important;
      margin-bottom: 8px !important;
    }
    .mt-5 {
      margin-top: 10px !important;
      padding-top: 6px !important;
    }
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
      className="raihan-modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/75 backdrop-blur-xs animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="raihan-modal-box relative w-full max-w-4xl lg:max-w-5xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-teal-500/40 flex flex-col max-h-[92vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="raihan-modal-header px-4 py-3 bg-gradient-to-r from-teal-700 via-teal-800 to-emerald-800 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-white/15 text-teal-200 shadow-xs">
              <Scissors className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm tracking-tight flex items-center gap-2">
                <span>Snipping Tool</span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/25 text-emerald-200 border border-emerald-400/30">
                  HD Snapshot
                </span>
                {isGenerating && (
                  <span className="text-[10px] text-teal-200/80 flex items-center gap-1 animate-pulse">
                    <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                    <span>Rendering HD...</span>
                  </span>
                )}
              </h3>
              <p className="text-[11px] text-teal-100/80 truncate max-w-[280px] sm:max-w-md">
                {title || 'Raihan ERP Production Summary'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handlePrint}
              className="p-1.5 rounded-lg text-teal-100 hover:text-white hover:bg-white/10 transition-colors cursor-pointer hidden sm:flex"
              title="Print document or Save as PDF (Portrait 1-Sheet)"
            >
              <Printer className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-teal-100 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              title="Close Snipping Tool"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Content / Preview Area */}
        <div className="raihan-modal-content flex-1 p-3 sm:p-6 overflow-y-auto overflow-x-auto bg-slate-100 dark:bg-slate-950 flex flex-col items-center">
          {/* Branded ERP Summary Card that is ALWAYS immediately visible */}
          <div 
            ref={cardRef}
            id="raihan-snip-capture-card"
            className="printable-snip-card w-full max-w-4xl bg-white text-slate-900 rounded-xl p-5 sm:p-7 shadow-md border border-slate-200 selection:bg-teal-100 shrink-0"
            style={{ minWidth: 'min(100%, 820px)', color: '#0f172a', backgroundColor: '#ffffff' }}
          >
            {/* Card Branded Header */}
            <div className="flex items-center justify-between pb-3.5 mb-4 border-b-2 border-teal-600">
              <div className="flex items-center gap-2.5">
                {customLogo ? (
                  <div className="flex items-center justify-center shrink-0 max-h-11">
                    <img
                      src={customLogo}
                      alt="Epyllion Knitex Ltd."
                      className="h-9 w-auto max-w-[120px] max-h-10 object-contain"
                    />
                  </div>
                ) : (
                  <div
                    className="flex items-center justify-center shrink-0 shadow-xs"
                    title="Epyllion Knitex Logo"
                  >
                    <svg
                      width="42"
                      height="42"
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
                  <div className="text-sm sm:text-base font-extrabold text-slate-900 tracking-tight">
                    EPYLLION KNITEX LIMITED
                  </div>
                  <div className="text-xs font-bold text-teal-700 flex items-center gap-1.5">
                    <span>Ask Raihan · Production Guide</span>
                    <span className="text-slate-300">•</span>
                    <span className="text-slate-600 font-semibold">{title}</span>
                  </div>
                </div>
              </div>

              <div className="text-right">
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-300 px-2.5 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                  Verified ERP Record
                </span>
                <div className="text-[10px] text-slate-500 mt-1 font-medium">
                  {new Date().toLocaleString([], { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>

            {/* Content Body with Tables & Totals */}
            <div className="text-[12.5px] leading-relaxed text-slate-900">
              {renderFormattedCardContent(rawText)}
            </div>

            {/* Card Branded Footer */}
            <div className="mt-5 pt-3 border-t border-dashed border-slate-300 flex items-center justify-between text-[10.5px] text-slate-500">
              <span className="flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                <span>Verified ERP Summary generated by Ask Raihan</span>
              </span>
              <span className="font-semibold text-slate-600">
                Epylliong Knittex Limited-Knitting Department.
              </span>
            </div>
          </div>

          <p className="raihan-modal-hint text-[11px] text-slate-500 dark:text-slate-400 mt-3 flex items-center gap-1.5">
            <Sparkles className="w-3 h-3 text-teal-500" />
            <span>High-definition snapshot with complete tables and total summaries. Ready to save or share.</span>
          </p>

          {shareStatus && (
            <div className="mt-2 text-xs font-semibold px-3.5 py-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-800 flex items-center gap-1.5 animate-fade-in shadow-xs">
              <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>{shareStatus}</span>
            </div>
          )}
        </div>

        {/* Action Buttons Bar */}
        <div className="raihan-modal-actions p-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyText}
              className="px-3 py-1.5 text-xs font-medium rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Copy plain text data"
            >
              {copiedText ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
              <span>{copiedText ? 'Text Copied!' : 'Copy Text'}</span>
            </button>

            <button
              type="button"
              onClick={handleCopyImage}
              disabled={isGenerating}
              className="px-3 py-1.5 text-xs font-medium rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
              title="Copy image to clipboard"
            >
              {copiedImage ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-teal-600" />}
              <span>{copiedImage ? 'Image Copied!' : 'Copy Image'}</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              disabled={isGenerating}
              className="px-3 py-2 text-xs font-bold rounded-xl border border-teal-600/40 hover:bg-teal-50 dark:hover:bg-teal-950/40 text-teal-800 dark:text-teal-200 flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              title="Print 1-Sheet Portrait or Save as PDF"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Sheet</span>
            </button>

            <button
              type="button"
              onClick={handleShare}
              disabled={isGenerating}
              className="px-3.5 py-2 text-xs font-bold rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-md flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              title="Share via WhatsApp, Messenger, or Apps"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Share Image</span>
            </button>

            <button
              type="button"
              onClick={handleDownload}
              disabled={isGenerating}
              className="px-4 py-2 text-xs font-bold rounded-xl bg-teal-700 hover:bg-teal-600 text-white shadow-md flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              title="Download high-resolution image file"
            >
              {isGenerating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              <span>Download HD PNG</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
