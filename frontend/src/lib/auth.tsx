import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

interface AuthContextValue {
  /** undefined while the session check runs. */
  email: string | null | undefined;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// The session is an HttpOnly cookie set by the server after Google sign-in
// (/auth/login). Same-origin fetches send it, so no header handling is needed.
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [email, setEmail] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    fetch('/auth/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => setEmail(body?.email ?? null))
      .catch(() => setEmail(null));
  }, []);

  const logout = useCallback(async () => {
    const res = await fetch('/auth/logout', { method: 'POST' });
    if (!res.ok) {
      throw new Error(`Sign-out failed (HTTP ${res.status})`);
    }
    setEmail(null);
  }, []);

  return (
    <AuthContext.Provider value={{ email, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
