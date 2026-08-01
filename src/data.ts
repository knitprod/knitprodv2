/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { FactoryFloor, KPIMetric, ActivityLog, ChartDataPoint, ProductionEntry } from './types';

export const INITIAL_FLOORS: FactoryFloor[] = [
  {
    id: 'ekl',
    name: 'EKL',
    longName: 'Epyllion Knitting Ltd (Main Floor)',
    status: 'optimal',
    targetKg: 25000,
    productionKg: 24150,
    achievementPct: 96.6,
    runningMachines: 45,
    totalMachines: 48,
    idleMachines: 3,
    efficiencyPct: 94.2,
    rejectPct: 1.4,
    lastUpdated: '10 mins ago',
  },
  {
    id: 'efl',
    name: 'EFL',
    longName: 'Epyllion Fabrics Ltd (Floor 1)',
    status: 'optimal',
    targetKg: 20000,
    productionKg: 19400,
    achievementPct: 97.0,
    runningMachines: 38,
    totalMachines: 40,
    idleMachines: 2,
    efficiencyPct: 95.1,
    rejectPct: 1.6,
    lastUpdated: '5 mins ago',
  },
  {
    id: 'efl-2',
    name: 'EFL-2',
    longName: 'Epyllion Fabrics Ltd (Floor 2)',
    status: 'warning',
    targetKg: 18000,
    productionKg: 15120,
    achievementPct: 84.0,
    runningMachines: 29,
    totalMachines: 35,
    idleMachines: 6,
    efficiencyPct: 82.8,
    rejectPct: 2.2,
    lastUpdated: '15 mins ago',
  },
  {
    id: 'auto-stripe',
    name: 'Auto Stripe',
    longName: 'Auto Stripe Knitting Division',
    status: 'optimal',
    targetKg: 12000,
    productionKg: 11520,
    achievementPct: 96.0,
    runningMachines: 18,
    totalMachines: 20,
    idleMachines: 2,
    efficiencyPct: 92.5,
    rejectPct: 1.2,
    lastUpdated: 'Just now',
  },
  {
    id: 'efl-ext',
    name: 'EFL-Extension',
    longName: 'EFL Extension Wing',
    status: 'critical',
    targetKg: 15000,
    productionKg: 10800,
    achievementPct: 72.0,
    runningMachines: 17,
    totalMachines: 25,
    idleMachines: 8,
    efficiencyPct: 69.4,
    rejectPct: 3.1,
    lastUpdated: '22 mins ago',
  },
  {
    id: 'esl-ext',
    name: 'ESL-Extension',
    longName: 'ESL Extension Knitting Unit',
    status: 'optimal',
    targetKg: 10000,
    productionKg: 9550,
    achievementPct: 95.5,
    runningMachines: 14,
    totalMachines: 16,
    idleMachines: 2,
    efficiencyPct: 91.8,
    rejectPct: 1.8,
    lastUpdated: '30 mins ago',
  },
];

export const INITIAL_KPIS = (floors: FactoryFloor[]): KPIMetric[] => {
  const totalTarget = floors.reduce((acc, f) => acc + f.targetKg, 0);
  const totalProduction = floors.reduce((acc, f) => acc + f.productionKg, 0);
  const achievementPct = Math.round((totalProduction / totalTarget) * 1000) / 10;
  const runningMachines = floors.reduce((acc, f) => acc + f.runningMachines, 0);
  const totalMachines = floors.reduce((acc, f) => acc + f.totalMachines, 0);
  const idleMachines = totalMachines - runningMachines;
  
  // Calculate average reject weighted roughly by production
  const avgReject = Math.round((floors.reduce((acc, f) => acc + (f.rejectPct * f.productionKg), 0) / totalProduction) * 100) / 100;

  return [
    {
      id: 'target',
      label: 'Target',
      value: totalTarget.toLocaleString(),
      unit: 'Kg',
      description: 'Daily combined plan',
      change: '+4.5% vs yesterday',
      isPositive: true,
      color: 'blue',
      iconName: 'Target',
    },
    {
      id: 'production',
      label: 'Production',
      value: totalProduction.toLocaleString(),
      unit: 'Kg',
      description: 'Actual knitted output',
      change: '+3.2% vs yesterday',
      isPositive: true,
      color: 'green',
      iconName: 'Layers',
    },
    {
      id: 'achievement',
      label: 'Achievement %',
      value: `${achievementPct}%`,
      description: 'Overall plan achievement',
      change: '+1.1% in last 4 hrs',
      isPositive: true,
      color: 'green',
      iconName: 'TrendingUp',
    },
    {
      id: 'running',
      label: 'Running Machines',
      value: runningMachines,
      unit: `/${totalMachines}`,
      description: 'Active knitting frames',
      change: '2 frames resumed at 13:00',
      isPositive: true,
      color: 'blue',
      iconName: 'Cpu',
    },
    {
      id: 'idle',
      label: 'Idle Machines',
      value: idleMachines,
      unit: `/${totalMachines}`,
      description: 'Machines awaiting setup/yarn',
      change: '+2 frames since 08:00',
      isPositive: false,
      color: 'orange',
      iconName: 'AlertTriangle',
    },
    {
      id: 'reject',
      label: 'Reject %',
      value: `${avgReject}%`,
      description: 'Defective fabric percentage',
      change: '-0.2% improvement',
      isPositive: true,
      color: 'red',
      iconName: 'ShieldAlert',
    },
    {
      id: 'hold',
      label: 'Hold Quantity',
      value: '420',
      unit: 'Kg',
      description: 'QA inspection hold list',
      change: '150 Kg cleared just now',
      isPositive: true,
      color: 'red',
      iconName: 'Lock',
    },
    {
      id: 'needle',
      label: 'Needle Consumption',
      value: '240',
      unit: 'Pcs',
      description: 'Replacement frequency today',
      change: 'Normal wear-and-tear rate',
      isPositive: true,
      color: 'orange',
      iconName: 'Wrench',
    },
    {
      id: 'oil',
      label: 'Oil Consumption',
      value: '180',
      unit: 'Ltr',
      description: 'Sinker & needle lubrication',
      change: 'Consistent with machine hours',
      isPositive: true,
      color: 'blue',
      iconName: 'Droplet',
    },
  ];
};

