import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";
import dotenv from "dotenv";
import heicConvert from "heic-convert";
import sharp from "sharp";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Body parser with 50mb limit for large images
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  const apiKey = process.env.GEMINI_API_KEY;
  const ai = apiKey ? new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  }) : null;

  // API endpoints FIRST
  app.post("/api/analyze-image", async (req, res) => {
    try {
      if (!ai) {
        return res.status(500).json({ 
          error: "Brak klucza API Gemini na serwerze. Upewnij się, że klucz GEMINI_API_KEY jest ustawiony w ustawieniach (Secrets)." 
        });
      }

      const { image, mimeType } = req.body;
      if (!image) {
        return res.status(400).json({ error: "Nie przesłano zawartości obrazu." });
      }

      let processedImageBase64 = image;
      let processedMimeType = "image/jpeg";

      try {
        const startTime = Date.now();
        let inputBuffer = Buffer.from(image, "base64");
        
        // Fast direct sharp optimization:
        // Sharp natively supports HEIF/HEIC, JPEG, PNG, WebP via libvips C++ (80-200ms)
        // Auto-orient using EXIF, resize to max 1800px, compress to 88% JPEG
        let optimizedBuffer: Buffer;
        try {
          optimizedBuffer = await sharp(inputBuffer)
            .rotate()
            .resize(1400, 1400, { fit: "inside", withoutEnlargement: true })
            .jpeg({ quality: 82 })
            .toBuffer();
        } catch (sharpDirectErr: any) {
          // If direct sharp fails and it's HEIC, try heicConvert with a strict 4-second timeout
          const isHeic = mimeType === "image/heic" || mimeType === "image/heif" || (mimeType && mimeType.includes("heic")) || (mimeType && mimeType.includes("heif"));
          if (isHeic) {
            console.warn("Direct sharp failed for HEIC, attempting guarded fallback with 4s timeout...");
            const converted = await Promise.race([
              heicConvert({ buffer: inputBuffer, format: "JPEG", quality: 0.85 }),
              new Promise((_, reject) => setTimeout(() => reject(new Error("HEIC convert timed out")), 4000))
            ]) as ArrayBuffer;
            inputBuffer = Buffer.from(converted);
            optimizedBuffer = await sharp(inputBuffer)
              .rotate()
              .resize(1400, 1400, { fit: "inside", withoutEnlargement: true })
              .jpeg({ quality: 84 })
              .toBuffer();
          } else {
            throw sharpDirectErr;
          }
        }

        processedImageBase64 = optimizedBuffer.toString("base64");
        console.log(`Image optimized with sharp in ${Date.now() - startTime}ms. Size reduced from ${(inputBuffer.length / 1024).toFixed(1)} KB to ${(optimizedBuffer.length / 1024).toFixed(1)} KB.`);
      } catch (optErr: any) {
        console.warn("Sharp optimization failed, using original payload:", optErr.message || optErr);
        processedImageBase64 = image;
        processedMimeType = mimeType || "image/jpeg";
      }

      const imagePart = {
        inlineData: {
          mimeType: processedMimeType,
          data: processedImageBase64,
        },
      };

      const promptPart = {
        text: `Jesteś ekspertem ds. odczytywania odręcznych notatek hutniczych i zestawień materiałowych stali w języku polskim ze zdjęć zeszytów.
Odczytaj każdą widoczną linię elementów stalowych (od góry do dołu) i zwróć precyzyjnie rozpoznane dane w formacie JSON.

🚨 NAJWAŻNIEJSZE ZASADY INTERPRETACJI (NIE MYL WYMIARÓW Z ILOŚCIAMI SZTUK!):

1. BLACHA (detectedType: "BLACHA"):
   - Wymiary arkuszy blach podawane są w milimetrach, np.:
     "2000x2000", "2000/2000", "1500x3000", "1000x2000", "1250x2500", "2500x3000", "#4 2000x2000", "H6 2000x2000", "gr. 5 2000x2000", "blacha 2000x2000".
   - ⚠️ KRYTYCZNE: Zapis "2000x2000" to WYMIARY BLACHY (szerokość 2000 mm, długość 2000 mm = 2.0 m). NIGDY NIE KWALIFIKUJ TEGO JAKO "INNY"! To ZAWSZE jest BLACHA!
   - ⚠️ KRYTYCZNE: 2000 to NIE JEST ilość sztuk! Ilość sztuk znajduje się po myślniku lub na końcu linii.
   - Ilości sztuk dla blachy:
     - Jeśli na końcu linii jest lista po przecinku, np. "2000x2000 - 1, 2, 4" lub "H6 - 2500x3000 - 5, 10":
       Każda liczba po przecinku to osobna ilość sztuk arkuszy. Należy je ZSUMOWAĆ (np. 1+2+4 = 7 sztuk, 5+10 = 15 sztuk).
     - Jeśli po wymiarze podano pojedynczą cyfrę, np. "2000x2000 - 2" -> quantity = 2.
     - Jeśli po wymiarze nie ma podanej ilości, np. "2000x2000" -> quantity = 1.
   - Grubość blachy H (w mm):
     - Zapis "#4", "H4", "gr. 4", "g4" lub trzecia liczba np. "2000x2000x4" oznacza grubość H = 4 mm. Jeśli grubość nie jest podana w linii, wpisz 0 lub odczytaną wartość.
   - Szerokość i długość: width = szerokość w mm (np. 2000), length = długość w metrach (np. 2000 mm = 2.0 m).

2. PROFIL ZAMKNIĘTY / PROFIL KWADRATOWY LUB PROSTOKĄTNY (detectedType: "PROFIL_ZAMKNIETY"):
   - ⚠️ NAJWAŻNIEJSZA ZASADA: Zapis z 3 wymiarami typu "80x80x5", "60x40x3", "100x100x4", "80x80x4", "80x80x3", "50x50x3", "40x20x2", "120x120x5" itp. TO ZAWSZE I BEZWZGLĘDNIE JEST PROFIL ZAMKNIĘTY!
   - ⚠️ NIGDY, W ŻADNYM WYPADKU NIE ROZPOZNAWAJ "80x80x5" ANI PODOBNYCH JAKO PŁASKOWNIK!
   - Płaskownik 80x80x5 ani płaskownik 80x80 NIE ISTNIEJE! Płaskowniki nigdy nie mają 3 wymiarów ani grubości ścianki!
   - Wymiary profilu zamkniętego:
     * Pierwsza i druga liczba to wymiary zewnętrzne przekroju: h (wysokość w mm) i width (szerokość w mm). Dla "80x80x5": h = 80, width = 80. Dla "60x40x3": h = 60, width = 40.
     * Trzecia liczba (np. "5" w 80x80x5) to GRUBOŚĆ ŚCIANKI w mm: webThickness. Dla "80x80x5": webThickness = 5. Dla "60x40x3": webThickness = 3. Dla "100x100x4": webThickness = 4.
     * Jeśli zapisano np. "80x80 gr. 5", "80x80 #5" lub "profil 80x80 - 6,12" -> h = 80, width = 80, webThickness = 5 (lub podana ścianka).
     * Liczby po myślniku to odcinki w metrach (np. "- 6,12" -> 6m + 12m = 18m). Zsumuj je w polu length (np. 18.0), quantity = 1. W polu rawQuantityList podaj "6, 12".
     * detectedType = "PROFIL_ZAMKNIETY", isStandard = false, standardProfileName = null.

3. PŁASKOWNIK / PRĘT PŁASKI (detectedType: "PRET_PLASKI"):
   - Zapisywany WYŁĄCZNIE jako DWA wymiary przekroju poprzecznego (szerokość x grubość), np. "60x12", "80x10", "40x5", "50x8", "100x8", "PL 60x12 - 6,12", "płaskownik 60x12".
   - ⚠️ Płaskownik ma TYLKO DWA wymiary przekroju. Grubość płaskownika jest wyraźnie mniejsza od szerokości (np. 5, 6, 8, 10, 12, 15, 20 mm).
   - ⚠️ Jeśli linia zawiera 3 wymiary (np. "80x80x5" lub "60x40x3") lub ściankę -> TO JEST PROFIL ZAMKNIĘTY (PROFIL_ZAMKNIETY), A NIE PŁASKOWNIK!
   - Liczby po myślniku to poszczególne odcinki w metrach (np. "- 6, 12" -> 6m + 12m = 18m). Zsumuj je w polu length (np. 18.0), quantity = 1.
   - Zwróć: detectedType = "PRET_PLASKI", width = 60, h = 12, length = 18.0, quantity = 1, isStandard = false, standardProfileName = null.

4. PROFILE STANDARDOWE - TYLKO UNP I INP!
   - ⚠️ KRYTYCZNE ŻĄDANIE UŻYTKOWNIKA: Interesują nas WYŁĄCZNIE ceowniki UNP oraz dwuteowniki INP!
   - NIE UŻYWAJ ANI NIE PROPONUJ profili IPE ani NPE!
   - Ceowniki (detectedType: "CEOWNIK"):
     - Oznaczane: "UNP 120", "C 120", "UPN 120", "[ 120".
     - ZAWSZE zapisz standardProfileName jako "UNP [rozmiar]", np. "UNP 120", "UNP 160", "UNP 200".
     - isStandard = true. Liczby po myślniku to odcinki w metrach (np. "6, 12" -> length = 18.0 m), quantity = 1.
   - Dwuteowniki (detectedType: "DWUTEOWNIK"):
     - Oznaczane: "INP 160", "IPN 160", "I 160", "IPE 160", "H 160".
     - ZAWSZE zapisz standardProfileName jako "INP [rozmiar]", np. "INP 120", "INP 140", "INP 160", "INP 180", "INP 200".
     - isStandard = true. Liczby po myślniku to odcinki w metrach (np. "12" -> length = 12.0 m), quantity = 1.

5. RURA OKRĄGŁA ZE ŚCIANKĄ (detectedType: "RURA_OKRAGLA") oraz RURA (detectedType: "RURA"):
   - Rura ze ścianką (RURA_OKRAGLA): "Ø60,3x3", "fi 60,3x3,2", "RO 48,3x2,6 - 6,12".
     Wymiary średnicy i ścianki często mają ułamki dziesiętne z przecinkiem (np. 60,3 to 60.3; 3,2 to 3.2).
     Zwróć: h = średnica (60.3), width = średnica (60.3), webThickness = ścianka (3.2), length = zsumowane odcinki w metrach (18.0), quantity = 1.
   - Rura zwykła / wiertnicza w sztukach (RURA): "rura wiertnicza fi 60 - 10 szt." -> detectedType: "RURA", pipeType: "wiertnicza", pipeMode: "pieces", quantity: 10, h = 60.

6. PRĘT OKRĄGŁY GŁADKI (detectedType: "PRET_OKRAGLY") i PRĘT KWADRATOWY (detectedType: "PRET_KWADRATOWY"):
   - Pręt okrągły: "fi 16 - 3,3,6" lub "Ø 20 - 6,12" -> h = 16, width = 16, length = 12m, quantity = 1.
   - Pręt kwadratowy: "■ 14 - 6,6,12" lub "kwadrat 14" -> h = 14, width = 14, length = 24m, quantity = 1.

7. KĄTOWNIK (detectedType: "KATOWNIK"):
   - Kątownik: "L 50x50x5 - 6,12" lub "L 100x100x10" -> h = 50, width = 50, webThickness = 5, length = 18m, quantity = 1.

8. POZYCJE NIELICZONE (detectedType: "INNY"):
   - Jako "INNY" oznaczaj WYŁĄCZNIE pozycje nieliczone wagowo oraz drobne elementy montażowe:
     * Blacha łezkowa (zapisywana też w zeszycie jako: "bl łezka", "bl. łezka", "łezka", "blacha lezkowa", "bl lezka") -> customName: "Blacha łezkowa"
     * holimodel (zapisywany też jako: "holi") -> customName: "Holimodel"
     * hardox (zapisywany też jako: "blacha hardox", "hardox 450", "hardox 500") -> customName: "Hardox"
     * drobne elementy montażowe (np. Zaślepki PVC, uszczelki, śruby, nakrętki, uchwyty, flansze)
   - ⚠️ BARDZO WAŻNE: NIGDY nie oznaczaj zwykłej blachy ani płyt stalowych (np. 2000x2000, 1500x3000, #10 2000x1000, blacha czarna S235/S355) jako "INNY"! Każda zwykła blacha/płyta MUSI mieć detectedType: "BLACHA" i obliczoną wagę!
   - Dla pozycji INNY:
     * customName: dokładna nazwa elementu, np. "Blacha łezkowa", "Holimodel", "Hardox", "Zaślepka PVC"
     * customDimensions: zapisane wymiary lub opis jeśli podano (np. "2000x1000", "gr. 4", "M16", itp.)
     * quantity: ilość sztuk (lub zsumowane sztuki po myślniku)
     * h: 0, width: 0, length: 0

8. ⚠️ SPECYFIKA POLSKIEGO PISMA RĘCZNEGO:
   - Cyfra 7 ma poziomą kreseczkę (poprzeczkę) w połowie wysokości. Cyfra 1 nie ma poprzeczki.
   - Przecinek dziesiętny w wymiarach (np. 60,3 = 60.3; 48,3 = 48.3).
   - Przecinek po myślniku dla BLACHY = osobne sztuki do zsumowania (1, 2, 4 -> 7 sztuk). W polu rawQuantityList podaj '1, 2, 4'.
   - Przecinek po myślniku dla PROFILI / PRĘTÓW = odcinki w metrach do zsumowania (6, 12 -> 18 m). W polu rawQuantityList podaj '6, 12'.
   - W polu originalText wpisz CAŁY oryginalny zapis linii z zeszytu.`
      };

      let lastError: any = null;
      let responseText = "";

      // List of supported Gemini models in order of priority:
      // 1. gemini-3.1-flash-lite - High throughput, minimal latency, dedicated quota pool
      // 2. gemini-2.5-flash - Multimodal fallback with fast structured JSON
      // 3. gemini-flash-latest - Standard flash model
      const modelsToTry = [
        "gemini-3.1-flash-lite",
        "gemini-2.5-flash",
        "gemini-flash-latest"
      ];

      for (const modelName of modelsToTry) {
        try {
          console.log(`Analyzing image using model ${modelName}...`);
          
          const modelConfig: any = {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                items: {
                  type: Type.ARRAY,
                  description: "Lista wszystkich odczytanych pozycji z zeszytu.",
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      detectedType: {
                        type: Type.STRING,
                        description: "Musi być dokładnie: BLACHA, CEOWNIK, DWUTEOWNIK, PRET_OKRAGLY, PRET_KWADRATOWY, PRET_PLASKI, PROFIL_ZAMKNIETY, RURA_OKRAGLA, RURA, KATOWNIK lub INNY"
                      },
                      h: {
                        type: Type.NUMBER,
                        description: "Grubość blachy, średnica pręta okrągłego, bok pręta kwadratowego, grubość płaskownika, wysokość profilu zamkniętego, średnica rury lub ramię 1 kątownika w mm. Dla INNY uzyj 0."
                      },
                      width: {
                        type: Type.NUMBER,
                        description: "Szerokość blachy w mm, szerokość płaskownika w mm, szerokość profilu zamkniętego w mm, ramię 2 kątownika w mm. Dla INNY uzyj 0."
                      },
                      length: {
                        type: Type.NUMBER,
                        description: "Długość odcinka w metrach. Jeśli podana w mm (np. 3000), przelicz na metry (3.0). Dla INNY uzyj 0."
                      },
                      quantity: {
                        type: Type.INTEGER,
                        description: "ZSUMOWANA ilość sztuk ze wszystkich liczb rozdzielonych przecinkami. Dla blach zsumuj sztuki z końca linii."
                      },
                      rawQuantityList: {
                        type: Type.STRING,
                        description: "Oryginalna lista wszystkich odczytanych liczb po przecinku lub myślniku po kolei: dla blach lista sztuk (np. '1, 2, 4'), dla profili/prętów/płaskowników lista wszystkich odcinków w metrach (np. '6, 12, 6, 3')."
                      },
                      isStandard: {
                        type: Type.BOOLEAN,
                        description: "Czy profil jest standardowy (np. UNP 120, INP 160)."
                      },
                      standardProfileName: {
                        type: Type.STRING,
                        description: "Pełna nazwa profilu standardowego: TYLKO 'UNP [rozmiar]' lub 'INP [rozmiar]'. Nigdy IPE ani NPE. Dla blach, prętów, płaskowników i INNY null."
                      },
                       webThickness: {
                        type: Type.NUMBER,
                        description: "Grubość ścianki w mm (dla PROFIL_ZAMKNIETY, RURA, KATOWNIK, np. 3 dla profilu 40x40x3). Dla innych null/opcjonalne."
                      },
                      originalText: {
                        type: Type.STRING,
                        description: "Oryginalny odczytany tekst tej linii z zeszytu."
                      },
                      pipeMode: {
                        type: Type.STRING,
                        description: "Dla rur (RURA): 'pieces' lub 'meters'. Dla innych null lub puste."
                      },
                      pipeType: {
                        type: Type.STRING,
                        description: "Dla rur (RURA): 'zwykla' lub 'wiertnicza'. Dla innych null lub puste."
                      },
                      customName: {
                        type: Type.STRING,
                        description: "Dla INNY: Nazwa lub typ nieliczonego elementu, np. 'Blacha łezkowa', 'Holimodel', 'Hardox', 'Zaślepka PVC'."
                      },
                      customDimensions: {
                        type: Type.STRING,
                        description: "Dla INNY: Opis wymiarów lub cech nieliczonego elementu, np. '2000x1000', 'gr. 4', 'M16', 'ø100'."
                      }
                    },
                    required: ["detectedType", "h", "width", "length", "quantity", "rawQuantityList", "isStandard", "standardProfileName", "originalText"]
                  }
                },
                explanation: {
                  type: Type.STRING,
                  description: "Krótkie podsumowanie w jednym zdaniu."
                }
              },
              required: ["items", "explanation"]
            }
          };

          // Optimize thinking configuration per model to prevent hidden reasoning lag
          if (modelName === "gemini-3.8-flash" || modelName === "gemini-flash-latest") {
            modelConfig.thinkingConfig = { thinkingLevel: ThinkingLevel.LOW };
          } else if (modelName === "gemini-3.1-flash-lite") {
            modelConfig.thinkingConfig = { thinkingLevel: ThinkingLevel.MINIMAL };
          }

          // Per-model 120s timeout to allow large dense handwritten notes to be processed completely
          let timeoutHandle: NodeJS.Timeout | null = null;
          const timeoutPromise = new Promise<never>((_, reject) => {
            timeoutHandle = setTimeout(() => {
              reject(new Error(`Timeout zapytania do modelu ${modelName} (>120s)`));
            }, 120000);
          });

          const generatePromise = ai.models.generateContent({
            model: modelName,
            contents: [imagePart, promptPart],
            config: modelConfig
          });

          const response = await Promise.race([generatePromise, timeoutPromise])
            .finally(() => {
              if (timeoutHandle) clearTimeout(timeoutHandle);
            });

          if (response && response.text) {
            responseText = response.text;
            console.log(`Successfully received response from model: ${modelName}`);
            break; // Success! Break the model loop
          } else {
            throw new Error(`Pusta odpowiedź z modelu ${modelName}.`);
          }
        } catch (err: any) {
          lastError = err;
          const errStr = String(err.message || err || "");
          const isModelTimeout = errStr.includes("Timeout") || errStr.includes("limit czasu");
          const isModelQuota = 
            err?.status === "RESOURCE_EXHAUSTED" || 
            err?.status === 429 || 
            err?.code === 429 || 
            errStr.includes("RESOURCE_EXHAUSTED") ||
            errStr.includes("429") ||
            errStr.includes("Quota exceeded");

          if (isModelTimeout) {
            console.log(`[AI model] Model ${modelName} reached 120s timeout limit.`);
            break; // Do not cascade to secondary models if primary model timed out
          } else if (isModelQuota) {
            console.log(`[AI model failover] Model ${modelName} quota limit reached, falling back to alternative model...`);
          } else {
            console.log(`[AI model failover] Model ${modelName} returned error: ${err.message || err}, trying next model...`);
          }
          
          // If we got a successful response from a previous step, break
          if (responseText) {
            break;
          }
        }
      }

      if (!responseText) {
        const lastErrStr = String(lastError?.message || lastError || "");
        const isTimeout = lastErrStr.includes("Timeout") || lastErrStr.includes("limit czasu");
        if (isTimeout) {
          return res.status(504).json({
            error: "Odczytywanie zdjęcia zajęło zbyt dużo czasu (ponad 2 minuty). Zdjęcie zawiera bardzo dużą liczbę pozycji. Spróbuj wykonać bliższe zdjęcie fragmentu lub wprowadź pozycje ręcznie w formularzu kalkulatora powyżej.",
            isTimeout: true
          });
        }

        const isQuota = 
          lastError?.status === "RESOURCE_EXHAUSTED" || 
          lastError?.status === 429 || 
          lastError?.code === 429 || 
          lastError?.statusCode === 429 ||
          lastErrStr.includes("RESOURCE_EXHAUSTED") ||
          lastErrStr.includes("quota") ||
          lastErrStr.includes("429") ||
          lastErrStr.includes("Quota exceeded");

        if (isQuota) {
          return res.status(429).json({
            error: "Wyczerpano bieżącą pulę zapytań klucza Gemini API (Quota Exceeded). Upewnij się w panelu Settings > Secrets, że wybrany jest Twój klucz Pro, bądź wprowadź pozycje ręcznie w formularzu kalkulatora powyżej.",
            isQuota: true
          });
        }
        throw lastError || new Error("Nie udało się uzyskać odpowiedzi od AI po wielokrotnych próbach.");
      }

      const parsedResult = JSON.parse(responseText.trim());
      
      // Comprehensive programmatic normalization
      if (parsedResult && Array.isArray(parsedResult.items)) {
        const UNP_PROFILES: Record<string, { height: number, width: number, webThickness: number }> = {
          'UNP 50': { height: 50, width: 38, webThickness: 5.0 },
          'UNP 65': { height: 65, width: 42, webThickness: 5.5 },
          'UNP 80': { height: 80, width: 45, webThickness: 6.0 },
          'UNP 100': { height: 100, width: 50, webThickness: 6.0 },
          'UNP 120': { height: 120, width: 55, webThickness: 7.0 },
          'UNP 140': { height: 140, width: 60, webThickness: 7.0 },
          'UNP 160': { height: 160, width: 65, webThickness: 7.5 },
          'UNP 180': { height: 180, width: 70, webThickness: 8.0 },
          'UNP 200': { height: 200, width: 75, webThickness: 8.5 },
          'UNP 220': { height: 220, width: 80, webThickness: 9.0 },
          'UNP 240': { height: 240, width: 85, webThickness: 9.5 },
          'UNP 260': { height: 260, width: 90, webThickness: 10.0 },
          'UNP 300': { height: 300, width: 100, webThickness: 10.0 },
          'UNP 320': { height: 320, width: 100, webThickness: 14.0 },
          'UNP 350': { height: 350, width: 100, webThickness: 14.0 },
          'UNP 400': { height: 400, width: 110, webThickness: 14.0 }
        };

        const INP_PROFILES: Record<string, { height: number, width: number, webThickness: number }> = {
          'INP 80': { height: 80, width: 42, webThickness: 3.9 },
          'INP 100': { height: 100, width: 50, webThickness: 4.5 },
          'INP 120': { height: 120, width: 58, webThickness: 5.1 },
          'INP 140': { height: 140, width: 66, webThickness: 5.7 },
          'INP 160': { height: 160, width: 74, webThickness: 6.3 },
          'INP 180': { height: 180, width: 82, webThickness: 6.9 },
          'INP 200': { height: 200, width: 90, webThickness: 7.5 },
          'INP 220': { height: 220, width: 98, webThickness: 8.1 },
          'INP 240': { height: 240, width: 106, webThickness: 8.7 },
          'INP 270': { height: 270, width: 116, webThickness: 9.3 },
          'INP 300': { height: 300, width: 125, webThickness: 10.8 }
        };

        parsedResult.items = parsedResult.items.map((item: any) => {
          const rawText = item.originalText || "";
          const textLower = rawText.toLowerCase();

          // 0. SPECIAL NON-CALCULATED ITEMS (detectedType: "INNY")
          // Specific user requirement: Mark as "INNY" ONLY non-calculated items:
          // Blacha łezkowa (bl łezka), holimodel (holi), hardox, and small mounting accessories.
          const isLezka = /łezk|lezk/i.test(textLower) || /\bbl\s+łez/i.test(textLower) || /\bbl\s+lez/i.test(textLower);
          const isHoli = /\bholimodel\b/i.test(textLower) || /\bholi\b/i.test(textLower);
          const isHardox = /\bhardox\b/i.test(textLower);
          const isMounting = /\b(zaślepk|zaslepk|uszczelk|śrub|srub|nakrętk|nakretk|uchwyt|flansz|kołek|kolek)\b/i.test(textLower);

          if (isLezka || isHoli || isHardox || isMounting) {
            item.detectedType = "INNY";
            item.isStandard = false;
            item.standardProfileName = null;

            if (isLezka) {
              item.customName = "Blacha łezkowa";
            } else if (isHoli) {
              item.customName = "Holimodel";
            } else if (isHardox) {
              item.customName = "Hardox";
            } else if (!item.customName) {
              item.customName = "Element montażowy";
            }

            // Extract dimensions or specs for customDimensions if not set
            if (!item.customDimensions) {
              const dimsMatch = rawText.match(/\b\d+(?:[.,]\d+)?\s*[xX/]\s*\d+(?:[.,]\d+)?(?:\s*[xX/]\s*\d+(?:[.,]\d+)?)?\b/);
              if (dimsMatch) {
                item.customDimensions = dimsMatch[0];
              } else {
                const thickMatch = rawText.match(/(?:#|h|gr\.?|g)\s*(\d+(?:[.,]\d+)?)/i);
                if (thickMatch) {
                  item.customDimensions = `gr. ${thickMatch[1]}`;
                }
              }
            }

            // Extract quantity if after dash or specified
            const afterDash = rawText.match(/[-–—]\s*([0-9.,\s+]+)$/);
            if (afterDash) {
              const nums = afterDash[1].replace(/,/g, ' ').match(/\d+/g);
              if (nums && nums.length > 0) {
                const totalPieces = nums.reduce((acc: number, val: string) => acc + parseInt(val, 10), 0);
                if (totalPieces > 0) {
                  item.quantity = totalPieces;
                  item.rawQuantityList = nums.join(',');
                }
              }
            } else if (!item.quantity) {
              item.quantity = 1;
            }

            item.h = 0;
            item.width = 0;
            item.length = 0;
            return item;
          }

          // 1. NORMALIZATION OF BLACHA (Sheets / Plates)
          // ⚠️ NIGDY nie oznaczaj standardowej blachy ani płyt stalowych (np. 2000x2000) jako INNY!
          // Fixes cases like 2000x2000 being misclassified as INNY, or quantity being confused with 2000
          const sheet2dMatch = rawText.match(/(\d{3,4})\s*[xX/]\s*(\d{3,4})/);
          const hasSheetDims = sheet2dMatch && (parseInt(sheet2dMatch[1], 10) >= 500 || parseInt(sheet2dMatch[2], 10) >= 500);
          const isSheetText = textLower.includes("blacha") || textLower.includes("arkusz") || /(?:^|\s)#[0-9]/.test(rawText) || /(?:^|\s)gr\.?\s*[0-9]/.test(textLower);

          if (item.detectedType === "BLACHA" || (hasSheetDims && item.detectedType !== "PROFIL_ZAMKNIETY" && !textLower.includes("profil") && !textLower.startsWith("l ") && !textLower.includes("katownik")) || (item.detectedType === "INNY" && (hasSheetDims || isSheetText))) {
            item.detectedType = "BLACHA";
            item.isStandard = false;
            item.standardProfileName = null;

            // Extract width & length in mm from 2000x2000 pattern
            if (sheet2dMatch) {
              const d1 = parseFloat(sheet2dMatch[1]);
              const d2 = parseFloat(sheet2dMatch[2]);
              item.width = Math.min(d1, d2);
              item.length = Math.max(d1, d2) / 1000; // in meters (e.g. 2000 mm -> 2.0 m)
            } else if (item.length && item.length >= 100) {
              // Length was given in mm in JSON (e.g. 2000), normalize to meters (2.0)
              item.length = item.length / 1000;
            }

            // Extract thickness H (mm)
            const thickMatch = rawText.match(/(?:#|h|gr\.?|g)\s*(\d+(?:[.,]\d+)?)/i) || rawText.match(/\b(\d+(?:[.,]\d+)?)\s*x\s*\d{3,4}\s*x\s*\d{3,4}\b/) || rawText.match(/\b\d{3,4}\s*x\s*\d{3,4}\s*x\s*(\d+(?:[.,]\d+)?)\b/);
            if (thickMatch) {
              item.h = parseFloat(thickMatch[1].replace(',', '.'));
            } else if (!item.h || item.h === 0 || item.h > 100) {
              item.h = 4; // Sensible default plate thickness if not stated
            }

            // Extract quantities from after the dash "-" or slash
            const afterDash = rawText.match(/[-–—]\s*([0-9.,\s+]+)$/);
            if (afterDash) {
              // e.g. "1, 2, 4" or "5, 10" or "3"
              const nums = afterDash[1].replace(/,/g, ' ').match(/\d+/g);
              if (nums && nums.length > 0) {
                const totalPieces = nums.reduce((acc: number, val: string) => acc + parseInt(val, 10), 0);
                if (totalPieces > 0) {
                  item.quantity = totalPieces;
                  item.rawQuantityList = nums.join(',');
                }
              }
            } else if (!item.quantity || item.quantity >= 500) {
              // Don't mistake 2000 from 2000x2000 as quantity!
              item.quantity = 1;
            }

            return item;
          }

          // 2. NORMALIZATION OF CEOWNIK (Channels -> ONLY UNP)
          const isCeownik = item.detectedType === "CEOWNIK" || 
            (rawText && /^[\[\]]|(?:^|\b)(?:C|UNP|UPN|UPE)\s*-?\s*\d+/i.test(rawText));

          if (isCeownik) {
            item.detectedType = "CEOWNIK";
            item.isStandard = true;
            
            let rawName = String(item.standardProfileName || "").trim().toUpperCase();
            if (!rawName && rawText) {
              const match = rawText.toUpperCase().match(/\b(?:C|UNP|UPN|UPE)\s*-?\s*(\d+)\b/);
              if (match) rawName = `UNP ${match[1]}`;
            }

            // Map any channel designation strictly to UNP
            const numMatch = rawName.match(/\d+/);
            const sizeNumber = numMatch ? numMatch[0] : (item.h ? String(item.h) : "80");
            const updatedName = `UNP ${sizeNumber}`;
            item.standardProfileName = updatedName;

            // Backfill standard dimensions
            if (UNP_PROFILES[updatedName]) {
              const dims = UNP_PROFILES[updatedName];
              item.h = dims.height;
              item.width = dims.width;
              if (dims.webThickness) item.webThickness = dims.webThickness;
            }

            // Sum length in meters
            const afterDash = rawText.match(/[-–—]\s*([0-9.,\s+]+)$/);
            if (afterDash) {
              const nums = afterDash[1].replace(/,/g, '.').match(/\d+(?:\.\d+)?/g);
              if (nums && nums.length > 0) {
                const totalM = nums.reduce((acc: number, val: string) => acc + parseFloat(val), 0);
                if (totalM > 0) {
                  item.length = totalM;
                  item.quantity = 1;
                }
              }
            }
            return item;
          }

          // 3. NORMALIZATION OF DWUTEOWNIK (I-beams -> ONLY INP, REMOVE IPE / NPE)
          const isDwuteownik = item.detectedType === "DWUTEOWNIK" ||
            (rawText && /(?:^|\b)(?:I|INP|IPN|IPE|NPE|HEB|HEA)\s*-?\s*\d+/i.test(rawText));

          if (isDwuteownik) {
            item.detectedType = "DWUTEOWNIK";
            item.isStandard = true;

            let rawName = String(item.standardProfileName || "").trim().toUpperCase();
            if (!rawName && rawText) {
              const match = rawText.toUpperCase().match(/\b(?:I|INP|IPN|IPE|NPE|HEB|HEA)\s*-?\s*(\d+)\b/);
              if (match) rawName = `INP ${match[1]}`;
            }

            // Map IPE, IPN, NPE, HEB, HEA strictly to INP
            const numMatch = rawName.match(/\d+/);
            const sizeNumber = numMatch ? numMatch[0] : (item.h ? String(item.h) : "120");
            const updatedName = `INP ${sizeNumber}`;
            item.standardProfileName = updatedName;

            // Backfill standard dimensions
            if (INP_PROFILES[updatedName]) {
              const dims = INP_PROFILES[updatedName];
              item.h = dims.height;
              item.width = dims.width;
              if (dims.webThickness) item.webThickness = dims.webThickness;
            }

            // Sum length in meters
            const afterDash = rawText.match(/[-–—]\s*([0-9.,\s+]+)$/);
            if (afterDash) {
              const nums = afterDash[1].replace(/,/g, '.').match(/\d+(?:\.\d+)?/g);
              if (nums && nums.length > 0) {
                const totalM = nums.reduce((acc: number, val: string) => acc + parseFloat(val), 0);
                if (totalM > 0) {
                  item.length = totalM;
                  item.quantity = 1;
                }
              }
            }
            return item;
          }

          // 4. NORMALIZATION OF PROFIL_ZAMKNIETY (Hollow Box Section / Profil Zamknięty)
          // e.g. "80x80x5 - 6,12", "60x40x3 - 6, 12", "100x100x4", "80x80 gr. 5", "profil 80x80x5"
          const threeDimProfileMatch = rawText.match(/\b(\d{1,3})\s*[xX*]\s*(\d{1,3})\s*[xX*]\s*(\d+(?:[.,]\d+)?)\b/);
          const profileWithWallMatch = rawText.match(/(?:profil|prof|pz|pr)?\s*(\d{1,3})\s*[xX*]\s*(\d{1,3})\s*(?:gr\.?|#|ścianka|scianka|\/)\s*(\d+(?:[.,]\d+)?)/i);
          const isExplicitProfilKeyword = textLower.includes("profil") || textLower.includes("prof.") || textLower.includes("pz ");

          const isAngleBar = textLower.startsWith("l ") || textLower.startsWith("l-") || textLower.startsWith("l/") || textLower.includes("katownik") || textLower.includes("kątownik");
          const isRoundPipe = textLower.includes("rura okr") || /\bro\b/i.test(textLower) || textLower.includes("fi ") || textLower.includes("ø") || textLower.includes("średn");

          if (!isAngleBar && !isRoundPipe && (item.detectedType === "PROFIL_ZAMKNIETY" || threeDimProfileMatch || profileWithWallMatch || (isExplicitProfilKeyword && !isCeownik && !isDwuteownik))) {
            let dim1 = 0;
            let dim2 = 0;
            let wall = 0;

            if (threeDimProfileMatch) {
              dim1 = parseFloat(threeDimProfileMatch[1]);
              dim2 = parseFloat(threeDimProfileMatch[2]);
              wall = parseFloat(threeDimProfileMatch[3].replace(',', '.'));
            } else if (profileWithWallMatch) {
              dim1 = parseFloat(profileWithWallMatch[1]);
              dim2 = parseFloat(profileWithWallMatch[2]);
              wall = parseFloat(profileWithWallMatch[3].replace(',', '.'));
            } else if (item.h && item.width) {
              dim1 = item.h;
              dim2 = item.width;
              wall = item.webThickness || 3;
            }

            // Only treat as profile if dimensions are typical profile dimensions (not 2000x2000 plates)
            if (dim1 > 0 && dim2 > 0 && dim1 <= 400 && dim2 <= 400) {
              item.detectedType = "PROFIL_ZAMKNIETY";
              item.isStandard = false;
              item.standardProfileName = null;
              item.h = Math.max(dim1, dim2);
              item.width = Math.min(dim1, dim2);
              item.webThickness = wall > 0 ? wall : (item.webThickness || 3);
              item.quantity = 1;

              // Parse lengths in meters from after dash (e.g. "- 6,12" -> 18m)
              const afterDashMatch = rawText.match(/[-–—]\s*([0-9.,\s+]+)$/);
              if (afterDashMatch) {
                const nums = afterDashMatch[1].replace(/,/g, '.').match(/\d+(?:\.\d+)?/g);
                if (nums && nums.length > 0) {
                  const sum = nums.reduce((acc: number, val: string) => acc + parseFloat(val), 0);
                  if (sum > 0) {
                    item.length = sum;
                    item.rawQuantityList = nums.join(', ');
                  }
                }
              } else if (!item.length || item.length <= 0) {
                item.length = 6.0; // default commercial 6m bar
              }
              return item;
            }
          }

          // 5. NORMALIZATION OF PRET_PLASKI (Flat Bar / Płaskownik)
          // e.g. "60x12 - 6,12", "80x10 - 6,12" -> width: 60, h: 12, length: 18m, quantity: 1
          // CRITICAL: A flat bar NEVER has 3 dimensions (like 80x80x5) and NEVER has equal dimensions (like 80x80)!
          const hasThreeDims = /\b\d{1,3}\s*[xX*]\s*\d{1,3}\s*[xX*]\s*\d+(?:[.,]\d+)?\b/.test(rawText);
          
          if (!hasThreeDims && item.detectedType !== "PROFIL_ZAMKNIETY") {
            const flatBarMatch = rawText.match(/(?:#|pl|płaskownik|płas|pł|b|gr)?\s*(\d{1,3})\s*[xX]\s*(\d{1,3})\s*[-–—]/i) ||
                                 (textLower.includes("płaskownik") || textLower.includes("płas") ? rawText.match(/(\d{1,3})\s*[xX]\s*(\d{1,3})/) : null);
            if (flatBarMatch) {
              const dim1 = parseFloat(flatBarMatch[1]);
              const dim2 = parseFloat(flatBarMatch[2]);
              
              // A flat bar CANNOT have equal dimensions >= 25 (e.g. 80x80 is NOT a flat bar)
              const isSquareSection = dim1 === dim2 && dim1 >= 25;
              if (dim1 > 0 && dim2 > 0 && dim1 <= 500 && dim2 <= 500 && !isSquareSection) {
                if (!textLower.includes("profil") && !textLower.includes("prof") && !textLower.startsWith("l ") && !textLower.includes("katownik")) {
                  item.detectedType = "PRET_PLASKI";
                  item.isStandard = false;
                  item.standardProfileName = null;
                  item.width = Math.max(dim1, dim2);
                  item.h = Math.min(dim1, dim2);
                  item.quantity = 1;

                  const afterDashMatch = rawText.match(/[-–—]\s*([0-9.,\s+]+)$/);
                  if (afterDashMatch) {
                    const nums = afterDashMatch[1].replace(/,/g, '.').match(/\d+(?:\.\d+)?/g);
                    if (nums && nums.length > 0) {
                      const sum = nums.reduce((acc: number, val: string) => acc + parseFloat(val), 0);
                      if (sum > 0) {
                        item.length = sum;
                        item.rawQuantityList = nums.join(', ');
                      }
                    }
                  }
                  return item;
                }
              }
            }
          }

          // 5. NORMALIZATION OF RURA_OKRAGLA (Round Pipe with calculated weight)
          const isRuraOkragla = item.detectedType === "RURA_OKRAGLA" ||
            /\bro\b/i.test(textLower) ||
            textLower.includes("rura okr") ||
            (/(?:rura|ro|fi|∅|Ø)?\s*\d+(?:\.\d+)?\s*x\s*\d+(?:\.\d+)?\s*[-–—]/i.test(textLower) && (textLower.includes("rura") || /\bro\b/i.test(textLower)));

          if (isRuraOkragla) {
            item.detectedType = "RURA_OKRAGLA";
            item.isStandard = false;
            item.standardProfileName = null;

            const dimMatch = textLower.match(/(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)/);
            if (dimMatch) {
              const d1 = parseFloat(dimMatch[1]);
              const d2 = parseFloat(dimMatch[2]);
              if (d1 > 0 && d2 > 0) {
                item.h = Math.max(d1, d2);
                item.width = item.h;
                item.webThickness = Math.min(d1, d2);
              }
            } else if (!item.h) {
              const diaMatch = textLower.match(/(\d+(?:\.\d+)?)/);
              if (diaMatch) {
                item.h = parseFloat(diaMatch[1]);
                item.width = item.h;
              }
            }

            if (!item.webThickness) {
              item.webThickness = 3.2;
            }

            const numbers = rawText.match(/(?:[-–—\s])\s*([0-9.,\s+]+)$/);
            if (numbers) {
              const parsedNums = numbers[1].replace(/,/g, '.').match(/\d+(?:\.\d+)?/g);
              if (parsedNums && parsedNums.length > 0) {
                const totalMeters = parsedNums.reduce((acc: number, val: string) => acc + parseFloat(val), 0);
                if (totalMeters > 0) {
                  item.length = totalMeters;
                  item.quantity = 1;
                }
              }
            }
            return item;
          }

          // 6. NORMALIZATION OF RURA (Generic pipe / drilling pipe)
          const isRura = item.detectedType === "RURA" || 
            (rawText && /(?:^|\b)(?:RURA|R\s*fi|R\s*∅|R\s*Ø)\b/i.test(rawText));

          if (isRura) {
            item.detectedType = "RURA";
            item.isStandard = false;
            item.standardProfileName = null;

            if (!item.pipeType) {
              item.pipeType = textLower.includes("wiert") ? "wiertnicza" : "zwykla";
            }

            if (!item.h || item.h === 0) {
              const diaMatch = rawText.match(/(?:fi|R|∅|Ø|\brura\b)\s*[-_]?\s*(\d+(?:\.\d+)?)/i) || rawText.match(/\b(\d+)\b/);
              if (diaMatch) {
                item.h = parseFloat(diaMatch[1]);
                item.width = item.h;
              }
            } else {
              item.width = item.h;
            }

            let mode = item.pipeMode;
            if (!mode) {
              mode = (/\b\d+\s*m(?:b)?\b/i.test(rawText) || textLower.includes("12m")) ? "meters" : "pieces";
              item.pipeMode = mode;
            }

            const lastPartMatch = rawText.match(/(?:L\s*[-_]?\s*|[-–—\s])\s*([0-9a-zA-Z\s+*.,/]+)$/);
            let partToParse = lastPartMatch ? lastPartMatch[1] : "";
            if (!partToParse) partToParse = rawText;

            const numbers = partToParse.match(/\d+(?:\.\d+)?/g);
            if (numbers && numbers.length > 0) {
              const filteredNumbers = (partToParse === rawText && item.h)
                ? numbers.filter((numStr: string, index: number) => {
                    if (index === 0 && parseFloat(numStr) === item.h) return false;
                    return true;
                  })
                : numbers;

              if (filteredNumbers.length > 0) {
                const sum = filteredNumbers.reduce((acc: number, numStr: string) => acc + parseFloat(numStr), 0);
                if (mode === "pieces") {
                  item.quantity = Math.round(sum);
                  item.length = 0;
                  item.rawQuantityList = filteredNumbers.join(",");
                } else {
                  item.quantity = 1;
                  item.length = sum;
                  item.rawQuantityList = filteredNumbers.join(",");
                }
              }
            }
            return item;
          }

          return item;
        });
      }

      res.json(parsedResult);
    } catch (error: any) {
      const errStr = String(error?.message || error || "");
      const isQuota = 
        error?.status === "RESOURCE_EXHAUSTED" || 
        error?.status === 429 || 
        error?.code === 429 || 
        error?.statusCode === 429 ||
        errStr.includes("RESOURCE_EXHAUSTED") ||
        errStr.includes("quota") ||
        errStr.includes("429") ||
        errStr.includes("Quota exceeded");

      if (isQuota) {
        console.log("[Gemini API] Quota or rate limit reached:", error.message || error);
        return res.status(429).json({
          error: "Wyczerpano bieżącą pulę zapytań klucza Gemini API (Quota Exceeded). Upewnij się w panelu Settings > Secrets, że wybrany jest Twój klucz Pro, bądź wprowadź pozycje ręcznie w formularzu kalkulatora powyżej.",
          isQuota: true
        });
      }

      console.error("Gemini API Proxy Error:", error);
      res.status(500).json({ 
        error: error?.message || "Wystąpił nieoczekiwany błąd podczas komunikacji z AI." 
      });
    }
  });

  // Serve static files in production or use Vite middleware in development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("Vite development middleware mounted.");
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    console.log("Serving static files from dist directory in production mode.");
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Server failed to start:", err);
});
