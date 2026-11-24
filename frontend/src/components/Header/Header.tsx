import { Bell, LogOut, RefreshCw, Search, Settings, SlidersHorizontal, X } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

interface HeaderProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onRefresh?: () => void;
  refreshing?: boolean;
  showFilterToggle?: boolean;
  filterActive?: boolean;
  onToggleFilter?: () => void;
}

export function Header({
  searchQuery,
  onSearchChange,
  onRefresh,
  refreshing = false,
  showFilterToggle = false,
  filterActive = false,
  onToggleFilter,
}: HeaderProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const initials = (user?.name || 'U')
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const handleLogout = async () => {
    setMenuOpen(false);
    await logout();
    navigate('/login');
  };

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-gray-100 bg-white px-5">

      <div className="flex flex-1 items-center gap-2.5">
        <div className="flex w-full max-w-lg items-center gap-2 rounded-full bg-[#F4F5F7] px-3.5 py-1.5 border border-transparent focus-within:border-gray-300 focus-within:bg-white transition-colors">
          <Search className="h-3.5 w-3.5 shrink-0 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search"
            className="w-full bg-transparent text-[13px] text-gray-800 placeholder-gray-400 focus:outline-none"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="text-gray-400 hover:text-gray-600"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {showFilterToggle && onToggleFilter && (
          <button
            type="button"
            onClick={onToggleFilter}
            title="Filter emails"
            className={`rounded-md p-1.5 transition-colors ${
              filterActive
                ? 'bg-[#E8F7EE] text-[#00A838]'
                : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'
            }`}
          >
            <SlidersHorizontal className="h-4 w-4" />
          </button>
        )}

        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            title="Refresh list"
            className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin text-[#00A838]' : ''}`} />
          </button>
        )}
      </div>

      <div className="relative flex items-center gap-2">
        <button
          type="button"
          onClick={() => navigate('/settings')}
          title="Slack Notifications & Settings"
          className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        >
          <Bell className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => navigate('/settings')}
          title="Settings"
          className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        >
          <Settings className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={() => setMenuOpen((prev) => !prev)}
          className="ml-1 flex items-center gap-2 rounded-full border border-gray-200 bg-white py-0.5 pl-1 pr-2.5 hover:bg-gray-50 transition-colors"
          title={user?.email}
        >
          <div className="flex h-6 w-6 items-center justify-center overflow-hidden rounded-full bg-[#00A838] text-[10px] font-semibold text-white">
            {user?.avatar ? (
              <img src={user.avatar} alt={user.name} className="h-full w-full object-cover" />
            ) : (
              initials
            )}
          </div>
          <div className="hidden text-left sm:block">
            <div className="text-[11px] font-medium leading-tight text-gray-800">
              {user?.name}
            </div>
            <div className="text-[10px] leading-tight text-gray-400">
              {user?.email}
            </div>
          </div>
        </button>

        {menuOpen && (
          <div className="absolute right-0 top-full z-30 mt-1.5 w-48 rounded-lg border border-gray-200 bg-white py-1 shadow-md">
            <div className="border-b border-gray-100 px-3 py-2">
              <div className="truncate text-xs font-semibold text-gray-900">{user?.name}</div>
              <div className="truncate text-[11px] text-gray-500">{user?.email}</div>
            </div>
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                navigate('/settings');
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
            >
              <Settings className="h-3.5 w-3.5 text-gray-400" />
              Settings
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50"
            >
              <LogOut className="h-3.5 w-3.5" />
              Logout
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
