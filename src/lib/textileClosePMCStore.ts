/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Epyllion Knitex Ltd. - Textile Close By PMC Data Store & Helpers
 * Managing textile orders & fabric items officially signed off / closed by PMC
 */

import { TextileCloseRecord, KnittingStatusOrder } from '../types';
import * as XLSX from 'xlsx';

const STORAGE_KEY = 'epyllion_textile_close_pmc_v1';

export const INITIAL_TEXTILE_CLOSE_RECORDS: TextileCloseRecord[] = [
  {
    id: 'tc-pmc-271891-1',
    status: 'Textile Close By PMC',
    orderNo: '271891',
    buyerName: 'S.Oliver',
    teamLeader: 'Shahidul Islam',
    fgsm: 220,
    fWidth: '64" Tube',
    color: 'Olive Green',
    fabType: '100% Cotton 1x1 Rib',
    reqQty: 1200,
    greyQty: 1220,
    production: 1220,
    knitBal: 0,
    closedDate: '22-Aug-2026',
    remarks: 'PMC Full Sign-off • Quality Approved'
  },
  {
    id: 'tc-pmc-271891-2',
    status: 'Textile Close By PMC',
    orderNo: '271891',
    buyerName: 'S.Oliver',
    teamLeader: 'Shahidul Islam',
    fgsm: 240,
    fWidth: '70" Open',
    color: 'Dark Olive',
    fabType: 'Drop Needle Interlock',
    reqQty: 1250,
    greyQty: 1260,
    production: 1260,
    knitBal: 0,
    closedDate: '28-Aug-2026',
    remarks: 'PMC Full Sign-off • Completed on Schedule'
  },
  {
    id: 'tc-pmc-260796-1',
    status: 'Textile Close By PMC',
    orderNo: '260796',
    buyerName: 'H&M',
    teamLeader: 'Masud Rana',
    fgsm: 160,
    fWidth: '72" Open',
    color: 'Black',
    fabType: '100% Cotton Single Jersey',
    reqQty: 2700,
    greyQty: 2745,
    production: 2745,
    knitBal: 0,
    closedDate: '15-Aug-2026',
    remarks: 'PMC Approved • Zero Balance Reached'
  },
  {
    id: 'tc-pmc-260796-2',
    status: 'Textile Close By PMC',
    orderNo: '260796',
    buyerName: 'H&M',
    teamLeader: 'Masud Rana',
    fgsm: 160,
    fWidth: '72" Open',
    color: 'White',
    fabType: '100% Cotton Single Jersey',
    reqQty: 2700,
    greyQty: 2745,
    production: 2743,
    knitBal: 2,
    closedDate: '18-Aug-2026',
    remarks: 'PMC Signed Off • 2 Kg Shortage Accepted'
  },
  {
    id: 'tc-pmc-271895-1',
    status: 'Textile Close By PMC',
    orderNo: '271895',
    buyerName: 'Zara (Inditex)',
    teamLeader: 'Kabir Hossain',
    fgsm: 180,
    fWidth: '70" Open',
    color: 'Coral Red',
    fabType: '95/5 Cotton Elastane S/J',
    reqQty: 1600,
    greyQty: 1630,
    production: 1630,
    knitBal: 0,
    closedDate: '29-Aug-2026',
    remarks: 'PMC Audit Passed • Full Delivery Ready'
  },
  {
    id: 'tc-pmc-269874-1',
    status: 'Textile Close By PMC',
    orderNo: '269874',
    buyerName: 'Next UK',
    teamLeader: 'Tanvir Ahmed',
    fgsm: 260,
    fWidth: '74" Open',
    color: 'Charcoal Melange',
    fabType: 'Cotton Poly French Terry',
    reqQty: 3400,
    greyQty: 3470,
    production: 3470,
    knitBal: 0,
    closedDate: '20-Aug-2026',
    remarks: 'PMC Final Release Authorized'
  },
  {
    id: 'tc-pmc-268420-1',
    status: 'Textile Close By PMC',
    orderNo: '268420',
    buyerName: 'M&S',
    teamLeader: 'Masud Rana',
    fgsm: 190,
    fWidth: '68" Open',
    color: 'Sage Green',
    fabType: '100% Organic Cotton S/J',
    reqQty: 2100,
    greyQty: 2140,
    production: 2140,
    knitBal: 0,
    closedDate: '24-Aug-2026',
    remarks: 'PMC Compliance Verified'
  },
  {
    id: 'tc-pmc-267512-1',
    status: 'Textile Close By PMC',
    orderNo: '267512',
    buyerName: 'Puma',
    teamLeader: 'Shahidul Islam',
    fgsm: 200,
    fWidth: '72" Open',
    color: 'Electric Blue',
    fabType: '100% Polyester Birds Eye Mesh',
    reqQty: 2800,
    greyQty: 2850,
    production: 2850,
    knitBal: 0,
    closedDate: '27-Aug-2026',
    remarks: 'PMC Closed • Batch Dispatched'
  }
];

