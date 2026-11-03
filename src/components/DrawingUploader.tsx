import React, { useState, useRef, useEffect } from 'react';
import { Upload, FileImage, Cpu, CheckCircle2, AlertCircle, RefreshCw, Pencil, Trash2, X } from 'lucide-react';
import { MultiAnalysisResult, ShapeType, AnalyzedItem, ProfileSystem } from '../types';
import { calculateWeight } from '../utils/calculator';
import { STANDARD_CHANNELS, STANDARD_IBEAMS, findStandardProfile } from '../data/profiles';

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
  profileSystem?: ProfileSystem;
  webThickness?: number | null;
  flangeThickness?: number | null;
  customName?: string;
  customDimensions?: string;
  originalText?: string;
  selected: boolean;
  pipeMode?: 'pieces' | 'meters';
  pipeType?: 'zwykla' | 'wiertnicza';
}

// Helper to extract sequential items and their total sum
function getScannerDetails(item: EditableAnalyzedItem, isLengthType: boolean) {
  const totalVal = isLengthType ? (item.length ?? 0) : (item.quantity ?? 1);
  const totalStr = `${totalVal}`;

  let raw = (item.rawQuantityList || '').trim();
  if ((!raw || (raw === '1' && !isLengthType)) && item.originalText) {
    const dashIdx = item.originalText.lastIndexOf('-');
    if (dashIdx !== -1) {
      const candidate = item.originalText.substring(dashIdx + 1).trim();
      if (candidate && /\d/.test(candidate)) {
        raw = candidate;
      }
    }
  }

  // Parse numbers / values separated by commas, pluses, semicolons or spaces
  const parts = raw
    .split(/[,+;\s]+/)
    .map(p => p.trim())
    .filter(p => p.length > 0 && /\d/.test(p));

  let sequenceStr = '';
  if (parts.length > 1) {
    sequenceStr = parts.map(p => `${p}`).join(' + ') + ` = ${totalStr}`;
  } else if (parts.length === 1) {
    sequenceStr = parts[0] === totalStr ? totalStr : `${parts[0]} = ${totalStr}`;
  } else {
    sequenceStr = totalStr;
  }

  return {
    parts,
    totalStr,
    sequenceStr,
    originalText: item.originalText || raw || totalStr
  };
}

