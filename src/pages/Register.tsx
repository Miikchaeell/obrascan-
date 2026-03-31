import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Mail, Lock, Loader2 } from "lucide-react";

export default function Register() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);
  const [error, setError] = useState("");

  console.log("[Register] STATE:", { isRegistered, isLoading, hasError: !!error });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }
    
    setIsLoading(true);
    setError("");

    // [v4.0.2] Ensure no previous session leaks into registration
    localStorage.removeItem("token");

    try {
      const API_URL = import.meta.env.VITE_API_URL || "";
      const res = await fetch(`${API_URL}/api/auth/register`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (res.ok) {
        setIsRegistered(true);
      } else {
        const data = await res.json();
        setError(data.error || "Error al registrarse");
      }
    } catch {
      setError("Error de conexión");
    } finally {
      setIsLoading(false);
    }
  };

  if (isRegistered) {
    console.log("[Register] Rendering Success View");
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center" style={{ backgroundColor: '#0a0a0a', color: 'white' }}>
        <div className="max-w-md space-y-6">
          <div className="flex justify-center">
            <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center border border-green-500/50">
              <svg className="w-12 h-12 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path>
              </svg>
            </div>
          </div>
          <h1 className="text-4xl font-bold text-white">Cuenta en Revisión</h1>
          <p className="text-gray-400 text-lg">
            ¡Registro recibido! Tu solicitud de acceso está siendo procesada por el equipo de ObraGo.
          </p>
          <div className="bg-white/5 p-6 rounded-2xl text-sm border border-white/10 text-gray-300">
            Recibirás una notificación por email cuando tu acceso a la beta privada sea aprobado.
          </div>
          <a 
            href="/login" 
            className="inline-block w-full py-4 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-lg font-bold transition-all shadow-xl"
            style={{ textDecoration: 'none' }}
          >
            Volver al Inicio de Sesión
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 font-display">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md space-y-8"
      >
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight text-foreground">Únete a ObraGo</h1>
          <p className="text-muted-foreground mt-2">Crea tu cuenta gratis hoy mismo</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input
                type="email"
                placeholder="Email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-card border border-border rounded-xl py-3 pl-10 pr-4 focus:ring-2 focus:ring-primary outline-none transition-all"
              />
            </div>
          </div>
          <div className="space-y-2">
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input
                type="password"
                placeholder="Contraseña"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-card border border-border rounded-xl py-3 pl-10 pr-4 focus:ring-2 focus:ring-primary outline-none transition-all"
              />
            </div>
          </div>
          <div className="space-y-2">
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input
                type="password"
                placeholder="Confirmar Contraseña"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-card border border-border rounded-xl py-3 pl-10 pr-4 focus:ring-2 focus:ring-primary outline-none transition-all"
              />
            </div>
          </div>

          {error && <p className="text-destructive text-sm font-medium">{error}</p>}

          <Button 
            disabled={isLoading}
            className="w-full h-12 rounded-xl text-lg font-bold bg-primary hover:bg-primary/90 transition-all"
          >
            {isLoading ? <Loader2 className="animate-spin" /> : "Crear Cuenta"}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          ¿Ya tienes cuenta?{" "}
          <Link to="/login" className="text-primary font-bold hover:underline">
            Inicia sesión aquí
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
