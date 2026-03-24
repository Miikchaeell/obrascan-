import { useRef, useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { 
  Camera, 
  Upload, 
  ChevronLeft, 
  RotateCcw, 
  Save, 
  FileText, 
  Calculator, 
  Loader2,
  Crown,
  Maximize,
  Sparkles,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { jsPDF } from "jspdf";

type AnalysisResult = {
  elemento: string;
  sistema: string;
  dimensiones: {
    largo: number;
    ancho: number;
    espesor: number;
  };
  materiales: string[];
  confianza: "alta" | "media" | "baja";
  observaciones: string;
};

export default function Scanner() {
  const navigate = useNavigate();
  const location = useLocation();
  const { plan } = useAuth();
  
  const [step, setStep] = useState<'upload' | 'analyzing' | 'confirm' | 'edit'>('upload');
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [historyImageUrl, setHistoryImageUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [isValidated, setIsValidated] = useState(false);
  const [editedDims, setEditedDims] = useState({ largo: 0, ancho: 0, espesor: 0 });
  const [wastePercent] = useState(10);
  
  const [prices, setPrices] = useState<Record<string, number>>({
    "ladrillo": 650,
    "mortero": 5500,
    "hormigon": 120000,
    "malla": 4500,
    "plancha": 12500,
    "estructura": 3800,
    "otros": 1000
  });
  const [laborPrices, setLaborPrices] = useState({ maestro: 45000, ayudante: 30000 });
  const [performance, setPerformance] = useState(10); 

  useEffect(() => {
    if (location.state?.loadedProject) {
      const p = location.state.loadedProject;
      setResult({
        elemento: p.elemento,
        sistema: p.sistema,
        dimensiones: p.dimensiones,
        materiales: p.materiales || [],
        confianza: "alta",
        observaciones: "Proyecto cargado desde el historial"
      });
      setEditedDims(p.dimensiones);
      if (p.prices) setPrices(p.prices);
      if (p.laborPrices) setLaborPrices(p.laborPrices);
      if (p.performance) setPerformance(p.performance);
      setHistoryImageUrl(p.image_url || p.image);
      setIsValidated(true);
      setStep('confirm');
    }
  }, [location.state]);

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setImagePreview(url);
      setSelectedFile(file);
    }
  };

  const handleClear = () => {
    setImagePreview(null);
    setHistoryImageUrl(null);
    setSelectedFile(null);
    setResult(null);
    setIsValidated(false);
    setStep('upload');
  };

  const handleAnalyze = async () => {
    if (!selectedFile) return;
    setIsAnalyzing(true);
    setStep('analyzing');
    
    try {
      const formData = new FormData();
      formData.append('image', selectedFile);

      const API_URL = import.meta.env.VITE_API_URL || "";
      const token = localStorage.getItem("token");
      console.log("TOKEN ANTES DE ANALYZE:", token);

      if (!token || token === "null" || token === "undefined") {
        alert("TOKEN INVALIDO FRONT");
        setIsAnalyzing(false);
        setStep('upload');
        return;
      }

      console.log("AUTH HEADER:", `Bearer ${token}`);

      const response = await fetch(`${API_URL}/api/analyze`, {
        method: 'POST',
        headers: {
          "Authorization": `Bearer ${token}`
        },
        credentials: 'include',
        body: formData,
      });

      const data = await response.json();
      
      if (!response.ok) {
        if (response.status === 403) {
          const errMsg = (data.error || data.message || "").toLowerCase();
          const isPlanError = errMsg.includes("límite alcanzado") || 
                              errMsg.includes("plan requerido") || 
                              errMsg.includes("upgrade required");

          if (isPlanError) {
            setShowUpgradeModal(true);
            setStep('upload');
          } else {
            // Error de Autorización/Autenticación (e.g. JWT expirado, inactivo)
            alert(`Error de Acceso: ${data.error || "Sesión expirada"}`);
            setStep('upload');
          }
        } else {
          throw new Error(data.error || 'Error en el análisis');
        }
        return;
      }

      const backendData = data.data;
      const receivedDims = {
        largo: backendData.dimensiones?.alto_m || 0,
        ancho: backendData.dimensiones?.ancho_m || 0,
        espesor: backendData.dimensiones?.espesor_m || 0
      };

      setResult({
        elemento: backendData.elemento || "Desconocido",
        sistema: backendData.sistema_constructivo || "Desconocido",
        dimensiones: receivedDims,
        materiales: backendData.materiales_detectados || [],
        confianza: "alta",
        observaciones: backendData.observaciones || ""
      });
      
      setEditedDims(receivedDims);
      setHistoryImageUrl(data.imageUrl);
      setStep('confirm');
    } catch (error: any) {
      alert(error.message);
      setStep('upload');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const calculateGeometricData = () => {
    if (!result) return { area: 0, volume: 0, showVolume: false };
    const { largo, ancho, espesor } = result.dimensiones;
    const area = largo * ancho;
    const volume = area * espesor;
    const elem = result.elemento.toLowerCase();
    const showVolume = elem.includes("muro") || elem.includes("radier") || elem.includes("losa") || elem.includes("columna");
    return { area, volume, showVolume };
  };

  const calculateMaterialQuantities = () => {
    if (!result) return [];
    const { area, volume } = calculateGeometricData();
    const factor = 1 + wastePercent / 100;
    const elem = result.elemento.toLowerCase();
    const items = [];

    if (elem.includes("muro") || elem.includes("tabique")) {
      const bricks = area * 38;
      items.push({ id: "ladrillo", name: "Ladrillos", base: Math.round(bricks), total: Math.round(bricks * factor), unit: "un" });
      const mortar = area * 0.5;
      items.push({ id: "mortero", name: "Mortero", base: Math.ceil(mortar), total: Math.ceil(mortar * factor), unit: "sacos" });
    } else if (elem.includes("radier") || elem.includes("losa")) {
      items.push({ id: "hormigon", name: "Hormigón", base: volume.toFixed(2), total: (volume * factor).toFixed(2), unit: "m³" });
      items.push({ id: "malla", name: "Malla ACMA", base: area.toFixed(1), total: (area * factor).toFixed(1), unit: "m²" });
    } else {
      items.push({ id: "otros", name: "Material Estimado", base: area.toFixed(1), total: (area * factor).toFixed(1), unit: "un" });
    }
    return items;
  };

  const calculateTotalCost = () => {
    const materials = calculateMaterialQuantities();
    const matCost = materials.reduce((acc, item) => acc + (parseFloat(item.total.toString()) * (prices[item.id] || 0)), 0);
    const labor = (calculateGeometricData().area / performance) * (laborPrices.maestro + laborPrices.ayudante);
    return matCost + labor;
  };

  const handleSaveProject = async () => {
    if (!result) return;
    setIsSaving(true);
    try {
      const projectData = {
        elemento: result.elemento,
        sistema: result.sistema,
        dimensiones: result.dimensiones,
        materiales: result.materiales,
        totalCost: calculateTotalCost(),
        prices,
        laborPrices,
        image: historyImageUrl
      };
      
      const API_URL = import.meta.env.VITE_API_URL || "";
      const rawToken = localStorage.getItem("token");
      const token = rawToken && rawToken !== 'null' && rawToken !== 'undefined' ? rawToken : null;
      
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${API_URL}/api/projects`, {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify({ projectData })
      });
      if (res.ok) {
        alert("Proyecto guardado");
        navigate("/history");
      }
    } catch (err) {
      alert("Error al guardar");
    } finally {
      setIsSaving(false);
    }
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    const total = calculateTotalCost();
    doc.text(`COTIZACIÓN: ${result?.elemento}`, 14, 20);
    doc.text(`Costo Total: $${total.toLocaleString('es-CL')}`, 14, 30);
    doc.save("Cotizacion.pdf");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col font-display max-w-lg mx-auto shadow-2xl border-x border-border">
      
      <nav className="p-4 flex items-center justify-between border-b border-border bg-card/50 backdrop-blur-md sticky top-0 z-50">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-xl">
          <ChevronLeft className="w-6 h-6" />
        </Button>
        <div className="text-center">
          <h1 className="text-sm font-black uppercase tracking-widest text-foreground">ObraGo</h1>
          <p className="text-[10px] font-bold text-primary uppercase">BUILD: auth-fix-v6</p>
          <p className={`text-[10px] font-bold uppercase ${localStorage.getItem("token") ? "text-green-500" : "text-red-500"}`}>
            TOKEN PRESENTE: {localStorage.getItem("token") ? "SI" : "NO"}
          </p>
          <p className="text-[10px] font-bold text-muted-foreground uppercase">{!plan || plan === 'free' ? 'Plan Gratis' : `Plan ${plan}`}</p>
        </div>
        <div className="flex gap-2">
          {plan === 'free' && <Button size="sm" variant="ghost" className="text-primary p-0" onClick={() => navigate("/pricing")}><Crown className="w-5 h-5" /></Button>}
          <Button variant="ghost" size="icon" onClick={handleClear} className="rounded-xl text-muted-foreground"><RotateCcw className="w-5 h-5" /></Button>
        </div>
      </nav>

      <main className="flex-1 overflow-y-auto pb-24">
        {step === 'upload' && (
          <div className="p-6 flex flex-col items-center justify-center min-h-[60vh] text-center space-y-8">
            <div className="w-32 h-32 rounded-3xl bg-primary/10 flex items-center justify-center border-2 border-dashed border-primary/30">
              <Camera className="w-12 h-12 text-primary" />
            </div>
            <div className="space-y-4">
              <h2 className="text-2xl font-black tracking-tight">Cubicación Inteligente</h2>
              <p className="text-muted-foreground text-sm max-w-xs mx-auto">Sube una foto de la estructura y la IA calculará por ti.</p>
            </div>
            
            {imagePreview ? (
              <div className="space-y-6 w-full">
                <div className="relative h-64 rounded-3xl overflow-hidden shadow-xl border-4 border-white">
                  <img src={imagePreview} className="w-full h-full object-cover" />
                  <button onClick={handleClear} className="absolute top-2 right-2 p-2 bg-black/50 rounded-full text-white"><X className="w-4 h-4" /></button>
                </div>
                <Button 
                  size="lg" 
                  onClick={handleAnalyze}
                  disabled={isAnalyzing}
                  className="w-full h-16 rounded-2xl text-lg font-bold bg-primary hover:bg-primary/90 shadow-xl shadow-primary/20 gap-3"
                >
                  {isAnalyzing ? <Loader2 className="animate-spin" /> : <Sparkles className="w-6 h-6" />}
                  Iniciar Análisis IA
                </Button>
              </div>
            ) : (
              <Button 
                size="lg" 
                onClick={() => fileInputRef.current?.click()}
                className="w-full h-16 rounded-2xl text-lg font-bold bg-primary hover:bg-primary/90 shadow-xl shadow-primary/20 gap-3"
              >
                <Upload className="w-6 h-6" />
                Seleccionar Imagen
              </Button>
            )}
            <input type="file" ref={fileInputRef} className="hidden" onChange={handleImageUpload} accept="image/*" />
          </div>
        )}

        {step === 'analyzing' && (
          <div className="flex flex-col items-center justify-center min-h-[70vh] p-6 text-center space-y-6">
            <Loader2 className="w-16 h-16 text-primary animate-spin" />
            <div className="space-y-2">
              <h3 className="text-xl font-bold">Analizando Estructura...</h3>
              <p className="text-muted-foreground text-sm">Nuestra IA está identificando materiales y dimensiones.</p>
            </div>
          </div>
        )}

        {result && step === 'confirm' && (
          <div className="p-5 space-y-6">
            <div className="relative h-64 rounded-3xl overflow-hidden shadow-xl">
              <img src={imagePreview || historyImageUrl || ''} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              <div className="absolute bottom-4 left-4 text-white">
                <span className="text-[10px] font-black uppercase tracking-widest bg-primary/80 px-2 py-1 rounded-md mb-2 inline-block">Detectado</span>
                <h3 className="text-xl font-bold">{result.elemento}</h3>
              </div>
            </div>

            <div className="bg-card border border-border rounded-3xl p-6 space-y-6 shadow-sm">
              <div className="flex items-center justify-between border-b border-border pb-4">
                <h4 className="font-black text-sm uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Maximize className="w-4 h-4" /> Dimensiones
                </h4>
                <Button variant="ghost" size="sm" onClick={() => setIsValidated(!isValidated)} className="text-primary text-xs font-bold">
                  {isValidated ? "Editar" : "Confirmar"}
                </Button>
              </div>

              <div className="grid grid-cols-3 gap-4">
                {['largo', 'ancho', 'espesor'].map((dim) => (
                  <div key={dim} className="space-y-1">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase px-1">{dim}</label>
                    <input 
                      type="number"
                      disabled={isValidated}
                      value={editedDims[dim as keyof typeof editedDims]}
                      onChange={(e) => setEditedDims({...editedDims, [dim]: parseFloat(e.target.value) || 0})}
                      className="w-full bg-secondary border border-border rounded-xl py-3 px-2 text-center font-bold focus:ring-2 focus:ring-primary outline-none disabled:opacity-50"
                    />
                  </div>
                ))}
              </div>

              {isValidated && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="pt-4 space-y-6 border-t border-border">
                  <div className="flex items-center justify-between">
                    <h4 className="font-black text-sm uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                      <Calculator className="w-4 h-4" /> Materiales
                    </h4>
                    <span className="text-[10px] font-bold bg-secondary px-3 py-1 rounded-full">{wastePercent}% de pérdida</span>
                  </div>

                  <div className="space-y-3">
                    {calculateMaterialQuantities().map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between p-4 bg-secondary/50 rounded-2xl border border-border/10">
                        <div>
                          <p className="text-xs font-bold">{item.name}</p>
                          <p className="text-[10px] text-muted-foreground">Original: {item.base} {item.unit}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-black text-primary">{item.total} {item.unit}</p>
                          <p className="text-[10px] font-bold">${((parseFloat(item.total.toString()) * (prices[item.id] || 0))).toLocaleString('es-CL')}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="bg-primary/5 border border-primary/20 rounded-3xl p-6 text-center">
                    <p className="text-xs font-bold text-primary uppercase tracking-widest mb-1">Costo Total Estimado</p>
                    <p className="text-4xl font-black text-primary">${calculateTotalCost().toLocaleString('es-CL')}</p>
                  </div>
                </motion.div>
              )}
            </div>
          </div>
        )}
      </main>

      {result && isValidated && (
        <footer className="p-4 bg-background/80 backdrop-blur-md border-t border-border fixed bottom-0 left-0 right-0 max-w-lg mx-auto z-50">
          <div className="flex gap-3">
            <Button variant="outline" onClick={exportPDF} className="flex-1 h-14 rounded-2xl font-bold gap-2">
              <FileText className="w-5 h-5" /> PDF
            </Button>
            <Button onClick={handleSaveProject} disabled={isSaving} className="flex-[2] h-14 rounded-2xl font-bold gap-2 bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20">
              {isSaving ? <Loader2 className="animate-spin" /> : <Save className="w-5 h-5" />}
              Guardar Proyecto
            </Button>
          </div>
        </footer>
      )}

      <AnimatePresence>
        {showUpgradeModal && (
          <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowUpgradeModal(false)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div 
              initial={{ y: "100%" }} 
              animate={{ y: 0 }} 
              exit={{ y: "100%" }}
              className="bg-card w-full max-w-md rounded-[40px] p-8 relative z-10 shadow-2xl border border-border"
            >
              <div className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center mb-6 mx-auto">
                <Crown className="w-10 h-10 text-primary" />
              </div>
              <h3 className="text-2xl font-black text-center mb-2">Límite Alcanzado 🏗️</h3>
              <p className="text-center text-muted-foreground text-sm mb-8">Has llegado al límite de 3 análisis de tu plan gratuito. Asegura acceso ilimitado y funciones Pro ahora.</p>
              <div className="space-y-4">
                <Button onClick={() => navigate("/pricing")} className="w-full h-14 rounded-2xl font-black text-lg bg-primary hover:bg-primary/90 shadow-xl shadow-primary/30">
                  Ver Planes y Precios
                </Button>
                <Button variant="ghost" onClick={() => setShowUpgradeModal(false)} className="w-full h-12 rounded-2xl font-bold text-muted-foreground">
                  Quizás más tarde
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
