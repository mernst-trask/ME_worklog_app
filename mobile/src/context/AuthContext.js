import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, setAuthToken } from '../api';

const AuthContext = createContext(null);
const STORAGE_KEY = 'worklog_auth';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // On app start, restore a saved session so the worker doesn't have to log in every time.
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const { token, user: savedUser } = JSON.parse(raw);
          setAuthToken(token);
          setUser(savedUser);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function login(email, password) {
    const { token, user: loggedInUser } = await api.login(email, password);
    setAuthToken(token);
    setUser(loggedInUser);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ token, user: loggedInUser }));
  }

  async function logout() {
    setAuthToken(null);
    setUser(null);
    await AsyncStorage.removeItem(STORAGE_KEY);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
