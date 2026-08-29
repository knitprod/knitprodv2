/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Floating Back-to-Top Action Button
 * Provides quick, smooth scroll-to-top navigation when scrolled down
 */

import React, { useState, useEffect } from 'react';
import { ArrowUp } from 'lucide-react';
import { FilterState } from './DashboardFilterToolbar';
import { FactoryFloor } from '../types';

interface FloatingKPIAndFilterHUDProps {
  floors?: FactoryFloor[];
  filterState?: FilterState;
  onApplyFilters?: (filters: FilterState) => void;
  onResetFilters?: () => void;
  targetAnchorId?: string;
}

export default function FloatingKPIAndFilterHUD({
  targetAnchorId = 'dashboard-filter-toolbar'
}: FloatingKPIAndFilterHUDProps) {
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const anchor = document.getElementById(targetAnchorId);
      if (anchor) {
        const rect = anchor.getBoundingClientRect();
        if (rect.bottom < 50) {
          setShowScrollTop(true);
        } else {
          setShowScrollTop(false);
        }
      } else {
        if (window.scrollY > 280) {
          setShowScrollTop(true);
        } else {
          setShowScrollTop(false);
        }
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [targetAnchorId]);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (!showScrollTop) {
    return null;
  }

  return (
    <aside 
      aria-label="Scroll to top"
      className="fixed bottom-6 right-6 z-50 animate-fade-in"
    >
      <button
        type="button"
        onClick={scrollToTop}
        className="group flex items-center gap-2 rounded-full bg-[#0F4C81] hover:bg-[#0c3c66] dark:bg-blue-600 dark:hover:bg-blue-500 text-white px-4 py-2.5 shadow-xl hover:shadow-2xl transition-all duration-200 cursor-pointer border border-white/20 active:scale-95"
        title="Go back to top"
      >
        <ArrowUp className="h-4 w-4 transition-transform group-hover:-translate-y-0.5" />
        <span className="text-xs font-bold tracking-wider uppercase">Top</span>
      </button>
    </aside>
  );
}
