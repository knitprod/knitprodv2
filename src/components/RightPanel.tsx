/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { 
  BellRing, 
  Activity, 
  Heart, 
  Megaphone, 
  RefreshCw, 
  CheckCircle, 
  AlertCircle,
  Clock
} from 'lucide-react';
import { ActivityLog } from '../types';

interface RightPanelProps {
  activityLogs: ActivityLog[];
  onNotificationClick: (floorId?: string) => void;
}

export default function RightPanel({ activityLogs, onNotificationClick }: RightPanelProps) {
  
  // Announcements mock list
  const announcements = [
    {
      id: 'ann-1',
      title: 'Safety Auditing (Shift C)',
      content: 'Bi-weekly fire safety audit scheduled for 22:30 tonight on Floor EFL-2.',
      date: 'Today',
      severity: 'info',
    },
    {
      id: 'ann-2',
      title: 'Yarn Shipment Arrival',
      content: 'Fresh consignment of 30s Cotton Combed (Group A) cleared. Ready for setup.',
      date: 'Today',
      severity: 'success',
    },
    {
      id: 'ann-3',
      title: 'System Server Patching',
      content: 'Central ERP interface offline for 10 minutes at 04:00 Sunday for maintenance.',
      date: 'Yesterday',
      severity: 'warning',
    }
  ];

  // System Health details - literal and professional
  const systemHealthItems = [
    { name: 'Central Sync Server', status: 'optimal', details: 'Latency 12ms' },
    { name: 'Floor Terminals', status: 'optimal', details: '16/16 Connected' },
    { name: 'Active Shift Logs', status: 'optimal', details: 'All synced' },
  ];

  return (
    <aside className="space-y-6">
      {/* SECTION 1: System Health Indicators */}
      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-xs" id="right-panel-system-health">
        <div className="flex items-center justify-between border-b border-gray-50 pb-3">
          <div className="flex items-center gap-2">
            <Heart className="h-4.5 w-4.5 text-blue-600" />
            <h3 className="font-sans text-sm font-black text-gray-900">System Health Overview</h3>
          </div>
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600">
            <CheckCircle className="h-3 w-3" /> Fully Operational
          </span>
        </div>

        <div className="mt-4 space-y-3">
          {systemHealthItems.map((item, idx) => (
            <div key={idx} className="flex items-center justify-between rounded-xl bg-gray-50 p-2.5">
              <div className="flex flex-col">
                <span className="text-xs font-bold text-gray-800">{item.name}</span>
                <span className="text-[9px] font-semibold text-gray-400 uppercase tracking-wide">
                  {item.details}
                </span>
              </div>
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-bold text-emerald-700 uppercase tracking-wider">
                Online
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* SECTION 2: Announcements Panel */}
      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-xs" id="right-panel-announcements">
        <div className="flex items-center justify-between border-b border-gray-50 pb-3">
          <div className="flex items-center gap-2">
            <Megaphone className="h-4.5 w-4.5 text-blue-600" />
            <h3 className="font-sans text-sm font-black text-gray-900">Announcements</h3>
          </div>
          <span className="text-[10px] font-bold text-gray-400 uppercase">3 Bulletins</span>
        </div>

        <div className="mt-4 space-y-3.5">
          {announcements.map((ann) => (
            <div key={ann.id} className="relative pl-3.5 before:absolute before:left-0 before:top-1.5 before:h-1.5 before:w-1.5 before:rounded-full before:bg-blue-600">
              <h4 className="text-xs font-bold text-gray-900">{ann.title}</h4>
              <p className="mt-0.5 text-[11px] text-gray-500 leading-relaxed font-medium">
                {ann.content}
              </p>
              <span className="mt-1 block text-[8px] font-bold text-gray-400 uppercase">
                {ann.date}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* SECTION 3: Live Status & Latest Activity logs */}
      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-xs" id="right-panel-activity-logs">
        <div className="flex items-center justify-between border-b border-gray-50 pb-3">
          <div className="flex items-center gap-2">
            <Activity className="h-4.5 w-4.5 text-blue-600" />
            <h3 className="font-sans text-sm font-black text-gray-900">Latest Activity</h3>
          </div>
          <button 
            onClick={() => {}}
            className="rounded p-1 text-gray-400 hover:bg-gray-50 hover:text-gray-600"
            title="Refresh Logs"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="mt-4 space-y-4">
          {activityLogs.slice(0, 5).map((log) => (
            <button
              key={log.id}
              onClick={() => log.floorId && onNotificationClick(log.floorId)}
              className="group flex w-full items-start gap-2.5 text-left transition-colors hover:bg-gray-50/50 rounded-lg p-1.5"
            >
              {/* Badge visual indicator based on log severity */}
              <div className={`mt-0.5 flex h-2 w-2 shrink-0 rounded-full ${
                log.status === 'danger' ? 'bg-red-500' :
                log.status === 'warning' ? 'bg-amber-500' :
                log.status === 'success' ? 'bg-emerald-500' : 'bg-blue-500'
              }`} />
              
              <div className="flex-1">
                <p className="text-[11px] font-medium text-gray-700 leading-relaxed group-hover:text-gray-950 transition-colors">
                  {log.message}
                </p>
                <div className="mt-1 flex items-center justify-between text-[9px] font-bold text-gray-400 uppercase tracking-tight">
                  <span>{log.floorId?.toUpperCase() || 'GENERAL'}</span>
                  <span className="flex items-center gap-0.5">
                    <Clock className="h-2.5 w-2.5" /> {log.timestamp}
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}
