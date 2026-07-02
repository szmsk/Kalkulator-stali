export type ShapeType = 'BLACHA' | 'CEOWNIK' | 'DWUTEOWNIK' | 'PRET_OKRAGLY' | 'PRET_KWADRATOWY' | 'PRET_PLASKI' | 'PROFIL_ZAMKNIETY';

export type ProfileSystem = 'UNP' | 'UPE' | 'IPE' | 'IPN' | 'HEB' | 'HEA';

export interface StandardProfile {
  name: string;
  system: ProfileSystem;
  height: number; // H (mm)
  width: number;  // S (mm)
  webThickness?: number; // mm
  flangeThickness?: number; // mm
  weightPerMeter: number; // kg/m
}

export interface CalculationItem {
  id: string;
  type: ShapeType;
  isStandard: boolean;
  profileSystem?: ProfileSystem;
  profileName?: string;
  h: number; // grubość blachy (mm) lub wysokość kształtownika H (mm)
  width: number; // szerokość (mm)
  webThickness?: number; // grubość ścianki (mm) - dla custom lub profil zamknięty
  flangeThickness?: number; // grubość półki (mm) - dla custom
  length: number; // długość (m)
  quantity: number; // sztuki
  calculatedWeightPerUnit: number; // waga jednej sztuki (kg)
  calculatedWeightTotal: number; // waga łączna (kg)
  notes?: string;
}

export interface AnalysisResult {
  detectedType: ShapeType;
  h: number | null;
  width: number | null;
  length: number | null;
  quantity: number | null;
  isStandard: boolean;
  standardProfileName: string | null;
  webThickness?: number | null;
  explanation: string;
  confidence: number;
}

export interface AnalyzedItem {
  detectedType: ShapeType;
  h: number | null;
  width: number | null;
  length: number | null; // length in meters (normalized)
  quantity: number; // zsumowana ilość sztuk
  rawQuantityList: string; // np. "1,3,5,8,20,4"
  isStandard: boolean;
  standardProfileName: string | null;
  webThickness?: number | null;
  originalText?: string; // np. "H6 - 2500x3000 - 1,3,5,8,20,4"
}

export interface MultiAnalysisResult {
  items: AnalyzedItem[];
  explanation: string;
}

