import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Mail, Lock, Loader2 } from "lucide-react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const API_URL = import.meta.env.VITE_API_URL || "";
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      
      if (res.ok) {
        localStorage.setItem("token", data.token);
        
        try {
          const meRes = await fetch(`${API_URL}/api/auth/me`, { 
            headers: { 
              "Authorization": `Bearer ${data.token}`,
              "Content-Type": "application/json"
            },
            credentials: "include" 
          });
          
          const meData = await meRes.json();

          if (meRes.ok) {
            login(data.user, meData.plan);
            navigate("/");
          } else {
            setError(`Error de perfil: ${meData.error || 'No se pudo obtener la sesión'}`);
          }
        } catch (meError) {
          console.error("Me fetch error:", meError);
          setError("Error al sincronizar sesión");
        }
      } else {
        // [v3.0] Handling specific status errors
        if (data.error === 'TU_CUENTA_AUN_NO_HA_SIDO_APROBADA') {
          setError("Tu cuenta aún no ha sido aprobada. Recibirás un correo cuando el administrador autorice tu acceso.");
        } else if (data.error === 'TU_ACCESO_FUE_RECHAZADO') {
          setError("Tu solicitud de acceso fue rechazada. Contacta a soporte si crees que esto es un error.");
        } else {
          setError(data.error || "Credenciales incorrectas o error de servidor");
        }
      }
    } catch (err) {
      setError("Fallo de conexión con el servidor");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 font-display">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md space-y-8"
      >
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight text-foreground">Bienvenido a ObraGo</h1>
          <p className="text-muted-foreground mt-2">Ingresa a tu cuenta para continuar</p>
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

          {error && <p className="text-destructive text-sm font-medium">{error}</p>}

          <Button 
            disabled={isLoading}
            className="w-full h-12 rounded-xl text-lg font-bold bg-primary hover:bg-primary/90 transition-all"
          >
            {isLoading ? <Loader2 className="animate-spin" /> : "Iniciar Sesión"}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground pt-2">
          <Link to="/forgot-password" title="Olvidé mi contraseña" className="text-muted-foreground hover:text-primary transition-colors text-xs font-medium">
            ¿Olvidaste tu contraseña?
          </Link>
        </p>

        <p className="text-center text-sm text-muted-foreground">
          ¿No tienes cuenta?{" "}
          <Link to="/register" className="text-primary font-bold hover:underline">
            Regístrate aquí
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
