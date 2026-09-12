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
  FileSpreadsheet,
  Scissors,
  Camera
} from 'lucide-react';
import { UserRecord } from './UserManagementView';
import { KnittingStatusStorage } from '../lib/knittingStatusStore';
import { TextileClosePMCStorage } from '../lib/textileClosePMCStore';
import { useGlobalData } from '../context/GlobalDataContext';
import { RaihanAvatar } from './RaihanAvatar';
import { generateInitialLedger } from './ProductionLedgerView';
import { RaihanSnippingModal } from './RaihanSnippingModal';
import { 
  handleSmartProductionLedgerQuery, 
  handleSmartOrderQuery, 
  handleSmartSummaryQuery, 
  normalizeQueryString,
  STANDARD_FACTORY_FLOORS 
} from '../lib/raihanIntelligence';

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
  const [isMaximized, setIsMaximized] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
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

  // Snipping Tool State
  const [snipModalOpen, setSnipModalOpen] = useState(false);
  const [snipTitle, setSnipTitle] = useState('Raihan ERP Summary');
  const [snipRawText, setSnipRawText] = useState('');

  const handleSnipMessage = (_msgId: string, text: string) => {
    let title = 'Raihan ERP Summary';
    const orderMatch = text.match(/Order #?(\d+)/i) || text.match(/#(\d+)/);
    if (orderMatch) {
      title = `Order #${orderMatch[1]} Summary`;
    } else if (text.toLowerCase().includes('daily production') || text.toLowerCase().includes('knitting status')) {
      title = 'Knitting Floor Production Report';
    }

    setSnipTitle(title);
    setSnipRawText(text);
    setSnipModalOpen(true);
  };

  const handleSnipLatestSummary = () => {
    const lastBotMsg = [...messages].reverse().find(m => m.role === 'model' && !m.id.startsWith('welcome-'));
    if (lastBotMsg) {
      handleSnipMessage(lastBotMsg.id, lastBotMsg.text);
    } else if (messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      handleSnipMessage(lastMsg.id, lastMsg.text);
    }
  };

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

  const STANDARD_FLOORS = ['EFL', 'EFL-2', 'KDL', 'Unit-2'];

  // Autonomous Client-Side ERP Engine (works offline, on static Vercel, or during server transitions)
  const synthesizeClientERPResponse = (
    query: string,
    history: { role: string; text: string }[],
    context: any,
    knittingOrders: any[],
    orderPlans: any[],
    textileRecords: any[],
    yarnAllocationsList: any[],
    ledgerData: any[],
    floorsList: any[]
  ): string => {
    const effectiveLedger = (Array.isArray(ledgerData) && ledgerData.length > 0) ? ledgerData : generateInitialLedger();

    // 1. Check production ledger queries first (yesterday floor-by-floor, 7-day, forecast, missing floors)
    const prodResult = handleSmartProductionLedgerQuery(query, effectiveLedger, floorsList);
    if (prodResult.handled && prodResult.reply) {
      return prodResult.reply;
    }

    // 2. Check if asking about total knitting balance / total production summary without specific order number
    const normalized = normalizeQueryString(query);
    const numMatches = normalized.match(/\b\d{4,8}(?:-[A-Za-z0-9-]+)?\b/g) || [];
    const lowerQ = query.toLowerCase().trim();

    const isTotalKnittingQuery = 
      (lowerQ.includes('total') && (lowerQ.includes('balance') || lowerQ.includes('knit') || lowerQ.includes('prod') || lowerQ.includes('summary'))) ||
      (lowerQ.includes('knitting balance') && !numMatches.length) ||
      (lowerQ.includes('total balance') && !numMatches.length);

    if (isTotalKnittingQuery && numMatches.length === 0) {
      const summaryResult = handleSmartSummaryQuery(query, context?.summaryStats, knittingOrders.length, activeTab);
      if (summaryResult.handled && summaryResult.reply) {
        return summaryResult.reply;
      }
    }

    // 3. Check order queries (order number, color, fabric, balance)
    let activeOrderNum: string | null = numMatches[0] || null;
    let isFollowUp = false;

    if (!activeOrderNum && !isTotalKnittingQuery) {
      if (context?.activeOrderNo) {
        activeOrderNum = String(context.activeOrderNo);
        isFollowUp = true;
      } else {
        for (let i = history.length - 1; i >= 0; i--) {
          const histMatches = String(history[i]?.text || '').match(/\b\d{4,8}(?:-[A-Za-z0-9-]+)?\b/g);
          if (histMatches && histMatches.length > 0) {
            const candidate = histMatches[0];
            if (candidate === '2024' || candidate === '2025' || candidate === '2026') continue;
            activeOrderNum = candidate;
            isFollowUp = true;
            break;
          }
        }
      }
    }

    const orderResult = handleSmartOrderQuery(
      query,
      activeOrderNum,
      isFollowUp,
      numMatches,
      knittingOrders,
      orderPlans,
      textileRecords,
      yarnAllocationsList
    );
    if (orderResult.handled && orderResult.reply) {
      return orderResult.reply;
    }

    // 3. Summary query
    const summaryResult = handleSmartSummaryQuery(query, context?.summaryStats, knittingOrders.length, activeTab);
    if (summaryResult.handled && summaryResult.reply) {
      return summaryResult.reply;
    }

    // 4. Check if the question is clearly outside website data
    const isOutsideQuestion = 
      /\b(weather|temperature|forecast for|president|prime minister|capital of|tell me a joke|write a poem|sing a song|recipe|how to cook|movie|football score|cricket|stock price|bitcoin|crypto|python|javascript|write code)\b/i.test(lowerQ) ||
      (/\b(who is|what is|tell me about)\b/i.test(lowerQ) && !lowerQ.includes('order') && !lowerQ.includes('fabric') && !lowerQ.includes('knit') && !lowerQ.includes('floor') && !lowerQ.includes('production') && !lowerQ.includes('balance') && !lowerQ.includes('yarn') && !lowerQ.includes('buyer') && !lowerQ.includes('pmc') && !lowerQ.includes('target') && !lowerQ.includes('machine') && !lowerQ.includes('shift') && !numMatches.length);

    if (isOutsideQuestion) {
      return "Sorry, I don't have that information in my system.";
    }

    // 5. If specific order was queried but not found in any dataset
    if (activeOrderNum && numMatches.length > 0) {
      return `Hmm, I couldn't find that order in the system. I checked Knitting Status, Order Plans, Textile Close By PMC, and Yarn Allocations, but couldn't find **Order #${activeOrderNum}**.\n\nPlease verify the order number or ensure the latest records have been updated.`;
    }

    // 6. Default friendly colleague guided response
    return `Sure! 😊 I'm here to help with any information in the system.\n\n` +
      `Here are a few things you can ask me:\n` +
      `• *"Yesterday's production floor by floor"*\n` +
      `• *"Which floor did not update today?"*\n` +
      `• *"Last 7 days production of EFL"*\n` +
      `• *"Predict tomorrow's production"*\n` +
      `• *"What is the information for Order 272277?"*\n` +
      `• *"What is the total knitting balance?"*`;
  };

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

      // Multi-turn order context detection
      const isTotalKnittingQuery = 
        (lowerQ.includes('total') && (lowerQ.includes('balance') || lowerQ.includes('knit') || lowerQ.includes('prod') || lowerQ.includes('summary'))) ||
        (lowerQ.includes('knitting balance') && !numberMatches.length) ||
        (lowerQ.includes('total balance') && !numberMatches.length);

      let activeOrderNo: string | null = numberMatches[0] || null;
      if (!activeOrderNo && !isTotalKnittingQuery) {
        for (let i = messages.length - 1; i >= 0; i--) {
          const histMatches = String(messages[i]?.text || '').match(/\b\d{4,8}(?:-[A-Za-z0-9-]+)?\b/g);
          if (histMatches && histMatches.length > 0) {
            const candidate = histMatches[0];
            if (candidate === '2024' || candidate === '2025' || candidate === '2026') continue;
            activeOrderNo = candidate;
            break;
          }
        }
      }

      // Filter relevant records if specific numbers or buyers mentioned
      const matchedOrders: any[] = [];

      // 1. Check Knitting Status
      for (const ord of knittingOrders) {
        const matchesNum = numberMatches.some(n => ord.orderNo?.includes(n));
        const matchesActive = Boolean(activeOrderNo && ord.orderNo?.includes(activeOrderNo));
        const matchesBuyer = ord.buyerName && lowerQ.includes(ord.buyerName.toLowerCase());
        const fabricStr = ord.items?.map(it => it.fabType).join(' ').toLowerCase() || '';
        const matchesFabric = fabricStr && lowerQ.split(/\s+/).some(w => w.length > 3 && fabricStr.includes(w));

        if (matchesNum || matchesActive || matchesBuyer || matchesFabric) {
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
            itemsCount: ord.items?.length || 0,
            items: ord.items,
            color: ord.items?.map(it => it.color).filter(Boolean).join(', ') || ''
          });
        }
      }

      // 2. Check Order Plans
      for (const plan of orderPlans) {
        const matchesNum = numberMatches.some(n => String(plan.ewo || '').includes(n));
        const matchesActive = Boolean(activeOrderNo && String(plan.ewo || '').includes(activeOrderNo));
        const matchesBuyer = plan.buyer && lowerQ.includes(String(plan.buyer).toLowerCase());
        if (matchesNum || matchesActive || matchesBuyer) {
          matchedOrders.push({
            type: 'Order Plan',
            orderNo: plan.ewo,
            buyerName: plan.buyer,
            teamLeader: plan.knitTeamLeaders,
            fabType: plan.color ? `Color: ${plan.color}` : 'Fabric Plan',
            color: plan.color || '',
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
        const matchesActive = Boolean(activeOrderNo && rec.orderNo?.includes(activeOrderNo));
        const matchesBuyer = rec.buyerName && lowerQ.includes(rec.buyerName.toLowerCase());

        if (matchesNum || matchesActive || matchesBuyer) {
          matchedOrders.push({
            type: 'Textile Close By PMC',
            orderNo: rec.orderNo,
            buyerName: rec.buyerName,
            teamLeader: rec.teamLeader,
            fabType: rec.fabType,
            color: rec.color || '',
            reqQty: rec.reqQty,
            greyQty: rec.greyQty,
            production: rec.production,
            knitBal: rec.knitBal,
            closedDate: rec.closedDate,
            remarks: rec.remarks
          });
        }
      }

      // 4. Check Yarn Allocations
      const matchedAllocations: any[] = [];
      for (const ya of yarnAllocations) {
        const yaOrd = String(ya.orderNumber || '');
        const matchesNum = numberMatches.some(n => yaOrd.includes(n));
        const matchesActive = Boolean(activeOrderNo && yaOrd.includes(activeOrderNo));
        const matchesBuyer = ya.buyer && lowerQ.includes(String(ya.buyer).toLowerCase());
        const matchesShade = ya.fabricShade && lowerQ.includes(String(ya.fabricShade).toLowerCase());

        if (matchesNum || matchesActive || matchesBuyer || matchesShade) {
          matchedAllocations.push(ya);
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
            items: o.items,
            color: o.items?.map(it => it.color).filter(Boolean).join(', ') || '',
            reqQty: o.reqQty,
            production: o.production,
            knitBal: o.knitBalance
          }));

      return {
        activeTab,
        activeOrderNo,
        currentUser: {
          name: currentUser?.userName || 'User',
          userType: currentUser?.userType || 'General',
          unit: currentUser?.assignedUnits?.join(', ') || 'All Units'
        },
        relevantRecords: sampleRecords,
        yarnAllocations: matchedAllocations.length > 0 ? matchedAllocations : yarnAllocations.slice(0, 30),
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

    const knittingOrders = KnittingStatusStorage.getOrders();
    const textileRecords = TextileClosePMCStorage.getRecords();
    const effectiveLedger = (Array.isArray(ledger) && ledger.length > 0) ? ledger : generateInitialLedger();

    try {
      const context = getERPContext(query);
      const historyPayload = messages.slice(-4).map(m => ({
        role: m.role,
        text: m.text
      }));

      // 1. SMART SELF-CHECK: Let Raihan check for the answer himself directly from live ERP data!
      // A. Production Ledger Check (Yesterday floor-by-floor, 7-day trend, tomorrow's forecast, missing floors)
      const prodResult = handleSmartProductionLedgerQuery(query, effectiveLedger, floors);
      if (prodResult.handled && prodResult.reply) {
        await new Promise(r => setTimeout(r, 120));
        setMessages(prev => [
          ...prev,
          {
            id: `msg-${Date.now() + 1}`,
            role: 'model',
            text: prodResult.reply!,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ]);
        setIsLoading(false);
        return;
      }

      // B. Total Knitting Balance / Production Summary Check (without specific order)
      const normalized = normalizeQueryString(query);
      const numMatches = normalized.match(/\b\d{4,8}(?:-[A-Za-z0-9-]+)?\b/g) || [];
      const lowerQ = query.toLowerCase().trim();

      const isTotalKnittingQuery = 
        (lowerQ.includes('total') && (lowerQ.includes('balance') || lowerQ.includes('knit') || lowerQ.includes('prod') || lowerQ.includes('summary'))) ||
        (lowerQ.includes('knitting balance') && !numMatches.length) ||
        (lowerQ.includes('total balance') && !numMatches.length);

      if (isTotalKnittingQuery && numMatches.length === 0) {
        const summaryResult = handleSmartSummaryQuery(query, context?.summaryStats, knittingOrders.length, activeTab);
        if (summaryResult.handled && summaryResult.reply) {
          await new Promise(r => setTimeout(r, 120));
          setMessages(prev => [
            ...prev,
            {
              id: `msg-${Date.now() + 1}`,
              role: 'model',
              text: summaryResult.reply!,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }
          ]);
          setIsLoading(false);
          return;
        }
      }

      // C. Multi-turn Order / Color / Fabric / Balance Check
      let activeOrderNum: string | null = numMatches[0] || null;
      let isFollowUp = false;
      if (!activeOrderNum && !isTotalKnittingQuery) {
        if (context?.activeOrderNo) {
          activeOrderNum = String(context.activeOrderNo);
          isFollowUp = true;
        } else {
          for (let i = historyPayload.length - 1; i >= 0; i--) {
            const histMatches = String(historyPayload[i]?.text || '').match(/\b\d{4,8}(?:-[A-Za-z0-9-]+)?\b/g);
            if (histMatches && histMatches.length > 0) {
              const candidate = histMatches[0];
              if (candidate === '2024' || candidate === '2025' || candidate === '2026') continue;
              activeOrderNum = candidate;
              isFollowUp = true;
              break;
            }
          }
        }
      }

      const orderResult = handleSmartOrderQuery(
        query,
        activeOrderNum,
        isFollowUp,
        numMatches,
        knittingOrders,
        orderPlans,
        textileRecords,
        yarnAllocations
      );
      if (orderResult.handled && orderResult.reply) {
        await new Promise(r => setTimeout(r, 120));
        setMessages(prev => [
          ...prev,
          {
            id: `msg-${Date.now() + 1}`,
            role: 'model',
            text: orderResult.reply!,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ]);
        setIsLoading(false);
        return;
      }

      // C. High-Level ERP Summary Check
      const summaryResult = handleSmartSummaryQuery(query, context?.summaryStats, knittingOrders.length, activeTab);
      if (summaryResult.handled && summaryResult.reply) {
        await new Promise(r => setTimeout(r, 120));
        setMessages(prev => [
          ...prev,
          {
            id: `msg-${Date.now() + 1}`,
            role: 'model',
            text: summaryResult.reply!,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ]);
        setIsLoading(false);
        return;
      }

      let botReply = '';

      // 2. Open-ended / General query: Try server endpoint
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);

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

        if (res.ok) {
          const contentType = res.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            const data = await res.json();
            if (data && data.reply && typeof data.reply === 'string') {
              if (!data.reply.includes('Hello! I am **Raihan**') || !data.reply.includes('Try asking me:')) {
                botReply = data.reply;
              }
            }
          }
        }
      } catch (networkErr) {
        console.info('Server chat endpoint unreachable, activating client ERP engine:', networkErr);
      }

      // 3. Fallback to client synthesis if server did not provide a distinct answer
      if (!botReply) {
        botReply = synthesizeClientERPResponse(
          query,
          historyPayload,
          context,
          knittingOrders,
          orderPlans,
          textileRecords,
          yarnAllocations,
          effectiveLedger,
          floors
        );
      }

      const botMsg: ChatMessage = {
        id: `msg-${Date.now() + 1}`,
        role: 'model',
        text: botReply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages(prev => [...prev, botMsg]);
    } catch (err: any) {
      console.warn('Raihan local fallback activation:', err?.message || err);
      // Even in the most extreme edge case, synthesize directly from stores
      const emergencyReply = synthesizeClientERPResponse(
        query,
        [],
        {},
        knittingOrders,
        orderPlans,
        textileRecords,
        yarnAllocations,
        effectiveLedger,
        floors
      );
      setMessages(prev => [
        ...prev,
        {
          id: `msg-${Date.now() + 1}`,
          role: 'model',
          text: emergencyReply,
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

  // Markdown text formatter supporting tables, bold, headings, bullets, and line breaks
  const renderFormattedText = (text: string) => {
    const lines = text.split('\n');
    const elements: React.ReactNode[] = [];
    let i = 0;

    const renderInline = (str: string) => {
      const parts = str.split(/(\*\*[^*]+\*\*)/g);
      return parts.map((part, pIdx) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={pIdx} className="font-bold text-slate-900 dark:text-white">{part.slice(2, -2)}</strong>;
        }
        return part;
      });
    };

    while (i < lines.length) {
      const line = lines[i];
      const trimmed = line.trim();

      // Check if line is start of markdown table: starts with | and contains |
      if (trimmed.startsWith('|') && trimmed.endsWith('|') && trimmed.length > 2) {
        const tableLines: string[] = [];
        while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
          tableLines.push(lines[i].trim());
          i++;
        }

        if (tableLines.length >= 2) {
          const rawHeaders = tableLines[0].slice(1, -1).split('|').map(s => s.trim());
          // Check if second line is divider (| --- | --- |)
          const isDivider = tableLines[1].replace(/[-:\s|]/g, '').length === 0;
          const dataStartIdx = isDivider ? 2 : 1;
          const dataRows = tableLines.slice(dataStartIdx).map(tl => tl.slice(1, -1).split('|').map(s => s.trim()));

          elements.push(
            <div key={`table-${i}`} className="overflow-x-auto my-2 rounded-lg border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-900/90 shadow-xs max-w-full">
              <table className="w-full text-[11px] text-left border-collapse">
                <thead className="bg-slate-100/90 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold">
                  <tr>
                    {rawHeaders.map((h, hIdx) => {
                      const isNumeric = /qty|quantity|balance|production|req|gsm|width/i.test(h);
                      const isAllocatedYarn = /allocated yarn/i.test(h);
                      return (
                        <th
                          key={hIdx}
                          className={`px-2.5 py-1.5 border-b border-slate-200 dark:border-slate-700 ${
                            isNumeric ? 'text-right whitespace-nowrap' : isAllocatedYarn ? 'text-left min-w-[130px]' : 'text-left whitespace-nowrap'
                          }`}
                        >
                          {renderInline(h)}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                  {dataRows.map((row, rIdx) => {
                    const isTotalRow = row.some(cell => cell.includes('**Total**') || cell.trim().toLowerCase() === 'total');
                    return (
                      <tr
                        key={rIdx}
                        className={isTotalRow
                          ? "bg-emerald-50/70 dark:bg-emerald-950/40 font-bold border-t-2 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white"
                          : "hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                        }
                      >
                        {row.map((cell, cIdx) => {
                          const headerText = rawHeaders[cIdx] || '';
                          const isNumeric = /qty|quantity|balance|production|req|gsm|width/i.test(headerText);
                          const isAllocatedYarn = /allocated yarn/i.test(headerText);
                          return (
                            <td
                              key={cIdx}
                              className={`px-2.5 py-1.5 ${
                                isTotalRow ? 'font-bold text-slate-900 dark:text-white' : 'text-slate-800 dark:text-slate-200'
                              } ${
                                isNumeric ? 'text-right whitespace-nowrap' : isAllocatedYarn ? 'text-left min-w-[130px] whitespace-normal' : 'text-left whitespace-nowrap'
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
          <h4 key={`h4-${i}`} className="font-semibold text-xs text-teal-700 dark:text-teal-400 mt-2.5 mb-1 flex items-center gap-1.5">
            {renderInline(trimmed.replace(/^####\s*/, ''))}
          </h4>
        );
        i++;
        continue;
      }

      // Heading 3
      if (trimmed.startsWith('### ')) {
        elements.push(
          <h3 key={`h3-${i}`} className="font-bold text-xs text-slate-900 dark:text-white mt-3 mb-1.5">
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
          <div key={`bullet-${i}`} className="flex items-start gap-1.5 my-0.5 ml-1">
            <span className="text-teal-600 dark:text-teal-400 font-bold shrink-0 mt-0.5">•</span>
            <span>{renderInline(cleanLine)}</span>
          </div>
        );
        i++;
        continue;
      }

      // Empty line
      if (!trimmed) {
        elements.push(<div key={`space-${i}`} className="h-1.5" />);
        i++;
        continue;
      }

      // Normal paragraph
      elements.push(
        <p key={`p-${i}`} className="my-0.5">
          {renderInline(trimmed)}
        </p>
      );
      i++;
    }

    return elements;
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
              setIsMinimized(false);
              setShowWelcomeCallout(false);
            }}
            className="group relative flex items-center gap-3 px-3.5 py-2.5 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white rounded-2xl shadow-xl hover:shadow-teal-500/25 transition-all duration-200 transform hover:-translate-y-0.5 cursor-pointer border border-teal-400/30 ring-2 ring-white/20"
            title="Ask Raihan · Production Guide"
          >
            <RaihanAvatar size="lg" showOnlineIndicator={true} />
            
            <div className="text-left pr-1">
              <div className="flex items-center gap-1.5 whitespace-nowrap">
                <span className="text-sm font-black tracking-tight">Ask Raihan · Production Guide</span>
              </div>
              <p className="text-[11px] text-teal-100/90 font-medium whitespace-nowrap flex items-center gap-1.5">
                <span className="text-emerald-300 text-[10px] leading-none">●</span> In-Website Data Only · Offline Safe
              </p>
            </div>
          </button>
        </div>
      )}

      {/* Minimized Dock Bar */}
      {isOpen && isMinimized && (
        <div
          id="raihan-minimized-dock"
          onClick={() => setIsMinimized(false)}
          className="fixed bottom-5 right-5 z-50 flex items-center justify-between gap-3 px-3.5 py-2.5 bg-gradient-to-r from-teal-700 via-teal-800 to-emerald-900 text-white rounded-2xl shadow-2xl border border-teal-400/40 w-80 sm:w-88 cursor-pointer hover:border-teal-300 hover:shadow-teal-500/20 transition-all duration-200 transform hover:-translate-y-0.5 animate-scale-up"
          title="Click to expand Raihan chat"
        >
          <div className="flex items-center gap-2.5">
            <RaihanAvatar size="sm" showOnlineIndicator={true} />
            <div className="text-left">
              <div className="flex items-center gap-1.5 whitespace-nowrap">
                <span className="text-xs font-black tracking-tight">Ask Raihan · Production Guide</span>
              </div>
              <p className="text-[10.5px] text-teal-100/90 font-medium flex items-center gap-1.5 whitespace-nowrap">
                <span className="text-emerald-300 text-[9px] leading-none">●</span> In-Website Data Only · Offline Safe
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setIsMinimized(false)}
              className="p-1.5 rounded-lg text-teal-100 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              title="Restore Chat"
              aria-label="Restore Chat"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                setIsMinimized(false);
                setIsMaximized(false);
              }}
              className="p-1.5 rounded-lg text-teal-100 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              title="Close Chat"
              aria-label="Close Chat"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Chat Window */}
      {isOpen && !isMinimized && (
        <div 
          id="raihan-chat-window"
          className={`fixed z-50 flex flex-col bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden transition-all duration-200 animate-scale-up ${
            isMaximized
              ? 'inset-2 sm:inset-4 md:inset-6 rounded-2xl max-w-none max-h-none border-teal-500/40'
              : 'bottom-5 right-5 w-[390px] sm:w-[480px] md:w-[520px] max-w-[calc(100vw-1.5rem)] h-[620px] max-h-[calc(100vh-3.5rem)] rounded-2xl'
          }`}
        >
          {/* Header */}
          <div className="px-4 py-3 bg-gradient-to-r from-teal-600 to-emerald-700 text-white flex items-center justify-between shadow-xs shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="relative group/avatar" title="Raihan Avatar - Hover to replace photo">
                <RaihanAvatar size="md" showOnlineIndicator={true} allowUpload={true} />
              </div>

              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="text-sm font-black tracking-tight text-white">Ask Raihan</h3>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/30 text-emerald-100 border border-emerald-400/30">
                    Production Guide
                  </span>
                  {isMaximized && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-white/20 text-white border border-white/20">
                      Full Screen
                    </span>
                  )}
                </div>
                <p className="text-[10.5px] text-teal-100 font-medium flex items-center gap-1.5">
                  <span className="text-emerald-300 text-[9px] leading-none">●</span>
                  In-Website Data Only · Offline Safe
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {/* Snipping Tool button in header */}
              <button
                type="button"
                onClick={handleSnipLatestSummary}
                className="p-1.5 rounded-lg text-teal-100 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                title="Snipping Tool · Capture HD Summary Image"
                aria-label="Snipping Tool"
              >
                <Scissors className="w-4 h-4" />
              </button>

              {/* Minimize to dock button */}
              <button
                type="button"
                onClick={() => setIsMinimized(true)}
                className="p-1.5 rounded-lg text-teal-100 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                title="Minimize chat"
                aria-label="Minimize chat"
              >
                <ChevronDown className="w-4 h-4" />
              </button>

              {/* Maximize / Full-Screen Toggle button */}
              <button
                type="button"
                onClick={() => setIsMaximized(!isMaximized)}
                className="p-1.5 rounded-lg text-teal-100 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                title={isMaximized ? "Exit Full Screen" : "Maximize to Full Screen"}
                aria-label={isMaximized ? "Exit Full Screen" : "Maximize to Full Screen"}
              >
                {isMaximized ? (
                  <Minimize2 className="w-4 h-4" />
                ) : (
                  <Maximize2 className="w-4 h-4" />
                )}
              </button>

              {/* Clear chat button */}
              <button
                type="button"
                onClick={clearChat}
                className="p-1.5 rounded-lg text-teal-100 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                title="Clear Conversation"
                aria-label="Clear Conversation"
              >
                <Trash2 className="w-4 h-4" />
              </button>

              {/* Close chat button */}
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  setIsMinimized(false);
                  setIsMaximized(false);
                }}
                className="p-1.5 rounded-lg text-teal-100 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                title="Close Chat"
                aria-label="Close Chat"
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
                    <div id={`raihan-msg-content-${msg.id}`} className="text-[12.5px] leading-relaxed">
                      {renderFormattedText(msg.text)}
                    </div>
                    <div
                      className={`flex items-center justify-between mt-2 pt-1.5 border-t border-slate-100 dark:border-slate-700/60 no-snip ${
                        isBot ? 'text-slate-400 dark:text-slate-500' : 'text-teal-100'
                      }`}
                    >
                      <span className="text-[10px]">{msg.timestamp}</span>

                      {isBot && !isWelcome && (
                        <button
                          type="button"
                          onClick={() => handleSnipMessage(msg.id, msg.text)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/70 hover:bg-teal-100 dark:hover:bg-teal-900/80 border border-teal-300/80 dark:border-teal-700/80 transition-all cursor-pointer shadow-2xs group"
                          title="Snipping Tool · Save & share clear summary image"
                        >
                          <Scissors className="w-3 h-3 text-teal-600 dark:text-teal-400 group-hover:rotate-12 transition-transform" />
                          <span>Snipping Tool</span>
                        </button>
                      )}
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

      {/* High-Definition Snipping Tool Modal */}
      <RaihanSnippingModal
        isOpen={snipModalOpen}
        onClose={() => setSnipModalOpen(false)}
        title={snipTitle}
        rawText={snipRawText}
      />
    </>
  );
};

export default RaihanChatBot;
