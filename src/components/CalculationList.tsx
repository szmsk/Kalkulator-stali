import { useState, useEffect } from 'react';
import { Trash2, Pencil, X, FileSpreadsheet, FileText, ShoppingBag, FolderGit2, RefreshCcw } from 'lucide-react';
import { CalculationItem, ShapeType, ProfileSystem } from '../types';
import { exportToExcel, exportToPDF } from '../utils/export';
import { calculateWeight } from '../utils/calculator';
import { STANDARD_CHANNELS, STANDARD_IBEAMS, findStandardProfile } from '../data/profiles';

interface CalculationListProps {
  items: CalculationItem[];
  onRemoveItem: (id: string) => void;
  onClearAll: () => void;
  onRemoveLastItem: () => void;
  onUpdateItem: (id: string, updatedItem: CalculationItem) => void;
}

export default function CalculationList({ 
  items, 
  onRemoveItem, 
  onClearAll, 
  onRemoveLastItem, 
  onUpdateItem 
}: CalculationListProps) {
  const [projectTitle, setProjectTitle] = useState('');
  const [isConfirmingClear, setIsConfirmingClear] = useState(false);

  // Modal Editing States
  const [editingItem, setEditingItem] = useState<CalculationItem | null>(null);
  const [editingIndex, setEditingIndex] = useState<number>(-1);

  const [editType, setEditType] = useState<ShapeType>('BLACHA');
  const [editIsStandard, setEditIsStandard] = useState<boolean>(false);
  const [editProfileSystem, setEditProfileSystem] = useState<ProfileSystem>('UNP');
  const [editProfileName, setEditProfileName] = useState<string>('UNP 80');
  const [editH, setEditH] = useState<number>(8);
  const [editWidth, setEditWidth] = useState<number>(1000);
  const [editLength, setEditLength] = useState<number>(2500); // mm for BLACHA, m for profiles
  const [editQuantity, setEditQuantity] = useState<number>(1);
  const [editWebThickness, setEditWebThickness] = useState<number | ''>('');
  const [editFlangeThickness, setEditFlangeThickness] = useState<number | ''>('');
  
  const [editPipeMode, setEditPipeMode] = useState<'pieces' | 'meters'>('pieces');
  const [editPipeType, setEditPipeType] = useState<'zwykla' | 'wiertnicza'>('zwykla');
  const [editPipeManualWeight, setEditPipeManualWeight] = useState<number | ''>('');

  const totalWeight = items.reduce((sum, item) => sum + item.calculatedWeightTotal, 0);
  const totalWeightTonnes = totalWeight / 1000;
  const totalSheetsPieces = items.reduce((sum, item) => {
    if (item.type === 'BLACHA') return sum + item.quantity;
    if (item.type === 'RURA' && item.pipeMode === 'pieces') return sum + item.quantity;
    return sum;
  }, 0);
  const totalProfilesLength = items.reduce((sum, item) => {
    if (item.type === 'BLACHA') return sum;
    if (item.type === 'RURA' && item.pipeMode === 'pieces') return sum;
    return sum + (item.length * item.quantity);
  }, 0);

  const handleExportExcel = () => {
    if (items.length === 0) return;
    
    const modifiedItems = projectTitle 
      ? items.map(item => ({ ...item, notes: item.notes ? `${projectTitle} - ${item.notes}` : projectTitle }))
      : items;

    exportToExcel(modifiedItems, totalWeight);
  };

  const handleExportPDF = () => {
    if (items.length === 0) return;

    const modifiedItems = projectTitle 
      ? items.map(item => ({ ...item, notes: item.notes ? `${projectTitle} - ${item.notes}` : projectTitle }))
      : items;

    exportToPDF(modifiedItems, totalWeight);
  };

  // Open the edit modal and populate state values
  const startEdit = (item: CalculationItem, index: number) => {
    setEditingItem(item);
    setEditingIndex(index);
    setEditType(item.type);
    setEditIsStandard(item.isStandard);
    
    if (item.isStandard && item.profileSystem) {
      setEditProfileSystem(item.profileSystem);
      setEditProfileName(item.profileName || '');
    } else {
      if (item.type === 'CEOWNIK') {
        const savedSys = localStorage.getItem('biastal_pref_ceownik') as ProfileSystem || 'UNP';
        setEditProfileSystem(savedSys);
        const savedProfile = localStorage.getItem(`biastal_pref_profile_name_${savedSys}`);
        if (savedProfile && findStandardProfile(savedProfile)) {
          setEditProfileName(savedProfile);
        } else {
          const first = STANDARD_CHANNELS.find(p => p.system === savedSys);
          setEditProfileName(first ? first.name : 'UNP 80');
        }
      } else if (item.type === 'DWUTEOWNIK') {
        const savedSys = localStorage.getItem('biastal_pref_dwuteownik') as ProfileSystem || 'IPN';
        setEditProfileSystem(savedSys);
        const savedProfile = localStorage.getItem(`biastal_pref_profile_name_${savedSys}`);
        if (savedProfile && findStandardProfile(savedProfile)) {
          setEditProfileName(savedProfile);
        } else {
          const first = STANDARD_IBEAMS.find(p => p.system === savedSys);
          setEditProfileName(first ? first.name : 'IPN 120');
        }
      }
    }
    
    setEditH(item.h);
    setEditWidth(item.width);
    
    // For BLACHA, length is stored in meters, but we input/edit it in mm
    if (item.type === 'BLACHA') {
      setEditLength(Math.round(item.length * 1000));
    } else {
      setEditLength(item.length);
    }
    
    setEditQuantity(item.quantity);
    setEditWebThickness(item.webThickness !== undefined ? item.webThickness : '');
    setEditFlangeThickness(item.flangeThickness !== undefined ? item.flangeThickness : '');
    
    setEditPipeMode(item.pipeMode || 'pieces');
    setEditPipeType(item.pipeType || 'zwykla');
    setEditPipeManualWeight(item.type === 'RURA' ? item.calculatedWeightTotal : '');
  };

  // Sync profile dimensions to inputs when standard profile is chosen in modal
  useEffect(() => {
    if (editIsStandard && (editType === 'CEOWNIK' || editType === 'DWUTEOWNIK')) {
      const p = findStandardProfile(editProfileName);
      if (p) {
        setEditH(p.height);
        setEditWidth(p.width);
        if (p.webThickness) setEditWebThickness(p.webThickness);
        if (p.flangeThickness) setEditFlangeThickness(p.flangeThickness);
      }
    }
  }, [editProfileName, editIsStandard, editType]);

  // Handle changing shape type inside the edit modal
  const handleEditTypeChange = (newType: ShapeType) => {
    setEditType(newType);
    if (newType === 'BLACHA') {
      setEditIsStandard(false);
      if (editType !== 'BLACHA') {
        setEditLength(Math.round(editLength * 1000));
      }
    } else {
      if (editType === 'BLACHA') {
        setEditLength(editLength / 1000);
      }
      
      if (newType === 'CEOWNIK' || newType === 'DWUTEOWNIK') {
        const sys = newType === 'CEOWNIK'
          ? (localStorage.getItem('biastal_pref_ceownik') as ProfileSystem || 'UNP')
          : (localStorage.getItem('biastal_pref_dwuteownik') as ProfileSystem || 'IPN');
        setEditProfileSystem(sys);
        const savedProfile = localStorage.getItem(`biastal_pref_profile_name_${sys}`);
        if (savedProfile && findStandardProfile(savedProfile)) {
          setEditProfileName(savedProfile);
        } else {
          const first = newType === 'CEOWNIK' 
            ? STANDARD_CHANNELS.find(p => p.system === sys)
            : STANDARD_IBEAMS.find(p => p.system === sys);
          if (first) {
            setEditProfileName(first.name);
          } else {
            setEditProfileName(newType === 'CEOWNIK' ? 'UNP 80' : 'IPN 120');
          }
        }
      } else {
        setEditIsStandard(false);
      }
    }
  };

  const isMetersOnly = editType === 'PRET_OKRAGLY' || editType === 'PRET_KWADRATOWY' || editType === 'PRET_PLASKI' || editType === 'PROFIL_ZAMKNIETY' || editType === 'KATOWNIK';

  // Recalculate live weight inside modal
  const currentCalcEdit = calculateWeight({
    type: editType,
    isStandard: editIsStandard,
    profileName: editIsStandard ? editProfileName : undefined,
    h: editH,
    width: (editType === 'PRET_OKRAGLY' || editType === 'PRET_KWADRATOWY' || editType === 'RURA') ? editH : editWidth,
    length: editType === 'BLACHA' ? editLength / 1000 : (editType === 'RURA' && editPipeMode === 'pieces') ? 0 : editLength,
    quantity: isMetersOnly ? 1 : (editType === 'RURA' ? (editPipeMode === 'pieces' ? editQuantity : 1) : editQuantity),
    webThickness: (editType === 'PROFIL_ZAMKNIETY' || editType === 'RURA' || editType === 'KATOWNIK') ? (editWebThickness !== '' ? Number(editWebThickness) : (editType === 'KATOWNIK' ? 3 : 2)) : (editWebThickness === '' ? undefined : Number(editWebThickness)),
    flangeThickness: editFlangeThickness === '' ? undefined : Number(editFlangeThickness),
    manualWeight: editType === 'RURA' ? (editPipeManualWeight !== '' ? Number(editPipeManualWeight) : 0) : undefined,
  });

  // Save changes to current editing item
  const handleSave = () => {
    if (!editingItem) return;

    const isMetersOnly = editType === 'PRET_OKRAGLY' || editType === 'PRET_KWADRATOWY' || editType === 'PRET_PLASKI' || editType === 'PROFIL_ZAMKNIETY' || editType === 'KATOWNIK';
    const finalLength = editType === 'BLACHA' ? editLength / 1000 : (editType === 'RURA' && editPipeMode === 'pieces') ? 0 : editLength;
    const finalQuantity = isMetersOnly ? 1 : (editType === 'RURA' ? (editPipeMode === 'pieces' ? editQuantity : 1) : editQuantity);
    
    let specName = '';
    if (editIsStandard && (editType === 'CEOWNIK' || editType === 'DWUTEOWNIK')) {
      specName = editProfileName;
    } else if (editType === 'BLACHA') {
      specName = `Blacha ${editH}x${editWidth}x${Math.round(editLength)}mm`;
    } else if (editType === 'PRET_OKRAGLY') {
      specName = `Pręt okr. ∅${editH}mm`;
    } else if (editType === 'PRET_KWADRATOWY') {
      specName = `Pręt kw. ■${editH}mm`;
    } else if (editType === 'PRET_PLASKI') {
      specName = `Płaskownik ${editH}x${editWidth}mm`;
    } else if (editType === 'RURA') {
      const pTypeLabel = editPipeType === 'zwykla' ? 'zwykła' : 'wiertnicza';
      if (editPipeMode === 'pieces') {
        specName = `Rura ∅${editH}mm (${pTypeLabel}, same sztuki)`;
      } else {
        specName = `Rura ∅${editH}mm (${pTypeLabel}, same metry)`;
      }
    } else if (editType === 'KATOWNIK') {
      specName = `Kątownik L ${editH}x${editWidth}x${editWebThickness || 3}mm`;
    } else if (editType === 'PROFIL_ZAMKNIETY') {
      specName = `Profil zamk. ${editH}x${editWidth}x${editWebThickness || 2}mm`;
    } else {
      specName = `Geom. (${editH}x${editWidth}x${Math.round(editLength * 1000)}mm)`;
    }

    let notes = '';
    if (editType === 'BLACHA') {
      notes = `Grubość: ${editH} mm`;
    } else if (editType === 'RURA') {
      if (editPipeMode === 'pieces') {
        notes = `${specName} - ${finalQuantity} szt.`;
      } else {
        notes = `${specName} - ${finalLength} m`;
      }
    } else if (isMetersOnly) {
      notes = `${specName} - ${finalLength} m`;
    } else {
      notes = `${specName} - dł. ${finalLength} m`;
    }

    const updatedItem: CalculationItem = {
      ...editingItem,
      type: editType,
      isStandard: editIsStandard,
      profileSystem: editIsStandard ? editProfileSystem : undefined,
      profileName: editIsStandard ? editProfileName : undefined,
      h: editH,
      width: (editType === 'PRET_OKRAGLY' || editType === 'PRET_KWADRATOWY' || editType === 'RURA') ? editH : editWidth,
      length: finalLength,
      quantity: finalQuantity,
      webThickness: editType === 'RURA' ? undefined : ((editType === 'PROFIL_ZAMKNIETY' || editType === 'KATOWNIK') ? (editWebThickness !== '' ? Number(editWebThickness) : (editType === 'KATOWNIK' ? 3 : 2)) : (editType !== 'BLACHA' ? currentCalcEdit.webThickness : undefined)),
      flangeThickness: (editType !== 'BLACHA' && editType !== 'PRET_OKRAGLY' && editType !== 'PRET_KWADRATOWY' && editType !== 'PRET_PLASKI' && editType !== 'PROFIL_ZAMKNIETY' && editType !== 'RURA' && editType !== 'KATOWNIK') ? currentCalcEdit.flangeThickness : undefined,
      calculatedWeightPerUnit: editType === 'RURA' ? 0 : currentCalcEdit.unitWeight,
      calculatedWeightTotal: editType === 'RURA' ? 0 : currentCalcEdit.totalWeight,
      notes,
      pipeMode: editType === 'RURA' ? editPipeMode : undefined,
      pipeType: editType === 'RURA' ? editPipeType : undefined,
    };

    onUpdateItem(editingItem.id, updatedItem);
    setEditingItem(null);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col h-full">
      {/* Title Header */}
      <div className="bg-slate-900 p-5 text-white flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShoppingBag className="text-orange-500 w-5 h-5" />
          <h2 className="font-display font-semibold text-lg">Zestawienie Obliczeń</h2>
        </div>
        <span className="bg-slate-800 text-xs text-slate-300 px-2.5 py-1 rounded-full font-mono">
          Pozycji: {items.length}
        </span>
      </div>

      <div className="p-6 flex-1 flex flex-col justify-between">
        {/* Project Name Input */}
        <div className="mb-5">
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <FolderGit2 className="w-3.5 h-3.5 text-slate-400" /> Nazwa Projektu / Klient (Opcjonalnie)
          </label>
          <input 
            type="text" 
            value={projectTitle}
            onChange={(e) => setProjectTitle(e.target.value)}
            placeholder="np. Konstrukcja dachu - Kowalski, Zlecenie #124"
            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500"
          />
        </div>

        {/* Calculation List Table */}
        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-12 text-center">
            <div className="bg-slate-50 p-4 rounded-full text-slate-300 mb-3">
              <ShoppingBag className="w-8 h-8" />
            </div>
            <p className="text-slate-500 text-sm font-medium">Brak elementów na liście</p>
            <p className="text-slate-400 text-xs mt-1 px-4 leading-relaxed max-w-xs">
              Uzupełnij wymiary w kalkulatorze po lewej stronie i kliknij "Dodaj do listy", aby rozpocząć kalkulację zbiorczą.
            </p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto max-h-[380px] border border-slate-100 rounded-lg mb-6">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] tracking-wider sticky top-0 border-b border-slate-100 z-10">
                <tr>
                  <th className="px-3 py-3 font-semibold">Lp.</th>
                  <th className="px-3 py-3 font-semibold">Element</th>
                  <th className="px-3 py-3 font-semibold">Specyfikacja</th>
                  <th className="px-3 py-3 font-semibold text-right">Ilość</th>
                  <th className="px-3 py-3 font-semibold text-right">Masa (kg)</th>
                  <th className="px-3 py-3 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item, index) => {
                  const typeLabel = 
                    item.type === 'BLACHA' ? 'Blacha' : 
                    item.type === 'CEOWNIK' ? 'Ceownik g/w' : 
                    item.type === 'DWUTEOWNIK' ? 'Dwuteownik' :
                    item.type === 'PRET_OKRAGLY' ? 'Pręt okrągły gładki' :
                    item.type === 'PRET_KWADRATOWY' ? 'Pręt kwadratowy' :
                    item.type === 'PRET_PLASKI' ? 'Pręt płaski / Płaskownik' :
                    item.type === 'RURA' ? 'Rura' :
                    item.type === 'KATOWNIK' ? 'Kątownik' :
                    'Profil zamknięty';
                  
                  return (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-3 py-3.5 font-mono text-slate-400">{index + 1}</td>
                      <td className="px-3 py-3.5 font-medium text-slate-800">
                        {typeLabel}
                        <span className="block text-[10px] text-slate-400 font-normal">
                          {item.isStandard ? (item.profileName || 'Standard') : 'Geom. (Custom)'}
                        </span>
                      </td>
                      <td className="px-3 py-3.5 text-slate-500 leading-relaxed font-mono text-[11px]">
                        {item.type === 'PRET_OKRAGLY' ? (
                          <>
                            <div>Średnica: ∅ {item.h} mm</div>
                            <div>Długość: {item.length} m</div>
                          </>
                        ) : item.type === 'PRET_KWADRATOWY' ? (
                          <>
                            <div>Bok: ■ {item.h} mm</div>
                            <div>Długość: {item.length} m</div>
                          </>
                        ) : item.type === 'PRET_PLASKI' ? (
                          <>
                            <div>Grubość: {item.h} mm | Szerokość: {item.width} mm</div>
                            <div>Długość: {item.length} m</div>
                          </>
                        ) : item.type === 'RURA' ? (
                          <>
                            <div>Średnica: ∅ {item.h} mm | Typ: {item.pipeType === 'wiertnicza' ? 'Wiertnicza' : 'Zwykła'}</div>
                            {item.pipeMode === 'pieces' ? (
                              <div className="text-slate-400 font-sans text-[10px]">Bez długości (same sztuki)</div>
                            ) : (
                              <div>Długość: {item.length} m</div>
                            )}
                          </>
                        ) : item.type === 'PROFIL_ZAMKNIETY' ? (
                          <>
                            <div>Wymiar: {item.h}x{item.width} mm | Ścianka: {item.webThickness || 2} mm</div>
                            <div>Długość: {item.length} m</div>
                          </>
                        ) : item.type === 'KATOWNIK' ? (
                          <>
                            <div>Kątownik L: {item.h}x{item.width} mm | Ścianka: {item.webThickness || 3} mm</div>
                            <div>Długość: {item.length} m</div>
                          </>
                        ) : (
                          <>
                            <div>H: {item.h} mm | S: {item.width} mm</div>
                            <div>Długość: {item.type === 'BLACHA' ? `${Math.round(item.length * 1000)} mm` : `${item.length} m`}</div>
                          </>
                        )}
                      </td>
                      <td className="px-3 py-3.5 text-right font-medium text-slate-800 whitespace-nowrap">
                        {item.type === 'BLACHA' 
                          ? `${item.quantity} szt.` 
                          : (item.type === 'PRET_OKRAGLY' || item.type === 'PRET_KWADRATOWY' || item.type === 'PRET_PLASKI' || item.type === 'PROFIL_ZAMKNIETY' || item.type === 'KATOWNIK')
                            ? `${item.length.toLocaleString('pl-PL', { maximumFractionDigits: 2 })} m`
                            : item.type === 'RURA'
                              ? item.pipeMode === 'pieces'
                                ? `${item.quantity} szt.`
                                : `${item.length.toLocaleString('pl-PL', { maximumFractionDigits: 2 })} m`
                              : `${item.quantity} szt. x ${item.length.toLocaleString('pl-PL', { maximumFractionDigits: 2 })} m`
                        }
                      </td>
                      <td className="px-3 py-3.5 text-right font-semibold text-slate-900 whitespace-nowrap">
                        {item.type === 'RURA' ? '-' : `${item.calculatedWeightTotal.toLocaleString('pl-PL', { minimumFractionDigits: 1 })} kg`}
                      </td>
                      <td className="px-3 py-3.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button 
                            onClick={() => startEdit(item, index)}
                            className="text-slate-400 hover:text-orange-500 p-1 rounded-md hover:bg-orange-50 transition-colors cursor-pointer"
                            title="Edytuj element"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button 
                            onClick={() => onRemoveItem(item.id)}
                            className="text-slate-400 hover:text-orange-500 p-1 rounded-md hover:bg-orange-50 transition-colors cursor-pointer"
                            title="Usuń element"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Totals Summary Card */}
        <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 mb-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Masa całkowita</p>
              <p className="font-display font-bold text-slate-800 text-lg leading-tight mt-1">
                {totalWeight.toLocaleString('pl-PL', { minimumFractionDigits: 1 })} <span className="text-sm font-medium text-slate-500">kg</span>
              </p>
              {totalWeightTonnes > 0 && (
                <p className="text-xs text-slate-500 font-mono mt-0.5">
                  ({totalWeightTonnes.toLocaleString('pl-PL', { minimumFractionDigits: 3 })} t)
                </p>
              )}
            </div>
            
            <div className="text-right">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Ilość sumaryczna</p>
              <div className="text-xs text-slate-600 mt-1 space-y-0.5 font-mono">
                {totalSheetsPieces > 0 && (
                  <div>Blachy: <span className="font-bold text-slate-800">{totalSheetsPieces} szt.</span></div>
                )}
                {totalProfilesLength > 0 && (
                  <div>Materiały (M): <span className="font-bold text-slate-800">{totalProfilesLength.toLocaleString('pl-PL', { maximumFractionDigits: 2 })} m</span></div>
                )}
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                {items.length} pozycji asortymentowych
              </p>
            </div>
          </div>
        </div>

        {/* Action Export Buttons */}
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleExportPDF}
              disabled={items.length === 0}
              className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
                items.length === 0
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                  : 'bg-slate-800 hover:bg-slate-900 text-white shadow-sm'
              }`}
            >
              <FileText className="w-4 h-4 shrink-0 text-orange-500" /> Pobierz PDF
            </button>

            <button
              onClick={handleExportExcel}
              disabled={items.length === 0}
              className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
                items.length === 0
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4 shrink-0 text-emerald-300" /> Pobierz Excel
            </button>
          </div>

          {items.length > 0 && (
            <div className="flex flex-col gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={onRemoveLastItem}
                className="w-full flex items-center justify-center gap-1.5 py-2 px-3 bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-800 rounded-lg text-xs font-semibold transition-colors border border-slate-200 cursor-pointer shadow-sm"
              >
                <Trash2 className="w-3.5 h-3.5 text-slate-400" /> Usuń ostatnio dodaną pozycję
              </button>
              
              <div className="flex justify-center min-h-[28px] mt-1">
                {isConfirmingClear ? (
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-500 font-medium">Na pewno wyczyścić wszystko?</span>
                    <button
                      onClick={() => {
                        onClearAll();
                        setIsConfirmingClear(false);
                      }}
                      className="px-2 py-1 bg-red-500 hover:bg-red-600 text-white rounded text-[10px] font-bold cursor-pointer transition-colors"
                    >
                      Tak
                    </button>
                    <button
                      onClick={() => setIsConfirmingClear(false)}
                      className="px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded text-[10px] font-bold cursor-pointer transition-colors"
                    >
                      Anuluj
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setIsConfirmingClear(true)}
                    className="flex items-center justify-center gap-1.5 py-1 text-slate-400 hover:text-orange-500 text-xs font-medium transition-colors bg-transparent border-none cursor-pointer"
                  >
                    <RefreshCcw className="w-3 h-3" /> Wyczyść wszystkie kalkulacje
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Edit Item Modal Backdrop & Box */}
      {editingItem && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full flex flex-col overflow-hidden max-h-[95vh] text-left">
            {/* Header */}
            <div className="bg-slate-900 px-6 py-4 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Pencil className="text-orange-500 w-5 h-5" />
                <h3 className="font-display font-semibold text-base">
                  Edycja pozycji #{editingIndex + 1}
                </h3>
              </div>
              <button 
                onClick={() => setEditingItem(null)}
                className="text-slate-400 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form Body */}
            <div className="p-6 overflow-y-auto space-y-4 text-slate-700">
              {/* Material Type Selection */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Typ elementu
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {(['BLACHA', 'CEOWNIK', 'DWUTEOWNIK', 'PRET_OKRAGLY', 'PRET_KWADRATOWY', 'PRET_PLASKI', 'PROFIL_ZAMKNIETY', 'RURA', 'KATOWNIK'] as ShapeType[]).map((type) => {
                    const label = 
                      type === 'BLACHA' ? 'Blacha' :
                      type === 'CEOWNIK' ? 'Ceownik' :
                      type === 'DWUTEOWNIK' ? 'Dwuteownik' :
                      type === 'PRET_OKRAGLY' ? 'Pręt okrągły' :
                      type === 'PRET_KWADRATOWY' ? 'Pręt kwadratowy' :
                      type === 'PRET_PLASKI' ? 'Pręt płaski' :
                      type === 'RURA' ? 'Rura' :
                      type === 'KATOWNIK' ? 'Kątownik' :
                      'Profil zamknięty';
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => handleEditTypeChange(type)}
                        className={`py-1.5 px-2 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                          editType === type
                            ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Standard vs Custom toggle */}
              {editType !== 'BLACHA' && (
                <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setEditIsStandard(true)}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                      editIsStandard 
                        ? 'bg-slate-900 text-white shadow-sm' 
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    Profil standardowy
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditIsStandard(false)}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                      !editIsStandard 
                        ? 'bg-slate-900 text-white shadow-sm' 
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    Geometria (Custom)
                  </button>
                </div>
              )}

              {/* Standard Profiles selects */}
              {editType !== 'BLACHA' && editIsStandard && (
                <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3.5 rounded-xl border border-slate-150">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                      System profili
                    </label>
                    <select
                      value={editProfileSystem}
                      onChange={(e) => {
                        const sys = e.target.value as ProfileSystem;
                        setEditProfileSystem(sys);
                        const first = editType === 'CEOWNIK' 
                          ? STANDARD_CHANNELS.find(p => p.system === sys)
                          : STANDARD_IBEAMS.find(p => p.system === sys);
                        if (first) setEditProfileName(first.name);
                      }}
                      className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-orange-500"
                    >
                      {editType === 'CEOWNIK' ? (
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
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                      Rozmiar / Oznaczenie
                    </label>
                    <select
                      value={editProfileName}
                      onChange={(e) => setEditProfileName(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-orange-500"
                    >
                      {(editType === 'CEOWNIK' ? STANDARD_CHANNELS : STANDARD_IBEAMS)
                        .filter(p => p.system === editProfileSystem)
                        .map((p) => (
                          <option key={p.name} value={p.name}>
                            {p.name} ({p.weightPerMeter} kg/m)
                          </option>
                        ))
                      }
                    </select>
                  </div>
                </div>
              )}

              {/* Dimensions Inputs */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    {editType === 'BLACHA' ? 'Grubość H (mm)' : 
                     editType === 'PRET_OKRAGLY' ? 'Średnica Ø (mm)' :
                     editType === 'RURA' ? 'Średnica Ø (mm)' :
                     editType === 'PRET_KWADRATOWY' ? 'Bok kwadratu a (mm)' :
                     editType === 'PRET_PLASKI' ? 'Grubość H (mm)' :
                     editType === 'KATOWNIK' ? 'Ramię H (mm)' :
                     'Wysokość H (mm)'}
                  </label>
                  <input
                    type="number"
                    value={editH || ''}
                    onChange={(e) => setEditH(Number(e.target.value))}
                    disabled={editIsStandard && (editType === 'CEOWNIK' || editType === 'DWUTEOWNIK')}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold text-slate-800 focus:ring-1 focus:ring-orange-500 focus:outline-none disabled:bg-slate-100 disabled:text-slate-400"
                  />
                </div>

                {editType !== 'PRET_OKRAGLY' && editType !== 'PRET_KWADRATOWY' && editType !== 'RURA' && (
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                      {editType === 'BLACHA' ? 'Szerokość S (mm)' : 
                       editType === 'PRET_PLASKI' ? 'Szerokość S (mm)' :
                       editType === 'KATOWNIK' ? 'Ramię S (mm)' :
                       'Szerokość półki S (mm)'}
                    </label>
                    <input
                      type="number"
                      value={editWidth || ''}
                      onChange={(e) => setEditWidth(Number(e.target.value))}
                      disabled={editIsStandard && (editType === 'CEOWNIK' || editType === 'DWUTEOWNIK')}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold text-slate-800 focus:ring-1 focus:ring-orange-500 focus:outline-none disabled:bg-slate-100 disabled:text-slate-400"
                    />
                  </div>
                )}
              </div>

              {/* Web/Flange Thickness for Custom Profiles */}
              {(editType === 'PROFIL_ZAMKNIETY' || editType === 'KATOWNIK') && (
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    g - Grubość ścianki (mm)
                  </label>
                  <input
                    type="number"
                    value={editWebThickness}
                    onChange={(e) => setEditWebThickness(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder={editType === 'KATOWNIK' ? 'np. 3' : 'np. 2'}
                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none"
                  />
                </div>
              )}

              {/* Pipe Type Selection for Edit Modal */}
              {editType === 'RURA' && (
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Rodzaj rury
                  </label>
                  <div className="grid grid-cols-2 gap-2 bg-slate-200 p-0.5 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setEditPipeType('zwykla')}
                      className={`py-1.5 text-xs font-semibold rounded-md transition-colors ${
                        editPipeType === 'zwykla'
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-600 hover:text-slate-800'
                      }`}
                    >
                      1. Zwykła
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditPipeType('wiertnicza')}
                      className={`py-1.5 text-xs font-semibold rounded-md transition-colors ${
                        editPipeType === 'wiertnicza'
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-600 hover:text-slate-800'
                      }`}
                    >
                      2. Wiertnicza
                    </button>
                  </div>
                </div>
              )}

              {!editIsStandard && editType !== 'BLACHA' && editType !== 'PROFIL_ZAMKNIETY' && editType !== 'RURA' && editType !== 'KATOWNIK' && editType !== 'PRET_OKRAGLY' && editType !== 'PRET_KWADRATOWY' && editType !== 'PRET_PLASKI' && (
                <div className="grid grid-cols-2 gap-4 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                      tw - Ścianka (mm)
                    </label>
                    <input
                      type="number"
                      value={editWebThickness}
                      onChange={(e) => setEditWebThickness(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder={`Sugerowana: ${Math.max(3, Math.round(editH * 0.05 * 10) / 10)}`}
                      className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                      tf - Półka (mm)
                    </label>
                    <input
                      type="number"
                      value={editFlangeThickness}
                      onChange={(e) => setEditFlangeThickness(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder={`Sugerowana: ${Math.max(4, Math.round(editWidth * 0.08 * 10) / 10)}`}
                      className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {/* RURA Mode Section */}
              {editType === 'RURA' && (
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex flex-col gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                      Wybierz sposób podania rury
                    </label>
                    <div className="grid grid-cols-2 gap-2 bg-slate-200 p-0.5 rounded-lg">
                      <button
                        type="button"
                        onClick={() => {
                          setEditPipeMode('pieces');
                          setEditQuantity(1);
                        }}
                        className={`py-1 text-xs font-semibold rounded-md transition-colors ${
                          editPipeMode === 'pieces'
                            ? 'bg-white text-slate-900 shadow-sm'
                            : 'text-slate-600 hover:text-slate-800'
                        }`}
                      >
                        Same sztuki (szt.)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditPipeMode('meters');
                          setEditQuantity(1);
                        }}
                        className={`py-1 text-xs font-semibold rounded-md transition-colors ${
                          editPipeMode === 'meters'
                            ? 'bg-white text-slate-900 shadow-sm'
                            : 'text-slate-600 hover:text-slate-800'
                        }`}
                      >
                        Same metry (m)
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Length & Quantity Inputs */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    {editType === 'BLACHA' ? 'Długość (mm)' : 'Długość (m)'}
                  </label>
                  <input
                    type="number"
                    step={editType === 'BLACHA' ? '1' : '0.01'}
                    disabled={editType === 'RURA' && editPipeMode === 'pieces'}
                    value={(editType === 'RURA' && editPipeMode === 'pieces') ? '' : (editLength || '')}
                    onChange={(e) => setEditLength(Number(e.target.value))}
                    placeholder={(editType === 'RURA' && editPipeMode === 'pieces') ? 'Nie dotyczy' : ''}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold text-slate-800 focus:ring-1 focus:ring-orange-500 focus:outline-none disabled:bg-slate-100 disabled:text-slate-400"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Ilość (szt.)
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    disabled={isMetersOnly || (editType === 'RURA' && editPipeMode === 'meters')}
                    value={(isMetersOnly || (editType === 'RURA' && editPipeMode === 'meters')) ? 1 : (editQuantity || '')}
                    onChange={(e) => setEditQuantity(Math.max(1, Math.floor(Number(e.target.value))))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold text-slate-800 focus:ring-1 focus:ring-orange-500 focus:outline-none disabled:bg-slate-100 disabled:text-slate-400"
                  />
                </div>
              </div>

              {/* Live Weight Info Section */}
              <div className="bg-slate-900 text-white rounded-xl p-4 flex items-center justify-between">
                <div>
                  <span className="block text-[10px] text-slate-400 uppercase tracking-wider">Masa po zmianie</span>
                  <span className="font-display font-bold text-2xl text-orange-400">
                    {currentCalcEdit.totalWeight.toLocaleString('pl-PL', { minimumFractionDigits: 1 })} kg
                  </span>
                </div>
                <div className="text-right text-[10px] text-slate-400 leading-normal">
                  <div>Jedn: {currentCalcEdit.unitWeight.toLocaleString('pl-PL', { minimumFractionDigits: 2 })} kg</div>
                  <div>Przed: {editingItem.calculatedWeightTotal.toLocaleString('pl-PL', { minimumFractionDigits: 1 })} kg</div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
              >
                Anuluj
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={!editH || (editType !== 'PRET_OKRAGLY' && editType !== 'PRET_KWADRATOWY' && !editWidth) || !editLength || !editQuantity}
                className="px-4 py-2 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-xs font-bold cursor-pointer transition-colors"
              >
                Zapisz zmiany
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
