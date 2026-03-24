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
    try {
      const token = localStorage.getItem("token");
      const API_URL = import.meta.env.VITE_API_URL || "";
      const res = await fetch(`${API_URL}/api/projects`, { 
        headers: { "Authorization": `Bearer ${token}` },
        credentials: "include" 
      });
      if (res.ok) {
        const data = await res.json();
        setProjects(data.projects || []);
      }
    } catch (error) {
      console.error("Error fetching projects:", error);
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
          <div className="space-y-4">
            <AnimatePresence>
              {filteredProjects.map((p, idx) => (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="group relative bg-card border border-border rounded-3xl p-5 hover:border-primary/50 transition-all shadow-sm active:scale-[0.98]"
                >
                  <div className="flex gap-4">
                    <div className="w-20 h-20 rounded-2xl bg-secondary overflow-hidden shrink-0 border border-border/10">
                      <img src={p.image_url || p.image} alt="Project" className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0" onClick={() => navigate("/scanner", { state: { loadedProject: p } })}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-black uppercase text-primary tracking-widest">#{p.id}</span>
                        <div className="flex items-center gap-1 text-[9px] font-bold text-muted-foreground uppercase">
                          <Calendar className="w-3 h-3" />
                          {new Date(p.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      <h3 className="font-bold text-foreground truncate">{p.elemento}</h3>
                      <p className="text-xs text-muted-foreground font-medium mb-3">{p.sistema}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-primary">${p.total_cost?.toLocaleString('es-CL')}</span>
                        <div className="flex items-center gap-1 text-primary text-[10px] font-bold uppercase tracking-tighter">
                          Ver Detalle <ChevronRight className="w-3 h-3" />
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleDelete(p.id); }}
                    className="absolute top-4 right-4 p-2 rounded-xl bg-destructive/10 text-destructive opacity-0 group-hover:opacity-100 transition-all hover:bg-destructive hover:text-white"
                  >
                    <Trash2 className="w-4 h-4" />
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
