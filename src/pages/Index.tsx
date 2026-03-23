import { 
  Plus, 
  History as HistoryIcon, 
  TrendingUp, 
  Hammer, 
  Calculator,
  User,
  LogOut,
  Crown,
  FileText,
  Scan,
  Zap,
  ArrowRight
} from "lucide-react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

const cardAlbanileria = "https://images.unsplash.com/photo-1589939705384-5185137a7f0f?q=80&w=800&auto=format&fit=crop";
const cardHormigon = "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=800&auto=format&fit=crop";
const cardMadera = "https://images.unsplash.com/photo-1610505417978-01e6a0d0505a?q=80&w=800&auto=format&fit=crop";

const menuItems = [
  { icon: Plus, label: "Nuevo Escaneo", path: "/scanner" },
  { icon: HistoryIcon, label: "Proyectos Guardados", path: "/history" },
  { icon: TrendingUp, label: "Reportes", path: "#" },
];

const adventures = [
  { img: cardAlbanileria, label: "Albañilería" },
  { img: cardHormigon, label: "Hormigón" },
  { img: cardMadera, label: "Madera" },
];

const features = [
  { icon: Scan, title: "Escaneo con IA", desc: "Detecta muros, losas y estructuras automáticamente" },
  { icon: Calculator, title: "Cubicación Instantánea", desc: "Calcula m², m³ y cantidades en segundos" },
  { icon: FileText, title: "Lista de Compra", desc: "Exportable a PDF o WhatsApp" },
  { icon: Zap, title: "Motor APU", desc: "Lógica real de construcción chilena" },
];

export default function Index() {
  const navigate = useNavigate();
  const { user, plan, logout } = useAuth();

  return (
    <div className="min-h-screen bg-background bg-grid-pattern text-foreground font-display selection:bg-primary/30">
      <main className="relative max-w-lg mx-auto min-h-screen pb-24 shadow-2xl bg-background/80 backdrop-blur-xl border-x border-border">
        
        {/* Hero Section with Banner */}
        <section className="relative h-72 overflow-hidden">
          <motion.div 
            initial={{ scale: 1.1 }}
            animate={{ scale: 1 }}
            transition={{ duration: 10, repeat: Infinity, repeatType: "reverse" }}
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url('https://images.unsplash.com/photo-1503387762-592deb58ef4e?q=80&w=1200&auto=format&fit=crop')` }}
          >
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
          </motion.div>
          
          <div className="absolute inset-0 p-6 flex flex-col justify-end">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
            >
              <h2 className="text-4xl font-black italic tracking-tighter text-white drop-shadow-2xl">OBRAGO</h2>
              <p className="text-white/80 font-bold text-sm tracking-widest uppercase">Inteligencia en Terreno</p>
            </motion.div>
          </div>
        </section>

        <div className="px-6 -mt-8 relative z-20 space-y-10">
          
          {/* Header Overlay */}
          <header className="flex justify-between items-center mb-10 bg-card/50 backdrop-blur-md border border-border p-4 rounded-3xl shadow-lg">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20">
                <Hammer className="text-white w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl font-black tracking-tight text-foreground">ObraGo</h1>
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase truncate w-32">{user?.email}</span>
                  <div 
                    onClick={() => navigate("/pricing")}
                    className={`flex items-center gap-1 mt-1 w-fit px-2 py-0.5 rounded-full text-[9px] font-black uppercase cursor-pointer transition-all hover:scale-105 ${
                      plan !== 'free' ? "bg-primary/10 text-primary border border-primary/20" : "bg-secondary text-muted-foreground border border-border"
                    }`}
                  >
                    {plan !== 'free' && <Crown className="w-3 h-3 text-primary" />}
                    Plan {plan}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={logout}
                className="p-3 bg-secondary/50 border border-border rounded-xl text-muted-foreground hover:text-destructive transition-all"
              >
                <LogOut className="w-5 h-5" />
              </button>
              <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center border border-primary/20">
                <User className="text-primary w-5 h-5" />
              </div>
            </div>
          </header>

          {/* Quick Access Grid */}
          <div className="grid grid-cols-3 gap-4">
            {menuItems.map((item) => (
              <motion.button
                key={item.label}
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate(item.path)}
                className="flex flex-col items-center gap-3 p-4 bg-card border border-border rounded-3xl group hover:border-primary/50 transition-all shadow-sm"
              >
                <div className="w-12 h-12 rounded-2xl bg-secondary flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                  <item.icon className="w-6 h-6 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{item.label}</span>
              </motion.button>
            ))}
          </div>

          {/* Featured Sections */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black tracking-tight">Especialidades</h3>
              <ArrowRight className="w-5 h-5 text-muted-foreground" />
            </div>
            <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide snap-x">
              {adventures.map((adv) => (
                <div 
                  key={adv.label}
                  className="relative min-w-[160px] h-48 rounded-3xl overflow-hidden snap-start group"
                >
                  <img src={adv.img} className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                  <div className="absolute bottom-4 left-4">
                    <span className="text-white font-black uppercase text-xs tracking-widest">{adv.label}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* CTA Section */}
          <motion.div 
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate("/scanner")}
            className="p-8 bg-primary rounded-[40px] shadow-2xl shadow-primary/30 relative overflow-hidden group cursor-pointer"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-3xl transition-all group-hover:scale-150" />
            <div className="relative z-10 flex items-center justify-between">
              <div className="space-y-1">
                <h3 className="text-3xl font-black text-white leading-tight">Nueva<br />Cubicación</h3>
                <p className="text-white/70 text-sm font-bold uppercase tracking-widest">Escanea ahora</p>
              </div>
              <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center">
                <Scan className="text-white w-8 h-8" />
              </div>
            </div>
          </motion.div>

          {/* Features Checklist */}
          <section className="space-y-6 pb-12">
            <h3 className="text-lg font-black tracking-tight">¿Qué puedes hacer?</h3>
            <div className="grid grid-cols-1 gap-4">
              {features.map((f) => (
                <div 
                  key={f.title}
                  className="flex items-center gap-5 p-5 bg-card/40 border border-border rounded-3xl"
                >
                  <div className="w-12 h-12 rounded-2xl bg-secondary flex items-center justify-center shrink-0">
                    <f.icon className="w-6 h-6 text-primary" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-black text-sm">{f.title}</h4>
                    <p className="text-xs text-muted-foreground">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

        </div>
      </main>
    </div>
  );
}
