import { Mail } from 'lucide-react';
import React from 'react';

interface EmptyStateProps {
  title: string;
  description: string;
  action?: React.ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-gray-50 border border-gray-200 text-gray-400">
        <Mail className="h-5 w-5" />
      </div>
      <h3 className="text-sm font-medium text-gray-900">{title}</h3>
      <p className="mt-1 max-w-sm text-xs text-gray-500">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