export default function DrawingUploader({ onAnalysisComplete }: DrawingUploaderProps) {
  const [dragActive, setDragActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<MultiAnalysisResult | null>(null);
  const [localItems, setLocalItems] = useState<EditableAnalyzedItem[]>([]);
  const [lastFile, setLastFile] = useState<File | null>(null);
  
  // Modal Edit state (identical to CalculationList.tsx)
  const [editingItem, setEditingItem] = useState<EditableAnalyzedItem | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editType, setEditType] = useState<ShapeType>('BLACHA');
  const [editIsStandard, setEditIsStandard] = useState(false);
  const [editProfileSystem, setEditProfileSystem] = useState<ProfileSystem>('UNP');
  const [editProfileName, setEditProfileName] = useState('UNP 80');
  const [editH, setEditH] = useState<number>(0);
  const [editWidth, setEditWidth] = useState<number>(0);
  const [editLength, setEditLength] = useState<number>(2000);
  const [editQuantity, setEditQuantity] = useState<number>(1);
  const [editWebThickness, setEditWebThickness] = useState<number | ''>('');
  const [editFlangeThickness, setEditFlangeThickness] = useState<number | ''>('');
  const [editPipeMode, setEditPipeMode] = useState<'pieces' | 'meters'>('pieces');
  const [editPipeType, setEditPipeType] = useState<'zwykla' | 'wiertnicza'>('zwykla');
  const [editCustomName, setEditCustomName] = useState('');
  const [editCustomDimensions, setEditCustomDimensions] = useState('');

  const abortControllerRef = useRef<AbortController | null>(null);
  const isUserCancelledRef = useRef<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCancelScan = () => {
    isUserCancelledRef.current = true;
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setLoading(false);
    setError('Przerwano analizę na żądanie użytkownika.');
  };

  const optimizeImageClientSide = async (file: File): Promise<{ base64: string; mimeType: string }> => {
    const isHeic = file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif') || file.type === 'image/heic' || file.type === 'image/heif';
    
    // For standard images (JPEG, PNG, WebP), resize directly on canvas in the browser (takes ~40ms)
    // This reduces a 15-25MB camera photo down to ~300KB before network transmission!
    if (!isHeic && typeof window !== 'undefined') {
      try {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        const img = new Image();
        const loaded = new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = reject;
        });
        img.src = dataUrl;
        await loaded;

        const maxDim = 1400;
        let width = img.width;
        let height = img.height;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.82);
          return {
            base64: compressedDataUrl.split(',')[1],
            mimeType: 'image/jpeg'
          };
        }
      } catch (clientOptErr) {
        console.warn('Client-side canvas optimization fallback to raw FileReader:', clientOptErr);
      }
    }

    // Fallback or HEIC: read base64 directly, letting server-side Sharp handle it
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve({
          base64: result.split(',')[1],
          mimeType: isHeic ? 'image/heic' : (file.type || 'image/jpeg')
        });
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

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

    setLastFile(file);
    setLoading(true);
    setError(null);
    setAnalysisResult(null);
    setLocalItems([]);
    isUserCancelledRef.current = false;
    
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

    const controller = new AbortController();
    abortControllerRef.current = controller;

    // Automatic 140s client timeout (allowing thorough multimodal recognition on large notebook pages)
    const timeoutId = setTimeout(() => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    }, 140000);
    
    try {
      const { base64: base64Data, mimeType: uploadMimeType } = await optimizeImageClientSide(file);
      
      const response = await fetch('/api/analyze-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image: base64Data,
          mimeType: uploadMimeType,
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        let rawMsg = errData.error || 'Wystąpił błąd podczas analizy obrazu.';
        if (typeof rawMsg === 'string' && (rawMsg.startsWith('{') || rawMsg.includes('"error"'))) {
          try {
            const parsed = JSON.parse(rawMsg);
            rawMsg = parsed.error?.message || parsed.message || rawMsg;
          } catch {
            // ignore JSON parse error
          }
        }
        if (response.status === 429 || errData.isQuota || rawMsg.includes('quota') || rawMsg.includes('Quota') || rawMsg.includes('429') || rawMsg.includes('RESOURCE_EXHAUSTED')) {
          rawMsg = 'Wyczerpano bieżącą pulę zapytań klucza Gemini API (Quota Exceeded). Upewnij się w panelu Settings > Secrets, że wybrany jest Twój klucz Pro, bądź wprowadź pozycje ręcznie w formularzu kalkulatora powyżej.';
        }
        throw new Error(rawMsg);
      }

      const data: MultiAnalysisResult = await response.json();
      setAnalysisResult(data);
      const sanitized = (data.items || []).map(item => {
        let detectedType = item.detectedType;
        let h = item.h;
        let width = item.width;
        let webThickness = item.webThickness;
        const rawText = item.originalText || '';

        // Safeguard: 3 dimensions (e.g. 80x80x5, 60x40x3) or square cross-section (80x80) is ALWAYS a box profile
        const threeDimMatch = rawText.match(/\b(\d{1,3})\s*[xX*]\s*(\d{1,3})\s*[xX*]\s*(\d+(?:[.,]\d+)?)\b/);
        const isAngle = /^(?:L\s|katownik|kątownik)/i.test(rawText.trim());
        const isRound = /(?:rura okr|ro\b|fi\s|ø)/i.test(rawText.toLowerCase());

        if (!isAngle && !isRound && (threeDimMatch || (detectedType === 'PRET_PLASKI' && (h === width || webThickness)))) {
          if (threeDimMatch) {
            const d1 = parseFloat(threeDimMatch[1]);
            const d2 = parseFloat(threeDimMatch[2]);
            const w = parseFloat(threeDimMatch[3].replace(',', '.'));
            if (d1 <= 400 && d2 <= 400) {
              detectedType = 'PROFIL_ZAMKNIETY';
              h = Math.max(d1, d2);
              width = Math.min(d1, d2);
              webThickness = w;
            }
          } else if (detectedType === 'PRET_PLASKI' && h === width && (h || 0) >= 20) {
            detectedType = 'PROFIL_ZAMKNIETY';
            webThickness = webThickness || 3;
          }
        }

        return {
          ...item,
          detectedType,
          h,
          width,
          webThickness,
          id: crypto.randomUUID(),
          selected: true,
        };
      });

      setLocalItems(sanitized);
    } catch (err: any) {
      console.error(err);
      if (err.name === 'AbortError') {
        if (isUserCancelledRef.current) {
          setError('Przerwano analizę na żądanie użytkownika.');
        } else {
          setError('Czas oczekiwania na odpowiedź minął. Upewnij się, że zdjęcie jest czytelne lub wprowadź pozycje ręcznie w formularzu.');
        }
        return;
      }
      let msg = err.message || 'Wystąpił nieoczekiwany błąd. Upewnij się, że serwer działa.';
      if (typeof msg === 'string' && (msg.startsWith('{') || msg.includes('"error"'))) {
        try {
          const parsed = JSON.parse(msg);
          msg = parsed.error?.message || parsed.message || msg;
        } catch {
          // ignore
        }
      }
      if (msg.includes('quota') || msg.includes('Quota') || msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')) {
        msg = 'Wyczerpano bieżącą pulę zapytań klucza Gemini API (Quota Exceeded). Upewnij się w panelu Settings > Secrets, że wybrany jest Twój klucz Pro, bądź wprowadź pozycje ręcznie w formularzu kalkulatora powyżej.';
      }
      setError(msg);
    } finally {
      clearTimeout(timeoutId);
      abortControllerRef.current = null;
      setLoading(false);
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

  const deleteItem = (id: string) => {
    setLocalItems(prev => prev.filter(item => item.id !== id));
  };

  const handleToggleSelectAll = (checked: boolean) => {
    setLocalItems(prev => prev.map(item => ({ ...item, selected: checked })));
  };

  const handleToggleItemSelect = (id: string, checked: boolean) => {
    setLocalItems(prev => prev.map(item => item.id === id ? { ...item, selected: checked } : item));
  };

  // Open the edit modal (identical to CalculationList.tsx)
  const startEdit = (item: EditableAnalyzedItem, index: number) => {
    setEditingItem(item);
    setEditingIndex(index);
    setEditType(item.detectedType);
    setEditIsStandard(item.isStandard);
    
    if (item.isStandard && item.standardProfileName) {
      const found = findStandardProfile(item.standardProfileName);
      const sys = found?.system || (item.detectedType === 'CEOWNIK' ? 'UNP' : 'INP');
      setEditProfileSystem(sys);
      setEditProfileName(item.standardProfileName);
    } else {
      if (item.detectedType === 'CEOWNIK') {
        const savedSys = (localStorage.getItem('biastal_pref_ceownik') as ProfileSystem) || 'UNP';
        setEditProfileSystem(savedSys);
        const savedProfile = localStorage.getItem(`biastal_pref_profile_name_${savedSys}`);
        if (savedProfile && findStandardProfile(savedProfile)) {
          setEditProfileName(savedProfile);
        } else {
          const first = STANDARD_CHANNELS.find(p => p.system === savedSys);
          setEditProfileName(first ? first.name : 'UNP 80');
        }
      } else if (item.detectedType === 'DWUTEOWNIK') {
        setEditProfileSystem('INP');
        const savedProfile = localStorage.getItem('biastal_pref_profile_name_INP');
        if (savedProfile && findStandardProfile(savedProfile)) {
          setEditProfileName(savedProfile);
        } else {
          const first = STANDARD_IBEAMS.find(p => p.system === 'INP');
          setEditProfileName(first ? first.name : 'INP 120');
        }
      }
    }
    
    setEditH(item.h || 0);
    setEditWidth(item.width || 0);
    
    // Length: BLACHA is stored in meters internally, but edited in mm (e.g. 2000 mm)
    setEditLength(item.detectedType === 'BLACHA' ? Math.round((item.length || 0) * 1000) : (item.length || 0));
    
    setEditQuantity(item.quantity || 1);
    setEditWebThickness(item.webThickness !== undefined && item.webThickness !== null ? item.webThickness : '');
    setEditFlangeThickness(item.flangeThickness !== undefined && item.flangeThickness !== null ? item.flangeThickness : '');
    
    setEditPipeMode(item.pipeMode || 'pieces');
    setEditPipeType(item.pipeType || 'zwykla');

    setEditCustomName(item.customName || '');
    setEditCustomDimensions(item.customDimensions || '');
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
      if (editLength < 100) setEditLength(2000);
    } else {
      if (editLength >= 100) setEditLength(6.0);
      if (newType === 'CEOWNIK' || newType === 'DWUTEOWNIK') {
        const sys: ProfileSystem = newType === 'CEOWNIK' ? 'UNP' : 'INP';
        setEditProfileSystem(sys);
        const first = newType === 'CEOWNIK' 
          ? STANDARD_CHANNELS.find(p => p.system === 'UNP')
          : STANDARD_IBEAMS.find(p => p.system === 'INP');
        setEditProfileName(first ? first.name : (newType === 'CEOWNIK' ? 'UNP 80' : 'INP 120'));
        setEditIsStandard(true);
      } else {
        setEditIsStandard(false);
      }
    }
  };

  const isMetersOnly = editType === 'PRET_OKRAGLY' || editType === 'PRET_KWADRATOWY' || editType === 'PRET_PLASKI' || editType === 'PROFIL_ZAMKNIETY' || editType === 'KATOWNIK' || editType === 'RURA_OKRAGLA';

  // Recalculate live weight inside modal (BLACHA editLength in mm converted to m)
  const currentCalcEdit = calculateWeight({
    type: editType,
    isStandard: editIsStandard,
    profileName: editIsStandard ? editProfileName : undefined,
    h: editH,
    width: (editType === 'PRET_OKRAGLY' || editType === 'PRET_KWADRATOWY' || editType === 'RURA' || editType === 'RURA_OKRAGLA') ? editH : editWidth,
    length: editType === 'BLACHA' ? (editLength / 1000) : ((editType === 'RURA' && editPipeMode === 'pieces') ? 0 : editLength),
    quantity: isMetersOnly ? 1 : (editType === 'RURA' ? (editPipeMode === 'pieces' ? editQuantity : 1) : editQuantity),
    webThickness: (editType === 'PROFIL_ZAMKNIETY' || editType === 'RURA' || editType === 'RURA_OKRAGLA' || editType === 'KATOWNIK') ? (editWebThickness !== '' ? Number(editWebThickness) : (editType === 'RURA_OKRAGLA' ? 3.2 : (editType === 'KATOWNIK' ? 3 : 2))) : (editWebThickness === '' ? undefined : Number(editWebThickness)),
    flangeThickness: editFlangeThickness === '' ? undefined : Number(editFlangeThickness),
  });

  // Save changes from modal back to localItems
  const handleSaveModal = () => {
    if (!editingItem) return;

    const finalLength = editType === 'BLACHA' 
      ? (editLength / 1000) 
      : ((editType === 'RURA' && editPipeMode === 'pieces') ? 0 : editLength);
    const finalQuantity = isMetersOnly 
      ? 1 
      : (editType === 'RURA' ? (editPipeMode === 'pieces' ? editQuantity : 1) : editQuantity);

    setLocalItems(prev => prev.map(item => {
      if (item.id !== editingItem.id) return item;
      return {
        ...item,
        detectedType: editType,
        isStandard: editIsStandard,
        standardProfileName: (editIsStandard && (editType === 'CEOWNIK' || editType === 'DWUTEOWNIK')) ? editProfileName : null,
        profileSystem: (editIsStandard && (editType === 'CEOWNIK' || editType === 'DWUTEOWNIK')) ? editProfileSystem : undefined,
        customName: editType === 'INNY' ? editCustomName : undefined,
        customDimensions: editType === 'INNY' ? editCustomDimensions : undefined,
        h: editH,
        width: (editType === 'PRET_OKRAGLY' || editType === 'PRET_KWADRATOWY' || editType === 'RURA' || editType === 'RURA_OKRAGLA') ? editH : editWidth,
        length: finalLength,
        quantity: finalQuantity,
        webThickness: (editType === 'PROFIL_ZAMKNIETY' || editType === 'KATOWNIK' || editType === 'RURA_OKRAGLA') 
          ? (editWebThickness !== '' ? Number(editWebThickness) : (editType === 'RURA_OKRAGLA' ? 3.2 : (editType === 'KATOWNIK' ? 3 : 2))) 
          : (editType === 'RURA' ? undefined : (editType !== 'BLACHA' ? currentCalcEdit.webThickness : undefined)),
        flangeThickness: (editType !== 'BLACHA' && editType !== 'PRET_OKRAGLY' && editType !== 'PRET_KWADRATOWY' && editType !== 'PRET_PLASKI' && editType !== 'PROFIL_ZAMKNIETY' && editType !== 'RURA' && editType !== 'RURA_OKRAGLA' && editType !== 'KATOWNIK') 
          ? currentCalcEdit.flangeThickness 
          : undefined,
        pipeMode: editType === 'RURA' ? editPipeMode : undefined,
        pipeType: editType === 'RURA' ? editPipeType : undefined,
      };
    }));

    setEditingItem(null);
    setEditingIndex(null);
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
      width: (item.detectedType === 'PRET_OKRAGLY' || item.detectedType === 'PRET_KWADRATOWY' || item.detectedType === 'RURA' || item.detectedType === 'RURA_OKRAGLA') ? finalH : finalWidth,
      length: item.length || 0,
      quantity: (item.detectedType === 'PRET_OKRAGLY' || item.detectedType === 'PRET_KWADRATOWY' || item.detectedType === 'PRET_PLASKI' || item.detectedType === 'RURA_OKRAGLA') ? 1 : (item.quantity || 1),
      webThickness: (item.detectedType === 'PROFIL_ZAMKNIETY' || item.detectedType === 'RURA' || item.detectedType === 'RURA_OKRAGLA' || item.detectedType === 'KATOWNIK') ? (item.webThickness || (item.detectedType === 'RURA_OKRAGLA' ? 3.2 : (item.detectedType === 'KATOWNIK' ? 3 : 2))) : matchedWebThick,
      flangeThickness: matchedFlangeThick
    });

    return calc;
  };

  const handleAddSelected = () => {
    const selected = localItems.filter(item => item.selected);
    if (selected.length === 0) return;
    
    onAnalysisComplete({
      items: selected.map(({ id, selected, ...rest }) => rest as AnalyzedItem),
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
    .reduce((sum, item) => sum + (item.detectedType === 'INNY' ? 0 : getLiveWeight(item).totalWeight), 0);

  const translateType = (t: string) => {
    if (t === 'BLACHA') return 'Blacha';
    if (t === 'CEOWNIK') return 'Ceownik';
    if (t === 'DWUTEOWNIK') return 'Dwuteownik';
    if (t === 'PRET_OKRAGLY') return 'Pręt okrągły gładki';
    if (t === 'PRET_KWADRATOWY') return 'Pręt kwadratowy';
    if (t === 'PRET_PLASKI') return 'Pręt płaski / Płaskownik';
    if (t === 'PROFIL_ZAMKNIETY') return 'Profil zamknięty';
    if (t === 'RURA_OKRAGLA') return 'Rura okrągła';
    if (t === 'RURA') return 'Rura';
    if (t === 'KATOWNIK') return 'Kątownik';
    if (t === 'INNY') return 'Inne';
    return t;
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
      {/* Title Header - Matching CalculationList */}
      <div className="bg-slate-900 p-5 text-white flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Cpu className="text-orange-500 w-5 h-5 shrink-0" />
          <h2 className="font-display font-semibold text-lg">
            Inteligentny Skaner AI (Zeszyt)
          </h2>
        </div>
        <span className="bg-slate-800 text-xs text-slate-300 px-2.5 py-1 rounded-full font-mono">
          {localItems.length > 0 ? `Pozycji: ${localItems.length}` : 'Odczyt ze zdjęć'}
        </span>
      </div>

      <div className="p-6 flex-1 flex flex-col">
        <form 
          onDragEnter={handleDrag} 
          onDragOver={handleDrag} 
          onDragLeave={handleDrag} 
          onDrop={handleDrop}
          onClick={onButtonClick}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors duration-200 flex flex-col items-center justify-center min-h-[200px] ${
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
              <div className="relative w-32 h-32 rounded-xl overflow-hidden border border-slate-200 bg-slate-100 flex items-center justify-center shadow-inner">
                {imagePreview === 'HEIC_PREVIEW_PLACEHOLDER' ? (
                  <div className="flex flex-col items-center justify-center text-slate-500 font-semibold text-xs p-2 text-center">
                    <FileImage className="w-10 h-10 text-orange-500 mb-1" />
                    <span>Obraz HEIC</span>
                  </div>
                ) : (
                  <img src={imagePreview} alt="Podgląd" className="w-full h-full object-cover" />
                )}
                {loading && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                    <RefreshCw className="animate-spin text-orange-500 w-8 h-8" />
                  </div>
                )}
              </div>
              
              {!loading && (
                <button
                  type="button" 
                  onClick={onButtonClick}
                  className="text-slate-600 text-xs font-medium flex items-center gap-1.5 hover:text-slate-900 cursor-pointer bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition-colors border border-slate-200"
                >
                  <FileImage className="w-3.5 h-3.5 text-orange-500" /> Zmień plik zdjęcia
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center">
              <div className="bg-orange-100/70 p-4 rounded-2xl mb-3 text-orange-600 shadow-xs">
                <Upload className="w-8 h-8" />
              </div>
              <p className="text-slate-800 text-sm font-semibold">
                Przeciągnij zdjęcie odręcznych notatek lub <span className="text-orange-600 underline underline-offset-2">wybierz z dysku</span>
              </p>
              <p className="text-slate-400 text-xs mt-1.5 font-medium">
                Obsługiwane formaty: PNG, JPG, JPEG, HEIC (iPhone / Android)
              </p>
            </div>
          )}
        </form>

        {/* Progress & Loading State */}
        {loading && (
          <div className="mt-5 p-4 bg-orange-50/70 border border-orange-200 rounded-xl flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <RefreshCw className="animate-spin text-orange-600 w-5 h-5 shrink-0" />
                <p className="text-slate-800 text-sm font-semibold">Trwa odczytywanie zdjęcia</p>
              </div>
              <button
                type="button"
                onClick={handleCancelScan}
                className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 hover:text-slate-900 transition-colors shadow-xs shrink-0 cursor-pointer"
              >
                Przerwij
              </button>
            </div>
            <div className="w-full bg-orange-200/60 h-2 rounded-full overflow-hidden">
              <div className="bg-orange-500 h-full rounded-full animate-infinite-loading w-1/2" />
            </div>
          </div>
        )}

        {/* Success Notification with Selector & Items List */}
        {analysisResult && !loading && localItems.length > 0 && (
          <div className="mt-5 p-5 bg-emerald-50/50 border border-emerald-200 rounded-2xl">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="text-emerald-500 w-5 h-5 shrink-0 mt-0.5" />
              <div className="w-full min-w-0">
                <div className="flex items-center justify-between">
                  <p className="text-emerald-800 text-sm font-bold">
                    AI odczytało pozycje ({localItems.length}):
                  </p>
                  <span className="text-xs text-emerald-700 font-medium">
                    Zaznaczono: {selectedItemsCount} / {localItems.length}
                  </span>
                </div>
                
                {/* Select All Toggle */}
                <div className="flex items-center gap-2 mt-2 mb-2 pb-2 border-b border-emerald-100 text-xs text-slate-700 font-medium">
                  <input
                    type="checkbox"
                    id="select-all"
                    checked={allSelected}
                    ref={el => {
                      if (el) el.indeterminate = someSelected;
                    }}
                    onChange={(e) => handleToggleSelectAll(e.target.checked)}
                    className="rounded text-emerald-500 border-slate-300 focus:ring-emerald-400 w-4 h-4 cursor-pointer"
                  />
                  <label htmlFor="select-all" className="cursor-pointer select-none">
                    Zaznacz wszystkie
                  </label>
                </div>

                {/* Items List */}
                <div className="space-y-2.5 max-h-[440px] overflow-y-auto pr-1">
                  {localItems.map((item, idx) => {
                    const liveWeightCalc = getLiveWeight(item);
                    const isLengthType = item.detectedType !== 'BLACHA' && item.detectedType !== 'INNY' && !(item.detectedType === 'RURA' && item.pipeMode === 'pieces');
                    const scannerDetails = getScannerDetails(item, isLengthType);

                    return (
                      <div key={item.id} className={`p-3 rounded-xl border text-xs text-slate-700 transition-colors flex gap-2.5 items-start ${
                        item.selected 
                          ? 'bg-white border-emerald-200 hover:border-emerald-300 shadow-sm' 
                          : 'bg-slate-50/70 border-slate-200 opacity-65 hover:opacity-100'
                      }`}>
                        {/* CHECKBOX */}
                        <input
                          type="checkbox"
                          checked={item.selected}
                          onChange={(e) => handleToggleItemSelect(item.id, e.target.checked)}
                          className="mt-1 rounded text-emerald-500 border-slate-300 focus:ring-emerald-400 w-4 h-4 cursor-pointer shrink-0"
                        />

                        {/* ITEM DETAILS */}
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-slate-900 flex justify-between items-start gap-1">
                            <span className="truncate flex items-center gap-1.5">
                              <span className="font-mono text-slate-400 whitespace-nowrap">{idx + 1}.</span>
                              <span className="text-sm">
                                {item.detectedType === 'INNY' 
                                  ? (item.customName || 'Inny element') 
                                  : item.detectedType === 'BLACHA'
                                    ? `Blacha ${item.h}x${item.width}x${Math.round((item.length || 0) * 1000)} mm`
                                    : item.detectedType === 'PRET_PLASKI'
                                      ? `Płaskownik ${Math.max(item.width || 0, item.h || 0)}x${Math.min(item.width || 0, item.h || 0)} mm`
                                      : item.detectedType === 'PROFIL_ZAMKNIETY'
                                        ? `Profil zamk. ${item.h}x${item.width}x${item.webThickness || 2} mm`
                                        : item.detectedType === 'KATOWNIK'
                                          ? `Kątownik L ${item.h}x${item.width}x${item.webThickness || 3} mm`
                                          : (item.isStandard && item.standardProfileName ? item.standardProfileName : translateType(item.detectedType))}
                              </span>
                            </span>
                            <span className="text-orange-600 font-mono font-bold shrink-0 text-sm">
                              {isLengthType
                                ? `${item.length} m`
                                : `${item.quantity} szt.`}
                            </span>
                          </div>

                          <div className="mt-1 text-slate-500 font-mono text-xs flex flex-wrap gap-x-2.5 gap-y-0.5">
                            {item.detectedType === 'INNY' ? (
                              <span>Opis: {item.customDimensions || 'Element nieliczony'}</span>
                            ) : item.detectedType === 'RURA' ? (
                              <>
                                <span>Średnica: ∅ {item.h} mm</span>
                                <span>Typ: {item.pipeType === 'wiertnicza' ? 'Wiertnicza' : 'Zwykła'}</span>
                                {item.pipeMode === 'meters' && (
                                  <span>Długość: {item.length} m</span>
                                )}
                              </>
                            ) : item.detectedType === 'RURA_OKRAGLA' ? (
                              <>
                                <span>Średnica: Ø {item.h} mm</span>
                                <span>Ścianka: {item.webThickness || 3.2} mm</span>
                                <span>Długość: {item.length} m</span>
                              </>
                            ) : item.detectedType === 'BLACHA' ? (
                              <>
                                <span>Grubość: {item.h} mm</span>
                                {item.width && <span>Szerokość: {item.width} mm</span>}
                                <span>Długość: {Math.round((item.length || 0) * 1000)} mm</span>
                              </>
                            ) : item.detectedType === 'PRET_PLASKI' ? (
                              <>
                                <span>Wymiar: {Math.max(item.width || 0, item.h || 0)}x{Math.min(item.width || 0, item.h || 0)} mm</span>
                                <span>Długość: {item.length} m</span>
                              </>
                            ) : item.detectedType === 'PROFIL_ZAMKNIETY' ? (
                              <>
                                <span>Przekrój: {item.h}x{item.width} mm</span>
                                <span>Ścianka: {item.webThickness || 2} mm</span>
                                <span>Długość: {item.length} m</span>
                              </>
                            ) : (
                              <>
                                <span>Wysokość: {item.h} mm</span>
                                {item.width && <span>Szerokość: {item.width} mm</span>}
                                {item.webThickness && <span>Ścianka: {item.webThickness} mm</span>}
                                <span>Długość: {item.length} m</span>
                              </>
                            )}
                          </div>

                          {/* LIVE WEIGHT DISPLAY */}
                          {item.detectedType === 'INNY' ? (
                            <div className="mt-1.5 text-slate-500 font-semibold text-xs flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded w-fit border border-slate-200">
                              <span>Waga: nieliczona (0 kg)</span>
                            </div>
                          ) : item.detectedType === 'RURA' && item.pipeMode === 'pieces' ? (
                            <div className="mt-1.5 text-slate-800 font-semibold text-xs flex items-center gap-1 bg-slate-50 px-2 py-0.5 rounded w-fit border border-slate-200">
                              <span>Typ rury:</span>
                              <span className="text-slate-600 font-medium">
                                {item.pipeType === 'wiertnicza' ? 'Wiertnicza' : 'Zwykła'}
                              </span>
                            </div>
                          ) : (
                            <div className="mt-1.5 text-slate-800 font-semibold text-xs flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded w-fit border border-emerald-100">
                              <span>Waga:</span>
                              <span className="text-emerald-700 font-mono font-bold">
                                {liveWeightCalc.totalWeight.toLocaleString('pl-PL', { minimumFractionDigits: 1 })} kg
                              </span>
                            </div>
                          )}

                          {/* ODCZYTANE CYFRY */}
                          <div className="mt-1.5 p-2 bg-amber-50/90 border border-amber-200/90 rounded-lg text-xs text-slate-800 flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-amber-900 text-xs">
                              Odczytane:
                            </span>
                            <span className="font-mono font-bold text-slate-900 bg-white/90 px-2 py-0.5 rounded border border-amber-200 shadow-2xs">
                              {scannerDetails.sequenceStr}
                            </span>
                          </div>
                        </div>

                        {/* ACTION BUTTONS */}
                        <div className="flex flex-col gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => startEdit(item, idx)}
                            className="text-slate-400 hover:text-orange-500 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                            title="Edytuj pozycję"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteItem(item.id)}
                            className="text-slate-400 hover:text-rose-500 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                            title="Usuń pozycję"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Summary / Import Trigger */}
                <div className="mt-4 pt-3 border-t border-emerald-100">
                  <button
                    type="button"
                    onClick={handleAddSelected}
                    disabled={selectedItemsCount === 0}
                    className={`w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-4 rounded-xl text-sm transition-colors shadow-sm cursor-pointer flex items-center justify-center gap-2 ${
                      selectedItemsCount === 0 ? 'opacity-50 cursor-not-allowed bg-slate-400 hover:bg-slate-400' : ''
                    }`}
                  >
                    <CheckCircle2 className="w-5 h-5" />
                    Dodaj wybrane ({selectedItemsCount}) — {totalScannedWeight.toLocaleString('pl-PL', { maximumFractionDigits: 1 })} kg
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className={`mt-5 p-4 rounded-xl border ${
            error.includes('Settings > Secrets') || error.includes('limit')
              ? 'bg-amber-50/70 border-amber-200'
              : 'bg-rose-50 border-rose-200'
          }`}>
            <div className="flex items-start gap-3">
              <AlertCircle className={`w-5 h-5 shrink-0 mt-0.5 ${
                error.includes('Settings > Secrets') || error.includes('limit') ? 'text-amber-600' : 'text-rose-500'
              }`} />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className={`text-xs font-semibold ${
                    error.includes('Settings > Secrets') || error.includes('limit') ? 'text-amber-800' : 'text-rose-700'
                  }`}>
                    Komunikat skanera AI
                  </p>
                </div>
                <p className="text-slate-700 text-xs mt-1 leading-relaxed">
                  {error}
                </p>
                <div className="flex flex-wrap items-center gap-3 mt-3">
                  {lastFile && !loading && (
                    <button
                      type="button"
                      onClick={() => processFile(lastFile)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-medium transition-colors shadow-xs cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Spróbuj ponownie
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                    className="text-slate-600 hover:text-orange-600 text-xs underline cursor-pointer transition-colors"
                  >
                    Przejdź do ręcznego formularza powyżej
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Edit Item Modal Backdrop & Box - identical to CalculationList.tsx */}
      {editingItem && editingIndex !== null && (
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
                onClick={() => {
                  setEditingItem(null);
                  setEditingIndex(null);
                }}
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
                  {(['BLACHA', 'CEOWNIK', 'DWUTEOWNIK', 'PRET_OKRAGLY', 'PRET_KWADRATOWY', 'PRET_PLASKI', 'RURA_OKRAGLA', 'PROFIL_ZAMKNIETY', 'RURA', 'KATOWNIK', 'INNY'] as ShapeType[]).map((type) => {
                    const label = 
                      type === 'BLACHA' ? 'Blacha' :
                      type === 'CEOWNIK' ? 'Ceownik' :
                      type === 'DWUTEOWNIK' ? 'Dwuteownik' :
                      type === 'PRET_OKRAGLY' ? 'Pręt okrągły' :
                      type === 'PRET_KWADRATOWY' ? 'Pręt kwadratowy' :
                      type === 'PRET_PLASKI' ? 'Pręt płaski' :
                      type === 'RURA_OKRAGLA' ? 'Rura okrągła' :
                      type === 'RURA' ? 'Rura' :
                      type === 'KATOWNIK' ? 'Kątownik' :
                      type === 'INNY' ? 'Inne' :
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

              {/* INNY Custom Inputs */}
              {editType === 'INNY' && (
                <div className="space-y-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                      Szybki wybór pozycji nieliczonej:
                    </label>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {[
                        { label: 'Blacha łezkowa (bl łezka)', value: 'Blacha łezkowa' },
                        { label: 'Holimodel (holi)', value: 'Holimodel' },
                        { label: 'Hardox', value: 'Hardox' },
                        { label: 'Zaślepka PVC', value: 'Zaślepka PVC' },
                      ].map(preset => (
                        <button
                          key={preset.value}
                          type="button"
                          onClick={() => setEditCustomName(preset.value)}
                          className={`text-[11px] px-2 py-0.5 rounded border font-medium transition-colors cursor-pointer ${
                            editCustomName === preset.value
                              ? 'bg-orange-500 text-white border-orange-600 shadow-xs'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100 hover:text-slate-900'
                          }`}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>

                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                      Nazwa elementu
                    </label>
                    <input
                      type="text"
                      value={editCustomName}
                      onChange={(e) => setEditCustomName(e.target.value)}
                      placeholder="np. Blacha łezkowa, Holimodel, Hardox, Zaślepka PVC"
                      className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                      Wymiary / Opis (opcjonalnie)
                    </label>
                    <input
                      type="text"
                      value={editCustomDimensions}
                      onChange={(e) => setEditCustomDimensions(e.target.value)}
                      placeholder="np. 2000x1000 lub gr. 4 / M16"
                      className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-orange-500"
                    />
                  </div>
                  <div className="text-[10px] text-slate-500">
                    💡 Pozycja nieliczona (0 kg). Waga całkowita nie będzie powiększana o ten element.
                  </div>
                </div>
              )}

              {/* Standard vs Custom toggle */}
              {editType !== 'BLACHA' && editType !== 'INNY' && (
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
              {editType !== 'BLACHA' && editType !== 'INNY' && editIsStandard && (
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
                        <option value="UNP">UNP (Ceownik standardowy)</option>
                      ) : (
                        <option value="INP">INP (Dwuteownik standardowy)</option>
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
              {editType !== 'INNY' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                      {editType === 'BLACHA' ? 'Grubość H (mm)' : 
                       (editType === 'PRET_OKRAGLY' || editType === 'RURA' || editType === 'RURA_OKRAGLA') ? 'Średnica Ø (mm)' :
                       editType === 'PRET_KWADRATOWY' ? 'Bok kwadratu a (mm)' :
                       editType === 'PRET_PLASKI' ? 'Grubość H (mm)' :
                       editType === 'KATOWNIK' ? 'Ramię H (mm)' :
                       'Wysokość H (mm)'}
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={editH || ''}
                      onChange={(e) => {
                        const raw = e.target.value.replace(',', '.');
                        setEditH(raw === '' ? 0 : Number(raw));
                      }}
                      disabled={editIsStandard && (editType === 'CEOWNIK' || editType === 'DWUTEOWNIK')}
                      placeholder={editType === 'RURA_OKRAGLA' ? 'np. 60.3 lub 60,3' : ''}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold text-slate-800 focus:ring-1 focus:ring-orange-500 focus:outline-none disabled:bg-slate-100 disabled:text-slate-400"
                    />
                  </div>

                  {editType !== 'PRET_OKRAGLY' && editType !== 'PRET_KWADRATOWY' && editType !== 'RURA' && editType !== 'RURA_OKRAGLA' && (
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                        {editType === 'BLACHA' ? 'Szerokość S (mm)' : 
                         editType === 'PRET_PLASKI' ? 'Szerokość S (mm)' :
                         editType === 'KATOWNIK' ? 'Ramię S (mm)' :
                         'Szerokość półki S (mm)'}
                      </label>
                      <input
                        type="number"
                        step="any"
                        value={editWidth || ''}
                        onChange={(e) => {
                          const raw = e.target.value.replace(',', '.');
                          setEditWidth(raw === '' ? 0 : Number(raw));
                        }}
                        disabled={editIsStandard && (editType === 'CEOWNIK' || editType === 'DWUTEOWNIK')}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold text-slate-800 focus:ring-1 focus:ring-orange-500 focus:outline-none disabled:bg-slate-100 disabled:text-slate-400"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Web/Flange Thickness for Custom Profiles */}
              {(editType === 'PROFIL_ZAMKNIETY' || editType === 'KATOWNIK' || editType === 'RURA_OKRAGLA') && (
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    g - Grubość ścianki (mm)
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={editWebThickness}
                    onChange={(e) => {
                      const raw = e.target.value.replace(',', '.');
                      setEditWebThickness(raw === '' ? '' : Number(raw));
                    }}
                    placeholder={editType === 'RURA_OKRAGLA' ? 'np. 3.2 lub 3' : (editType === 'KATOWNIK' ? 'np. 3' : 'np. 2')}
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

              {!editIsStandard && editType !== 'BLACHA' && editType !== 'PROFIL_ZAMKNIETY' && editType !== 'RURA' && editType !== 'RURA_OKRAGLA' && editType !== 'KATOWNIK' && editType !== 'PRET_OKRAGLY' && editType !== 'PRET_KWADRATOWY' && editType !== 'PRET_PLASKI' && (
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
                        Sztuki (szt.)
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
                        Metry (m)
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Length & Quantity Inputs */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    {editType === 'BLACHA' ? 'Długość arkusza (mm)' : 'Długość (m)'}
                  </label>
                  <input
                    type="number"
                    step={editType === 'BLACHA' ? '1' : 'any'}
                    disabled={editType === 'INNY' || (editType === 'RURA' && editPipeMode === 'pieces')}
                    value={(editType === 'INNY' || (editType === 'RURA' && editPipeMode === 'pieces')) ? '' : (editLength || '')}
                    onChange={(e) => {
                      const raw = e.target.value.replace(',', '.');
                      setEditLength(raw === '' ? 0 : Number(raw));
                    }}
                    placeholder={(editType === 'INNY' || (editType === 'RURA' && editPipeMode === 'pieces')) ? 'Nie dotyczy' : (editType === 'BLACHA' ? 'np. 2000 lub 2500' : 'np. 6.0')}
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
                    {editType === 'INNY' ? '0 kg (Nieliczona)' : `${currentCalcEdit.totalWeight.toLocaleString('pl-PL', { minimumFractionDigits: 1 })} kg`}
                  </span>
                </div>
                <div className="text-right text-[10px] text-slate-400 leading-normal">
                  {editType === 'INNY' ? (
                    <div>Inny element</div>
                  ) : (
                    <>
                      <div>Jedn: {currentCalcEdit.unitWeight.toLocaleString('pl-PL', { minimumFractionDigits: 2 })} kg</div>
                      <div>Przed: {getLiveWeight(editingItem).totalWeight.toLocaleString('pl-PL', { minimumFractionDigits: 1 })} kg</div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setEditingItem(null);
                  setEditingIndex(null);
                }}
                className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
              >
                Anuluj
              </button>
              <button
                type="button"
                onClick={handleSaveModal}
                disabled={
                  editType === 'INNY'
                    ? !editCustomName && !editCustomDimensions
                    : !editH || 
                      (editType !== 'PRET_OKRAGLY' && editType !== 'PRET_KWADRATOWY' && editType !== 'RURA' && editType !== 'RURA_OKRAGLA' && !editWidth) || 
                      (editType !== 'RURA' && !editLength) || 
                      !editQuantity
                }
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
