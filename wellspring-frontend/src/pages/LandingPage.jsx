import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export function LandingPage() {
  const { user } = useAuth();
  const { theme, toggle } = useTheme();

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--paper)] font-ui overflow-hidden relative">
      {/* Dynamic Glowing Background Blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-[radial-gradient(circle,rgba(79,209,181,0.15)_0%,transparent_70%)] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[60vw] h-[60vw] rounded-full bg-[radial-gradient(circle,rgba(242,184,114,0.12)_0%,transparent_70%)] pointer-events-none" />

      {/* Header */}
      <header className="max-w-6xl mx-auto flex items-center justify-between px-7 py-6 relative z-10">
        <div className="font-display italic font-semibold text-2xl tracking-tight text-[var(--paper)]">
          Wellspring
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={toggle}
            className="font-label text-xs font-semibold uppercase tracking-wider text-[var(--mist)] hover:text-[var(--paper)] border border-[var(--panel-border)] hover:border-[var(--panel-border-hover)] rounded-full px-4 py-2 transition-all duration-300"
          >
            {theme === 'dark' ? '☀ Light' : '☾ Dark'}
          </button>
          {user ? (
            <Link
              to="/journal"
              className="font-label text-xs font-semibold uppercase tracking-wider bg-[var(--glow-amber)] text-[var(--bg)] rounded-full px-5 py-2.5 hover:opacity-90 transition-all duration-300 shadow-sm"
            >
              Open App
            </Link>
          ) : (
            <Link
              to="/login"
              className="font-label text-xs font-semibold uppercase tracking-wider text-[var(--mist)] hover:text-[var(--paper)] transition-all duration-300"
            >
              Sign In
            </Link>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-4xl mx-auto px-7 pt-20 pb-16 text-center relative z-10">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--chip-bg)] border border-[var(--panel-border)] mb-8 animate-fade-in">
          <span className="w-2 h-2 rounded-full bg-[var(--line-teal)] animate-pulse" />
          <span className="font-label text-[10.5px] font-semibold uppercase tracking-wide text-[var(--mist)]">
            A Daily Sanctuary for the Mind
          </span>
        </div>

        <h1 className="font-display italic text-5xl md:text-7xl font-semibold leading-[1.1] mb-6 tracking-tight text-[var(--paper)]">
          Your thoughts, <br className="hidden sm:inline" />
          <span className="bg-gradient-to-r from-[var(--line-teal)] to-[var(--glow-amber)] bg-clip-text text-transparent">
            unravelled gently.
          </span>
        </h1>

        <p className="text-lg md:text-xl text-[var(--mist)] font-ui leading-relaxed max-w-2xl mx-auto mb-10">
          A reflective journaling companion built with secure memory retrieval, tailored prompts, and a dedicated safety companion layer.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          {user ? (
            <Link
              to="/journal"
              className="w-full sm:w-auto font-label text-xs font-semibold uppercase tracking-wider bg-[var(--glow-amber)] text-[var(--bg)] rounded-full px-8 py-4 hover:scale-[1.03] transition-all duration-300 shadow-md text-center"
            >
              Go to Journal
            </Link>
          ) : (
            <>
              <Link
                to="/register"
                className="w-full sm:w-auto font-label text-xs font-semibold uppercase tracking-wider bg-[var(--glow-amber)] text-[var(--bg)] rounded-full px-8 py-4 hover:scale-[1.03] transition-all duration-300 shadow-md text-center"
              >
                Get Started
              </Link>
              <Link
                to="/login"
                className="w-full sm:w-auto font-label text-xs font-semibold uppercase tracking-wider border border-[var(--panel-border)] hover:border-[var(--panel-border-hover)] rounded-full px-8 py-4 text-[var(--paper)] hover:bg-[var(--surface-active)] transition-all duration-300 text-center"
              >
                Sign In
              </Link>
            </>
          )}
        </div>
      </main>

      {/* Features Grid */}
      <section className="max-w-6xl mx-auto px-7 py-20 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Feature 1 */}
          <div className="bg-[var(--surface)] border border-[var(--panel-border)] rounded-[24px] p-8 hover:-translate-y-1 hover:border-[var(--panel-border-hover)] transition-all duration-300 group">
            <div className="w-10 h-10 rounded-full bg-[var(--chip-bg)] flex items-center justify-center mb-6 border border-[var(--panel-border)] group-hover:bg-[var(--surface-active)] transition-colors duration-300">
              <span className="text-[var(--line-teal)] text-lg">✍</span>
            </div>
            <h3 className="font-display italic text-xl font-semibold mb-3 text-[var(--paper)]">
              Reflective Journaling
            </h3>
            <p className="text-sm leading-relaxed text-[var(--mist)]">
              Record your daily thoughts in an immutable digital canvas. Select your current mood state along our organic sliding scale.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="bg-[var(--surface)] border border-[var(--panel-border)] rounded-[24px] p-8 hover:-translate-y-1 hover:border-[var(--panel-border-hover)] transition-all duration-300 group">
            <div className="w-10 h-10 rounded-full bg-[var(--chip-bg)] flex items-center justify-center mb-6 border border-[var(--panel-border)] group-hover:bg-[var(--surface-active)] transition-colors duration-300">
              <span className="text-[var(--glow-amber)] text-lg">✦</span>
            </div>
            <h3 className="font-display italic text-xl font-semibold mb-3 text-[var(--paper)]">
              Companion Chat
            </h3>
            <p className="text-sm leading-relaxed text-[var(--mist)]">
              Chat with a companion that is dynamically grounded in your journal entries to help you recognize thought patterns over time.
            </p>
          </div>

          {/* Feature 3 */}
          <div className="bg-[var(--surface)] border border-[var(--panel-border)] rounded-[24px] p-8 hover:-translate-y-1 hover:border-[var(--panel-border-hover)] transition-all duration-300 group">
            <div className="w-10 h-10 rounded-full bg-[var(--chip-bg)] flex items-center justify-center mb-6 border border-[var(--panel-border)] group-hover:bg-[var(--surface-active)] transition-colors duration-300">
              <span className="text-[var(--line-teal)] text-lg">⚛</span>
            </div>
            <h3 className="font-display italic text-xl font-semibold mb-3 text-[var(--paper)]">
              Interactive Growth
            </h3>
            <p className="text-sm leading-relaxed text-[var(--mist)]">
              Explore a responsive Three.js phyllotaxis node map of your mental state, visually mapping the themes and connections you discover.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="max-w-6xl mx-auto px-7 py-12 border-t border-[var(--divider)] relative z-10 text-center sm:text-left flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="font-label text-xs text-[var(--mist)]">
          &copy; {new Date().getFullYear()} Wellspring. All rights reserved.
        </div>
        <div className="flex gap-6 font-label text-xs text-[var(--mist)]">
          <span className="hover:text-[var(--paper)] cursor-pointer transition-colors duration-200">Privacy</span>
          <span className="hover:text-[var(--paper)] cursor-pointer transition-colors duration-200">Terms</span>
          <span className="hover:text-[var(--paper)] cursor-pointer transition-colors duration-200">Support</span>
        </div>
      </footer>
    </div>
  );
}
