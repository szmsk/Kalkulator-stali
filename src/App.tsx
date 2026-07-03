import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Check, 
  Info, 
} from 'lucide-react';

import { ShapeType, CalculationItem, MultiAnalysisResult, ProfileSystem } from './types';
import { STANDARD_CHANNELS, STANDARD_IBEAMS, findStandardProfile } from './data/profiles';
import { calculateWeight } from './utils/calculator';
import DrawingUploader from './components/DrawingUploader';
import CalculationList from './components/CalculationList';
import { exportToExcel, exportToPDF } from './utils/export';

export default function App() {
  // Shape selection
  const [activeTab, setActiveTab] = useState<ShapeType>('BLACHA');

  // Load preferences helper
  const getPreferredSystem = (type: 'CEOWNIK' | 'DWUTEOWNIK'): ProfileSystem => {
    if (type === 'CEOWNIK') {
      const saved = localStorage.getItem('biastal_pref_ceownik');
      return (saved as ProfileSystem) || 'UNP';
    } else {
      const saved = localStorage.getItem('biastal_pref_dwuteownik');
      return (saved as ProfileSystem) || 'IPN';
    }
  };

  const mapProfileToPreferredSystem = (
    detectedType: 'CEOWNIK' | 'DWUTEOWNIK',
    standardProfileName: string,
    height: number
  ): string => {
    const prefSys = getPreferredSystem(detectedType);
    
    // Check if the current profile already matches the preferred system
    const currentProfile = findStandardProfile(standardProfileName);
    if (currentProfile && currentProfile.system === prefSys) {
      return standardProfileName;
    }

    // Try to find a profile in the preferred system with the same size number or height
    const numMatch = standardProfileName.match(/\d+/);
    const sizeNumber = numMatch ? numMatch[0] : String(height);

    const candidates = detectedType === 'CEOWNIK' ? STANDARD_CHANNELS : STANDARD_IBEAMS;
    const prefCandidates = candidates.filter(p => p.system === prefSys);

    // 1. Try matching the exact name with the preferred prefix
    const targetName = `${prefSys} ${sizeNumber}`;
    const matchByName = prefCandidates.find(
      p => p.name.toUpperCase().replace(/\s+/g, '') === targetName.toUpperCase().replace(/\s+/g, '')
    );
    if (matchByName) {
      return matchByName.name;
    }

    // 2. Try matching by height
    const matchByHeight = prefCandidates.find(p => p.height === height);
    if (matchByHeight) {
      return matchByHeight.name;
    }

    // 3. Fallback: find closest height in that system
    if (prefCandidates.length > 0) {
      const closest = prefCandidates.reduce((prev, curr) => {
        return Math.abs(curr.height - height) < Math.abs(prev.height - height) ? curr : prev;
      });
      return closest.name;
    }

    return standardProfileName;
  };
  
  // Calculator state
  const [isStandard, setIsStandard] = useState<boolean>(true);
  const [profileSystem, setProfileSystem] = useState<ProfileSystem>(() => {
    const saved = localStorage.getItem('biastal_pref_ceownik');
    return (saved as ProfileSystem) || 'UNP';
  });
  const [selectedProfileName, setSelectedProfileName] = useState<string>('UNP 80');
  
  // Geometric inputs (for Sheet or Custom profiles)
  const [h, setH] = useState<number>(8); // mm (default thickness or height)
  const [width, setWidth] = useState<number>(1000); // mm (default width)
  const [length, setLength] = useState<number>(2500); // mm (default length)
  const [quantity, setQuantity] = useState<number>(1); // pieces
  
  // Custom profile thicknesses (optional)
  const [webThickness, setWebThickness] = useState<number | ''>('');
  const [flangeThickness, setFlangeThickness] = useState<number | ''>('');

  // Item list state
  const [calculationItems, setCalculationItems] = useState<CalculationItem[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Sync profile options when system or standard tab changes
  useEffect(() => {
    if (activeTab === 'CEOWNIK') {
      setIsStandard(true);
      const prefSys = getPreferredSystem('CEOWNIK');
      setProfileSystem(prefSys);
      // Find preferred selected profile name if saved, or use first profile of system
      const savedProfile = localStorage.getItem(`biastal_pref_profile_name_${prefSys}`);
      if (savedProfile && findStandardProfile(savedProfile)) {
        setSelectedProfileName(savedProfile);
      } else {
        const first = STANDARD_CHANNELS.find(p => p.system === prefSys);
        setSelectedProfileName(first ? first.name : 'UNP 80');
      }
    } else if (activeTab === 'DWUTEOWNIK') {
      setIsStandard(true);
      const prefSys = getPreferredSystem('DWUTEOWNIK');
      setProfileSystem(prefSys);
      // Find preferred selected profile name if saved, or use first profile of system
      const savedProfile = localStorage.getItem(`biastal_pref_profile_name_${prefSys}`);
      if (savedProfile && findStandardProfile(savedProfile)) {
        setSelectedProfileName(savedProfile);
      } else {
        const first = STANDARD_IBEAMS.find(p => p.system === prefSys);
        setSelectedProfileName(first ? first.name : 'IPN 120');
      }
    } else {
      setIsStandard(false); // Plates (BLACHA) are never standard-profiles
    }
  }, [activeTab]);

  // Sync profile dimensions to inputs when standard profile is chosen
  useEffect(() => {
    if (isStandard && (activeTab === 'CEOWNIK' || activeTab === 'DWUTEOWNIK')) {
      const p = findStandardProfile(selectedProfileName);
      if (p) {
        setH(p.height);
        setWidth(p.width);
        if (p.webThickness) setWebThickness(p.webThickness);
        if (p.flangeThickness) setFlangeThickness(p.flangeThickness);
      }
    }
  }, [selectedProfileName, isStandard, activeTab]);

  // Sync bar type quantity limit
  useEffect(() => {
    if (activeTab === 'PRET_OKRAGLY' || activeTab === 'PRET_KWADRATOWY' || activeTab === 'PRET_PLASKI') {
      setQuantity(1);
    }
  }, [activeTab]);

  // Calculate live results
  const currentCalc = calculateWeight({
    type: activeTab,
    isStandard,
    profileName: selectedProfileName,
    h,
    width: (activeTab === 'PRET_OKRAGLY' || activeTab === 'PRET_KWADRATOWY' || activeTab === 'RURA') ? h : width,
    length: activeTab === 'BLACHA' ? length / 1000 : length,
    quantity: (activeTab === 'PRET_OKRAGLY' || activeTab === 'PRET_KWADRATOWY' || activeTab === 'PRET_PLASKI') ? 1 : quantity,
    webThickness: (activeTab === 'PROFIL_ZAMKNIETY' || activeTab === 'RURA' || activeTab === 'KATOWNIK') ? (webThickness !== '' ? Number(webThickness) : (activeTab === 'KATOWNIK' ? 3 : 2)) : (webThickness === '' ? undefined : Number(webThickness)),
    flangeThickness: flangeThickness === '' ? undefined : Number(flangeThickness),
  });

  // Calculate totals for export buttons in navigation
  const totalWeight = calculationItems.reduce((sum, item) => sum + item.calculatedWeightTotal, 0);

  // Header Export handlers
  const handleExportExcel = () => {
    if (calculationItems.length === 0) return;
    exportToExcel(calculationItems, totalWeight);
  };

  const handleExportPDF = () => {
    if (calculationItems.length === 0) return;
    exportToPDF(calculationItems, totalWeight);
  };

  // Handle addition of items
  const handleAddItem = () => {
    let specName = '';
    if (isStandard && (activeTab === 'CEOWNIK' || activeTab === 'DWUTEOWNIK')) {
      specName = selectedProfileName;
    } else if (activeTab === 'BLACHA') {
      specName = `Blacha ${h}x${width}x${length}mm`;
    } else if (activeTab === 'PRET_OKRAGLY') {
      specName = `Pręt okr. Ø${h}mm`;
    } else if (activeTab === 'PRET_KWADRATOWY') {
      specName = `Pręt kw. ■${h}mm`;
    } else if (activeTab === 'PRET_PLASKI') {
      specName = `Płaskownik ${h}x${width}mm`;
    } else if (activeTab === 'PROFIL_ZAMKNIETY') {
      specName = `Profil zamk. ${h}x${width}x${webThickness || 2}mm`;
    } else if (activeTab === 'RURA') {
      specName = `Rura Ø${h}x${webThickness || 2}mm`;
    } else if (activeTab === 'KATOWNIK') {
      specName = `Kątownik L ${h}x${width}x${webThickness || 3}mm`;
    } else {
      specName = `Geom. (${h}x${width}x${Math.round(length * 1000)}mm)`;
    }

    const newItem: CalculationItem = {
      id: crypto.randomUUID(),
      type: activeTab,
      isStandard,
      profileSystem: isStandard ? profileSystem : undefined,
      profileName: isStandard ? selectedProfileName : undefined,
      h,
      width: (activeTab === 'PRET_OKRAGLY' || activeTab === 'PRET_KWADRATOWY' || activeTab === 'RURA') ? h : width,
      length: activeTab === 'BLACHA' ? length / 1000 : length, // Store standard normalized in meters
      quantity: (activeTab === 'PRET_OKRAGLY' || activeTab === 'PRET_KWADRATOWY' || activeTab === 'PRET_PLASKI') ? 1 : quantity,
      webThickness: (activeTab === 'PROFIL_ZAMKNIETY' || activeTab === 'RURA' || activeTab === 'KATOWNIK') ? (webThickness !== '' ? Number(webThickness) : (activeTab === 'KATOWNIK' ? 3 : 2)) : (activeTab !== 'BLACHA' ? currentCalc.webThickness : undefined),
      flangeThickness: (activeTab !== 'BLACHA' && activeTab !== 'PRET_OKRAGLY' && activeTab !== 'PRET_KWADRATOWY' && activeTab !== 'PRET_PLASKI' && activeTab !== 'PROFIL_ZAMKNIETY' && activeTab !== 'RURA' && activeTab !== 'KATOWNIK') ? currentCalc.flangeThickness : undefined,
      calculatedWeightPerUnit: currentCalc.unitWeight,
      calculatedWeightTotal: currentCalc.totalWeight,
      notes: activeTab === 'BLACHA' 
        ? `Grubość: ${h} mm` 
        : `${specName} - dł. ${activeTab === 'BLACHA' ? length + 'mm' : length + 'm'}`
    };

    setCalculationItems(prev => [...prev, newItem]);
    showToast(`Dodano do zestawienia: ${typeLabel(activeTab)} (${specName})`);
  };

  const handleRemoveItem = (id: string) => {
    setCalculationItems(prev => prev.filter(item => item.id !== id));
  };

  const handleUpdateItem = (id: string, updatedItem: CalculationItem) => {
    setCalculationItems(prev => prev.map(item => item.id === id ? updatedItem : item));
    showToast(`Zaktualizowano pozycję: ${updatedItem.type === 'BLACHA' ? 'Blacha' : typeLabel(updatedItem.type)}`);
  };

  const handleRemoveLastItem = () => {
    if (calculationItems.length > 0) {
      const lastItem = calculationItems[calculationItems.length - 1];
      setCalculationItems(prev => prev.slice(0, -1));
      showToast(`Usunięto ostatnią pozycję: ${lastItem.type === 'BLACHA' ? 'Blacha' : typeLabel(lastItem.type)}`);
    }
  };

  const handleClearAll = () => {
    setCalculationItems([]);
    showToast('Wyczyszczono wszystkie kalkulacje.');
  };

  // Helper translations
  const typeLabel = (t: ShapeType) => {
    if (t === 'BLACHA') return 'Blacha';
    if (t === 'CEOWNIK') return 'Ceownik g/w';
    if (t === 'DWUTEOWNIK') return 'Dwuteownik';
    if (t === 'PRET_OKRAGLY') return 'Pręt okrągły gładki';
    if (t === 'PRET_KWADRATOWY') return 'Pręt kwadratowy';
    if (t === 'PRET_PLASKI') return 'Pręt płaski / Płaskownik';
    if (t === 'PROFIL_ZAMKNIETY') return 'Profil zamknięty';
    if (t === 'RURA') return 'Rura';
    if (t === 'KATOWNIK') return 'Kątownik';
    return t;
  };

  // Triggered when Gemini AI scans an image and returns values
  const handleAiAnalysisComplete = (result: MultiAnalysisResult) => {
    if (!result.items || result.items.length === 0) {
      showToast('AI nie wykryło żadnych pozycji na zdjęciu.');
      return;
    }

    const newItems: CalculationItem[] = result.items.map(aiItem => {
      let matchedWebThick: number | undefined = undefined;
      let matchedFlangeThick: number | undefined = undefined;
      let finalH = aiItem.h || 0;
      let finalWidth = aiItem.width || 0;
      let finalProfileName = aiItem.standardProfileName;

      if (aiItem.isStandard && finalProfileName && (aiItem.detectedType === 'CEOWNIK' || aiItem.detectedType === 'DWUTEOWNIK')) {
        finalProfileName = mapProfileToPreferredSystem(aiItem.detectedType, finalProfileName, finalH);
        const matched = findStandardProfile(finalProfileName);
        if (matched) {
          finalH = matched.height;
          finalWidth = matched.width;
          matchedWebThick = matched.webThickness;
          matchedFlangeThick = matched.flangeThickness;
        }
      }

      // Calculate weight using length in meters (normalized)
      const lengthInMeters = aiItem.length || 0;
      const calc = calculateWeight({
        type: aiItem.detectedType,
        isStandard: aiItem.isStandard,
        profileName: finalProfileName || undefined,
        h: finalH,
        width: (aiItem.detectedType === 'PRET_OKRAGLY' || aiItem.detectedType === 'PRET_KWADRATOWY' || aiItem.detectedType === 'RURA') ? finalH : finalWidth,
        length: lengthInMeters,
        quantity: aiItem.quantity || 1,
        webThickness: aiItem.detectedType === 'PROFIL_ZAMKNIETY' ? (aiItem.webThickness || 2) : matchedWebThick,
        flangeThickness: matchedFlangeThick
      });

      const specName = aiItem.isStandard && finalProfileName
        ? finalProfileName
        : aiItem.detectedType === 'BLACHA'
          ? `Blacha ${finalH}x${finalWidth}x${Math.round(lengthInMeters * 1000)}mm`
          : aiItem.detectedType === 'RURA'
            ? `R fi ${finalH}`
            : aiItem.detectedType === 'PRET_OKRAGLY'
              ? `Pręt okr. Ø${finalH}mm`
              : aiItem.detectedType === 'PRET_KWADRATOWY'
                ? `Pręt kw. ■${finalH}mm`
                : aiItem.detectedType === 'PRET_PLASKI'
                  ? `Płaskownik ${finalH}x${finalWidth}mm`
                  : aiItem.detectedType === 'PROFIL_ZAMKNIETY'
                    ? `Profil zamk. ${finalH}x${finalWidth}x${aiItem.webThickness || 2}mm`
                    : `Geom. (${finalH}x${finalWidth}x${Math.round(lengthInMeters * 1000)}mm)`;

      const notes = aiItem.detectedType === 'BLACHA'
        ? `Grubość: ${finalH} mm`
        : `${specName} - dł. ${lengthInMeters}m`;

      return {
        id: crypto.randomUUID(),
        type: aiItem.detectedType,
        isStandard: aiItem.isStandard,
        profileSystem: aiItem.isStandard && finalProfileName ? findStandardProfile(finalProfileName)?.system : undefined,
        profileName: aiItem.isStandard ? (finalProfileName || undefined) : undefined,
        h: finalH,
        width: (aiItem.detectedType === 'PRET_OKRAGLY' || aiItem.detectedType === 'PRET_KWADRATOWY' || aiItem.detectedType === 'RURA') ? finalH : finalWidth,
        length: lengthInMeters,
        quantity: aiItem.quantity || 1,
        webThickness: calc.webThickness || undefined,
        flangeThickness: calc.flangeThickness || undefined,
        calculatedWeightPerUnit: calc.unitWeight,
        calculatedWeightTotal: calc.totalWeight,
        notes: notes + (aiItem.rawQuantityList ? (aiItem.detectedType === 'BLACHA' ? ` (suma sztuk: ${aiItem.rawQuantityList})` : ` (suma dł: ${aiItem.rawQuantityList} m)`) : '')
      };
    });

    setCalculationItems(prev => [...prev, ...newItems]);

    // Populate the form fields with the last item for a responsive feel
    const lastItem = result.items[result.items.length - 1];
    if (lastItem) {
      setActiveTab(lastItem.detectedType);
      if (lastItem.h) setH(lastItem.h);
      if (lastItem.width) setWidth(lastItem.width);
      if (lastItem.length) {
        if (lastItem.detectedType === 'BLACHA') {
          setLength(Math.round(lastItem.length * 1000));
        } else {
          setLength(lastItem.length);
        }
      }
      if (lastItem.quantity) setQuantity(lastItem.quantity);
      if (lastItem.isStandard && lastItem.standardProfileName && (lastItem.detectedType === 'CEOWNIK' || lastItem.detectedType === 'DWUTEOWNIK')) {
        setIsStandard(true);
        const mappedName = mapProfileToPreferredSystem(lastItem.detectedType, lastItem.standardProfileName, lastItem.h || 0);
        const matched = findStandardProfile(mappedName);
        if (matched) {
          setProfileSystem(matched.system);
          setSelectedProfileName(matched.name);
        }
      } else {
        setIsStandard(lastItem.isStandard || false);
      }
    }

    showToast(`AI automatycznie dodało ${newItems.length} pozycji do zestawienia.`);
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Filters profiles by selected profile system
  const getProfilesForSystem = () => {
    if (activeTab === 'CEOWNIK') {
      return STANDARD_CHANNELS.filter(p => p.system === profileSystem);
    } else {
      return STANDARD_IBEAMS.filter(p => p.system === profileSystem);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 flex flex-col selection:bg-orange-500 selection:text-white">
      
      {/* BRAND HEADER BAR */}
      <header className="h-16 bg-slate-900 text-white flex items-center justify-between px-8 shrink-0 shadow-lg sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <img src="/icon.svg" alt="Kalkulator Wag Stali" className="w-10 h-10 object-contain" referrerPolicy="no-referrer" />
          <h1 className="text-lg font-bold tracking-tight uppercase">
            Biastal <span className="font-light text-slate-400">Kalkulator Wag</span>
          </h1>
        </div>
        
        <div className="flex gap-4">
          <button 
            onClick={handleExportExcel}
            disabled={calculationItems.length === 0}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 rounded text-xs font-semibold transition-colors border border-slate-700 cursor-pointer"
          >
            <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
            </svg>
            EKSPORT DO EXCEL
          </button>
          <button 
            onClick={handleExportPDF}
            disabled={calculationItems.length === 0}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 rounded text-xs font-semibold transition-colors border border-slate-700 cursor-pointer"
          >
            <svg className="w-4 h-4 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/>
            </svg>
            DRUKUJ PDF
          </button>
        </div>
      </header>

      {/* TOAST SYSTEM */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div 
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 bg-slate-900 text-orange-400 border border-slate-800 px-4 py-3 rounded-xl shadow-2xl z-50 flex items-center gap-2.5 text-xs font-medium"
          >
            <Check className="w-4 h-4 bg-orange-500/15 p-0.5 rounded-full" />
            {toastMessage}
          </motion.div>
        )}
      </AnimatePresence>

      {/* MAIN LAYOUT */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto p-6 flex flex-col xl:flex-row gap-6 items-start">
        
        {/* COLUMN 1: SIDEBAR (MATERIAL SELECTION & AI SCANNER) */}
        <aside className="w-full xl:w-72 shrink-0 flex flex-col gap-4">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Typ Elementu</h3>
            <div className="space-y-2">
              <button
                onClick={() => {
                  if (activeTab !== 'BLACHA') {
                    setLength(prev => Math.round(prev * 1000));
                  }
                  setActiveTab('BLACHA');
                }}
                className={`w-full flex items-center justify-between p-3 rounded-lg transition-all cursor-pointer ${
                  activeTab === 'BLACHA'
                    ? 'bg-slate-900 text-white border-l-4 border-orange-500 font-semibold shadow-md'
                    : 'hover:bg-slate-100 text-slate-600 font-medium'
                }`}
              >
                <span>Blacha Stalowa</span>
                <span className={`text-[10px] px-2 py-0.5 rounded ${
                  activeTab === 'BLACHA' ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-500'
                }`}>PLT</span>
              </button>

              <button
                onClick={() => {
                  if (activeTab === 'BLACHA') {
                    setLength(prev => prev / 1000);
                  }
                  setActiveTab('CEOWNIK');
                }}
                className={`w-full flex items-center justify-between p-3 rounded-lg transition-all cursor-pointer ${
                  activeTab === 'CEOWNIK'
                    ? 'bg-slate-900 text-white border-l-4 border-orange-500 font-semibold shadow-md'
                    : 'hover:bg-slate-100 text-slate-600 font-medium'
                }`}
              >
                <span>Ceownik g/w</span>
                <span className={`text-[10px] px-2 py-0.5 rounded ${
                  activeTab === 'CEOWNIK' ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-500'
                }`}>UPN</span>
              </button>

              <button
                onClick={() => {
                  if (activeTab === 'BLACHA') {
                    setLength(prev => prev / 1000);
                  }
                  setActiveTab('DWUTEOWNIK');
                }}
                className={`w-full flex items-center justify-between p-3 rounded-lg transition-all cursor-pointer ${
                  activeTab === 'DWUTEOWNIK'
                    ? 'bg-slate-900 text-white border-l-4 border-orange-500 font-semibold shadow-md'
                    : 'hover:bg-slate-100 text-slate-600 font-medium'
                }`}
              >
                <span>Dwuteownik</span>
                <span className={`text-[10px] px-2 py-0.5 rounded ${
                  activeTab === 'DWUTEOWNIK' ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-500'
                }`}>HEA/HEB</span>
              </button>

              <button
                onClick={() => {
                  if (activeTab === 'BLACHA') {
                    setLength(prev => prev / 1000);
                  }
                  setActiveTab('PRET_OKRAGLY');
                  setIsStandard(false);
                }}
                className={`w-full flex items-center justify-between p-3 rounded-lg transition-all cursor-pointer ${
                  activeTab === 'PRET_OKRAGLY'
                    ? 'bg-slate-900 text-white border-l-4 border-orange-500 font-semibold shadow-md'
                    : 'hover:bg-slate-100 text-slate-600 font-medium'
                }`}
              >
                <span>Pręt okrągły gładki</span>
                <span className={`text-[10px] px-2 py-0.5 rounded ${
                  activeTab === 'PRET_OKRAGLY' ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-500'
                }`}>Ø</span>
              </button>

              <button
                onClick={() => {
                  if (activeTab === 'BLACHA') {
                    setLength(prev => prev / 1000);
                  }
                  setActiveTab('PRET_KWADRATOWY');
                  setIsStandard(false);
                }}
                className={`w-full flex items-center justify-between p-3 rounded-lg transition-all cursor-pointer ${
                  activeTab === 'PRET_KWADRATOWY'
                    ? 'bg-slate-900 text-white border-l-4 border-orange-500 font-semibold shadow-md'
                    : 'hover:bg-slate-100 text-slate-600 font-medium'
                }`}
              >
                <span>Pręt kwadratowy</span>
                <span className={`text-[10px] px-2 py-0.5 rounded ${
                  activeTab === 'PRET_KWADRATOWY' ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-500'
                }`}>■</span>
              </button>

              <button
                onClick={() => {
                  if (activeTab === 'BLACHA') {
                    setLength(prev => prev / 1000);
                  }
                  setActiveTab('PRET_PLASKI');
                  setIsStandard(false);
                }}
                className={`w-full flex items-center justify-between p-3 rounded-lg transition-all cursor-pointer ${
                  activeTab === 'PRET_PLASKI'
                    ? 'bg-slate-900 text-white border-l-4 border-orange-500 font-semibold shadow-md'
                    : 'hover:bg-slate-100 text-slate-600 font-medium'
                }`}
              >
                <span>Pręt płaski</span>
                <span className={`text-[10px] px-2 py-0.5 rounded ${
                  activeTab === 'PRET_PLASKI' ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-500'
                }`}>PL</span>
              </button>

              <button
                onClick={() => {
                  if (activeTab === 'BLACHA') {
                    setLength(prev => prev / 1000);
                  }
                  setActiveTab('PROFIL_ZAMKNIETY');
                  setIsStandard(false);
                }}
                className={`w-full flex items-center justify-between p-3 rounded-lg transition-all cursor-pointer ${
                  activeTab === 'PROFIL_ZAMKNIETY'
                    ? 'bg-slate-900 text-white border-l-4 border-orange-500 font-semibold shadow-md'
                    : 'hover:bg-slate-100 text-slate-600 font-medium'
                }`}
              >
                <span>Profil zamknięty</span>
                <span className={`text-[10px] px-2 py-0.5 rounded ${
                  activeTab === 'PROFIL_ZAMKNIETY' ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-500'
                }`}>BOX</span>
              </button>

              <button
                onClick={() => {
                  if (activeTab === 'BLACHA') {
                    setLength(prev => prev / 1000);
                  }
                  setActiveTab('RURA');
                  setIsStandard(false);
                }}
                className={`w-full flex items-center justify-between p-3 rounded-lg transition-all cursor-pointer ${
                  activeTab === 'RURA'
                    ? 'bg-slate-900 text-white border-l-4 border-orange-500 font-semibold shadow-md'
                    : 'hover:bg-slate-100 text-slate-600 font-medium'
                }`}
              >
                <span>Rura</span>
                <span className={`text-[10px] px-2 py-0.5 rounded ${
                  activeTab === 'RURA' ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-500'
                }`}>R fi</span>
              </button>

              <button
                onClick={() => {
                  if (activeTab === 'BLACHA') {
                    setLength(prev => prev / 1000);
                  }
                  setActiveTab('KATOWNIK');
                  setIsStandard(false);
                }}
                className={`w-full flex items-center justify-between p-3 rounded-lg transition-all cursor-pointer ${
                  activeTab === 'KATOWNIK'
                    ? 'bg-slate-900 text-white border-l-4 border-orange-500 font-semibold shadow-md'
                    : 'hover:bg-slate-100 text-slate-600 font-medium'
                }`}
              >
                <span>Kątownik (L)</span>
                <span className={`text-[10px] px-2 py-0.5 rounded ${
                  activeTab === 'KATOWNIK' ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-500'
                }`}>L</span>
              </button>
            </div>
          </div>

          {/* AI DRAWING ANALYZER WIDGET */}
          <DrawingUploader onAnalysisComplete={handleAiAnalysisComplete} />
        </aside>

        {/* COLUMN 2: INPUTS & ACTIVE CALCULATOR RESULTS */}
        <section className="flex-1 w-full flex flex-col gap-6">
          
          {/* CALCULATOR INTERFACE */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 space-y-6">
            
            {/* SPECIFICATION TOGGLE (STANDARD VS GEOMETRIC) */}
            {activeTab !== 'BLACHA' && (
              <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
                <button
                  onClick={() => setIsStandard(true)}
                  className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                    isStandard 
                      ? 'bg-slate-900 text-white shadow-md' 
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Standardowe profile hutnicze
                </button>
                <button
                  onClick={() => setIsStandard(false)}
                  className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                    !isStandard 
                      ? 'bg-slate-900 text-white shadow-md' 
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Kalkulator geometryczny (Custom)
                </button>
              </div>
            )}

            {/* PROFILE CHOOSE SECTION */}
            {activeTab !== 'BLACHA' && isStandard && (
              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    System profili
                  </label>
                  <select
                    value={profileSystem}
                    onChange={(e) => {
                      const sys = e.target.value as ProfileSystem;
                      setProfileSystem(sys);
                      // Save preference
                      if (activeTab === 'CEOWNIK') {
                        localStorage.setItem('biastal_pref_ceownik', sys);
                        const savedProfile = localStorage.getItem(`biastal_pref_profile_name_${sys}`);
                        if (savedProfile && findStandardProfile(savedProfile)) {
                          setSelectedProfileName(savedProfile);
                        } else {
                          const first = STANDARD_CHANNELS.find(p => p.system === sys);
                          if (first) setSelectedProfileName(first.name);
                        }
                      } else {
                        localStorage.setItem('biastal_pref_dwuteownik', sys);
                        const savedProfile = localStorage.getItem(`biastal_pref_profile_name_${sys}`);
                        if (savedProfile && findStandardProfile(savedProfile)) {
                          setSelectedProfileName(savedProfile);
                        } else {
                          const first = STANDARD_IBEAMS.find(p => p.system === sys);
                          if (first) setSelectedProfileName(first.name);
                        }
                      }
                    }}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500 cursor-pointer"
                  >
                    {activeTab === 'CEOWNIK' ? (
                      <>
                        <option value="UNP">UNP (Standard U-channel)</option>
                        <option value="UPE">UPE (Parallel flange U-channel)</option>
                      </>
                    ) : (
                      <>
                        <option value="IPN">IPN (Standard European I-beam)</option>
                        <option value="IPE">IPE (Narrow flange I-beam)</option>
                        <option value="HEB">HEB (Wide flange, heavy)</option>
                        <option value="HEA">HEA (Wide flange, light)</option>
                      </>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    Rozmiar / Oznaczenie
                  </label>
                  <select
                    value={selectedProfileName}
                    onChange={(e) => {
                      const name = e.target.value;
                      setSelectedProfileName(name);
                      // Save size preference for this system
                      const matched = findStandardProfile(name);
                      if (matched) {
                        localStorage.setItem(`biastal_pref_profile_name_${matched.system}`, name);
                      }
                    }}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500 cursor-pointer"
                  >
                    {getProfilesForSystem().map((p) => (
                      <option key={p.name} value={p.name}>
                        {p.name} ({p.weightPerMeter} kg/m)
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* INPUT FIELDS AREA */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                
                {/* INPUT: HEIGHT / THICKNESS H */}
                <div className="space-y-2">
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    {activeTab === 'BLACHA' ? 'Wymiar H - Grubość (mm)' : 
                     activeTab === 'PRET_OKRAGLY' ? 'Średnica Ø (mm)' :
                     activeTab === 'RURA' ? 'Średnica Ø (mm)' :
                     activeTab === 'PRET_KWADRATOWY' ? 'Bok kwadratu a (mm)' :
                     activeTab === 'PRET_PLASKI' ? 'Wymiar H - Grubość (mm)' :
                     'Wymiar H - Wysokość (mm)'}
                  </label>
                  <input
                    type="number"
                    value={h || ''}
                    onChange={(e) => setH(Number(e.target.value))}
                    disabled={isStandard && (activeTab === 'CEOWNIK' || activeTab === 'DWUTEOWNIK')}
                    placeholder="Wprowadź H..."
                    className={`w-full px-4 py-3 bg-slate-50 border rounded-lg text-lg font-semibold focus:ring-2 focus:ring-orange-500 focus:outline-none transition-all ${
                      isStandard && (activeTab === 'CEOWNIK' || activeTab === 'DWUTEOWNIK') 
                        ? 'border-slate-200 text-slate-400 bg-slate-100 cursor-not-allowed' 
                        : 'border-slate-200 text-slate-800 hover:border-slate-300'
                    }`}
                  />
                </div>

                {/* INPUT: WIDTH */}
                {activeTab !== 'PRET_OKRAGLY' && activeTab !== 'PRET_KWADRATOWY' && activeTab !== 'RURA' && (
                  <div className="space-y-2">
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      {activeTab === 'BLACHA' ? 'Szerokość (mm)' : 
                       activeTab === 'PRET_PLASKI' ? 'Szerokość S (mm)' :
                       'S - Szerokość półki (mm)'}
                    </label>
                    <input
                      type="number"
                      value={width || ''}
                      onChange={(e) => setWidth(Number(e.target.value))}
                      disabled={isStandard && (activeTab === 'CEOWNIK' || activeTab === 'DWUTEOWNIK')}
                      placeholder="Wprowadź szerokość..."
                      className={`w-full px-4 py-3 bg-slate-50 border rounded-lg text-lg font-semibold focus:ring-2 focus:ring-orange-500 focus:outline-none transition-all ${
                        isStandard && (activeTab === 'CEOWNIK' || activeTab === 'DWUTEOWNIK') 
                          ? 'border-slate-200 text-slate-400 bg-slate-100 cursor-not-allowed' 
                          : 'border-slate-200 text-slate-800 hover:border-slate-300'
                      }`}
                    />
                  </div>
                )}
              </div>

              {/* WALL THICKNESS FOR CLOSED PROFILES */}
              {(activeTab === 'PROFIL_ZAMKNIETY' || activeTab === 'RURA' || activeTab === 'KATOWNIK') && (
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      g - Grubość ścianki (mm)
                    </label>
                  </div>
                  <input
                    type="number"
                    value={webThickness}
                    onChange={(e) => setWebThickness(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder={activeTab === 'KATOWNIK' ? "Wprowadź grubość ścianki (np. 3)..." : "Wprowadź grubość ścianki (np. 2)..."}
                    className="w-full bg-white border border-slate-200 hover:border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-orange-500"
                  />
                </div>
              )}

              {/* ADVANCED WALLS FOR CUSTOM PROFILE */}
              {!isStandard && activeTab !== 'BLACHA' && activeTab !== 'PROFIL_ZAMKNIETY' && activeTab !== 'PRET_OKRAGLY' && activeTab !== 'PRET_KWADRATOWY' && activeTab !== 'PRET_PLASKI' && activeTab !== 'RURA' && activeTab !== 'KATOWNIK' && (
                <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        tw - Grubość ścianki (mm)
                      </label>
                      <span className="text-[9px] text-slate-400 italic">Opcjonalnie</span>
                    </div>
                    <input
                      type="number"
                      value={webThickness}
                      onChange={(e) => setWebThickness(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder={`Sugerowana: ${Math.max(3, Math.round(h * 0.05 * 10) / 10)} mm`}
                      className="w-full bg-white border border-slate-200 hover:border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-orange-500"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        tf - Grubość półki (mm)
                      </label>
                      <span className="text-[9px] text-slate-400 italic">Opcjonalnie</span>
                    </div>
                    <input
                      type="number"
                      value={flangeThickness}
                      onChange={(e) => setFlangeThickness(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder={`Sugerowana: ${Math.max(4, Math.round(width * 0.08 * 10) / 10)} mm`}
                      className="w-full bg-white border border-slate-200 hover:border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-orange-500"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                
                {/* INPUT: LENGTH */}
                <div className="space-y-2">
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    {activeTab === 'BLACHA' ? 'Długość odcinka (mm)' : 'Długość odcinka (m)'}
                  </label>
                  <input
                    type="number"
                    step={activeTab === 'BLACHA' ? '1' : '0.01'}
                    value={length || ''}
                    onChange={(e) => setLength(Number(e.target.value))}
                    placeholder={activeTab === 'BLACHA' ? 'np. 2500' : 'np. 6.0'}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-lg font-semibold focus:ring-2 focus:ring-orange-500 focus:outline-none transition-all text-slate-800 hover:border-slate-300"
                  />
                </div>

                {/* INPUT: QUANTITY */}
                <div className="space-y-2">
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Ilość sztuk
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    disabled={activeTab === 'PRET_OKRAGLY' || activeTab === 'PRET_KWADRATOWY' || activeTab === 'PRET_PLASKI'}
                    value={(activeTab === 'PRET_OKRAGLY' || activeTab === 'PRET_KWADRATOWY' || activeTab === 'PRET_PLASKI') ? 1 : (quantity || '')}
                    onChange={(e) => setQuantity(Math.max(1, Math.floor(Number(e.target.value))))}
                    placeholder="1"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-lg font-semibold focus:ring-2 focus:ring-orange-500 focus:outline-none transition-all text-slate-800 hover:border-slate-300 disabled:bg-slate-100 disabled:text-slate-400"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* RESULTS PREVIEW SECTION */}
          <div className="bg-slate-900 rounded-xl shadow-xl flex flex-col overflow-hidden text-white">
            <div className="p-6 border-b border-slate-800">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Wynik Obliczeń</h3>
            </div>
            <div className="flex-1 flex flex-col items-center justify-center p-8">
              <div className="text-slate-400 text-sm font-medium mb-1">Całkowita masa ładunku:</div>
              <div className="text-5xl lg:text-7xl font-light text-white tracking-tighter">
                {currentCalc.totalWeight.toLocaleString('pl-PL', { minimumFractionDigits: 2 })} <span className="text-3xl text-orange-500 font-bold ml-1">kg</span>
              </div>
              
              <div className="mt-4 grid grid-cols-3 gap-8 w-full max-w-md border-t border-slate-800 pt-6 text-center">
                <div>
                  <div className="text-[10px] text-slate-500 uppercase">Sztuka</div>
                  <div className="text-lg font-semibold text-slate-200">
                    {currentCalc.unitWeight.toLocaleString('pl-PL', { maximumFractionDigits: 2 })} kg
                  </div>
                </div>
                <div className="border-x border-slate-800 px-2">
                  <div className="text-[10px] text-slate-500 uppercase">Objętość</div>
                  <div className="text-lg font-semibold text-slate-200">
                    {((activeTab === 'BLACHA' 
                      ? (h * width * length) / 1000000000 
                      : (currentCalc.unitWeight / 7850) * length
                    ) * quantity).toLocaleString('pl-PL', { maximumFractionDigits: 3 })} m³
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500 uppercase">Gęstość</div>
                  <div className="text-lg font-semibold text-slate-200">7.85 kg/dm³</div>
                </div>
              </div>
            </div>
            
            <button
              onClick={handleAddItem}
              disabled={!h || (activeTab !== 'PRET_OKRAGLY' && activeTab !== 'PRET_KWADRATOWY' && activeTab !== 'RURA' && !width) || !length || (activeTab === 'BLACHA' ? !quantity : false)}
              className="h-12 bg-orange-600 flex items-center justify-center cursor-pointer hover:bg-orange-500 transition-colors border-none text-white font-bold uppercase tracking-widest text-xs disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Dodaj do zestawienia zbiorczego
            </button>
          </div>

        </section>

        {/* COLUMN 3: CALCULATION SUMMARY & AGGREGATOR */}
        <section className="w-full xl:w-[540px] shrink-0 h-full">
          <CalculationList 
            items={calculationItems} 
            onRemoveItem={handleRemoveItem}
            onClearAll={handleClearAll}
            onRemoveLastItem={handleRemoveLastItem}
            onUpdateItem={handleUpdateItem}
          />
        </section>

      </main>

      {/* FOOTER */}
      <footer className="h-12 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between px-6 shrink-0 text-slate-500 text-xs mt-auto">
        <div className="text-[10px] text-slate-400">
          Kalkulator Wag Stali 2026 Autor: Szymon Kloskowski
        </div>
      </footer>

    </div>
  );
}