export class TextileClosePMCStorage {
  static getRecords(): TextileCloseRecord[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Could not read Textile Close By PMC from localStorage', e);
    }
    this.saveRecords(INITIAL_TEXTILE_CLOSE_RECORDS);
    return INITIAL_TEXTILE_CLOSE_RECORDS;
  }

  static saveRecords(records: TextileCloseRecord[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    } catch (e) {
      console.warn('Could not save Textile Close By PMC to localStorage', e);
    }
  }

  static resetToDefault(): TextileCloseRecord[] {
    this.saveRecords(INITIAL_TEXTILE_CLOSE_RECORDS);
    return INITIAL_TEXTILE_CLOSE_RECORDS;
  }

  /**
   * Helper to parse flexible Excel rows into TextileCloseRecord items
   */
  static parseExcelRows(rows: any[]): TextileCloseRecord[] {
    const records: TextileCloseRecord[] = [];

    const getVal = (row: any, keys: string[]): any => {
      const rowKeys = Object.keys(row);
      for (const k of keys) {
        const cleanK = k.toLowerCase().replace(/[\s\n_.-]/g, '');
        const foundKey = rowKeys.find(
          rk => rk.toLowerCase().replace(/[\s\n_.-]/g, '') === cleanK
        );
        if (foundKey && row[foundKey] !== undefined && row[foundKey] !== null) {
          const v = row[foundKey];
          if (typeof v === 'string') {
            const trimmed = v.trim();
            if (trimmed !== '') return trimmed;
          } else {
            return v;
          }
        }
      }
      return '';
    };

    rows.forEach((row, idx) => {
      const orderNo = String(getVal(row, ['Order No.', 'Order No', 'Order #', 'Order', 'EWO', 'Order_No']) || '').trim();
      if (!orderNo) return;

      const rawStatus = String(getVal(row, ['Status', 'PMC Status', 'Close Status', 'Order Status', 'State']) || '').trim();
      const status = rawStatus || 'Textile Close By PMC';

      const buyerName = String(getVal(row, ['Buyer Name', 'Buyer', 'Customer']) || '').trim();
      const teamLeader = String(getVal(row, ['Team Leader', 'TeamLeader', 'Leader', 'TL']) || '').trim();
      
      const rawFgsm = getVal(row, ['FGSM', 'Finish GSM', 'F.GSM', 'GSM']);
      const fgsm = rawFgsm !== '' && !isNaN(Number(rawFgsm)) ? Number(rawFgsm) : String(rawFgsm || '').trim();

      const fWidth = String(getVal(row, ['F. Width', 'Finish Width', 'F Width', 'Width', 'Dia']) || '').trim();
      const color = String(getVal(row, ['Color', 'Fabric Color', 'Colour', 'Shade']) || '').trim();
      const fabType = String(getVal(row, ['Fab. Type', 'Fabric Type', 'Fab Type', 'Fabric', 'Item Description']) || '').trim();

      const rawReq = getVal(row, ['Req QTY', 'Req. Qty', 'Req Qty', 'Required Qty', 'ReqQty', 'Rq Qty']);
      const reqQty = rawReq !== '' && !isNaN(Number(rawReq)) ? Number(rawReq) : 0;

      const rawGrey = getVal(row, ['Grey QTY', 'Grey Qty', 'GreyQty', 'Grey Fab Qty']);
      const greyQty = rawGrey !== '' && !isNaN(Number(rawGrey)) ? Number(rawGrey) : 0;

      const rawProd = getVal(row, ['Production', 'Knitting Prod', 'Prod Qty', 'Total Prod', 'Prod']);
      const production = rawProd !== '' && !isNaN(Number(rawProd)) ? Number(rawProd) : 0;

      const rawBal = getVal(row, ['Knit Bal', 'Knit Balance', 'Balance Qty', 'Balance', 'Bal']);
      const knitBal = rawBal !== '' && !isNaN(Number(rawBal)) ? Number(rawBal) : Math.max(0, greyQty - production);

      records.push({
        id: `tc-pmc-${orderNo}-${idx}-${Date.now()}`,
        status,
        orderNo,
        buyerName,
        teamLeader,
        fgsm,
        fWidth,
        color,
        fabType,
        reqQty,
        greyQty,
        production,
        knitBal,
        updatedAt: new Date().toISOString()
      });
    });

    return records;
  }

  /**
   * Export records with the EXACT 12 column headers specified:
   * Status, Order No., Buyer Name, Team Leader, FGSM, F. Width, Color, Fab. Type, Req QTY, Grey QTY, Production, Knit Bal
   */
  static exportToExcel(records: TextileCloseRecord[]): void {
    const exportData = records.map(r => ({
      'Status': r.status,
      'Order No.': r.orderNo,
      'Buyer Name': r.buyerName,
      'Team Leader': r.teamLeader,
      'FGSM': r.fgsm,
      'F. Width': r.fWidth,
      'Color': r.color,
      'Fab. Type': r.fabType,
      'Req QTY': r.reqQty,
      'Grey QTY': r.greyQty,
      'Production': r.production,
      'Knit Bal': r.knitBal
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Textile Close By PMC');

    const filename = `Textile_Close_By_PMC_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(workbook, filename);
  }
}
