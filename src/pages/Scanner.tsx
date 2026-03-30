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
  Trash2,
  Users,
  Clock
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { jsPDF } from "jspdf";
import { MATERIALS_CATALOG, SYSTEMS_CATALOG } from "@/constants/catalog";

type AnalysisResult = {
  partida: string;
  subtipo: string;
  sistema_id: string; // ID coincidente con SYSTEMS_CATALOG
  dimensiones: {
    largo: number;
    ancho: number;
    espesor: number;
    alto: number;
  };
  materiales?: any[];
  confianza: number; // 0.0 a 1.0
  calidad_analisis?: {
    iluminacion: string;
    enfoque: string;
    advertencia: string;
  };
  alternativas?: string[]; // IDs de alternativas
  recomendacion_cuadrilla?: string;
  observaciones?: string;
  
  // Compatibilidad con v2/v3 (opcional)
  elemento?: string;
  sistema?: string;
};

type MaterialLine = {
  id: string;
  name: string;
  unit: string;
  baseQuantity: number; // Por m2/m3
  quantity: number; // Total con pérdida
  price: number;
  total: number;
  category: string;
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
  const [editedDims, setEditedDims] = useState({ largo: 0, ancho: 0, espesor: 0, alto: 0 });
  const [wastePercent] = useState(10);
  const [unitMode, setUnitMode] = useState<'m' | 'cm'>('m');
  
  // Local string states for fluid input UX (Excel-like)
  const [localLargo, setLocalLargo] = useState("");
  const [localAncho, setLocalAncho] = useState("");
  const [localAlto, setLocalAlto] = useState("");
  const [localEspesor, setLocalEspesor] = useState("");

  const [showAnalysisGuide, setShowAnalysisGuide] = useState(() => {
    return localStorage.getItem("skipAnalysisGuide") !== "true";
  });
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  // Expose guide trigger for the button
  useEffect(() => {
    (window as any).showGuideModal = () => setIsGuideOpen(true);
  }, []);
  
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
  const [customLaborRate, setCustomLaborRate] = useState<number | null>(null);
  const [ggPercent, setGgPercent] = useState(12);
  const [profitPercent, setProfitPercent] = useState(15);

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
      if (p.labor_rate) setCustomLaborRate(p.labor_rate);
      if (p.gg_percent) setGgPercent(p.gg_percent);
      if (p.profit_percent) setProfitPercent(p.profit_percent);

      setResult({
        partida: p.partida || p.elemento || "Proyecto Cargado",
        subtipo: p.subtipo || p.sistema || "Estándar",
        sistema_id: p.selected_system_id || p.sistema_id || "radier_estandar",
        dimensiones: parsedDims,
        materiales: parsedMats || [],
        confianza: 1.0,
        calidad_analisis: p.calidad_analisis,
        recomendacion_cuadrilla: p.recomendacion_cuadrilla,
        elemento: p.elemento,
        sistema: p.sistema
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

  const handleFeedback = async (correctedId: string) => {
    if (!result || !historyImageUrl) return;
    
    try {
      const API_URL = import.meta.env.VITE_API_URL || "";
      const token = localStorage.getItem("token");
      await fetch(`${API_URL}/api/feedback/correction`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          imageUrl: historyImageUrl,
          detectedId: result.sistema_id,
          correctedId: correctedId,
          confidence: Number(result.confianza)
        })
      });
      console.log("Feedback sent successfully");
    } catch (err) {
      console.error("Feedback error:", err);
    }
  };


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

      const backendData = data.data;
      
      const receivedDims = {
        largo: Number(backendData.dimensiones?.largo || 0),
        ancho: Number(backendData.dimensiones?.ancho || 0),
        espesor: Number(backendData.dimensiones?.espesor || 0),
        alto: Number(backendData.dimensiones?.alto || 2.4)
      };

      const detectedId = backendData.sistema_id;
      let bestSystem = detectedId || SYSTEMS_CATALOG[0].id;
      
      // Fallback a lógica antigua de strings si no hay ID exacto
      if (!detectedId) {
        const detectedElem = (backendData.partida || backendData.elemento || "").toLowerCase();
        if (detectedElem.includes("muro") || detectedElem.includes("tabique")) bestSystem = "tabique_st";
        if (detectedElem.includes("cielo")) bestSystem = "cielo_falso_st";
        if (detectedElem.includes("radier") || detectedElem.includes("losa")) bestSystem = "radier_estandar";
        if (detectedElem.includes("cierre") || detectedElem.includes("osb")) bestSystem = "cie_prov_osb";
      }
      
      setSelectedSystemId(bestSystem);
      const sys = SYSTEMS_CATALOG.find(s => s.id === bestSystem);
      if (sys) {
        setPerformance(sys.performance);
        setCustomLaborRate(sys.laborRate);
      }
      
      setResult({
        partida: backendData.partida || "Partida Detectada",
        subtipo: backendData.subtipo || "Sistema Estándar",
        sistema_id: bestSystem,
        dimensiones: receivedDims,
        confianza: Number(backendData.confianza || 1.0),
        alternativas: backendData.alternativas || [],
        calidad_analisis: backendData.calidad_analisis,
        recomendacion_cuadrilla: backendData.recomendacion_cuadrilla,
        observaciones: backendData.observaciones || ""
      });
      
      const projectName = `${backendData.partida || backendData.elemento || 'Análisis'} - ${new Date().toLocaleDateString()}`;
      setProjectNameInput(projectName);
      
      const dims = {
        largo: receivedDims.largo || 0,
        ancho: receivedDims.ancho || 0,
        alto: receivedDims.alto || 0,
        espesor: receivedDims.espesor || 0.1
      };

      setEditedDims(dims);
      setLocalLargo(dims.largo.toString());
      setLocalAncho(dims.ancho.toString());
      setLocalAlto(dims.alto.toString());
      setLocalEspesor(dims.espesor.toString());
      
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

  const toggleUnits = () => {
    const isToCm = unitMode === 'm';
    const factor = isToCm ? 100 : 0.01;
    
    setUnitMode(isToCm ? 'cm' : 'm');
    
    // We update local strings to reflect the change visually
    setLocalLargo(prev => prev ? (parseFloat(prev.replace(',', '.')) * factor).toString() : "");
    setLocalAncho(prev => prev ? (parseFloat(prev.replace(',', '.')) * factor).toString() : "");
    setLocalAlto(prev => prev ? (parseFloat(prev.replace(',', '.')) * factor).toString() : "");
    setLocalEspesor(prev => prev ? (parseFloat(prev.replace(',', '.')) * factor).toString() : "");
  };

  const handleLocalInputChange = (dim: 'largo' | 'ancho' | 'alto' | 'espesor', val: string) => {
    // Normalizar coma a punto para cálculo
    const normalized = val.replace(',', '.');
    const numeric = parseFloat(normalized) || 0;
    
    // El valor interno SIEMPRE es en metros
    const valueInMeters = unitMode === 'cm' ? numeric / 100 : numeric;
    
    setEditedDims(prev => ({ ...prev, [dim]: valueInMeters }));
    
    if (dim === 'largo') setLocalLargo(val);
    if (dim === 'ancho') setLocalAncho(val);
    if (dim === 'alto') setLocalAlto(val);
    if (dim === 'espesor') setLocalEspesor(val);
  };

  const calculateGeometricData = () => {
    const { largo, ancho, espesor, alto } = editedDims;
    const sys = SYSTEMS_CATALOG.find(s => s.id === selectedSystemId);
    
    let area = 0;
    if (sys?.id === "tabique_st" || sys?.category === "Cierros Provisorios") {
      area = largo * alto; // Para cierros y tabiques, el área es vertical
    } else {
      area = largo * ancho;
    }
    
    const volume = area * espesor;
    const elem = (result?.elemento || "").toLowerCase();
    const showVolume = elem.includes("radier") || elem.includes("losa") || elem.includes("viga");

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
        total: Math.round(totalQty * price),
        category: mat.category
      };
    }).filter(Boolean) as MaterialLine[];
  };

  const currentMaterials = calculateMaterialQuantities();

  const calculateLaborCost = () => {
    if (!selectedSystemId) return 0;
    const system = SYSTEMS_CATALOG.find(s => s.id === selectedSystemId);
    if (!system) return 0;
    const { area, volume } = calculateGeometricData();
    const baseValue = system.baseUnit === 'm2' ? area : volume;
    const rate = customLaborRate !== null ? customLaborRate : system.laborRate;
    return Math.round(baseValue * rate);
  };

  const calculateEstimatedTime = () => {
    if (!selectedSystemId) return 0;
    const system = SYSTEMS_CATALOG.find(s => s.id === selectedSystemId);
    if (!system) return 0;
    const { area, volume } = calculateGeometricData();
    const baseValue = system.baseUnit === 'm2' ? area : volume;
    const perf = performance || system.performance || 1;
    return Math.ceil(baseValue / perf);
  };

  const calculateTotalCost = () => {
    const materialsTotal = currentMaterials.reduce((acc, m) => acc + m.total, 0);
    const laborTotal = calculateLaborCost();
    const costoDirecto = materialsTotal + laborTotal;
    const ggAmount = Math.round(costoDirecto * (ggPercent / 100));
    const profitAmount = Math.round((costoDirecto + ggAmount) * (profitPercent / 100));
    const totalVenta = costoDirecto + ggAmount + profitAmount;
    
    return {
      materials: materialsTotal,
      labor: laborTotal,
      costoDirecto,
      gg: ggAmount,
      profit: profitAmount,
      total: totalVenta
    };
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
        labor_rate: customLaborRate,
        gg_percent: ggPercent,
        profit_percent: profitPercent,
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
    const { materials: matCost, labor: laborCost, costoDirecto, gg: ggAmount, profit: profitAmount, total } = calculateTotalCost();
    const dims = editedDims;
    const materials = currentMaterials;

    // Header
    doc.setFillColor(15, 23, 42); // Slate 900
    doc.rect(0, 0, 210, 45, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont("helvetica", "bold");
    doc.text("ObraGo v2.0", 15, 22);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text("SOFTWARE DE PRESUPUESTACIÓN E INTELIGENCIA ARTIFICIAL", 15, 32);
    doc.text(new Date().toLocaleDateString() + " " + new Date().toLocaleTimeString(), 160, 22);

    // Metadata & Quality
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(`PROYECTO: ${projectNameInput || 'Sin Nombre'}`, 15, 60);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Sistema Detectado: ${SYSTEMS_CATALOG.find(s => s.id === selectedSystemId)?.name || result.sistema}`, 15, 68);
    
    if (result.calidad_analisis?.advertencia) {
      doc.setTextColor(185, 28, 28); // Red 700
      doc.setFontSize(8);
      doc.text(`AVISO DE CALIDAD: ${result.calidad_analisis.advertencia}`, 15, 74);
      doc.setTextColor(0, 0, 0);
    }

    // Dimensions
    doc.setDrawColor(226, 232, 240);
    doc.line(15, 82, 195, 82);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("DIMENSIONES TÉCNICAS", 15, 90);
    doc.setFont("helvetica", "normal");
    doc.text(`Largo: ${dims.largo}m    |    Ancho: ${dims.ancho}m    |    Espesor: ${dims.espesor}m    |    Superficie: ${(dims.largo * dims.ancho).toFixed(2)}m2`, 15, 98);

    // Execution Dashboard
    doc.setFillColor(240, 253, 244); // Emerald 50
    doc.rect(15, 105, 180, 15, 'F');
    doc.setTextColor(21, 128, 61); // Emerald 700
    doc.setFont("helvetica", "bold");
    doc.text("MÉTRICAS DE EJECUCIÓN", 20, 112);
    doc.setFont("helvetica", "normal");
    doc.text(`Plazo: ${calculateEstimatedTime()} Días    |    Cuadrilla: ${SYSTEMS_CATALOG.find(s => s.id === selectedSystemId)?.squad || "Maestro + Ayudante"}`, 80, 112);
    doc.setTextColor(0, 0, 0);

    // Materials Table - PRINCIPALES
    doc.setFillColor(248, 250, 252);
    doc.rect(15, 125, 180, 8, 'F');
    doc.setFont("helvetica", "bold");
    doc.text("MATERIALES PRINCIPALES", 20, 131);
    doc.text("Cant.", 100, 131);
    doc.text("Precio", 135, 131);
    doc.text("Subtotal", 170, 131);

    // Table Content Principal
    doc.setFont("helvetica", "normal");
    let y = 140;
    const principal = materials.filter(m => ["Planchas", "Perfiles", "Hormigones", "Aislación"].includes(m.category));
    principal.forEach((m) => {
      doc.text(m.name, 20, y);
      doc.text(m.quantity.toString(), 100, y);
      doc.text(`$${m.price.toLocaleString('es-CL')}`, 135, y);
      doc.text(`$${m.total.toLocaleString('es-CL')}`, 170, y);
      y += 7;
    });

    // Materials Table - INSUMOS
    y += 5;
    doc.setFillColor(255, 251, 235); // Amber 50
    doc.rect(15, y, 180, 8, 'F');
    doc.setTextColor(180, 83, 9); // Amber 700
    doc.setFont("helvetica", "bold");
    doc.text("INSUMOS / FIJACIONES / CONSUMIBLES", 20, y + 6);
    doc.setTextColor(0, 0, 0);

    y += 14;
    doc.setFont("helvetica", "normal");
    const insumos = materials.filter(m => ["Fijaciones", "Otros"].includes(m.category));
    insumos.forEach((m) => {
      doc.text(m.name, 20, y);
      doc.text(m.quantity.toString(), 100, y);
      doc.text(`$${m.price.toLocaleString('es-CL')}`, 135, y);
      doc.text(`$${m.total.toLocaleString('es-CL')}`, 170, y);
      y += 7;
    });

    // Labor
    y += 5;
    doc.line(15, y, 195, y);
    y += 8;
    doc.setFont("helvetica", "bold");
    doc.text("MANO DE OBRA ESPECIALIZADA", 20, y);
    doc.setFontSize(8);
    doc.text(`(Plazo: ${calculateEstimatedTime()} días | Cuadrilla: ${SYSTEMS_CATALOG.find(s => s.id === selectedSystemId)?.squad || "Personal"})`, 85, y);
    doc.setFontSize(10);
    doc.text(`$${laborCost.toLocaleString('es-CL')}`, 170, y);
    
    // Summary APU Block
    y += 15;
    if (y > 230) { doc.addPage(); y = 20; }
    doc.setFillColor(15, 23, 42); 
    doc.rect(120, y, 75, 45, 'F');
    doc.setTextColor(255, 255, 255);
    
    doc.setFontSize(8);
    doc.text("COSTO DIRECTO:", 125, y + 10);
    doc.text(`$${costoDirecto.toLocaleString('es-CL')}`, 188, y + 10, { align: "right" });
    
    doc.text(`GASTOS GENERALES (${ggPercent}%):`, 125, y + 18);
    doc.text(`+ $${ggAmount.toLocaleString('es-CL')}`, 188, y + 18, { align: "right" });
    
    doc.text(`UTILIDAD (${profitPercent}%):`, 125, y + 26);
    doc.text(`+ $${profitAmount.toLocaleString('es-CL')}`, 188, y + 26, { align: "right" });

    // Internal reference for total materials
    console.log("Material Cost for report:", matCost);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("TOTAL VENTA:", 125, y + 38);
    doc.setTextColor(59, 130, 246);
    doc.text(`$${total.toLocaleString('es-CL')}`, 188, y + 38, { align: "right" });

    // Footer
    doc.setTextColor(148, 163, 184);
    doc.setFontSize(7);
    doc.text("ObraGo AI | Reporte de presupuestación generado automáticamente. Los valores son referenciales.", 15, 285);

    doc.save(`Presupuesto_ObraGo_v2_${projectNameInput.replace(/\s/g, '_')}.pdf`);
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
              <h2 className="text-2xl font-black tracking-tight">Cubicación Inteligente v2.0</h2>
              <p className="text-muted-foreground text-sm max-w-xs mx-auto">Sube una foto de la estructura y la IA generará un presupuesto profesional completo.</p>
            </div>
            
            {/* PRUEBA DE CALIDAD IA - ADVERTENCIA PREVIA */}
            <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-2xl flex items-start gap-3 text-left max-w-sm mx-auto">
              <Sparkles className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-[11px] font-bold text-amber-800 leading-relaxed">
                <span className="block mb-1 text-sm font-black uppercase tracking-widest">Recomendación Pro</span>
                Captura la estructura de frente, con buena luz y sin obstrucciones para una precisión del 99%.
              </p>
            </div>
            
            {imagePreview ? (
              <div className="space-y-6 w-full">
                <div className="relative h-64 rounded-3xl overflow-hidden shadow-xl border-4 border-white">
                  <img src={imagePreview} className="w-full h-full object-cover" />
                  <button onClick={handleClear} className="absolute top-2 right-2 p-2 bg-black/50 rounded-full text-white"><X className="w-4 h-4" /></button>
                </div>
                <Button 
                  size="lg" 
                  onClick={() => {
                    if (showAnalysisGuide) {
                      // Trigger Guide Modal instead of direct analysis if it's the first time
                      (window as any).showGuideModal();
                    } else {
                      handleAnalyze();
                    }
                  }}
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
            {/* QUALITY WARNING BANNER */}
            {/* [v4.0] DESAMBIGUACIÓN / AVISO DE CONFIANZA */}
            {result && (result.confianza < 0.8 || (result.alternativas && result.alternativas.length > 0)) && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-amber-500/10 border border-amber-500/20 rounded-[32px] p-6 space-y-4"
              >
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-amber-500 rounded-2xl shadow-lg shadow-amber-500/20">
                    <Sparkles className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-amber-600 mb-1">Verificación Requerida</p>
                    <p className="text-sm font-bold text-foreground">La IA detectó ambigüedad. Selecciona la partida más precisa:</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {result.alternativas?.map(altId => {
                    const altSys = SYSTEMS_CATALOG.find(s => s.id === altId);
                    if (!altSys) return null;
                    return (
                      <Button
                        key={altId}
                        variant={selectedSystemId === altId ? "default" : "outline"}
                        size="sm"
                        onClick={() => setSelectedSystemId(altId)}
                        className={`rounded-xl text-[10px] font-black uppercase tracking-wider h-auto py-2 px-3 ${selectedSystemId === altId ? 'bg-amber-500 hover:bg-amber-600 text-white' : 'border-amber-500/30 text-amber-700 hover:bg-amber-500/10'}`}
                      >
                        {altSys.name}
                      </Button>
                    );
                  })}
                </div>
                
                {result.calidad_analisis?.advertencia && (
                  <p className="text-[10px] font-bold text-amber-700 italic bg-amber-500/5 p-3 rounded-xl border border-amber-500/10">
                    Nota IA: {result.calidad_analisis.advertencia}
                  </p>
                )}
              </motion.div>
            )}
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
              <div className="flex items-center justify-between px-1">
                <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Partida de Obra</label>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-auto py-0 text-[9px] font-bold text-primary hover:bg-transparent"
                  onClick={() => setIsGuideOpen(true)}
                >
                  ¿No es la correcta?
                </Button>
              </div>
              <select 
                value={selectedSystemId || ''}
                onChange={(e) => {
                  const newId = e.target.value;
                  const oldId = selectedSystemId;
                  setSelectedSystemId(newId);
                  // [v4.0] Trigger feedback loop if user changes it manually after AI detection
                  if (result && oldId && oldId !== newId) {
                    handleFeedback(newId);
                  }
                }}
                className="w-full bg-secondary/50 border border-border rounded-2xl py-4 px-5 text-sm font-bold focus:ring-2 focus:ring-primary outline-none transition-all appearance-none cursor-pointer"
              >
                {Array.from(new Set(SYSTEMS_CATALOG.map(s => s.category))).map(cat => (
                  <optgroup key={cat} label={cat}>
                    {SYSTEMS_CATALOG.filter(s => s.category === cat).map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            <div className="relative h-72 rounded-[32px] overflow-hidden shadow-2xl group border-4 border-white">
              <img src={imagePreview || historyImageUrl || ''} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
              <div className="absolute bottom-6 left-6 text-white space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-widest bg-primary px-3 py-1 rounded-full shadow-lg text-white">IA Detectado</span>
                  <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full shadow-lg text-white ${Number(result.confianza) >= 0.8 ? 'bg-emerald-500' : Number(result.confianza) >= 0.5 ? 'bg-amber-500' : 'bg-destructive'}`}>
                    Confianza {(Number(result.confianza) * 100).toFixed(0)}%
                  </span>
                </div>
                <h3 className="text-2xl font-black tracking-tight">{result.partida || result.elemento}</h3>
                <p className="text-xs font-bold text-white/70 italic">{result.subtipo || result.sistema}</p>
              </div>
            </div>

            <div className="bg-card border border-border rounded-3xl p-6 space-y-6 shadow-sm">
              <div className="flex items-center justify-between border-b border-border pb-4">
                <h4 className="font-black text-sm uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Maximize className="w-4 h-4" /> Dimensiones
                </h4>
                <div className="flex bg-secondary/50 p-1 rounded-xl ring-1 ring-border">
                  <button 
                    onClick={() => unitMode !== 'm' && toggleUnits()}
                    className={`px-3 py-1 text-[10px] font-black uppercase rounded-lg transition-all ${unitMode === 'm' ? 'bg-primary text-white shadow-md' : 'text-muted-foreground'}`}
                  >
                    Metros
                  </button>
                  <button 
                    onClick={() => unitMode !== 'cm' && toggleUnits()}
                    className={`px-3 py-1 text-[10px] font-black uppercase rounded-lg transition-all ${unitMode === 'cm' ? 'bg-primary text-white shadow-md' : 'text-muted-foreground'}`}
                  >
                    cm
                  </button>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setIsValidated(!isValidated)} className="text-primary text-xs font-bold">
                  {isValidated ? "Editar" : "Confirmar"}
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* LARGO - SIEMPRE VISIBLE */}
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-muted-foreground uppercase px-1">Largo ({unitMode})</label>
                  <input 
                    type="text"
                    inputMode="decimal"
                    value={localLargo}
                    onChange={(e) => handleLocalInputChange('largo', e.target.value)}
                    placeholder="0.00"
                    disabled={isValidated}
                    className="w-full bg-secondary/50 border border-border rounded-xl py-4 px-4 text-sm font-black focus:ring-2 focus:ring-primary outline-none transition-all text-center disabled:opacity-50"
                  />
                </div>

                {/* ANCHO - SOLO CIELO / RADIER */}
                {selectedSystemId !== 'tabique_st' && (
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-muted-foreground uppercase px-1">Ancho ({unitMode})</label>
                    <input 
                      type="text"
                      inputMode="decimal"
                      value={localAncho}
                      onChange={(e) => handleLocalInputChange('ancho', e.target.value)}
                      placeholder="0.00"
                      disabled={isValidated}
                      className="w-full bg-secondary/50 border border-border rounded-xl py-4 px-4 text-sm font-black focus:ring-2 focus:ring-primary outline-none transition-all text-center disabled:opacity-50"
                    />
                  </div>
                )}

                {/* ALTO - SOLO TABIQUE */}
                {selectedSystemId === 'tabique_st' && (
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-muted-foreground uppercase px-1">Alto ({unitMode})</label>
                    <input 
                      type="text"
                      inputMode="decimal"
                      value={localAlto}
                      onChange={(e) => handleLocalInputChange('alto', e.target.value)}
                      placeholder="0.00"
                      disabled={isValidated}
                      className="w-full bg-secondary/50 border border-border rounded-xl py-4 px-4 text-sm font-black focus:ring-2 focus:ring-primary outline-none transition-all text-center disabled:opacity-50"
                    />
                  </div>
                )}

                {/* ESPESOR - SOLO RADIER */}
                {selectedSystemId === 'radier_estandar' && (
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-muted-foreground uppercase px-1">Espesor ({unitMode})</label>
                    <input 
                      type="text"
                      inputMode="decimal"
                      value={localEspesor}
                      onChange={(e) => handleLocalInputChange('espesor', e.target.value)}
                      placeholder="0.00"
                      disabled={isValidated}
                      className="w-full bg-secondary/50 border border-border rounded-xl py-4 px-4 text-sm font-black focus:ring-2 focus:ring-primary outline-none transition-all text-center disabled:opacity-50"
                    />
                  </div>
                )}
              </div>

              {/* AUTOMATIC METRICS DASHBOARD (v2.0+) */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="bg-primary/5 p-4 rounded-[28px] border border-primary/10">
                  <p className="text-[9px] font-black text-primary/60 uppercase tracking-widest leading-none mb-1">Superficie</p>
                  <p className="text-lg font-black text-primary tracking-tight">{calculateGeometricData().area.toFixed(2)} m²</p>
                </div>
                <div className="bg-secondary/30 p-4 rounded-[28px] border border-border/10">
                  <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest leading-none mb-1">Mano de Obra</p>
                  <p className="text-lg font-black text-foreground tracking-tight">${calculateLaborCost().toLocaleString('es-CL')}</p>
                </div>
              </div>
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

                    <div className="space-y-3">
                    <div className="space-y-6">
                      {/* SECTION 1: MATERIALES PRINCIPALES */}
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 px-1">
                          <div className="w-1 h-4 bg-primary rounded-full" />
                          <h5 className="text-[10px] font-black uppercase tracking-widest text-foreground">Materiales Principales</h5>
                        </div>
                        {currentMaterials.filter(m => ["Planchas", "Perfiles", "Hormigones", "Aislación"].includes(m.category)).map((item, idx) => (
                          <div key={`m-${idx}`} className="p-4 bg-secondary/20 rounded-2xl border border-border/5 group hover:border-primary/20 transition-all flex flex-col gap-3">
                            <div className="flex items-center justify-between">
                              <div className="space-y-0.5">
                                <p className="text-[11px] font-black text-foreground uppercase tracking-tight">{item.name}</p>
                                <p className="text-[9px] text-muted-foreground font-bold italic">Rend: {item.baseQuantity} {item.unit}/un</p>
                              </div>
                              <button 
                                onClick={() => {
                                  const newMats = currentMaterials.filter(cm => cm.id !== item.id);
                                  setCustomMaterials(newMats);
                                }}
                                className="p-2 text-destructive/40 hover:text-destructive hover:bg-destructive/10 rounded-xl transition-all"
                                title="Eliminar ítem"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                            
                            <div className="grid grid-cols-12 gap-2 items-end">
                              <div className="col-span-4 space-y-1">
                                <label className="text-[8px] font-black text-muted-foreground uppercase px-1">Cantidad</label>
                                <input 
                                  type="number"
                                  value={item.quantity}
                                  title={`Cantidad para ${item.name}`}
                                  placeholder="0.00"
                                  onChange={(e) => {
                                    const val = parseFloat(e.target.value) || 0;
                                    const newMats = currentMaterials.map(cm => cm.id === item.id ? { ...cm, quantity: val, total: Math.round(val * cm.price) } : cm);
                                    setCustomMaterials(newMats);
                                  }}
                                  className="w-full bg-background/50 border-none rounded-lg py-1.5 px-2 text-[11px] font-black focus:ring-1 focus:ring-primary transition-all text-center"
                                />
                              </div>
                              <div className="col-span-4 space-y-1">
                                <label className="text-[8px] font-black text-muted-foreground uppercase px-1">Precio Un.</label>
                                <input 
                                  type="number"
                                  value={item.price}
                                  title={`Precio unitario para ${item.name}`}
                                  placeholder="0"
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value) || 0;
                                    const newMats = currentMaterials.map(cm => cm.id === item.id ? { ...cm, price: val, total: Math.round(cm.quantity * val) } : cm);
                                    setCustomMaterials(newMats);
                                  }}
                                  className="w-full bg-background/50 border-none rounded-lg py-1.5 px-2 text-[11px] font-black focus:ring-1 focus:ring-primary transition-all text-right"
                                />
                              </div>
                              <div className="col-span-4 text-right pb-1.5">
                                <p className="text-[8px] font-black text-muted-foreground uppercase leading-none mb-1">Subtotal</p>
                                <p className="text-[11px] font-black text-primary leading-none">${item.total.toLocaleString('es-CL')}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* SECTION 2: INSUMOS Y FIJACIONES (EXPERT DETAIL) */}
                      <div className="space-y-3 pt-4">
                        <div className="flex items-center gap-2 px-1">
                          <div className="w-1 h-4 bg-amber-500 rounded-full" />
                          <h5 className="text-[10px] font-black uppercase tracking-widest text-foreground">Insumos y Fijaciones <span className="ml-2 text-[8px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Nivel Experto</span></h5>
                        </div>
                        {currentMaterials.filter(m => ["Fijaciones", "Otros"].includes(m.category)).map((item, idx) => (
                          <div key={`i-${idx}`} className="p-4 bg-amber-500/5 rounded-2xl border border-amber-500/10 group hover:border-amber-500/30 transition-all flex flex-col gap-3">
                            <div className="flex items-center justify-between">
                              <div className="space-y-0.5">
                                <p className="text-[11px] font-black text-foreground uppercase tracking-tight">{item.name}</p>
                                <p className="text-[9px] text-muted-foreground font-bold italic">Consumo Est.: {item.baseQuantity} {item.unit}/un</p>
                              </div>
                              <button 
                                onClick={() => {
                                  const newMats = currentMaterials.filter(cm => cm.id !== item.id);
                                  setCustomMaterials(newMats);
                                }}
                                className="p-2 text-destructive/40 hover:text-destructive hover:bg-destructive/10 rounded-xl transition-all"
                                title="Eliminar ítem"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                            
                            <div className="grid grid-cols-12 gap-2 items-end">
                              <div className="col-span-4 space-y-1">
                                <label className="text-[8px] font-black text-muted-foreground uppercase px-1">Cantidad</label>
                                <input 
                                  type="number"
                                  value={item.quantity}
                                  title={`Cantidad para ${item.name}`}
                                  placeholder="0.00"
                                  onChange={(e) => {
                                    const val = parseFloat(e.target.value) || 0;
                                    const newMats = currentMaterials.map(cm => cm.id === item.id ? { ...cm, quantity: val, total: Math.round(val * cm.price) } : cm);
                                    setCustomMaterials(newMats);
                                  }}
                                  className="w-full bg-background/50 border-none rounded-lg py-1.5 px-2 text-[11px] font-black focus:ring-1 focus:ring-amber-500 transition-all text-center"
                                />
                              </div>
                              <div className="col-span-4 space-y-1">
                                <label className="text-[8px] font-black text-muted-foreground uppercase px-1">Precio Un.</label>
                                <input 
                                  type="number"
                                  value={item.price}
                                  title={`Precio unitario para ${item.name}`}
                                  placeholder="0"
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value) || 0;
                                    const newMats = currentMaterials.map(cm => cm.id === item.id ? { ...cm, price: val, total: Math.round(cm.quantity * val) } : cm);
                                    setCustomMaterials(newMats);
                                  }}
                                  className="w-full bg-background/50 border-none rounded-lg py-1.5 px-2 text-[11px] font-black focus:ring-1 focus:ring-amber-500 transition-all text-right"
                                />
                              </div>
                              <div className="col-span-4 text-right pb-1.5">
                                <p className="text-[8px] font-black text-muted-foreground uppercase leading-none mb-1">Subtotal</p>
                                <p className="text-[11px] font-black text-amber-600 leading-none">${item.total.toLocaleString('es-CL')}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    
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
                            total: mat.refPrice,
                            category: mat.category
                          }]);
                        }
                      }}
                    >
                      <Plus className="w-4 h-4 mr-2 group-hover:scale-110 transition-transform" /> Agregar Insumo
                    </Button>

                    {/* MANO DE OBRA SECTION */}
                    <div className="pt-6 border-t border-border/50 space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="font-black text-sm uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                          <Users className="w-4 h-4 text-primary" /> Mano de Obra
                        </h4>
                      </div>
                      
                      <div className="p-5 bg-secondary/30 rounded-3xl border border-border/10 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="text-[9px] font-bold text-muted-foreground uppercase px-1">Tarifa por {SYSTEMS_CATALOG.find(s => s.id === selectedSystemId)?.baseUnit || 'u'}</label>
                            <input 
                              type="number"
                              value={customLaborRate || 0}
                              aria-label="Tarifa de Mano de Obra"
                              placeholder="0"
                              onChange={(e) => setCustomLaborRate(parseInt(e.target.value) || 0)}
                              className="w-full bg-background border border-border rounded-xl py-2 px-3 text-xs font-bold focus:ring-1 focus:ring-primary"
                            />
                          </div>
                          <div className="text-right flex flex-col justify-center">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase">Subtotal M.O</span>
                            <span className="text-xs font-black text-primary">${calculateLaborCost().toLocaleString('es-CL')}</span>
                          </div>
                        </div>
                      </div>
                      
                      {/* ESTIMATED TIME & SQUAD indicator (PRODUCT v2.0) */}
                      <div className="flex flex-col gap-3 p-5 bg-emerald-500/10 border border-emerald-500/20 rounded-3xl">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-emerald-500/20 rounded-lg text-emerald-600">
                               <Clock className="w-5 h-5 text-emerald-600" />
                            </div>
                            <div className="space-y-0.5">
                              <p className="text-[10px] font-black text-emerald-800 uppercase tracking-widest leading-none">Plazo Estimado</p>
                              <p className="text-sm font-black text-emerald-700">{calculateEstimatedTime()} Días Hábiles</p>
                            </div>
                          </div>
                          <div className="text-right">
                             <span className="text-[9px] font-black text-emerald-700/50 uppercase tracking-tighter">Rend: {performance} un/día</span>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-3 pt-3 border-t border-emerald-500/10">
                          <div className="p-2 bg-emerald-500/20 rounded-lg text-emerald-600">
                             <Users className="w-5 h-5 text-emerald-600" />
                          </div>
                          <div className="space-y-0.5">
                            <p className="text-[10px] font-black text-emerald-800 uppercase tracking-widest leading-none">Cuadrilla Recomendada</p>
                            <p className="text-sm font-black text-emerald-700">{SYSTEMS_CATALOG.find(s => s.id === selectedSystemId)?.squad || result.recomendacion_cuadrilla || "Maestro + Ayudante"}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* APU INDIRECTS SECTION */}
                  <div className="pt-6 border-t border-border/50 space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-black text-sm uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                        <Maximize className="w-4 h-4 text-primary" /> Costos Indirectos
                      </h4>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-secondary/20 rounded-2xl border border-border/10 space-y-1">
                        <label className="text-[9px] font-bold text-muted-foreground uppercase px-1">G. Generales (%)</label>
                        <input 
                          type="number"
                          value={ggPercent}
                          onChange={(e) => setGgPercent(parseFloat(e.target.value) || 0)}
                          className="w-full bg-background border border-border rounded-xl py-2 px-3 text-xs font-bold focus:ring-1 focus:ring-primary"
                        />
                      </div>
                      <div className="p-4 bg-secondary/20 rounded-2xl border border-border/10 space-y-1">
                        <label className="text-[9px] font-bold text-muted-foreground uppercase px-1">Utilidad (%)</label>
                        <input 
                          type="number"
                          value={profitPercent}
                          onChange={(e) => setProfitPercent(parseFloat(e.target.value) || 0)}
                          className="w-full bg-background border border-border rounded-xl py-2 px-3 text-xs font-bold focus:ring-1 focus:ring-primary"
                        />
                      </div>
                    </div>
                  </div>

                  {/* PROFESSIONAL APU SUMMARY */}
                  <div className="bg-primary text-white rounded-[32px] p-8 shadow-xl shadow-primary/20 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -mr-24 -mt-24 blur-3xl" />
                    <div className="space-y-6 relative z-10">
                      <div className="flex justify-between items-center opacity-80 text-[10px] font-black uppercase tracking-[0.2em]">
                        <span>Análisis de Precio Unitario (APU)</span>
                        <span>CLP</span>
                      </div>
                      
                      <div className="space-y-3 font-bold border-b border-white/10 pb-6">
                        <div className="flex justify-between text-xs opacity-70">
                          <span>Subtotal Materiales</span>
                          <span>${calculateTotalCost().materials.toLocaleString('es-CL')}</span>
                        </div>
                        <div className="flex justify-between text-xs opacity-70">
                          <span>Mano de Obra</span>
                          <span>${calculateTotalCost().labor.toLocaleString('es-CL')}</span>
                        </div>
                        <div className="flex justify-between text-sm pt-2 border-t border-white/5">
                          <span>COSTO DIRECTO</span>
                          <span>${calculateTotalCost().costoDirecto.toLocaleString('es-CL')}</span>
                        </div>
                        
                        <div className="flex justify-between text-xs pt-2 opacity-70">
                          <span>Gastos Generales ({ggPercent}%)</span>
                          <span>+ ${calculateTotalCost().gg.toLocaleString('es-CL')}</span>
                        </div>
                        <div className="flex justify-between text-xs opacity-70">
                          <span>Utilidad ({profitPercent}%)</span>
                          <span>+ ${calculateTotalCost().profit.toLocaleString('es-CL')}</span>
                        </div>
                      </div>

                      <div className="flex flex-col items-center pt-2">
                        <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-1">Total Venta Neto</p>
                        <div className="flex items-center gap-2">
                          <span className="text-5xl font-black tabular-nums tracking-tighter">
                            ${calculateTotalCost().total.toLocaleString('es-CL')}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
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

        {isGuideOpen && (
          <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsGuideOpen(false)} className="absolute inset-0 bg-black/80 backdrop-blur-md" />
            <motion.div 
              initial={{ y: "100%", opacity: 0 }} 
              animate={{ y: 0, opacity: 1 }} 
              exit={{ y: "100%", opacity: 0 }}
              className="bg-card w-full max-w-lg rounded-[48px] p-10 relative z-10 shadow-2xl border border-border overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full -mr-32 -mt-32 blur-3xl" />
              
              <div className="relative z-10 space-y-8">
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <h3 className="text-3xl font-black tracking-tight">Guía de Análisis Pro</h3>
                    <p className="text-muted-foreground font-bold">Consigue presupuestos con 99% de precisión</p>
                  </div>
                  <X className="w-6 h-6 text-muted-foreground cursor-pointer" onClick={() => setIsGuideOpen(false)} />
                </div>

                <div className="grid gap-6">
                  {[
                    { icon: <Maximize className="w-5 h-5" />, title: "Imagen Frontal", desc: "Evita ángulos extremos. Captura la estructura de frente." },
                    { icon: <Sparkles className="w-5 h-5" />, title: "Buena Iluminación", desc: "Asegúrate de que no haya sombras densas sobre la obra." },
                    { icon: <Camera className="w-5 h-5" />, title: "Foco Nítido", desc: "La IA necesita ver las texturas de los materiales claramente." }
                  ].map((item, i) => (
                    <div key={i} className="flex gap-4 p-4 bg-secondary/30 rounded-3xl border border-border/10">
                      <div className="p-3 bg-primary/10 rounded-2xl text-primary h-fit">{item.icon}</div>
                      <div className="space-y-0.5">
                        <p className="font-black text-sm">{item.title}</p>
                        <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="space-y-4 pt-4">
                  <Button 
                    onClick={() => {
                      setIsGuideOpen(false);
                      handleAnalyze();
                    }} 
                    className="w-full h-16 rounded-[24px] font-black text-lg bg-primary hover:bg-primary/90 shadow-xl shadow-primary/30 gap-2"
                  >
                    Iniciar Análisis <Sparkles className="w-5 h-5" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    onClick={() => {
                      localStorage.setItem("skipAnalysisGuide", "true");
                      setShowAnalysisGuide(false);
                      setIsGuideOpen(false);
                      handleAnalyze();
                    }} 
                    className="w-full text-muted-foreground font-bold text-xs uppercase tracking-widest"
                  >
                    Entendido, no mostrar nuevamente
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
