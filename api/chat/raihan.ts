/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Vercel Serverless Function for Raihan AI Assistant
 * Endpoint: /api/chat/raihan
 */

import { GoogleGenAI } from '@google/genai';

let cachedGenAI: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI | null {
  if (cachedGenAI) return cachedGenAI;
  const key = process.env.GEMINI_API_KEY;
  if (key && key.trim()) {
    try {
      cachedGenAI = new GoogleGenAI({ apiKey: key.trim() });
      return cachedGenAI;
    } catch {
      return null;
    }
  }
  return null;
}

function sanitizeOutput(text: string): string {
  if (!text) return '';
  return text
    .replace(/supabase/gi, 'Internal ERP Database')
    .replace(/postgresql|postgres/gi, 'Factory Database')
    .replace(/https?:\/\/[^\s]+/g, '[Internal ERP link]');
}

export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, reply: 'Method not allowed' });
  }

  try {
    const { message, history, context } = req.body || {};
    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ success: false, reply: 'Please provide a valid question.' });
    }

    const trimmedMsg = message.trim();
    const lowerMsg = trimmedMsg.toLowerCase();
    const activeTab = context?.activeTab || 'Knitting Status';
    const summaryStats = context?.summaryStats || {};

    // 1. Detect order number from current message or multi-turn history
    let numMatches: string[] = trimmedMsg.match(/\b\d{4,8}(?:-[A-Za-z0-9-]+)?\b/g) || [];
    let isFollowUp = false;
    let activeOrderNum: string | null = numMatches[0] || null;

    if (!activeOrderNum) {
      if (context?.activeOrderNo) {
        activeOrderNum = String(context.activeOrderNo);
        isFollowUp = true;
      } else if (Array.isArray(history) && history.length > 0) {
        for (let i = history.length - 1; i >= 0; i--) {
          const histText = String(history[i]?.text || '');
          const histMatches = histText.match(/\b\d{4,8}(?:-[A-Za-z0-9-]+)?\b/g);
          if (histMatches && histMatches.length > 0) {
            activeOrderNum = histMatches[0];
            isFollowUp = true;
            break;
          }
        }
      }
    }

    const relevantRecords: any[] = Array.isArray(context?.relevantRecords) ? context.relevantRecords : [];
    const matchedRecord = activeOrderNum 
      ? relevantRecords.find((r: any) => String(r.orderNo || r.order_no || r.ewo || '').includes(activeOrderNum!))
      : null;

    // 2. Multi-turn Follow-up handling for active order (color, balance, fabric, team leader)
    if (isFollowUp && activeOrderNum && matchedRecord) {
      const buyer = matchedRecord.buyerName || matchedRecord.buyer || 'Epyllion Buyer';
      const items = Array.isArray(matchedRecord.items) ? matchedRecord.items : [];
      const orderColors: string[] = [];
      items.forEach((it: any) => {
        if (it.color && !orderColors.includes(it.color)) orderColors.push(it.color);
      });
      if (matchedRecord.color && !orderColors.includes(matchedRecord.color)) orderColors.push(matchedRecord.color);

      // Color inquiry
      const isColorQuery = lowerMsg.includes('color') || lowerMsg.includes('mix') || lowerMsg.includes('grey') || 
        lowerMsg.includes('black') || lowerMsg.includes('white') || lowerMsg.includes('blue') || lowerMsg.includes('red');
      if (isColorQuery) {
        const cleanSearch = lowerMsg.replace(/\bonly\b/g, '').replace(/\bcolor\b/g, '').replace(/\bwhat is\b/g, '').replace(/\bthe\b/g, '').trim();
        if (cleanSearch && cleanSearch.length >= 3 && !['what', 'tell', 'show', 'is'].includes(cleanSearch)) {
          const matchedItems = items.filter((it: any) => {
            const c = String(it.color || '').toLowerCase();
            return c.includes(cleanSearch) || cleanSearch.includes(c);
          });

          if (matchedItems.length > 0) {
            let resTxt = `For **Order #${activeOrderNum}** (${buyer}), here are the details for **${matchedItems[0].color}**:\n\n`;
            matchedItems.forEach((it: any, idx: number) => {
              resTxt += `**Item ${idx + 1}: ${it.color}**\n` +
                `• Fabric: **${it.fabType || 'Single Jersey'}** (GSM: ${it.fgsm || 'N/A'} | Dia: ${it.finishedDia || 'N/A'})\n` +
                `• Required Qty: ${Number(it.reqQty || 0).toLocaleString()} kg\n` +
                `• Grey Qty: ${Number(it.greyQty || 0).toLocaleString()} kg\n` +
                `• Production: ${Number(it.production || 0).toLocaleString()} kg\n` +
                `• Knitting Balance: **${Number(it.knitBal || 0).toLocaleString()} kg**\n\n`;
            });
            return res.status(200).json({ success: true, reply: sanitizeOutput(resTxt.trim()) });
          }

          const actualColorsStr = orderColors.length > 0 ? orderColors.map(c => `• **${c}**`).join('\n') : '• *Standard Fabric*';
          return res.status(200).json({
            success: true,
            reply: sanitizeOutput(
              `For **Order #${activeOrderNum}**, the recorded color(s) in the ERP are:\n${actualColorsStr}\n\n` +
              `*(Note: "${trimmedMsg}" was not found as an active item color under Order #${activeOrderNum}.)*`
            )
          });
        }

        if (orderColors.length > 0) {
          let resTxt = `The recorded color(s) for **Order #${activeOrderNum}** (${buyer}) are:\n\n` +
            orderColors.map(c => `• **${c}**`).join('\n');
          if (items.length > 1) {
            resTxt += `\n\n*(There are ${items.length} individual color items on this order. You can ask for a specific color like "Grey mix only" or "Black only" to see individual balances.)*`;
          }
          return res.status(200).json({ success: true, reply: sanitizeOutput(resTxt) });
        }
      }

      // Balance / quantity inquiry
      if (lowerMsg.includes('balance') || lowerMsg.includes('prod') || lowerMsg.includes('qty') || lowerMsg.includes('quantity')) {
        const req = Number(matchedRecord.reqQty || matchedRecord.target || 0);
        const grey = Number(matchedRecord.greyQty || matchedRecord.allocatedQty || 0);
        const prod = Number(matchedRecord.production || matchedRecord.knitPro || 0);
        const bal = Number(matchedRecord.knitBal || (grey - prod));

        return res.status(200).json({
          success: true,
          reply: sanitizeOutput(
            `Here is the quantity and production status for **Order #${activeOrderNum}**:\n\n` +
            `• **Required Quantity**: ${req.toLocaleString()} kg\n` +
            `• **Grey Quantity**: ${grey.toLocaleString()} kg\n` +
            `• **Current Production**: ${prod.toLocaleString()} kg\n` +
            `• **Knitting Balance**: **${bal.toLocaleString()} kg**\n` +
            `• **Status**: ${bal <= 0 ? 'Completed' : (prod > 0 ? 'Running' : 'Pending')}`
          )
        });
      }

      // Fabric inquiry
      if (lowerMsg.includes('fabric') || lowerMsg.includes('gsm') || lowerMsg.includes('width') || lowerMsg.includes('dia')) {
        return res.status(200).json({
          success: true,
          reply: sanitizeOutput(
            `Fabric specifications for **Order #${activeOrderNum}**:\n\n` +
            `• **Fabric Type**: **${matchedRecord.fabType || 'Knitted Fabric'}**\n` +
            `• **Finished GSM**: **${matchedRecord.fgsm || 'N/A'}**\n` +
            `• **Finished Width**: **${matchedRecord.fWidth || 'N/A'}**\n` +
            `• **Buyer**: **${buyer}**` +
            (orderColors.length > 0 ? `\n• **Color(s)**: ${orderColors.join(', ')}` : '')
          )
        });
      }
    }

    // 3. Explicit Order Number Requested in Current Message
    if (numMatches.length > 0) {
      const targetNum = numMatches[0];
      const found = relevantRecords.find((r: any) => String(r.orderNo || r.order_no || r.ewo || '').includes(targetNum));
      if (found) {
        let report = `Here is the verified information for **Order #${targetNum}**:\n\n` +
          `• **Buyer**: **${found.buyerName || found.buyer || 'Epyllion'}**\n` +
          `• **Team Leader**: **${found.teamLeader || 'Unassigned'}**\n` +
          `• **Fabric Type**: **${found.fabType || 'Knitted Fabric'}**\n` +
          `• **Finished GSM**: **${found.fgsm || 'N/A'}** | **Finished Width**: **${found.fWidth || 'N/A'}**\n` +
          `• **Required Qty**: ${Number(found.reqQty || 0).toLocaleString()} kg\n` +
          `• **Grey Qty**: ${Number(found.greyQty || 0).toLocaleString()} kg\n` +
          `• **Current Production**: ${Number(found.production || 0).toLocaleString()} kg\n` +
          `• **Knitting Balance**: **${Number(found.knitBal || 0).toLocaleString()} kg**\n`;

        if (Array.isArray(found.items) && found.items.length > 0) {
          report += `\n**Color & Fabric Breakdown (${found.items.length} items):**\n`;
          found.items.forEach((it: any, i: number) => {
            report += `${i + 1}. **${it.color || 'Color ' + (i + 1)}**: Balance **${Number(it.knitBal || 0).toLocaleString()} kg** (Req: ${Number(it.reqQty || 0).toLocaleString()} kg | Grey: ${Number(it.greyQty || 0).toLocaleString()} kg)\n`;
          });
        }
        return res.status(200).json({ success: true, reply: sanitizeOutput(report) });
      }
    }

    // 4. Summary query
    if (lowerMsg.includes('total') || lowerMsg.includes('summary') || (lowerMsg.includes('balance') && !lowerMsg.includes('order'))) {
      const reply = `Here is the current **ERP dataset summary**:\n` +
        `• **Active Tab**: ${activeTab}\n` +
        `• **Total Orders**: ${(summaryStats.totalOrders || 0).toLocaleString()}\n` +
        `• **Total Required Qty**: ${(summaryStats.totalReqQty || 0).toLocaleString()} kg\n` +
        `• **Total Production**: ${(summaryStats.totalProduction || 0).toLocaleString()} kg\n` +
        `• **Total Knit Balance**: ${(summaryStats.totalKnitBal || 0).toLocaleString()} kg\n\n` +
        `You can ask me for details on any specific Order Number (e.g., *272277*), Buyer, or Fabric!`;
      return res.status(200).json({ success: true, reply: sanitizeOutput(reply) });
    }

    // 5. Try Gemini if API key is provided
    const ai = getGenAI();
    if (ai) {
      try {
        const contents: any[] = [];
        if (Array.isArray(history) && history.length > 0) {
          history.slice(-4).forEach((h: any) => {
            if (h.text && (h.role === 'user' || h.role === 'model')) {
              contents.push({ role: h.role, parts: [{ text: String(h.text) }] });
            }
          });
        }
        contents.push({
          role: 'user',
          parts: [{
            text: `ERP DATA CONTEXT: ${JSON.stringify({ activeTab, relevantRecords: relevantRecords.slice(0, 10), summaryStats })}\n\nUSER QUESTION: ${trimmedMsg}`
          }]
        });

        const geminiRes = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents,
          config: {
            systemInstruction: 'You are Raihan, internal ERP assistant for Epyllion Knitex Ltd. Answer strictly from the provided ERP context.',
            temperature: 0.2
          }
        });

        if (geminiRes.text) {
          return res.status(200).json({ success: true, reply: sanitizeOutput(geminiRes.text) });
        }
      } catch {}
    }

    // 6. Helpful default prompt
    return res.status(200).json({
      success: true,
      reply: sanitizeOutput(
        `Hello! I am **Raihan**, your internal Epyllion Knitex ERP assistant.\n` +
        `I answer questions directly from the operational data within this website (Knitting Status, Order Plans, Textile Close By PMC, and Production Records).\n\n` +
        `Try asking me:\n` +
        `• *"What is the information for 272277?"*\n` +
        `• *"Show fabric details and knitting balance for Order [Number]"*\n` +
        `• *"Give me a summary of total balance and production"*`
      )
    });
  } catch (err: any) {
    return res.status(200).json({
      success: true,
      reply: "Hello! I am Raihan. Please provide an Order Number or ask about fabric, floor production, or knitting balance."
    });
  }
}
