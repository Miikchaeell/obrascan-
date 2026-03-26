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
      if (!token) {
        setIsLoading(false);
        return;
      }
      
      const API_URL = import.meta.env.VITE_API_URL || "";
      const headers = { 
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      };
      const res = await fetch(`${API_URL}/api/auth/me`, {
        headers,
        credentials: "include"
      });
      console.log(`CHECKAUTH FETCH STATUS (${API_URL}/api/auth/me):`, res.status);
      
      if (res.ok) {
        const data = await res.json();
        console.log("CHECKAUTH FETCH BODY:", data);
        setUser(data.user);
        setPlan(data.plan || 'free');
      } else {
        const errorData = await res.json().catch(() => ({}));
        console.warn("CHECKAUTH FETCH FAILED:", res.status, errorData);
        setUser(null);
        setPlan('free');
      }
    } catch (error: any) {
      console.error("CHECKAUTH CRITICAL ERROR:", error);
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
      headers: { 
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
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
