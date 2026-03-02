import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';

interface AuthState {
  username: string;
  password: string;
}

interface AuthContextValue {
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// Module-level ref so the urql client can read the auth header
// without needing React context
let _authHeader: string | null = null;

export function getAuthHeader(): string | null {
  return _authHeader;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [credentials, setCredentials] = useState<AuthState | null>(() => {
    const stored = sessionStorage.getItem('kent-auth');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        return null;
      }
    }
    return null;
  });

  // Keep the module-level ref in sync
  useEffect(() => {
    if (credentials) {
      _authHeader = 'Basic ' + btoa(`${credentials.username}:${credentials.password}`);
    } else {
      _authHeader = null;
    }
  }, [credentials]);

  const login = useCallback(async (username: string, password: string) => {
    const header = 'Basic ' + btoa(`${username}:${password}`);

    // Test credentials by calling the stats query (lightweight, requires no auth
    // but we'll verify the server accepts the header with an admin query)
    const res = await fetch('/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': header,
      },
      body: JSON.stringify({
        query: '{ stats { lineageCount } }',
      }),
    });

    if (!res.ok) {
      throw new Error('Invalid credentials');
    }

    const json = await res.json();
    if (json.errors) {
      throw new Error(json.errors[0]?.message || 'Authentication failed');
    }

    const state: AuthState = { username, password };
    sessionStorage.setItem('kent-auth', JSON.stringify(state));
    setCredentials(state);
  }, []);

  const logout = useCallback(() => {
    sessionStorage.removeItem('kent-auth');
    setCredentials(null);
    _authHeader = null;
  }, []);

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated: credentials !== null,
        login,
        logout,
      }}
    >
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
