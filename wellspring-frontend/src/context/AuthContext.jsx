import { createContext, useContext, useEffect, useState } from 'react';
import { api, setToken, getToken } from '../lib/apiClient';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  // `ready` gates ProtectedRoute — without it, a page refresh with a valid
  // token would flash a redirect to /login before /me has had a chance to
  // resolve, since `user` starts null either way.
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function restore() {
      if (!getToken()) {
        setReady(true);
        return;
      }
      try {
        const me = await api.getMe();
        if (!cancelled) setUser(me);
      } catch {
        // token expired or invalid — clear it rather than leave a dead
        // token around that will keep failing on every request
        setToken(null);
      } finally {
        if (!cancelled) setReady(true);
      }
    }
    restore();
    return () => {
      cancelled = true;
    };
  }, []);

  async function login(email, password) {
    const data = await api.login(email, password);
    setToken(data.token);
    setUser(data.user);
  }

  async function register(email, password) {
    const data = await api.register(email, password);
    setToken(data.token);
    setUser(data.user);
  }

  function logout() {
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, ready, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
