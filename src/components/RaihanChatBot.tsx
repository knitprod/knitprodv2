/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Raihan - Internal Epyllion Knitex ERP Assistant
 * Restricted exclusively to in-website data (Orders, Knitting Status, Textile Close, Production)
 * Zero external web access, Zero secret/code sharing.
 */

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Bot, 
  X, 
  Send, 
  Sparkles, 
  ShieldCheck, 
  Trash2, 
  Minimize2, 
  Maximize2, 
  ChevronDown,
  RefreshCw,
  Search,
  CheckCircle2,
  FileSpreadsheet
} from 'lucide-react';
import { UserRecord } from './UserManagementView';
import { KnittingStatusStorage } from '../lib/knittingStatusStore';
import { TextileClosePMCStorage } from '../lib/textileClosePMCStore';
import { useGlobalData } from '../context/GlobalDataContext';
import { RaihanAvatar } from './RaihanAvatar';

interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: string;
}

interface RaihanChatBotProps {
  currentUser?: UserRecord | null;
  activeTab?: string;
}

export const RAIHAN_WELCOME_BANNER = `👋 **Hey there! Raihan here! 😊**

Need a little help?
Ask me about anything on this website, and I’ll help you find the information you’re looking for.

**What can I help you with? 💬**`;

export const RaihanChatBot: React.FC<RaihanChatBotProps> = ({ currentUser, activeTab = 'Dashboard' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputQuery, setInputQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showWelcomeCallout, setShowWelcomeCallout] = useState(true);
  const { orderPlans = [], yarnAllocations = [], ledger = [], floors = [] } = useGlobalData();

  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: 'welcome-1',
      role: 'model',
      text: RAIHAN_WELCOME_BANNER,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen, messages]);

  // Quick prompt suggestions
  const SUGGESTIONS = [
    "Yesterday's production floor by floor",
    "Which floor did not update today?",
    "Last 7 days production of EFL",
    "Predict tomorrow's production",
    "Information for Order 272277",
    "What is the total knitting balance?"
  ];

  // Helper to package current in-website context for the server
  const getERPContext = (userQuestion: string) => {
    try {
      const knittingOrders = KnittingStatusStorage.getOrders();
      const textileRecords = TextileClosePMCStorage.getRecords();

      // Extract total stats
      let totalReqQty = 0;
      let totalGreyQty = 0;
      let totalProduction = 0;
      let totalKnitBal = 0;

      for (const ord of knittingOrders) {
        totalReqQty += Number(ord.reqQty || 0);
        totalGreyQty += Number(ord.greyQty || 0);
        totalProduction += Number(ord.production || 0);
        totalKnitBal += Number(ord.knitBalance || 0);
      }

      // Find any order numbers mentioned in user's query
      const numberMatches = userQuestion.match(/\b\d{4,8}(?:-[A-Za-z0-9-]+)?\b/g) || [];
      const lowerQ = userQuestion.toLowerCase();

      // Filter relevant records if specific numbers or buyers mentioned
      const matchedOrders: any[] = [];

      // 1. Check Knitting Status
      for (const ord of knittingOrders) {
        const matchesNum = numberMatches.some(n => ord.orderNo?.includes(n));
        const matchesBuyer = ord.buyerName && lowerQ.includes(ord.buyerName.toLowerCase());
        const fabricStr = ord.items?.map(it => it.fabType).join(' ').toLowerCase() || '';
        const matchesFabric = fabricStr && lowerQ.split(/\s+/).some(w => w.length > 3 && fabricStr.includes(w));

        if (matchesNum || matchesBuyer || matchesFabric) {
          const firstItem = ord.items?.[0];
          matchedOrders.push({
            type: 'Knitting Status',
            orderNo: ord.orderNo,
            buyerName: ord.buyerName,
            teamLeader: ord.teamLeader,
            fabType: ord.items?.map(it => it.fabType).filter(Boolean).join(', ') || 'Various',
            fgsm: firstItem?.fgsm || 'N/A',
            fWidth: firstItem?.fWidth || 'N/A',
            reqQty: ord.reqQty,
            greyQty: ord.greyQty,
            production: ord.production,
            knitBal: ord.knitBalance,
            itemsCount: ord.items?.length || 0
          });
        }
      }

      // 2. Check Order Plans
      for (const plan of orderPlans) {
        const matchesNum = numberMatches.some(n => String(plan.ewo || '').includes(n));
        const matchesBuyer = plan.buyer && lowerQ.includes(String(plan.buyer).toLowerCase());
        if (matchesNum || matchesBuyer) {
          matchedOrders.push({
            type: 'Order Plan',
            orderNo: plan.ewo,
            buyerName: plan.buyer,
            teamLeader: plan.knitTeamLeaders,
            fabType: plan.color ? `Color: ${plan.color}` : 'Fabric Plan',
            reqQty: plan.target,
            greyQty: plan.allocatedQty,
            production: plan.knitPro,
            knitBal: plan.knitBal,
            planMonth: plan.planMonth,
            planType: plan.planType
          });
        }
      }

      // 3. Check Textile Close PMC
      for (const rec of textileRecords) {
        const matchesNum = numberMatches.some(n => rec.orderNo?.includes(n));
        const matchesBuyer = rec.buyerName && lowerQ.includes(rec.buyerName.toLowerCase());

        if (matchesNum || matchesBuyer) {
          matchedOrders.push({
            type: 'Textile Close By PMC',
            orderNo: rec.orderNo,
            buyerName: rec.buyerName,
            teamLeader: rec.teamLeader,
            fabType: rec.fabType,
            reqQty: rec.reqQty,
            greyQty: rec.greyQty,
            production: rec.production,
            knitBal: rec.knitBal,
            closedDate: rec.closedDate,
            remarks: rec.remarks
          });
        }
      }

      // If no specific match was made, include a representative top sample (up to 12 records)
      const sampleRecords = matchedOrders.length > 0 
        ? matchedOrders.slice(0, 12)
        : knittingOrders.slice(0, 10).map(o => ({
            type: 'Knitting Status',
            orderNo: o.orderNo,
            buyerName: o.buyerName,
            teamLeader: o.teamLeader,
            fabType: o.items?.map(it => it.fabType).filter(Boolean).join(', ') || 'Knitting Fabric',
            reqQty: o.reqQty,
            production: o.production,
            knitBal: o.knitBalance
          }));

      return {
        activeTab,
        currentUser: {
          name: currentUser?.userName || 'User',
          userType: currentUser?.userType || 'General',
          unit: currentUser?.assignedUnits?.join(', ') || 'All Units'
        },
        relevantRecords: sampleRecords,
        ledger: Array.isArray(ledger) ? ledger.slice(0, 50) : [],
        floors: Array.isArray(floors) ? floors : [],
        summaryStats: {
          totalOrders: knittingOrders.length,
          totalTextileCloseRecords: textileRecords.length,
          totalReqQty: Math.round(totalReqQty),
          totalGreyQty: Math.round(totalGreyQty),
          totalProduction: Math.round(totalProduction),
          totalKnitBal: Math.round(totalKnitBal),
          buyers: Array.from(new Set(knittingOrders.map(o => o.buyerName).filter(Boolean))).slice(0, 10)
        }
      };
    } catch (e) {
      console.warn('Error packaging context for Raihan:', e);
      return {
        activeTab,
        currentUser: { name: currentUser?.userName || 'User', userType: currentUser?.userType || 'General' },
        relevantRecords: [],
        summaryStats: {}
      };
    }
  };

  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || inputQuery).trim();
    if (!query || isLoading) return;

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setInputQuery('');
    setIsLoading(true);

    try {
      const context = getERPContext(query);
      const historyPayload = messages.slice(-4).map(m => ({
        role: m.role,
        text: m.text
      }));

      // Resilient fetch with automatic single retry for transient network hiccups
      const sendRequest = async (retriesLeft = 1): Promise<Response> => {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 15000);

          const res = await fetch('/api/chat/raihan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: query,
              history: historyPayload,
              context
            }),
            signal: controller.signal
          });
          clearTimeout(timeoutId);
          return res;
        } catch (err) {
          if (retriesLeft > 0) {
            await new Promise(res => setTimeout(res, 800));
            return sendRequest(retriesLeft - 1);
          }
          throw err;
        }
      };

      const res = await sendRequest(1);
      if (!res.ok) {
        throw new Error(`Server returned status ${res.status}`);
      }

      const data = await res.json();
      const botReply = data.reply || "I am unable to retrieve that information right now. Please try asking again.";

      const botMsg: ChatMessage = {
        id: `msg-${Date.now() + 1}`,
        role: 'model',
        text: botReply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages(prev => [...prev, botMsg]);
    } catch (err: any) {
      console.warn('Raihan assistant communication fallback:', err?.message || err);
      setMessages(prev => [
        ...prev,
        {
          id: `msg-${Date.now() + 1}`,
          role: 'model',
          text: "I am having temporary difficulty connecting to the ERP system. Please verify your connection or try asking again.",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([
      {
        id: `welcome-${Date.now()}`,
        role: 'model',
        text: RAIHAN_WELCOME_BANNER,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);
  };

  // Simple Markdown-like text formatter for bold, bullets, and line breaks
  const renderFormattedText = (text: string) => {
    return text.split('\n').map((line, idx) => {
      // Check if line is a bullet item
      const isBullet = line.trim().startsWith('•') || line.trim().startsWith('-');
      let cleanLine = isBullet ? line.replace(/^[•\-]\s*/, '') : line;

      // Replace bold **text**
      const parts = cleanLine.split(/(\*\*[^*]+\*\*)/g);

      const content = parts.map((part, pIdx) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={pIdx} className="font-bold text-slate-900 dark:text-white">{part.slice(2, -2)}</strong>;
        }
        return part;
      });

      if (isBullet) {
        return (
          <div key={idx} className="flex items-start gap-1.5 my-0.5 ml-1">
            <span className="text-teal-600 dark:text-teal-400 font-bold shrink-0 mt-0.5">•</span>
            <span>{content}</span>
          </div>
        );
      }

      if (!line.trim()) {
        return <div key={idx} className="h-1.5" />;
      }

      return <p key={idx} className="my-0.5">{content}</p>;
    });
  };

  return (
    <>
      {/* Floating Launcher Button */}
      {!isOpen && (
        <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-2.5 animate-fade-in">
          {/* Welcome Banner Callout Bubble */}
          {showWelcomeCallout && (
            <div
              onClick={() => {
                setIsOpen(true);
                setShowWelcomeCallout(false);
              }}
              className="group/callout relative max-w-[280px] sm:max-w-[310px] p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-teal-500/30 dark:border-teal-500/40 shadow-2xl cursor-pointer hover:border-teal-500 transition-all text-xs select-none"
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowWelcomeCallout(false);
                }}
                className="absolute top-2 right-2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-md cursor-pointer"
                title="Dismiss welcome banner"
              >
                <X className="w-3.5 h-3.5" />
              </button>

              <div className="space-y-1.5 pr-3">
                <p className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5 text-xs">
                  <span>👋</span>
                  <span>Hey there! Raihan here! 😊</span>
                </p>
                <p className="text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed">
                  Need a little help? Ask me about anything on this website, and I’ll help you find the information you’re looking for.
                </p>
                <p className="font-bold text-teal-600 dark:text-teal-400 text-[11px] pt-0.5 flex items-center gap-1">
                  <span>What can I help you with?</span>
                  <span>💬</span>
                </p>
              </div>

              {/* Speech bubble arrow pointing towards launcher button */}
              <div className="absolute -bottom-1.5 right-7 w-3 h-3 bg-white dark:bg-slate-900 border-r border-b border-teal-500/30 dark:border-teal-500/40 rotate-45" />
            </div>
          )}

          <button
            id="raihan-chat-launcher"
            type="button"
            onClick={() => {
              setIsOpen(true);
              setShowWelcomeCallout(false);
            }}
            className="group relative flex items-center gap-3 px-3.5 py-2.5 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white rounded-2xl shadow-xl hover:shadow-teal-500/25 transition-all duration-200 transform hover:-translate-y-0.5 cursor-pointer border border-teal-400/30"
            title="Ask Raihan - Epyllion Knitex ERP Assistant"
          >
            <RaihanAvatar size="md" showOnlineIndicator={true} />
            
            <div className="text-left pr-1">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-black tracking-tight">Ask Raihan</span>
                <span className="text-[10px] uppercase font-bold bg-white/20 text-teal-100 px-1.5 py-0.5 rounded-md">
                  ERP Bot
                </span>
              </div>
              <p className="text-[11px] text-teal-100/90 font-medium">In-Website ERP Assistant</p>
            </div>
          </button>
        </div>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div 
          id="raihan-chat-window"
          className="fixed bottom-5 right-5 z-50 w-[380px] sm:w-[440px] max-w-[calc(100vw-1.5rem)] h-[590px] max-h-[calc(100vh-3.5rem)] flex flex-col bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-scale-up"
        >
          {/* Header */}
          <div className="px-4 py-3 bg-gradient-to-r from-teal-600 to-emerald-700 text-white flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2.5">
              <RaihanAvatar size="md" showOnlineIndicator={true} />

              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="text-sm font-black tracking-tight text-white">Raihan</h3>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/30 text-emerald-100 border border-emerald-400/30">
                    ERP Assistant
                  </span>
                </div>
                <p className="text-[10.5px] text-teal-100 font-medium flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                  In-Website Data Only • Offline Safe
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={clearChat}
                className="p-1.5 rounded-lg text-teal-100 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                title="Clear Conversation"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg text-teal-100 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                title="Close Chat"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Privacy & Scope Banner */}
          <div className="px-3.5 py-1.5 bg-teal-50/80 dark:bg-teal-950/40 border-b border-teal-100 dark:border-teal-900/60 flex items-center gap-2 text-[10.5px] text-teal-900 dark:text-teal-200">
            <ShieldCheck className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
            <span className="truncate">
              Grounded strictly in website records. No online browsing or secret sharing.
            </span>
          </div>

          {/* Messages Stream */}
          <div className="flex-1 p-3.5 overflow-y-auto space-y-3 bg-slate-50/50 dark:bg-slate-900/50 text-xs">
            {messages.map((msg) => {
              const isBot = msg.role === 'model';
              const isWelcome = msg.id.startsWith('welcome-');
              return (
                <div
                  key={msg.id}
                  className={`flex items-start gap-2.5 ${isBot ? 'justify-start' : 'justify-end'}`}
                >
                  {isBot && (
                    <RaihanAvatar size="sm" className="mt-0.5" />
                  )}

                  <div
                    className={`max-w-[88%] rounded-2xl p-3 leading-relaxed shadow-xs ${
                      isBot
                        ? isWelcome
                          ? 'bg-gradient-to-br from-teal-50/90 via-emerald-50/40 to-white dark:from-slate-800 dark:via-teal-950/30 dark:to-slate-800 text-slate-800 dark:text-slate-200 border border-teal-200/90 dark:border-teal-700/60 shadow-xs'
                          : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700/80'
                        : 'bg-teal-600 text-white rounded-br-none font-medium'
                    }`}
                  >
                    <div className="text-[12.5px] leading-relaxed">
                      {renderFormattedText(msg.text)}
                    </div>
                    <div
                      className={`text-[10px] mt-1.5 ${
                        isBot ? 'text-slate-400 dark:text-slate-500' : 'text-teal-100 text-right'
                      }`}
                    >
                      {msg.timestamp}
                    </div>
                  </div>
                </div>
              );
            })}

            {isLoading && (
              <div className="flex items-start gap-2.5">
                <RaihanAvatar size="sm" className="mt-0.5 animate-pulse" />
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-3.5 py-2 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2 shadow-xs">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-teal-600" />
                  <span>Raihan is analyzing ERP records...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Minimized / Compact Suggestions Row */}
          {(showSuggestions || (messages.length <= 1 && !isLoading)) && (
            <div className="px-2.5 py-1.5 bg-slate-100/90 dark:bg-slate-900 border-t border-slate-200/70 dark:border-slate-800 flex items-center gap-1.5 transition-all">
              <div className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/60 border border-teal-200/50 dark:border-teal-800/50 shrink-0">
                <Sparkles className="w-2.5 h-2.5 text-teal-600 dark:text-teal-400" />
                <span>Ideas</span>
              </div>

              <div className="flex-1 flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 scroll-smooth">
                {SUGGESTIONS.map((sug, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleSendMessage(sug)}
                    className="text-[10.5px] font-medium px-2.5 py-0.5 rounded-full bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-teal-50 dark:hover:bg-teal-950/50 hover:text-teal-700 dark:hover:text-teal-300 border border-slate-200 dark:border-slate-700 transition-colors shrink-0 whitespace-nowrap shadow-2xs cursor-pointer"
                  >
                    {sug}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setShowSuggestions(false)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 shrink-0 cursor-pointer"
                title="Minimize suggestions"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Input Box */}
          <div className="p-2.5 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-center gap-1.5"
            >
              <div className="relative flex-1">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputQuery}
                  onChange={(e) => setInputQuery(e.target.value)}
                  placeholder="Ask Raihan about orders, balance, fabric..."
                  disabled={isLoading}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white dark:focus:bg-slate-900 transition-all pr-8"
                />
                {inputQuery && (
                  <button
                    type="button"
                    onClick={() => setInputQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Suggestions Toggle Pill Button */}
              <button
                type="button"
                onClick={() => setShowSuggestions(!showSuggestions)}
                className={`p-2 rounded-xl border transition-all cursor-pointer shrink-0 ${
                  showSuggestions
                    ? 'bg-teal-50 dark:bg-teal-950/60 border-teal-500 text-teal-600 dark:text-teal-400'
                    : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 hover:text-teal-600'
                }`}
                title={showSuggestions ? "Hide suggestions" : "Show suggested questions"}
              >
                <Sparkles className="w-4 h-4" />
              </button>

              <button
                type="submit"
                disabled={!inputQuery.trim() || isLoading}
                className="p-2 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-40 text-white transition-all shadow-xs cursor-pointer disabled:cursor-not-allowed shrink-0"
                title="Send Question"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
            <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 px-1">
              <span>Press Enter to send</span>
              <span className="font-semibold text-teal-600 dark:text-teal-400">Raihan v1.0 • Epyllion Knitex</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default RaihanChatBot;
