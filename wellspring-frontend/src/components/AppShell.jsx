import { NavLink, useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';

const NAV_ITEMS = [
  { to: '/journal', label: 'Journal' },
  { to: '/chat', label: 'Chat' },
  { to: '/growth', label: 'Growth' },
  { to: '/community', label: 'Community' },
];

export function AppShell({ children }) {
  const { theme, toggle } = useTheme();
  const { logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--paper)] font-ui">
      <header className="max-w-6xl mx-auto flex items-center justify-between px-7 py-6">
        <div className="font-display italic font-semibold text-lg">Wellspring</div>

        <nav className="hidden sm:flex gap-6 font-label text-xs uppercase tracking-wider">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                isActive ? 'text-[var(--paper)]' : 'text-[var(--mist)] hover:text-[var(--paper)] transition-colors'
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <button
            onClick={toggle}
            className="font-label text-xs font-semibold uppercase tracking-wider text-[var(--mist)] hover:text-[var(--paper)] border border-[var(--panel-border)] hover:border-[var(--panel-border-hover)] rounded-full px-4 py-2 transition-colors"
          >
            {theme === 'dark' ? '☀ Light' : '☾ Dark'}
          </button>
          <button
            onClick={() => {
              logout();
              navigate('/login');
            }}
            className="font-label text-xs uppercase tracking-wider text-[var(--mist)] hover:text-[var(--paper)] transition-colors"
          >
            Log out
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-7 pb-12">{children}</main>
    </div>
  );
}
