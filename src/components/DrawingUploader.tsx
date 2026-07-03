import React, { useState, useRef } from 'react';
import { Upload, FileImage, Cpu, CheckCircle2, AlertCircle, RefreshCw, Pencil, Trash2, Check, X } from 'lucide-react';
import { MultiAnalysisResult, ShapeType, AnalyzedItem } from '../types';
import { calculateWeight } from '../utils/calculator';
import { STANDARD_CHANNELS, STANDARD_IBEAMS } from '../data/profiles';

interface DrawingUploaderProps {
  onAnalysisComplete: (result: MultiAnalysisResult) => void;
}

interface EditableAnalyzedItem {
  id: string;
  detectedType: ShapeType;
  h: number | null;
  width: number | null;
  length: number | null; // length in meters (normalized)
  quantity: number; // zsumowana ilość sztuk
  rawQuantityList: string;
  isStandard: boolean;
  standardProfileName: string | null;
  webThickness?: number | null;
  originalText?: string;
  selected: boolean;
  isEditing?: boolean;
}

export default function DrawingUploader({ onAnalysisComplete }: DrawingUploaderProps) {
  const [dragActive, setDragActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progressText, setProgressText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<MultiAnalysisResult | null>(null);
  const [localItems, setLocalItems] = useState<EditableAnalyzedItem[]>([]);
  const [editBackup, setEditBackup] = useState<Record<string, EditableAnalyzedItem>>({});
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const processFile = async (file: File) => {
    const isHeic = file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif') || file.type === 'image/heic' || file.type === 'image/heif';
    if (!file.type.startsWith('image/') && !isHeic) {
      setError('Przesłany plik musi być obrazem (PNG, JPG, JPEG, HEIC).');
      return;
    }

    setLoading(true);
    setError(null);
    setAnalysisResult(null);
    setLocalItems([]);
    
    // Create preview
    if (isHeic) {
      setImagePreview('HEIC_PREVIEW_PLACEHOLDER');
    } else {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }

    setProgressText('Przygotowywanie obrazu...');
    
    try {
      // Convert to base64 for server-side API proxy
      const base64Promise = new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.readAsDataURL(file);
        r.onload = () => {
          // extract only base64 data portion
          const base64String = (r.result as string).split(',')[1];
          resolve(base64String);
        };
        r.onerror = (e) => reject(e);
      });

      const base64Data = await base64Promise;
      setProgressText('Wysyłanie rysunku do serwera...');

      setProgressText('AI analizuje zeszyt i odczytuje wszystkie pozycje (grubości, wymiary, sumy sztuk)...');
      
      const response = await fetch('/api/analyze-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image: base64Data,
          mimeType: isHeic ? 'image/heic' : (file.type || 'image/jpeg'),
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Wystąpił błąd podczas analizy obrazu.');
      }

      const data: MultiAnalysisResult = await response.json();
      setAnalysisResult(data);
      setLocalItems(data.items.map(item => ({
        ...item,
        id: crypto.randomUUID(),
        selected: true,
        isEditing: false
      })));
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Wystąpił nieoczekiwany błąd. Upewnij się, że serwer działa.');
    } finally {
      setLoading(false);
      setProgressText('');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const onButtonClick = () => {
    fileInputRef.current?.click();
  };

  // Editing helpers
  const startEditing = (item: EditableAnalyzedItem) => {
    setEditBackup(prev => ({ ...prev, [item.id]: { ...item } }));
    setLocalItems(prev => prev.map(x => x.id === item.id ? { ...x, isEditing: true } : x));
  };

  const cancelEditing = (id: string) => {
    const backup = editBackup[id];
    if (backup) {
      setLocalItems(prev => prev.map(x => x.id === id ? { ...backup, isEditing: false } : x));
    } else {
      setLocalItems(prev => prev.map(x => x.id === id ? { ...x, isEditing: false } : x));
    }
  };

  const saveEditing = (id: string) => {
    setLocalItems(prev => prev.map(x => x.id === id ? { ...x, isEditing: false } : x));
    setEditBackup(prev => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
  };

  const deleteItem = (id: string) => {
    setLocalItems(prev => prev.filter(item => item.id !== id));
  };

  const handleToggleSelectAll = (checked: boolean) => {
    setLocalItems(prev => prev.map(item => ({ ...item, selected: checked })));
  };

  const handleItemChange = (id: string, field: keyof EditableAnalyzedItem, value: any) => {
    setLocalItems(prev => prev.map(item => {
      if (item.id !== id) return item;
      
      const updated = { ...item, [field]: value };
      
      // If type changed, set smart defaults
      if (field === 'detectedType') {
        const type = value as ShapeType;
        updated.isStandard = (type === 'CEOWNIK' || type === 'DWUTEOWNIK');
        if (updated.isStandard) {
          const firstProfile = type === 'CEOWNIK' ? STANDARD_CHANNELS[0].name : STANDARD_IBEAMS[0].name;
          updated.standardProfileName = firstProfile;
          const p = type === 'CEOWNIK' ? STANDARD_CHANNELS[0] : STANDARD_IBEAMS[0];
          updated.h = p.height;
          updated.width = p.width;
          updated.webThickness = p.webThickness || null;
        } else {
          updated.standardProfileName = null;
          if (type === 'PRET_OKRAGLY' || type === 'PRET_KWADRATOWY' || type === 'PRET_PLASKI') {
            updated.quantity = 1;
          }
        }
      }
      
      return updated;
    }));
  };

  const handleProfileNameChange = (id: string, name: string) => {
    const all = [...STANDARD_CHANNELS, ...STANDARD_IBEAMS];
    const profile = all.find(p => p.name === name);
    if (profile) {
      setLocalItems(prev => prev.map(item => {
        if (item.id === id) {
          return {
            ...item,
            standardProfileName: name,
            h: profile.height,
            width: profile.width,
            webThickness: profile.webThickness || null
          };
        }
        return item;
      }));
    }
  };

  const getStandardProfilesForType = (type: ShapeType): string[] => {
    if (type === 'CEOWNIK') {
      return STANDARD_CHANNELS.map(p => p.name);
    }
    if (type === 'DWUTEOWNIK') {
      return STANDARD_IBEAMS.map(p => p.name);
    }
    return [];
  };

  const getLiveWeight = (item: EditableAnalyzedItem) => {
    let finalProfileName = item.standardProfileName;
    let finalH = item.h || 0;
    let finalWidth = item.width || 0;
    let matchedWebThick: number | undefined = undefined;
    let matchedFlangeThick: number | undefined = undefined;

    if (item.isStandard && finalProfileName && (item.detectedType === 'CEOWNIK' || item.detectedType === 'DWUTEOWNIK')) {
      const allProfiles = [...STANDARD_CHANNELS, ...STANDARD_IBEAMS];
      const matched = allProfiles.find(p => p.name === finalProfileName);
      if (matched) {
        finalH = matched.height;
        finalWidth = matched.width;
        matchedWebThick = matched.webThickness;
        matchedFlangeThick = matched.flangeThickness;
      }
    }

    const calc = calculateWeight({
      type: item.detectedType,
      isStandard: item.isStandard,
      profileName: finalProfileName || undefined,
      h: finalH,
      width: (item.detectedType === 'PRET_OKRAGLY' || item.detectedType === 'PRET_KWADRATOWY' || item.detectedType === 'RURA') ? finalH : finalWidth,
      length: item.length || 0,
      quantity: (item.detectedType === 'PRET_OKRAGLY' || item.detectedType === 'PRET_KWADRATOWY' || item.detectedType === 'PRET_PLASKI') ? 1 : (item.quantity || 1),
      webThickness: (item.detectedType === 'PROFIL_ZAMKNIETY' || item.detectedType === 'RURA' || item.detectedType === 'KATOWNIK') ? (item.webThickness || (item.detectedType === 'KATOWNIK' ? 3 : 2)) : matchedWebThick,
      flangeThickness: matchedFlangeThick
    });

    return calc;
  };

  const handleAddSelected = () => {
    const selected = localItems.filter(item => item.selected);
    if (selected.length === 0) return;
    
    // Call parent callback with selected items in regular AnalyzedItem structure
    onAnalysisComplete({
      items: selected.map(({ id, selected, isEditing, ...rest }) => rest as AnalyzedItem),
      explanation: analysisResult?.explanation || ''
    });

    // Reset drawing uploader state
    setLocalItems([]);
    setAnalysisResult(null);
    setImagePreview(null);
  };

  const allSelected = localItems.length > 0 && localItems.every(item => item.selected);
  const someSelected = localItems.length > 0 && localItems.some(item => item.selected) && !allSelected;
  const selectedItemsCount = localItems.filter(item => item.selected).length;

  const totalScannedWeight = localItems
    .filter(item => item.selected)
    .reduce((sum, item) => sum + getLiveWeight(item).totalWeight, 0);

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <Cpu className="text-orange-500 w-5 h-5" />
        <h3 className="font-display font-medium text-slate-800 text-md">
          Inteligentny Skaner AI (Odczyt z Zeszytu)
        </h3>
      </div>

      <form 
        onDragEnter={handleDrag} 
        onDragOver={handleDrag} 
        onDragLeave={handleDrag} 
        onDrop={handleDrop}
        onClick={onButtonClick}
        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors duration-200 flex flex-col items-center justify-center min-h-[160px] ${
          dragActive 
            ? 'border-orange-500 bg-orange-50/50' 
            : 'border-slate-200 bg-slate-50 hover:bg-orange-50/30 hover:border-orange-300'
        }`}
      >
        <input 
          ref={fileInputRef}
          type="file" 
          className="hidden" 
          accept="image/*,.heic,.heif"
          onChange={handleChange}
        />

        {imagePreview ? (
          <div className="flex flex-col items-center gap-3 w-full" onClick={(e) => e.stopPropagation()}>
            <div className="relative w-24 h-24 rounded-md overflow-hidden border border-slate-200 bg-slate-100 flex items-center justify-center">
              {imagePreview === 'HEIC_PREVIEW_PLACEHOLDER' ? (
                <div className="flex flex-col items-center justify-center text-slate-500 font-semibold text-[10px] p-2 text-center">
                  <FileImage className="w-8 h-8 text-orange-500 mb-1" />
                  <span>Obraz HEIC</span>
                </div>
              ) : (
                <img src={imagePreview} alt="Podgląd" className="w-full h-full object-cover" />
              )}
              {loading && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                  <RefreshCw className="animate-spin text-orange-500 w-6 h-6" />
                </div>
              )}
            </div>
            
            {!loading && (
              <span 
                onClick={onButtonClick}
                className="text-slate-500 text-xs flex items-center gap-1 hover:text-slate-800 cursor-pointer animate-fade-in"
              >
                <FileImage className="w-3 h-3" /> Zmień plik
              </span>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center">
            <div className="bg-orange-50 p-3 rounded-full mb-3 text-orange-500">
              <Upload className="w-6 h-6" />
            </div>
            <p className="text-slate-700 text-sm font-medium">
              Przeciągnij zdjęcie lub <span className="text-orange-500 font-semibold">kliknij, aby przeglądać</span>
            </p>
            <p className="text-slate-400 text-[10px] mt-1">
              Obsługiwane formaty: PNG, JPG, JPEG, HEIC (iOS)
            </p>
          </div>
        )}
      </form>

      {/* Progress & Loading State */}
      {loading && (
        <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-lg flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-orange-500 animate-ping" />
          <div className="flex-1">
            <p className="text-slate-700 text-xs font-medium animate-pulse">{progressText}</p>
            <div className="w-full bg-slate-200 h-1 rounded-full mt-2 overflow-hidden">
              <div className="bg-orange-500 h-full rounded-full animate-infinite-loading w-2/3" />
            </div>
          </div>
        </div>
      )}

      {/* Success Notification with Selector & Editor */}
      {analysisResult && !loading && localItems.length > 0 && (
        <div className="mt-4 p-4 bg-emerald-50/50 border border-emerald-200 rounded-xl">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="text-emerald-500 w-5 h-5 shrink-0 mt-0.5" />
            <div className="w-full min-w-0">
              <p className="text-emerald-700 text-xs font-semibold">
                AI odczytało pozycje ({localItems.length}):
              </p>
              
              {/* Select All Toggle */}
              <div className="flex items-center gap-2 mt-2 mb-2 pb-2 border-b border-emerald-100/60 text-[11px] text-slate-700 font-medium">
                <input
                  type="checkbox"
                  id="select-all"
                  checked={allSelected}
                  ref={el => {
                    if (el) el.indeterminate = someSelected;
                  }}
                  onChange={(e) => handleToggleSelectAll(e.target.checked)}
                  className="rounded text-emerald-500 border-slate-300 focus:ring-emerald-400 w-3.5 h-3.5 cursor-pointer"
                />
                <label htmlFor="select-all" className="cursor-pointer select-none">
                  Zaznacz wszystkie
                </label>
              </div>

              {/* Editable items list */}
              <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                {localItems.map((item, idx) => {
                  const translateType = (t: string) => {
                    if (t === 'BLACHA') return 'Blacha';
                    if (t === 'CEOWNIK') return 'Ceownik';
                    if (t === 'DWUTEOWNIK') return 'Dwuteownik';
                    if (t === 'PRET_OKRAGLY') return 'Pręt okrągły gładki';
                    if (t === 'PRET_KWADRATOWY') return 'Pręt kwadratowy';
                    if (t === 'PRET_PLASKI') return 'Pręt płaski / Płaskownik';
                    if (t === 'PROFIL_ZAMKNIETY') return 'Profil zamknięty';
                    if (t === 'RURA') return 'Rura';
                    if (t === 'KATOWNIK') return 'Kątownik';
                    return t;
                  };

                  const liveWeightCalc = getLiveWeight(item);

                  if (item.isEditing) {
                    return (
                      <div key={item.id} className="bg-white p-3 rounded-lg border-2 border-orange-200 text-xs text-slate-700 space-y-2.5 shadow-sm">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                          <span className="font-semibold text-slate-900 text-[11px]">Edycja pozycji {idx + 1}</span>
                          <div className="flex gap-1">
                            <button
                              type="button"
                              onClick={() => saveEditing(item.id)}
                              className="bg-emerald-500 hover:bg-emerald-600 text-white p-1 rounded transition-colors cursor-pointer"
                              title="Zapisz"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => cancelEditing(item.id)}
                              className="bg-slate-200 hover:bg-slate-300 text-slate-600 p-1 rounded transition-colors cursor-pointer"
                              title="Anuluj"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          {/* TYPE SELECT */}
                          <div className="col-span-2">
                            <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Typ kształtu</label>
                            <select
                              value={item.detectedType}
                              onChange={(e) => handleItemChange(item.id, 'detectedType', e.target.value)}
                              className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs"
                            >
                              <option value="BLACHA">Blacha</option>
                              <option value="CEOWNIK">Ceownik</option>
                              <option value="DWUTEOWNIK">Dwuteownik</option>
                              <option value="KATOWNIK">Kątownik</option>
                              <option value="PRET_OKRAGLY">Pręt okrągły</option>
                              <option value="PRET_KWADRATOWY">Pręt kwadratowy</option>
                              <option value="PRET_PLASKI">Płaskownik</option>
                              <option value="PROFIL_ZAMKNIETY">Profil zamknięty</option>
                              <option value="RURA">Rura</option>
                            </select>
                          </div>

                          {/* STANDARD OPTION */}
                          {(item.detectedType === 'CEOWNIK' || item.detectedType === 'DWUTEOWNIK') && (
                            <div className="col-span-2 flex items-center gap-1.5 py-1">
                              <input
                                type="checkbox"
                                id={`std-${item.id}`}
                                checked={item.isStandard}
                                onChange={(e) => handleItemChange(item.id, 'isStandard', e.target.checked)}
                                className="rounded text-orange-500 border-slate-300 focus:ring-orange-500"
                              />
                              <label htmlFor={`std-${item.id}`} className="text-[10px] text-slate-600 font-medium">
                                Profil standardowy
                              </label>
                            </div>
                          )}

                          {/* STANDARD PROFILE SELECT */}
                          {item.isStandard && (item.detectedType === 'CEOWNIK' || item.detectedType === 'DWUTEOWNIK') && (
                            <div className="col-span-2">
                              <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Nazwa profilu</label>
                              <select
                                value={item.standardProfileName || ''}
                                onChange={(e) => handleProfileNameChange(item.id, e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs font-mono"
                              >
                                {getStandardProfilesForType(item.detectedType).map(pName => (
                                  <option key={pName} value={pName}>{pName}</option>
                                ))}
                              </select>
                            </div>
                          )}

                          {/* DIMENSION H */}
                          {!item.isStandard && (
                            <div>
                              <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">
                                {item.detectedType === 'BLACHA' ? 'Grubość (mm)' : 
                                 (item.detectedType === 'PRET_OKRAGLY' || item.detectedType === 'RURA') ? 'Średnica (mm)' : 
                                 item.detectedType === 'PRET_PLASKI' ? 'Grubość (mm)' : 
                                 item.detectedType === 'KATOWNIK' ? 'Ramię H (mm)' : 'Wysokość (mm)'}
                              </label>
                              <input
                                type="number"
                                value={item.h || ''}
                                onChange={(e) => handleItemChange(item.id, 'h', e.target.value ? Number(e.target.value) : null)}
                                className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs"
                              />
                            </div>
                          )}

                          {/* DIMENSION WIDTH */}
                          {!item.isStandard && (item.detectedType === 'BLACHA' || item.detectedType === 'PRET_PLASKI' || item.detectedType === 'PROFIL_ZAMKNIETY' || item.detectedType === 'KATOWNIK') && (
                            <div>
                              <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">
                                {item.detectedType === 'KATOWNIK' ? 'Szerokość S (mm)' : 'Szerokość (mm)'}
                              </label>
                              <input
                                type="number"
                                value={item.width || ''}
                                onChange={(e) => handleItemChange(item.id, 'width', e.target.value ? Number(e.target.value) : null)}
                                className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs"
                              />
                            </div>
                          )}

                          {/* WALL THICKNESS */}
                          {!item.isStandard && (item.detectedType === 'PROFIL_ZAMKNIETY' || item.detectedType === 'RURA' || item.detectedType === 'KATOWNIK') && (
                            <div>
                              <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Ścianka (mm)</label>
                              <input
                                type="number"
                                value={item.webThickness || ''}
                                onChange={(e) => handleItemChange(item.id, 'webThickness', e.target.value ? Number(e.target.value) : null)}
                                className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs"
                              />
                            </div>
                          )}

                          {/* LENGTH */}
                          <div>
                            <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">
                              {item.detectedType === 'BLACHA' ? 'Długość (mm)' : 'Długość (m)'}
                            </label>
                            <input
                              type="number"
                              step="any"
                              value={item.detectedType === 'BLACHA' ? Math.round((item.length || 0) * 1000) : (item.length || '')}
                              onChange={(e) => {
                                const val = e.target.value ? Number(e.target.value) : null;
                                const parsedVal = (item.detectedType === 'BLACHA' && val !== null) ? val / 1000 : val;
                                handleItemChange(item.id, 'length', parsedVal);
                              }}
                              className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs"
                            />
                          </div>

                          {/* QUANTITY */}
                          {(item.detectedType === 'PRET_OKRAGLY' || item.detectedType === 'PRET_KWADRATOWY' || item.detectedType === 'PRET_PLASKI') ? (
                            <div>
                              <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Ilość sztuk</label>
                              <div className="w-full bg-slate-100 text-slate-400 border border-slate-200 rounded px-2 py-1 text-xs cursor-not-allowed font-medium">
                                Brak (tylko metry)
                              </div>
                            </div>
                          ) : (
                            <div>
                              <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Ilość sztuk</label>
                              <input
                                type="number"
                                value={item.quantity}
                                onChange={(e) => handleItemChange(item.id, 'quantity', e.target.value ? Number(e.target.value) : 1)}
                                className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  }

                  // Standard static item layout
                  const isBarType = item.detectedType === 'PRET_OKRAGLY' || item.detectedType === 'PRET_KWADRATOWY' || item.detectedType === 'PRET_PLASKI';

                  return (
                    <div key={item.id} className={`p-2.5 rounded border text-[11px] text-slate-700 transition-colors flex gap-2 items-start ${
                      item.selected 
                        ? 'bg-white border-emerald-200 hover:border-emerald-300 shadow-sm' 
                        : 'bg-slate-50/70 border-slate-200 opacity-65 hover:opacity-100'
                    }`}>
                      {/* CHECKBOX */}
                      <input
                        type="checkbox"
                        checked={item.selected}
                        onChange={(e) => handleItemChange(item.id, 'selected', e.target.checked)}
                        className="mt-1 rounded text-emerald-500 border-slate-300 focus:ring-emerald-400 w-3.5 h-3.5 cursor-pointer shrink-0"
                      />

                      {/* ITEM DETAILS */}
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-slate-900 flex justify-between items-start gap-1">
                          <span className="truncate">
                            {idx + 1}. {item.isStandard ? item.standardProfileName : translateType(item.detectedType)}
                          </span>
                          <span className="text-orange-600 font-mono font-bold shrink-0">
                            {isBarType ? `${item.length} m` : `${item.quantity} szt.`}
                          </span>
                        </div>

                        <div className="mt-0.5 text-slate-500 font-mono text-[10px] flex flex-wrap gap-x-2">
                          <span>Grubość/Wysokość: {item.h} mm</span>
                          {item.width && <span>Szerokość: {item.width} mm</span>}
                          {item.webThickness && <span>Ścianka: {item.webThickness} mm</span>}
                          <span>
                            Długość: {item.detectedType === 'BLACHA' ? `${Math.round((item.length || 0) * 1000)} mm` : `${item.length} m`}
                          </span>
                        </div>

                        {/* LIVE WEIGHT DISPLAY */}
                        <div className="mt-1 text-slate-800 font-semibold text-[10px] flex items-center gap-1 bg-emerald-50 px-1.5 py-0.5 rounded w-fit border border-emerald-100">
                          <span>Waga:</span>
                          <span className="text-emerald-700 font-mono">
                            {liveWeightCalc.totalWeight.toLocaleString('pl-PL', { minimumFractionDigits: 1 })} kg
                          </span>
                        </div>

                        {item.rawQuantityList && (
                          <div className="text-[9px] text-slate-400 mt-1">
                            {isBarType ? `Suma odcinków: ${item.rawQuantityList} = ${item.length} m` : `Suma z: ${item.rawQuantityList} = ${item.quantity} szt.`}
                          </div>
                        )}
                        {item.originalText && (
                          <div className="text-[9px] text-slate-400 italic mt-0.5 border-t border-slate-100 pt-0.5 truncate" title={item.originalText}>
                            Zapis: "{item.originalText}"
                          </div>
                        )}
                      </div>

                      {/* ACTION BUTTONS */}
                      <div className="flex flex-col gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => startEditing(item)}
                          className="text-slate-400 hover:text-orange-500 p-1 rounded hover:bg-slate-100 transition-colors cursor-pointer"
                          title="Edytuj"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteItem(item.id)}
                          className="text-slate-400 hover:text-rose-500 p-1 rounded hover:bg-slate-100 transition-colors cursor-pointer"
                          title="Usuń"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Summary / Explanation and Import Trigger */}
              <div className="mt-3 pt-2.5 border-t border-emerald-100">
                <p className="text-slate-500 text-[10px] italic leading-relaxed mb-3">
                  "{analysisResult.explanation}"
                </p>

                <button
                  type="button"
                  onClick={handleAddSelected}
                  disabled={selectedItemsCount === 0}
                  className={`w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 px-4 rounded-lg text-xs transition-colors shadow-sm cursor-pointer flex items-center justify-center gap-2 ${
                    selectedItemsCount === 0 ? 'opacity-50 cursor-not-allowed bg-slate-400 hover:bg-slate-400' : ''
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Dodaj wybrane ({selectedItemsCount}) — {totalScannedWeight.toLocaleString('pl-PL', { maximumFractionDigits: 1 })} kg
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mt-4 p-4 bg-rose-50 border border-rose-200 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertCircle className="text-rose-500 w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <p className="text-rose-700 text-xs font-semibold">Błąd skanera AI</p>
              <p className="text-slate-600 text-xs mt-1 leading-relaxed">
                {error}
              </p>
              <p className="text-slate-400 text-[10px] mt-2 leading-relaxed">
                Możesz nadal wpisać wymiary ręcznie w sekcji powyżej.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