export const INITIAL_ACTIVITY_LOGS: ActivityLog[] = [
  {
    id: 'act-1',
    timestamp: '21:24',
    floorId: 'ekl',
    type: 'production',
    message: 'EKL Floor registered 1,200 Kg of Single Jersey fabric.',
    status: 'success',
  },
  {
    id: 'act-2',
    timestamp: '21:15',
    floorId: 'efl-ext',
    type: 'alert',
    message: 'Machine #24 on EFL-Extension stopped due to Lycra feed breakage.',
    status: 'danger',
  },
  {
    id: 'act-3',
    timestamp: '20:50',
    floorId: 'efl-2',
    type: 'maintenance',
    message: 'Scheduled lubrication completed for group C circular machines on EFL-2.',
    status: 'info',
  },
  {
    id: 'act-4',
    timestamp: '20:10',
    floorId: 'auto-stripe',
    type: 'production',
    message: 'Auto Stripe achieved 96% of shift target for Jacquard design #501.',
    status: 'success',
  },
  {
    id: 'act-5',
    timestamp: '19:45',
    floorId: 'efl-ext',
    type: 'alert',
    message: 'High heat detected in motor box of Machine #12 on EFL-Extension.',
    status: 'warning',
  },
  {
    id: 'act-6',
    timestamp: '19:00',
    floorId: 'esl-ext',
    type: 'system',
    message: 'Shift B Knitting Report submitted to Management Portal.',
    status: 'info',
  },
];

export const PRODUCTION_TREND_DATA: ChartDataPoint[] = [
  { label: 'Jul 04', value1: 95000, value2: 91200, value3: 1800 },
  { label: 'Jul 05', value1: 96000, value2: 94800, value3: 1550 },
  { label: 'Jul 06', value1: 97000, value2: 98100, value3: 1400 },
  { label: 'Jul 07', value1: 98000, value2: 93500, value3: 2100 },
  { label: 'Jul 08', value1: 100000, value2: 99400, value3: 1620 },
  { label: 'Jul 09', value1: 100000, value2: 101200, value3: 1350 },
  { label: 'Jul 10', value1: 100000, value2: 90540, value3: 1540 }, // Today (In Progress)
];

export const ACHIEVEMENT_TREND_DATA: ChartDataPoint[] = [
  { label: 'Jul 04', value1: 96.0 },
  { label: 'Jul 05', value1: 98.7 },
  { label: 'Jul 06', value1: 101.1 },
  { label: 'Jul 07', value1: 95.4 },
  { label: 'Jul 08', value1: 99.4 },
  { label: 'Jul 09', value1: 101.2 },
  { label: 'Jul 10', value1: 90.5 }, // Today (Ongoing)
];

export const REJECT_ANALYSIS_DATA = [
  { label: 'Yarn Defect', value1: 42 },
  { label: 'Oil Spots', value1: 25 },
  { label: 'Needle Marks', value1: 18 },
  { label: 'Lycra Fly', value1: 10 },
  { label: 'Tension Issue', value1: 5 },
];

export const SHIFT_PERFORMANCE_DATA = [
  { label: 'Shift A (06:00 - 14:00)', value1: 34000, value2: 32500 },
  { label: 'Shift B (14:00 - 22:00)', value1: 34000, value2: 33100 },
  { label: 'Shift C (22:00 - 06:00)', value1: 32000, value2: 24940 }, // Currently in Shift C
];

export const MACHINE_UTILIZATION_DATA = [
  { label: 'EKL', value1: 45, value2: 3, value3: 0 }, // Running, Idle, Maintenance
  { label: 'EFL', value1: 38, value2: 2, value3: 0 },
  { label: 'EFL-2', value1: 29, value2: 6, value3: 0 },
  { label: 'Auto Stripe', value1: 18, value2: 2, value3: 0 },
  { label: 'EFL-Ext', value1: 17, value2: 8, value3: 0 },
  { label: 'ESL-Ext', value1: 14, value2: 2, value3: 0 },
];

export const YARN_TYPES = [
  '30s Cotton Combed',
  '34s Cotton Combed',
  '40s Cotton Combed',
  '26s Cotton Carded',
  '30s Slub Yarn',
  '50D Lycra',
  '75D Lycra',
  '30s CVC (60/40)',
  '30s Grey Melange',
];

export const FABRIC_TYPES = [
  'Single Jersey',
  'Heavy Jersey',
  '1x1 Rib',
  '2x2 Rib',
  'Interlock',
  'French Terry',
  'Fleece',
  'Pique',
  'Lacoste',
];
