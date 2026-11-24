import React, { useEffect, useState } from 'react';
import { emailService } from '../services/emailService';
import { DashboardStats } from '../types';
import { Sidebar } from '../components/Sidebar/Sidebar';

interface DashboardLayoutProps {
  children: React.ReactNode;
  statsRefreshTrigger?: number;
}

export function DashboardLayout({ children, statsRefreshTrigger = 0 }: DashboardLayoutProps) {
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    emailService
      .getDashboardStats()
      .then(setStats)
      .catch(() => {});
  }, [statsRefreshTrigger]);

  return (
    <div className="flex min-h-screen bg-white text-gray-900">
      <Sidebar stats={stats} />
      <main className="flex min-w-0 flex-1 flex-col bg-white">{children}</main>
    </div>
  );
}
