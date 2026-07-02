import React, { useState, useRef } from 'react';
import { Upload, FileImage, Cpu, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { MultiAnalysisResult, ShapeType } from '../types';

interface DrawingUploaderProps {
  onAnalysisComplete: (result: MultiAnalysisResult) => void;
}

export default function DrawingUploader({ onAnalysisComplete }: DrawingUploaderProps) {
  const [dragActive, setDragActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progressText, setProgressText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<MultiAnalysisResult | null>(null);
  
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
      onAnalysisComplete(data);
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
          <div className="flex flex-col items-center gap-3 w-full">
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
              <span className="text-slate-500 text-xs flex items-center gap-1 hover:text-slate-800">
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

      {/* Success Notification */}
      {analysisResult && !loading && (
        <div className="mt-4 p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="text-emerald-500 w-5 h-5 shrink-0 mt-0.5" />
            <div className="w-full">
              <p className="text-emerald-700 text-xs font-semibold">
                Udało się! AI pomyślnie odczytało {analysisResult.items.length} pozycji:
              </p>
              
              <div className="mt-2 space-y-2 max-h-60 overflow-y-auto pr-1">
                {analysisResult.items.map((item, idx) => {
                  const translateType = (t: string) => {
                    if (t === 'BLACHA') return 'Blacha';
                    if (t === 'CEOWNIK') return 'Ceownik';
                    if (t === 'DWUTEOWNIK') return 'Dwuteownik';
                    if (t === 'PRET_OKRAGLY') return 'Pręt okrągły gładki';
                    if (t === 'PRET_KWADRATOWY') return 'Pręt kwadratowy';
                    if (t === 'PRET_PLASKI') return 'Pręt płaski';
                    if (t === 'PROFIL_ZAMKNIETY') return 'Profil zamknięty';
                    return t;
                  };

                  return (
                    <div key={idx} className="bg-white/80 p-2 rounded border border-emerald-100 text-[11px] text-slate-700">
                      <div className="font-semibold text-slate-900 flex justify-between">
                        <span>{idx + 1}. {item.isStandard ? item.standardProfileName : translateType(item.detectedType)}</span>
                        <span className="text-orange-600 font-mono font-bold">{item.quantity} szt.</span>
                      </div>
                      <div className="mt-0.5 text-slate-500 font-mono text-[10px] flex flex-wrap gap-x-2">
                        <span>Grubość/Wysokość: {item.h} mm</span>
                        {item.width && <span>Szerokość: {item.width} mm</span>}
                        {item.webThickness && <span>Ścianka: {item.webThickness} mm</span>}
                        <span>Długość: {item.detectedType === 'BLACHA' ? `${Math.round((item.length || 0) * 1000)} mm` : `${item.length} m`}</span>
                      </div>
                      {item.rawQuantityList && (
                        <div className="text-[9px] text-slate-400 mt-0.5">
                          Suma z: {item.rawQuantityList} = {item.quantity} szt.
                        </div>
                      )}
                      {item.originalText && (
                        <div className="text-[9px] text-slate-400 italic mt-0.5 border-t border-slate-100 pt-0.5">
                          Zapis: "{item.originalText}"
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <p className="text-slate-500 text-[10px] mt-2 italic leading-relaxed border-t border-emerald-100 pt-2">
                "{analysisResult.explanation}"
              </p>
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
