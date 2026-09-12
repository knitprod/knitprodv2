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
    window.print();
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/75 backdrop-blur-xs animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-4xl lg:max-w-5xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-teal-500/40 flex flex-col max-h-[92vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-4 py-3 bg-gradient-to-r from-teal-700 via-teal-800 to-emerald-800 text-white flex items-center justify-between shrink-0">
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
              title="Print / Save PDF"
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
        <div className="flex-1 p-3 sm:p-6 overflow-y-auto overflow-x-auto bg-slate-100 dark:bg-slate-950 flex flex-col items-center">
          {/* Branded ERP Summary Card that is ALWAYS immediately visible */}
          <div 
            ref={cardRef}
            id="raihan-snip-capture-card"
            className="w-full max-w-4xl bg-white text-slate-900 rounded-xl p-5 sm:p-7 shadow-md border border-slate-200 selection:bg-teal-100 shrink-0"
            style={{ minWidth: '820px', color: '#0f172a', backgroundColor: '#ffffff' }}
          >
            {/* Card Branded Header */}
            <div className="flex items-center justify-between pb-3.5 mb-4 border-b-2 border-teal-600">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-teal-600 to-emerald-600 text-white flex items-center justify-center font-extrabold text-base shadow-sm">
                  R
                </div>
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
                Epyllion Knitex · Confidential Internal Record
              </span>
            </div>
          </div>

          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-3 flex items-center gap-1.5">
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
        <div className="p-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 shrink-0">
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
