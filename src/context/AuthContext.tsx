import React, { createContext, useContext, useState, useEffect } from 'react';

interface User {
  id: string;
  email: string;
}

interface AuthContextType {
  user: User | null;
  plan: string;
  isLoading: boolean;
  login: (userData: User, plan: string) => void;
  logout: () => void;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [plan, setPlan] = useState<string>('free');
  const [isLoading, setIsLoading] = useState(true);

  const checkAuth = async () => {
    try {
      const token = localStorage.getItem("token");
      const API_URL = import.meta.env.VITE_API_URL || "";
      const res = await fetch(`${API_URL}/api/auth/me`, {
        headers: { "Authorization": `Bearer ${token}` },
        credentials: "include"
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        setPlan(data.plan);
      } else {
        setUser(null);
        setPlan('free');
      }
    } catch (error) {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const login = (userData: User, userPlan: string) => {
    setUser(userData);
    setPlan(userPlan);
  };

  const logout = async () => {
    const token = localStorage.getItem("token");
    const API_URL = import.meta.env.VITE_API_URL || "";
    await fetch(`${API_URL}/api/auth/logout`, { 
      method: 'POST', 
      headers: { "Authorization": `Bearer ${token}` },
      credentials: 'include' 
    });
    localStorage.removeItem("token");
    setUser(null);
    setPlan('free');
  };

  return (
    <AuthContext.Provider value={{ user, plan, isLoading, login, logout, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
