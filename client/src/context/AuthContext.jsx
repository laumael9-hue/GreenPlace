import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../lib/api';
import { clearPendingSkip } from '../lib/pendingApproval';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [business, setBusiness] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async () => {
    try {
      const { data } = await api.get('/auth/me');
      setProfile(data.profile);
      setBusiness(data.business || null);
      return data.profile;
    } catch {
      setProfile(null);
      setBusiness(null);
      return null;
    }
  }, []);

  const checkSession = useCallback(async () => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      setLoading(false);
      return;
    }

    // Check the session and load the profile at the same time instead of one after the
    // other: every page waits on this before it renders, so it was paid twice per load.
    const [session] = await Promise.allSettled([api.get('/auth/session'), fetchProfile()]);
    if (session.status === 'fulfilled') {
      setUser(session.value.data.user);
    } else {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      setProfile(null);
      setBusiness(null);
    }
    setLoading(false);
  }, [fetchProfile]);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  const register = async ({ email, password, firstName, lastName, role, phone, businessName }) => {
    const { data } = await api.post('/auth/register', {
      email, password, firstName, lastName, role, phone, businessName,
    });

    if (data.session) {
      localStorage.setItem('access_token', data.session.access_token);
      localStorage.setItem('refresh_token', data.session.refresh_token);
      setUser(data.user);
      await fetchProfile();
    }

    return data;
  };

  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('access_token', data.session.access_token);
    localStorage.setItem('refresh_token', data.session.refresh_token);
    setUser(data.user);
    setProfile(data.user.profile);
    await fetchProfile();
    return data;
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      clearPendingSkip();
      setUser(null);
      setProfile(null);
      setBusiness(null);
    }
  };

  const forgotPassword = async (email) => {
    const { data } = await api.post('/auth/forgot-password', { email });
    return data;
  };

  const resetPassword = async (password) => {
    const { data } = await api.post('/auth/reset-password', { password });
    return data;
  };

  const updateProfile = async (updates) => {
    const { data } = await api.put('/auth/profile', updates);
    setProfile(data.profile);
    return data.profile;
  };

  const value = {
    user,
    profile,
    business,
    loading,
    register,
    login,
    logout,
    forgotPassword,
    resetPassword,
    updateProfile,
    fetchProfile,
    isAuthenticated: !!user,
    role: profile?.role || null,
    verificationStatus: business?.verification_status || null,
    // Owners whose business is not Verified see only the Pending Approval screen (admins are exempt)
    needsBusinessVerification: !!business && business.verification_status !== 'Verified' && profile?.role !== 'admin',
    isSuspended: profile ? !profile.is_active : false,
    suspensionReason: profile?.suspension_reason || null,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
