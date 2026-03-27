import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { 
  ChevronLeft, 
  Trash2, 
  Calendar, 
  Search,
  Plus,
  ChevronRight,
  Loader2,
  FileBox,
  Crown
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";

export default function History() {
  const navigate = useNavigate();
  const { plan } = useAuth();
  const [projects, setProjects] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const fetchProjects = async () => {
    setIsLoading(true);
    console.log("HISTORY FETCH START: /api/projects");
    try {
      const token = localStorage.getItem("token");
      const API_URL = import.meta.env.VITE_API_URL || "";
      const res = await fetch(`${API_URL}/api/projects`, { 
        headers: { "Authorization": `Bearer ${token}` },
        credentials: "include" 
      });
      console.log("HISTORY FETCH STATUS:", res.status);
      
      if (res.ok) {
        const data = await res.json();
        console.log("HISTORY FETCH BODY:", data);
        setProjects(data.projects || []);
      } else {
        const errorData = await res.json().catch(() => ({}));
        console.error("HISTORY FETCH FAILED:", res.status, errorData);
      }
    } catch (error) {
      console.error("HISTORY CRITICAL ERROR:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleDelete = async (id: number) => {
    if (!confirm("¿Eliminar este proyecto?")) return;
    try {
      const token = localStorage.getItem("token");
      const API_URL = import.meta.env.VITE_API_URL || "";
      const res = await fetch(`${API_URL}/api/projects/${id}`, { 
        method: 'DELETE', 
        headers: { "Authorization": `Bearer ${token}` },
        credentials: 'include' 
      });
      if (res.ok) fetchProjects();
    } catch (error) {
      alert("Error al eliminar");
    }
  };

  const filteredProjects = projects.filter(p => 
    p.elemento.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.sistema.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background font-display flex flex-col max-w-lg mx-auto shadow-2xl border-x border-border">
      
      {/* Header */}
      <nav className="p-4 flex items-center justify-between border-b border-border bg-card/50 backdrop-blur-md sticky top-0 z-50">
        <Button variant="ghost" size="icon" onClick={() => navigate("/")} className="rounded-xl">
          <ChevronLeft className="w-6 h-6" />
        </Button>
        <div className="text-center">
          <h1 className="text-sm font-black uppercase tracking-widest text-foreground">Mis Proyectos</h1>
          <p className="text-[10px] font-bold text-muted-foreground uppercase">{projects.length} Guardados</p>
        </div>
        <div className="w-10 h-10" />
      </nav>

      {/* Main Content */}
      <main className="flex-1 p-6 space-y-8">
        
        {/* Search Bar */}
        <div className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground transition-colors group-focus-within:text-primary" />
          <input 
            type="text"
            placeholder="Buscar por elemento o sistema..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-14 bg-card border border-border rounded-2xl pl-12 pr-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-muted-foreground/50"
          />
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="w-10 h-10 text-primary animate-spin" />
            <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Cargando Historial</p>
          </div>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-6">
            <div className="w-20 h-20 rounded-3xl bg-secondary flex items-center justify-center">
              <FileBox className="w-10 h-10 text-muted-foreground" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-bold">No hay proyectos aún</h3>
              <p className="text-sm text-muted-foreground max-w-[200px] mx-auto">Tus cubicaciones guardadas aparecerán aquí.</p>
            </div>
            <Button onClick={() => navigate("/scanner")} className="rounded-xl font-bold gap-2">
              <Plus className="w-4 h-4" /> Nuevo Análisis
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5">
            <AnimatePresence mode="popLayout">
              {filteredProjects.map((p, idx) => (
                <motion.div
                  key={p.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: idx * 0.03 }}
                  className="group relative bg-card border border-border/60 rounded-[32px] p-4 hover:border-primary/40 transition-all shadow-sm hover:shadow-xl hover:shadow-primary/5 active:scale-[0.98] cursor-pointer"
                  onClick={() => navigate("/scanner", { state: { loadedProject: p } })}
                >
                  <div className="flex gap-5">
                    <div className="w-24 h-24 rounded-2xl bg-secondary overflow-hidden shrink-0 border border-border/10 shadow-inner">
                      <img 
                        src={p.image_url ? (p.image_url.startsWith('http') ? p.image_url : `${import.meta.env.VITE_API_URL}${p.image_url}`) : '/placeholder.jpg'} 
                        alt="Project" 
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
                      />
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                      <div className="flex items-center gap-2 mb-1.5">
                        <div className="flex items-center gap-1 text-[8px] font-black text-muted-foreground/60 uppercase tracking-widest">
                          <Calendar className="w-2.5 h-2.5" />
                          {new Date(p.date || p.created_at).toLocaleDateString(undefined, { day: '2-digit', month: 'short' })}
                        </div>
                        <span className="w-1 h-1 bg-border rounded-full" />
                        <span className="text-[8px] font-black uppercase text-primary tracking-widest">ID {p.id.toString().substring(0,4)}</span>
                      </div>
                      <h3 className="font-black text-sm text-foreground truncate mb-0.5 tracking-tight">{p.elemento}</h3>
                      <p className="text-[10px] text-muted-foreground font-bold uppercase truncate mb-3 opacity-70">{p.sistema}</p>
                      
                      <div className="flex items-center justify-between mt-auto">
                        <span className="text-sm font-black text-primary tabular-nums tracking-tighter">
                          ${Number(p.total_cost).toLocaleString('es-CL')}
                        </span>
                        <div className="bg-secondary/80 p-1.5 rounded-full text-primary group-hover:bg-primary group-hover:text-white transition-all">
                          <ChevronRight className="w-3 h-3" />
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleDelete(p.id); }}
                    className="absolute -top-2 -right-2 p-2 rounded-full bg-destructive/10 text-destructive border border-destructive/20 opacity-0 group-hover:opacity-100 transition-all hover:bg-destructive hover:text-white shadow-lg backdrop-blur-md"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </main>

      {/* Plan Info Overlay */}
      {plan === 'free' && (
        <div className="p-4 mx-6 mb-6 mt-4 bg-primary/5 border border-primary/20 rounded-3xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Crown className="w-5 h-5 text-primary" />
            <div>
              <p className="text-[10px] font-black uppercase text-primary">Actualiza a Pro</p>
              <p className="text-[9px] font-bold text-muted-foreground">Analiza más de 3 proyectos cada mes</p>
            </div>
          </div>
          <Button size="sm" onClick={() => navigate("/pricing")} className="h-8 text-[10px] font-black rounded-lg">Mejorar</Button>
        </div>
      )}
    </div>
  );
}
