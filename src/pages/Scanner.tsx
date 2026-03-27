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
  X,
  Plus,
  Trash2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { jsPDF } from "jspdf";
import { MATERIALS_CATALOG, SYSTEMS_CATALOG } from "@/constants/catalog";

type AnalysisResult = {
  elemento: string;
  sistema: string;
  dimensiones: {
    largo: number;
    ancho: number;
    espesor: number;
  };
  materiales: any[];
  confianza: "alta" | "media" | "baja";
  observaciones: string;
};

type MaterialLine = {
  id: string;
  name: string;
  unit: string;
  baseQuantity: number; // Por m2/m3
  quantity: number; // Total con pérdida
  price: number;
  total: number;
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
  const [projectNameInput, setProjectNameInput] = useState("");
  const [selectedSystemId, setSelectedSystemId] = useState<string | null>(null);
  const [customMaterials, setCustomMaterials] = useState<MaterialLine[]>([]);

  useEffect(() => {
    if (location.state?.loadedProject) {
      const p = location.state.loadedProject;
      
      const parsedDims = typeof p.dimensiones === 'string' ? JSON.parse(p.dimensiones) : p.dimensiones;
      const parsedMats = typeof p.materiales === 'string' ? JSON.parse(p.materiales) : p.materiales;
      const parsedPrices = typeof p.prices === 'string' ? JSON.parse(p.prices) : p.prices;
      const parsedLabor = typeof p.labor_prices === 'string' ? JSON.parse(p.labor_prices) : p.labor_prices;

      setSelectedSystemId(p.selected_system_id || p.selectedSystemId || null);
      if (parsedMats && Array.isArray(parsedMats)) {
        setCustomMaterials(parsedMats);
      }

      setResult({
        elemento: p.elemento || "Proyecto Cargado",
        sistema: p.sistema || "Estándar",
        dimensiones: parsedDims,
        materiales: parsedMats || [],
        confianza: "alta",
        observaciones: "Proyecto cargado desde el historial"
      });
      
      setEditedDims(parsedDims);
      setProjectNameInput(p.elemento);
      
      if (parsedPrices) setPrices(parsedPrices);
      if (parsedLabor) setLaborPrices(parsedLabor);
      if (p.performance) setPerformance(Number(p.performance));
      
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
    console.log("RESETTING SCANNER STATE");
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
      
      const response = await fetch(`${API_URL}/api/analyze`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          "Authorization": `Bearer ${token}`
        },
        body: formData,
      });

      let data: any = {};
      if (!response.ok) {
        try {
          data = await response.json();
        } catch (e) {}
        
        console.error("ERROR EN RESPONSE /api/analyze:", response.status, data);
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

      data = await response.json();

      const backendData = data.data;
      
      // Mapeo robusto: buscar dimensiones en varios formatos posibles del JSON de la IA
      const receivedDims = {
        largo: Number(backendData.dimensiones?.largo || backendData.dimensiones?.alto_m || 0),
        ancho: Number(backendData.dimensiones?.ancho || backendData.dimensiones?.ancho_m || 0),
        espesor: Number(backendData.dimensiones?.espesor || backendData.dimensiones?.espesor_m || 0)
      };

      console.log("Dimesiones recibidas:", receivedDims);
      
      const detectedElem = (backendData.elemento || "").toLowerCase();
      let bestSystem = SYSTEMS_CATALOG[0].id;
      if (detectedElem.includes("muro") || detectedElem.includes("tabique")) bestSystem = "tabique_st";
      if (detectedElem.includes("cielo")) bestSystem = "cielo_falso_st";
      if (detectedElem.includes("radier") || detectedElem.includes("losa")) bestSystem = "radier_estandar";
      
      setSelectedSystemId(bestSystem);
      
      setResult({
        elemento: backendData.elemento || backendData.structure || "Estructura Detectada",
        sistema: backendData.sistema_constructivo || backendData.layout || "Sistema Estándar",
        dimensiones: receivedDims,
        materiales: backendData.materiales_detectados || backendData.elements || [],
        confianza: "alta",
        observaciones: backendData.observaciones || ""
      });
      
      setProjectNameInput(`${backendData.elemento || 'Análisis'} - ${new Date().toLocaleDateString()}`);
      setEditedDims(receivedDims);
      setHistoryImageUrl(data.imageUrl);
      setStep('confirm');
    } catch (error: any) {
      console.error("ANALYZE ERROR:", error);
      alert(`ERROR EN ANÁLISIS: ${error.message}`);
      setStep('upload');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const calculateGeometricData = () => {
    // IMPORTANTE: Usar editedDims para que la UI sea reactiva al cambio manual
    const { largo, ancho, espesor } = editedDims;
    const area = largo * ancho;
    const volume = area * espesor;
    const elem = (result?.elemento || "").toLowerCase();
    const showVolume = elem.includes("muro") || elem.includes("radier") || elem.includes("losa") || elem.includes("columna") || elem.includes("viga");
    return { area, volume, showVolume };
  };

  const calculateMaterialQuantities = (): MaterialLine[] => {
    if (!result || !selectedSystemId) return [];
    
    // Si hay materiales personalizados y ya estamos validados, retornar esos
    if (isValidated && customMaterials.length > 0) return customMaterials;

    const system = SYSTEMS_CATALOG.find(s => s.id === selectedSystemId);
    if (!system) return [];

    const { area, volume } = calculateGeometricData();
    const baseValue = system.baseUnit === 'm2' ? area : volume;
    const factor = 1 + wastePercent / 100;

    return system.materialIds.map(mid => {
      const mat = MATERIALS_CATALOG.find(m => m.id === mid);
      if (!mat) return null;
      const baseQty = Number((baseValue * mat.coverage).toFixed(2));
      const totalQty = Number((baseQty * factor).toFixed(2));
      const price = prices[mat.id] || mat.refPrice;
      return {
        id: mat.id,
        name: mat.name,
        unit: mat.unit,
        baseQuantity: baseQty,
        quantity: totalQty,
        price: price,
        total: Math.round(totalQty * price)
      };
    }).filter(Boolean) as MaterialLine[];
  };

  const currentMaterials = calculateMaterialQuantities();

  const calculateTotalCost = () => {
    const materials = currentMaterials;
    const matCost = materials.reduce((acc, item) => acc + item.total, 0);
    const { area } = calculateGeometricData();
    const labor = (area / performance) * (laborPrices.maestro + laborPrices.ayudante);
    return Math.round(matCost + labor);
  };

  const handleSaveProject = async () => {
    if (!result) return;
    setIsSaving(true);
    try {
      const formData = new FormData();
      const projectData = {
        elemento: projectNameInput || result.elemento,
        sistema: SYSTEMS_CATALOG.find(s => s.id === selectedSystemId)?.name || result.sistema,
        dimensiones: editedDims,
        materiales: currentMaterials,
        totalCost: calculateTotalCost(),
        prices: prices,
        labor_prices: laborPrices,
        performance: performance,
        selectedSystemId,
        image: historyImageUrl || imagePreview
      };
      
      const API_URL = import.meta.env.VITE_API_URL || "";
      const token = localStorage.getItem("token");

      if (!token) {
        alert("Inicia sesión para guardar.");
        return;
      }

      formData.append("projectData", JSON.stringify(projectData));
      if (selectedFile) formData.append("image", selectedFile);

      const res = await fetch(`${API_URL}/api/projects`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          "Authorization": `Bearer ${token}`
        },
        body: formData
      });

      if (res.ok) {
        alert("¡Proyecto guardado con éxito!");
        navigate("/history");
      } else {
        const err = await res.json();
        throw new Error(err.error || "Error al guardar");
      }
    } catch (err: any) {
      alert(`Error al guardar: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const exportPDF = () => {
    if (!result) return;
    const doc = new jsPDF();
    const total = calculateTotalCost();
    const dims = editedDims;
    const materials = currentMaterials;

    // Header
    doc.setFillColor(15, 23, 42); // Slate 900
    doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text("ObraGo", 15, 20);
    doc.setFontSize(10);
    doc.text("REPORTE DE CUBICACIÓN INTELIGENTE", 15, 30);
    doc.text(new Date().toLocaleDateString(), 180, 20);

    // Metadata
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(14);
    doc.text(`PROYECTO: ${projectNameInput || 'Sin Nombre'}`, 15, 55);
    doc.setFontSize(11);
    doc.text(`Elemento: ${result.elemento}`, 15, 65);
    doc.text(`Sistema: ${result.sistema}`, 15, 72);

    // Dimensions
    doc.setDrawColor(226, 232, 240); // Slate 200
    doc.line(15, 80, 195, 80);
    doc.setFontSize(10);
    doc.text("DIMENSIONES (m)", 15, 90);
    doc.text(`Largo: ${dims.largo}m    |    Ancho: ${dims.ancho}m    |    Espesor: ${dims.espesor}m`, 15, 100);

    // Materials Table Header
    doc.setFillColor(248, 250, 252); // Slate 50
    doc.rect(15, 110, 180, 8, 'F');
    doc.setFont("helvetica", "bold");
    doc.text("Material", 20, 116);
    doc.text("Cantidad (c/pérdida)", 100, 116);
    doc.text("Unid.", 150, 116);
    doc.text("Costo Est.", 175, 116);

    // Table Content
    doc.setFont("helvetica", "normal");
    let y = 125;
    materials.forEach((m) => {
      doc.text(m.name, 20, y);
      doc.text(m.quantity.toString(), 100, y);
      doc.text(m.unit, 150, y);
      doc.text(`$${m.total.toLocaleString('es-CL')}`, 175, y);
      y += 8;
    });

    // Totals
    doc.line(15, y + 5, 195, y + 5);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("TOTAL NETO ESTIMADO:", 15, y + 20);
    doc.setTextColor(37, 99, 235); // Blue 600
    doc.text(`$${total.toLocaleString('es-CL')} CLP`, 120, y + 20);

    // Footer
    doc.setTextColor(148, 163, 184); // Slate 400
    doc.setFontSize(8);
    doc.text("Generado automáticamente por ObraGo AI. Este reporte es referencial.", 15, 280);

    doc.save(`ObraGo_${projectNameInput.replace(/\s/g, '_')}.pdf`);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col font-display max-w-lg mx-auto shadow-2xl border-x border-border">
      
      <nav className="p-4 flex items-center justify-between border-b border-border bg-card/50 backdrop-blur-md sticky top-0 z-50">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-xl">
          <ChevronLeft className="w-6 h-6" />
        </Button>
        <div className="text-center">
          <h1 className="text-sm font-black uppercase tracking-widest text-foreground">ObraGo</h1>
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
            <div className="bg-card border border-border rounded-3xl p-5 shadow-sm space-y-4">
              <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-1">Nombre del Proyecto</label>
              <input 
                type="text"
                value={projectNameInput}
                onChange={(e) => setProjectNameInput(e.target.value)}
                placeholder="Ej: Muro Perimetral Casa 2"
                className="w-full bg-secondary/50 border border-border rounded-2xl py-4 px-5 text-sm font-bold focus:ring-2 focus:ring-primary outline-none transition-all"
              />
            </div>

            <div className="bg-card border border-border rounded-3xl p-5 shadow-sm space-y-4">
              <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-1">Sistema Constructivo</label>
              <select 
                value={selectedSystemId || ''}
                onChange={(e) => setSelectedSystemId(e.target.value)}
                className="w-full bg-secondary/50 border border-border rounded-2xl py-4 px-5 text-sm font-bold focus:ring-2 focus:ring-primary outline-none transition-all appearance-none cursor-pointer"
              >
                {SYSTEMS_CATALOG.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            <div className="relative h-72 rounded-[32px] overflow-hidden shadow-2xl group border-4 border-white">
              <img src={imagePreview || historyImageUrl || ''} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
              <div className="absolute bottom-6 left-6 text-white space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-widest bg-primary px-3 py-1 rounded-full shadow-lg">IA Detectado</span>
                  <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full shadow-lg ${result.confianza === 'alta' ? 'bg-emerald-500' : 'bg-amber-500'}`}>
                    Confianza {result.confianza}
                  </span>
                </div>
                <h3 className="text-2xl font-black tracking-tight">{result.elemento}</h3>
                <p className="text-xs font-bold text-white/70 italic">{result.sistema}</p>
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
                {(['largo', 'ancho', 'espesor'] as const).map((dim) => (
                  <div key={dim} className="space-y-1">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase px-1">{dim}</label>
                    <input 
                      type="number"
                      step="0.01"
                      disabled={isValidated}
                      value={editedDims[dim] === 0 ? '' : editedDims[dim]}
                      placeholder="0.00"
                      onChange={(e) => {
                        const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                        setEditedDims(prev => ({ ...prev, [dim]: val }));
                      }}
                      className="w-full bg-secondary border border-border rounded-xl py-3 px-2 text-center font-bold focus:ring-2 focus:ring-primary outline-none disabled:opacity-50 transition-all"
                    />
                  </div>
                ))}
              </div>

              {isValidated && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="pt-6 space-y-6 border-t border-border/50">
                  <div className="flex items-center justify-between">
                    <h4 className="font-black text-sm uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                      <Calculator className="w-4 h-4 text-primary" /> Cubicación de Materiales
                    </h4>
                    <span className="text-[10px] font-bold bg-primary/10 text-primary px-3 py-1 rounded-full ring-1 ring-primary/20">
                      {wastePercent}% de margen
                    </span>
                  </div>

                  <div className="space-y-4">
                    {currentMaterials.map((item, idx) => (
                      <div key={idx} className="p-5 bg-secondary/30 rounded-3xl border border-border/10 space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <p className="text-xs font-black text-foreground">{item.name}</p>
                            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-tighter">Neto: {item.baseQuantity} {item.unit}</p>
                          </div>
                          <button 
                            onClick={() => {
                              const newMats = currentMaterials.filter((_, i) => i !== idx);
                              setCustomMaterials(newMats);
                            }}
                            className="p-2 text-destructive hover:bg-destructive/10 rounded-xl transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="text-[9px] font-bold text-muted-foreground uppercase px-1">Cantidad</label>
                            <input 
                              type="number"
                              value={item.quantity}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                const newMats = [...currentMaterials];
                                newMats[idx] = { ...newMats[idx], quantity: val, total: Math.round(val * newMats[idx].price) };
                                setCustomMaterials(newMats);
                              }}
                              className="w-full bg-background border border-border rounded-xl py-2 px-3 text-xs font-bold focus:ring-1 focus:ring-primary"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] font-bold text-muted-foreground uppercase px-1">Precio Unit.</label>
                            <input 
                              type="number"
                              value={item.price}
                              onChange={(e) => {
                                const val = parseInt(e.target.value) || 0;
                                const newMats = [...currentMaterials];
                                newMats[idx] = { ...newMats[idx], price: val, total: Math.round(newMats[idx].quantity * val) };
                                setCustomMaterials(newMats);
                              }}
                              className="w-full bg-background border border-border rounded-xl py-2 px-3 text-xs font-bold focus:ring-1 focus:ring-primary text-right"
                            />
                          </div>
                        </div>
                        
                        <div className="pt-2 flex justify-between items-center border-t border-border/10">
                          <span className="text-[10px] font-bold text-muted-foreground uppercase">Subtotal Item</span>
                          <span className="text-xs font-black text-primary">${item.total.toLocaleString('es-CL')}</span>
                        </div>
                      </div>
                    ))}
                    
                    <Button 
                      variant="outline" 
                      className="w-full rounded-2xl border-dashed border-2 py-6 text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-primary hover:border-primary transition-all group"
                      onClick={() => {
                        const mat = MATERIALS_CATALOG.find(m => !currentMaterials.some(cm => cm.id === m.id));
                        if (mat) {
                          setCustomMaterials([...currentMaterials, {
                            id: mat.id,
                            name: mat.name,
                            unit: mat.unit,
                            baseQuantity: 0,
                            quantity: 1,
                            price: mat.refPrice,
                            total: mat.refPrice
                          }]);
                        }
                      }}
                    >
                      <Plus className="w-4 h-4 mr-2 group-hover:scale-110 transition-transform" /> Agregar Insumo
                    </Button>
                  </div>

                  <div className="bg-primary text-white rounded-[32px] p-8 text-center shadow-xl shadow-primary/20 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-3xl" />
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80 mb-2">Presupuesto Estimado</p>
                    <div className="flex items-center justify-center gap-2">
                      <span className="text-5xl font-black tabular-nums tracking-tighter">
                        ${calculateTotalCost().toLocaleString('es-CL')}
                      </span>
                      <span className="text-xs font-bold opacity-60 self-end mb-2">CLP</span>
                    </div>
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
