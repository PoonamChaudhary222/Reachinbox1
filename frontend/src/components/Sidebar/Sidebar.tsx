import {
  ChevronDown,
  Clock,
  Inbox,
  LogOut,
  Send,
  Settings,
} from 'lucide-react';
import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { DashboardStats } from '../../types';

interface SidebarProps {
  stats: DashboardStats | null;
}

export function Sidebar({ stats }: SidebarProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);

  const initials = (user?.name || 'U')
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <aside className="flex w-[228px] shrink-0 flex-col border-r border-gray-200 bg-white px-3.5 py-4 select-none">
      {/* Brand mark matching Figma top-left */}
      <div className="mb-4 flex items-center gap-2 px-1">
        <div className="flex h-7 items-center rounded bg-gray-900 px-2 text-xs font-extrabold tracking-tight text-white">
          REACHINBOX
        </div>
      </div>

      {/* User Profile Card / Dropdown */}
      <div className="relative mb-3">
        <button
          type="button"
          onClick={() => setAccountMenuOpen((prev) => !prev)}
          className="flex w-full items-center justify-between rounded-lg bg-[#F7F8FA] px-2.5 py-2 text-left hover:bg-gray-100 transition-colors"
        >
          <div className="flex min-w-0 items-center gap-2.5">
            {user?.avatar ? (
              <img
                src={user.avatar}
                alt={user.name}
                className="h-7 w-7 shrink-0 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#00A838] text-[11px] font-semibold text-white">
                {initials}
              </div>
            )}
            <div className="min-w-0">
              <div className="truncate text-[12px] font-semibold text-gray-900">
                {user?.name || 'Account'}
              </div>
              <div className="truncate text-[11px] text-gray-500">
                {user?.email || ''}
              </div>
            </div>
          </div>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-gray-400" />
        </button>

        {accountMenuOpen && (
          <div className="absolute left-0 right-0 top-full z-20 mt-1 rounded-lg border border-gray-200 bg-white py-1 shadow-sm">
            <button
              type="button"
              onClick={() => {
                setAccountMenuOpen(false);
                navigate('/settings');
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
            >
              <Settings className="h-3.5 w-3.5 text-gray-400" />
              Account Settings
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

      {/* Compose Button matching Figma green outline pill */}
      <button
        type="button"
        onClick={() => navigate('/compose')}
        className="mb-5 w-full rounded-full border border-[#00A838] bg-white py-1.5 text-[13px] font-medium text-[#00A838] hover:bg-[#E8F7EE] transition-colors"
      >
        Compose
      </button>

      {/* CORE Navigation */}
      <div className="mb-1.5 px-2 text-[10px] font-semibold tracking-wider text-gray-400 uppercase">
        CORE
      </div>

      <nav className="flex flex-1 flex-col gap-0.5">
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            `flex items-center justify-between rounded-lg px-2.5 py-2 text-[13px] transition-colors ${
              isActive
                ? 'bg-[#E8F7EE] font-medium text-gray-900'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`
          }
        >
          {({ isActive }) => (
            <>
              <span className="flex items-center gap-2.5">
                <Inbox
                  className={`h-4 w-4 ${isActive ? 'text-[#00A838]' : 'text-gray-400'}`}
                />
                All Emails
              </span>
              <span className="text-[11px] font-medium text-gray-500">
                {stats?.total ?? 0}
              </span>
            </>
          )}
        </NavLink>

        <NavLink
          to="/scheduled"
          className={({ isActive }) =>
            `flex items-center justify-between rounded-lg px-2.5 py-2 text-[13px] transition-colors ${
              isActive
                ? 'bg-[#E8F7EE] font-medium text-gray-900'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`
          }
        >
          {({ isActive }) => (
            <>
              <span className="flex items-center gap-2.5">
                <Clock
                  className={`h-4 w-4 ${isActive ? 'text-[#00A838]' : 'text-gray-400'}`}
                />
                Scheduled
              </span>
              <span className="text-[11px] font-medium text-gray-500">
                {stats?.scheduled ?? 0}
              </span>
            </>
          )}
        </NavLink>

        <NavLink
          to="/sent"
          className={({ isActive }) =>
            `flex items-center justify-between rounded-lg px-2.5 py-2 text-[13px] transition-colors ${
              isActive
                ? 'bg-[#E8F7EE] font-medium text-gray-900'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`
          }
        >
          {({ isActive }) => (
            <>
              <span className="flex items-center gap-2.5">
                <Send
                  className={`h-4 w-4 ${isActive ? 'text-[#00A838]' : 'text-gray-400'}`}
                />
                Sent
              </span>
              <span className="text-[11px] font-medium text-gray-500">
                {stats?.sentAndFailed ?? 0}
              </span>
            </>
          )}
        </NavLink>

        <div className="mt-4 border-t border-gray-100 pt-3">
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              `flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] transition-colors ${
                isActive
                  ? 'bg-[#E8F7EE] font-medium text-gray-900'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Settings
                  className={`h-4 w-4 ${isActive ? 'text-[#00A838]' : 'text-gray-400'}`}
                />
                Settings
              </>
            )}
          </NavLink>
        </div>
      </nav>
    </aside>
  );
}
