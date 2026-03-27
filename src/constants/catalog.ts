export type Material = {
  id: string;
  name: string;
  category: "Planchas" | "Perfiles" | "Fijaciones" | "Hormigones" | "Aislación" | "Otros";
  unit: "un" | "cajas" | "m2" | "m3" | "mt" | "sacos" | "kg";
  coverage: number; // Por m2 o m3
  refPrice: number; // Precio base CLP
  tags: string[];
};

export const MATERIALS_CATALOG: Material[] = [
  // PLANCHAS
  { id: "v_st_10", name: "Volcanita ST 10mm (1.2x2.4)", category: "Planchas", unit: "un", coverage: 0.35, refPrice: 7800, tags: ["tabique", "cielo"] },
  { id: "v_rh_12", name: "Volcanita RH 12.5mm (1.2x2.4)", category: "Planchas", unit: "un", coverage: 0.35, refPrice: 12500, tags: ["tabique", "baño", "cocina"] },
  
  // PERFILES
  { id: "mont_60", name: "Montante 60x38x0.5mm 3mt", category: "Perfiles", unit: "mt", coverage: 0.85, refPrice: 3200, tags: ["tabique", "metalcon"] },
  { id: "canal_60", name: "Canal 60x38x0.5mm 3mt", category: "Perfiles", unit: "mt", coverage: 0.45, refPrice: 2800, tags: ["tabique", "metalcon"] },
  { id: "omega", name: "Perfil Omega 3mt", category: "Perfiles", unit: "mt", coverage: 0.80, refPrice: 2500, tags: ["cielo", "revestimiento"] },
  
  // FIJACIONES
  { id: "torn_6x1", name: "Tornillo CRS 6x1 (100un)", category: "Fijaciones", unit: "cajas", coverage: 0.25, refPrice: 4500, tags: ["tabique", "planchas"] },
  
  // HORMIGONES / MEZCLAS
  { id: "horm_premix", name: "Hormigón Premezclado H20", category: "Hormigones", unit: "m3", coverage: 1.0, refPrice: 85000, tags: ["radier", "cimiento"] },
  { id: "malla_acma_c92", name: "Malla ACMA C-92 (2.6x5mt)", category: "Hormigones", unit: "un", coverage: 0.08, refPrice: 35000, tags: ["radier", "losa"] },
  
  // AISLACIÓN
  { id: "lana_vidrio_40", name: "Lana de Vidrio 40mm R100", category: "Aislación", unit: "m2", coverage: 1.05, refPrice: 4200, tags: ["tabique", "cielo", "aislacion"] }
];

export type ConstructionSystem = {
  id: string;
  name: string;
  baseUnit: "m2" | "m3";
  materialIds: string[];
};

export const SYSTEMS_CATALOG: ConstructionSystem[] = [
  { 
    id: "tabique_st", 
    name: "Tabiquería Volcanita ST", 
    baseUnit: "m2", 
    materialIds: ["v_st_10", "mont_60", "canal_60", "torn_6x1", "lana_vidrio_40"] 
  },
  { 
    id: "cielo_falso_st", 
    name: "Cielo Falso Yeso-Cartón", 
    baseUnit: "m2", 
    materialIds: ["v_st_10", "omega", "torn_6x1"] 
  },
  { 
    id: "radier_estandar", 
    name: "Radier de Hormigón H20", 
    baseUnit: "m3", 
    materialIds: ["horm_premix", "malla_acma_c92"] 
  }
];
