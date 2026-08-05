import { useContext } from 'react';
import { DashboardStatsContext } from '../contexts/DashboardStatsContext';

export function useDashboardStats() {
  const context = useContext(DashboardStatsContext);
  if (!context) {
    throw new Error('useDashboardStats must be used within a DashboardStatsProvider');
  }
  return context;
}

export type { BankStats, GlobalStats } from '../contexts/DashboardStatsContext';
