import React, { useEffect, useState } from 'react';
import { api, getToken, setToken } from './api';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';

export default function App() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);

  // On load, if a token is already saved, verify it and restore the session.
  useEffect(() => {
    (async () => {
      const token = getToken();
      if (!token) {
        setChecking(false);
        return;
      }
      try {
        const { user: me } = await api.me();
        setUser(me);
      } catch {
        setToken(null);
      } finally {
        setChecking(false);
      }
    })();
  }, []);

  function handleLogout() {
    setToken(null);
    setUser(null);
  }

  if (checking) return null;

  if (!user) return <Login onLoggedIn={setUser} />;

  if (user.role !== 'manager') {
    return (
      <div className="login-shell">
        <div className="login-card">
          <h1 className="login-title">Worklog</h1>
          <p className="login-sub">
            This dashboard is for managers. Use the mobile app to log your own hours.
          </p>
          <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleLogout}>
            Log out
          </button>
        </div>
      </div>
    );
  }

  return <Dashboard user={user} onLogout={handleLogout} />;
}
