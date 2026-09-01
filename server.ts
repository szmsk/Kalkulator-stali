import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import heicConvert from "heic-convert";

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
      let processedMimeType = mimeType || "image/jpeg";

      // Convert HEIC/HEIF to JPEG on the server-side
      const isHeic = mimeType === "image/heic" || mimeType === "image/heif" || (mimeType && mimeType.includes("heic")) || (mimeType && mimeType.includes("heif"));
      if (isHeic) {
        try {
          console.log("Detecting HEIC/HEIF image upload. Converting to JPEG on server-side...");
          const inputBuffer = Buffer.from(image, "base64");
          const outputBuffer = await heicConvert({
            buffer: inputBuffer,
            format: "JPEG",
            quality: 0.85
          });
          processedImageBase64 = Buffer.from(outputBuffer).toString("base64");
          processedMimeType = "image/jpeg";
          console.log("HEIC/HEIF conversion to JPEG succeeded!");
        } catch (convErr: any) {
          console.error("HEIC/HEIF conversion failed, continuing with original payload:", convErr.message || convErr);
        }
      }

      const imagePart = {
        inlineData: {
          mimeType: processedMimeType,
          data: processedImageBase64,
        },
      };

      const promptPart = {
        text: `Dokonaj szczegółowej analizy zdjęcia przedstawiającego ręcznie zapisane w zeszycie/notesie linie z wymiarami elementów stalowych (blach, ceowników, dwuteowników, kątowników, prętów okrągłych gładkich, prętów kwadratowych, prętów płaskich/płaskowników, profili zamkniętych, rur okrągłych ze ścianką oraz rur ogólnych). Zdjęcia będą robione telefonem iPhone 15 Pro, więc obraz jest wysokiej rozdzielczości, ale tekst może być pisany odręcznie, pod kątem, z cieniami lub skreśleniami.

Twoim zadaniem jest odczytanie KAŻDEJ linii tekstu (może być ich nawet około 20) i dla każdej linii rozpoznanie rodzaju elementu, jego wymiarów i ilości.

Zasady zapisu w zeszycie i rozpoznawania:
1. Sposób zapisu linii dla blachy (BLACHA) - podawana w SZTUKACH:
   Przykład: "H6 - 2500x3000 - 1,3,5,8,20,4" lub "gr. 6 - 2500x3000 - 5,10" lub "g6 2500/3000 - 1,2,3"
   - "H6", "gr. 6", "g6" oznacza grubość blachy H = 6 mm.
   - "2500x3000" lub "2500/3000" oznacza wymiary: szerokość = 2500 mm, długość = 3000 mm. Długość podaną w milimetrach (np. 3000) przelicz na metry i zwróć jako liczbę (np. 3.0).
   - "1,3,5,8,20,4" lub "6,7,8,6,4" na końcu linii to lista ilości sztuk po przecinku. 
     🚨 BARDZO WAŻNE DLA BLACH: Każda z tych liczb oddzielonych przecinkiem to CAŁKOWICIE OSOBNA ilość sztuk (liczba całkowita), które należy zsumować. 
     NIGDY nie łącz ich w ułamki dziesiętne! Np. zapis "6,7,8,6,4" oznacza pięć osobnych ilości sztuk: 6, 7, 8, 6, 4. Suma to 6+7+8+6+4 = 31. 
     Zwróć: detectedType = "BLACHA", h = 6, width = 2500, length = 3.0, quantity = 31, isStandard = false, standardProfileName = null.

2. Sposób zapisu linii dla RUR OKRĄGŁYCH ZE ŚCIANKĄ (RURA_OKRAGLA) / RO:
   Oznaczenia: "Ø", "fi", "ø", "RO", "R fi", "Rura okrągła", np. "Ø60,3x3", "fi 60,3x3,2", "Ø 48,3x2,6", "RO 33,7x2,9 - 6,12", "Ø 76,1x3,6 L 12", "Ø 88,9x4 - 6m", "fi 21,3x2,3 - 6".
   🚨 BARDZO WAŻNE: W rurach okrągłych wymiary średnicy i ścianki BARDZO CZĘSTO mają ułamki dziesiętne po przecinku (np. 60,3; 48,3; 42,4; 33,7; 21,3; 26,9; 76,1; 88,9; 114,3 mm) oraz grubość ścianki (np. 2,3; 2,6; 2,9; 3,0; 3,2; 3,6; 4,0 mm).
   Zapis "Ø60,3x3" oznacza średnicę 60.3 mm i grubość ścianki 3.0 mm.
   Zapis "fi 48,3x3,2 - 6,12" oznacza średnicę 48.3 mm, ściankę 3.2 mm, oraz odcinki 6m i 12m (suma = 18m).
   Zwróć: detectedType = "RURA_OKRAGLA", h = 60.3 (średnica), width = 60.3, webThickness = 3.0 (ścianka), isStandard = false, standardProfileName = null. Zsumuj długości odcinków i zwróć w length w metrach (np. 18.0), quantity = 1.

3. Sposób zapisu pozostałych profili i prętów:
   - PRĘT OKRĄGŁY GŁADKI (PRET_OKRAGLY):
     Oznaczany symbolem "Ø" lub "fi" bez podanej grubości ścianki (pojedynczy wymiar), np. "fi 16 - 3,3,6" lub "Ø 20 - 6,12".
     Zwróć: detectedType = "PRET_OKRAGLY", h = 16, width = 16, isStandard = false, standardProfileName = null. Zsumuj odcinki (np. 3+3+6 = 12) i zwróć w length = 12, quantity = 1.

   - PRĘT KWADRATOWY (PRET_KWADRATOWY):
     Oznaczany "■", "kwadrat", "kw", "k12", np. "■ 14 - 6,6,12".
     Zwróć: detectedType = "PRET_KWADRATOWY", h = 14, width = 14, length = 24, quantity = 1, isStandard = false.

   - PŁASKOWNIK / PRĘT PŁASKI (PRET_PLASKI):
     Oznaczany "PL", "płaskownik", "pł.", "40x5", "50x8", np. "PL 50x8 - 6,12" lub "50x8 - 6,6,6".
     Zwróć: detectedType = "PRET_PLASKI", h = grubość w mm (np. 8), width = szerokość w mm (np. 50), length = zsumowana długość w m, quantity = 1, isStandard = false.

   - PROFIL ZAMKNIĘTY / PROSTOKĄTNY / KWADRATOWY (PROFIL_ZAMKNIETY):
     Oznaczany trzema wymiarami bez litery L na początku, np. "100x100x10 L 20m" lub "80x40x3 - 6,12".
     Zwróć: detectedType = "PROFIL_ZAMKNIETY", h = 100, width = 100, webThickness = 10, length = 20, quantity = 1, isStandard = false.

   - KĄTOWNIK / L (KATOWNIK):
     Oznaczany literą "L" na początku/przed wymiarami, np. "L 100x100x10" lub "L 50x50x5 - 6,12".
     Zwróć: detectedType = "KATOWNIK", h = 100, width = 100, webThickness = 10, isStandard = false, standardProfileName = null. Zsumuj długości (np. 24m -> length = 24), quantity = 1.

   - CEOWNIK (CEOWNIK) i DWUTEOWNIK (DWUTEOWNIK):
     Oznaczane np. "UNP 120 - 6,12", "C 160 - 6,6", "IPE 200 - 12", "HEB 140 - 6".
     Dla standardowych profili ustaw isStandard = true, standardProfileName = pełna nazwa (np. "UNP 120").

   - RURA (RURA) - gdy wyraźnie oznaczona w sztukach lub jako rura wiertnicza:
     np. "rura wiertnicza fi 60 - 10 szt." -> detectedType = "RURA", pipeType = "wiertnicza", pipeMode = "pieces", quantity = 10, h = 60.

   - NIESTANDARDOWE / NIELICZONE ELEMENTY (INNY):
     Jeśli w zeszycie pojawią się pozycje, których się nie liczy w żaden sposób (np. zaślepki, śruby, uchwyty, uszczelnienia, komentarze z ilościami sztuk, inne nietypowe akcesoria), ustaw detectedType = "INNY", customName = nazwa/typ elementu z opisu, customDimensions = ewentualny podany wymiar lub opis, quantity = zsumowana ilość sztuk, length = 0, h = 0, width = 0, isStandard = false.

4. ROZPOZNAWANIE ODRECZNYCH IKON I SYMBOLI (BARDZO WAŻNE):
   - DWUTEOWNIK: pionowa kreska z dwoma poziomymi poprzeczkami (kształt litery "I" z szerokimi daszkami lub "H").
   - CEOWNIK: pionowa linia z dwiema krótkimi poprzeczkami w bok (kształt "[", "]" lub litery "C").
   - RURA OKRĄGŁA: symbol przekreślonego koła "Ø", "fi", "ø" lub "RO".

5. ⚠️ WAŻNE - ROZPOZNAWANIE CYFR (POLSKIE PISMO RĘCZNE):
   - ROZRÓŻNIENIE 1 OD 7: W polskim piśmie ręcznym cyfra 7 posiada charakterystyczną poziomą poprzeczkę (poziomą kreskę przekreślającą nóżkę) w połowie swojej wysokości. Cyfra bez poprzeczki to 1.
   - CYFRY PO PRZECINKU W WYMIARACH (np. Ø60,3x3):
     Wymiary rur okrągłych i innych profili często zawierają przecinek jako znak dziesiętny: 60,3 to 60.3; 48,3 to 48.3; 33,7 to 33.7; 3,2 to 3.2 itp. Zwracaj je w polach h i webThickness jako standardowe liczby zmiennoprzecinkowe (float).
   - CYFRY PO PRZECINKU DLA DŁUGOŚCI ODCINKÓW:
     - W przypadku BLACHY: przecinek na końcu linii (np. "2500x3000 - 1,3,5") oddziela ilości sztuk (1+3+5 = 9 sztuk).
     - W przypadku prętów/rur/profili: przecinek na końcu linii (np. "Ø60,3x3 - 6,12" lub "fi 16 - 3,3, 6") oddziela poszczególne odcinki w metrach (np. 6m + 12m = 18m). Sumuj te odcinki i wstaw w length!

Wskazówki dodatkowe:
- Pismo może mieć skreślenia, poprawki lub być mało czytelne. Staraj się odczytać jak najwięcej linii (nawet do 20 pozycji na jednym zdjęciu).
- Uważnie rozróżniaj cyfry: 1 od 7, 5 od 6, 8 od 0, 3 od 8.
- Zwróć tablicę wszystkich odczytanych elementów w polu "items".
- W polu "explanation" podsumuj krótko po polsku, ile pozycji wykryłeś, jak przebiegło sumowanie metrów lub sztuk.`
      };

      let lastError: any = null;
      let responseText = "";

      // List of Gemini models to try in sequence for optimal vision/OCR accuracy and quota fallback
      const modelsToTry = ["gemini-3.6-flash", "gemini-3.1-pro-preview", "gemini-flash-latest"];
      
      for (const modelName of modelsToTry) {
        let attempts = 3;
        for (let attempt = 1; attempt <= attempts; attempt++) {
          try {
            console.log(`Analyzing image using model ${modelName} (Attempt ${attempt}/${attempts})...`);
            const response = await ai.models.generateContent({
              model: modelName,
              contents: [imagePart, promptPart],
              config: {
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
                            description: "ZSUMOWANA ilość sztuk ze wszystkich liczb rozdzielonych przecinkami."
                          },
                          rawQuantityList: {
                            type: Type.STRING,
                            description: "Oryginalna lista ilości rozdzielona przecinkami, np. '1,3,5,8,20,4'."
                          },
                          isStandard: {
                            type: Type.BOOLEAN,
                            description: "Czy profil jest standardowy (np. UNP 120)."
                          },
                          standardProfileName: {
                            type: Type.STRING,
                            description: "Pełna nazwa profilu standardowego, np. 'UNP 120', 'IPE 160'. Dla prętów, płaskowników, profili zamkniętych, blach i INNY ustaw null."
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
                            description: "Dla INNY: Nazwa lub typ elementu, np. 'Zaślepka PVC', 'Uchwyt', 'Flansza'."
                          },
                          customDimensions: {
                            type: Type.STRING,
                            description: "Dla INNY: Opis wymiarów lub cech, np. '200x50', 'M16', 'ø100'."
                          }
                        },
                        required: ["detectedType", "h", "width", "length", "quantity", "rawQuantityList", "isStandard", "standardProfileName", "originalText"]
                      }
                    },
                    explanation: {
                      type: Type.STRING,
                      description: "Podsumowanie odczytu po polsku."
                    }
                  },
                  required: ["items", "explanation"]
                }
              }
            });

            if (response && response.text) {
              responseText = response.text;
              break; // Success! Break the attempt loop
            } else {
              throw new Error("Pusta odpowiedź z modelu Gemini.");
            }
          } catch (err: any) {
            lastError = err;
            const errStr = String(err.message || err || "");
            console.warn(`Attempt ${attempt} with model ${modelName} failed. Error:`, errStr);
            
            // Check if the error is a quota/rate limit error (429 or RESOURCE_EXHAUSTED)
            const isQuotaOrRateLimit = 
              err.status === "RESOURCE_EXHAUSTED" || 
              err.status === 429 ||
              err.code === 429 ||
              err.statusCode === 429 ||
              (err.error && (err.error.code === 429 || err.error.status === "RESOURCE_EXHAUSTED")) ||
              errStr.includes("RESOURCE_EXHAUSTED") ||
              errStr.includes("quota") ||
              errStr.includes("429") ||
              errStr.includes("limit") ||
              errStr.includes("rate limit") ||
              errStr.includes("Quota exceeded");

            if (isQuotaOrRateLimit) {
              console.warn(`[QUOTA EXCEEDED] Model ${modelName} returned 429 / resource exhausted. Switching immediately to the next model...`);
              break; // Break the attempt loop for the current model, continuing with the next model
            }

            // If it's the last attempt of the last model, we don't sleep
            if (modelName === modelsToTry[modelsToTry.length - 1] && attempt === attempts) {
              break;
            }
            
            // Wait with exponential backoff (e.g., 1.5s, 3s, 4.5s...)
            const delay = attempt * 1500;
            console.log(`Waiting ${delay}ms before retrying...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
        
        if (responseText) {
          break; // If we got a successful response, stop trying other models
        }
      }

      if (!responseText) {
        throw lastError || new Error("Nie udało się uzyskać odpowiedzi od AI po wielokrotnych próbach.");
      }

      const parsedResult = JSON.parse(responseText.trim());
      
      // Programmatic normalization of CEOWNIK (C 160 -> UNP 160)
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

        parsedResult.items = parsedResult.items.map((item: any) => {
          let updatedName = item.standardProfileName;
          
          // If detected type is CEOWNIK or original text indicates a C-channel, normalize it
          const isCeownik = item.detectedType === "CEOWNIK" || 
            (item.originalText && /^[\[\]]|(?:^|\b)(?:C|UNP|UPN)\s*-?\s*\d+/i.test(item.originalText));

          if (isCeownik) {
            item.detectedType = "CEOWNIK";
            item.isStandard = true;
            
            // Try to extract standard name from standardProfileName first
            let rawName = String(updatedName || "").trim().toUpperCase();
            
            // If standardProfileName is empty/invalid but originalText is available, try to parse from there
            if (!rawName && item.originalText) {
              const textUpper = item.originalText.toUpperCase();
              // Look for patterns like C 160, C160, C-160, UNP 160, UPN 160
              const match = textUpper.match(/\b(?:C|UNP|UPN)\s*-?\s*(\d+)\b/);
              if (match) {
                rawName = `UNP ${match[1]}`;
              }
            }

            // Normalization mappings for C-channels (e.g., C 160 -> UNP 160)
            const cMatch = rawName.match(/^C\s*-?\s*(\d+)$/i);
            const unpMatch = rawName.match(/^(?:UNP|UPN)\s*-?\s*(\d+)$/i);
            
            if (cMatch) {
              updatedName = `UNP ${cMatch[1]}`;
            } else if (unpMatch) {
              updatedName = `UNP ${unpMatch[1]}`;
            } else if (rawName.startsWith("C") && !rawName.startsWith("CEOWNIK")) {
              const digitsOnly = rawName.substring(1).trim();
              if (/^\d+$/.test(digitsOnly)) {
                updatedName = `UNP ${digitsOnly}`;
              }
            } else if (/^\d+$/.test(rawName)) {
              // Just a number was returned (e.g. "160")
              updatedName = `UNP ${rawName}`;
            }

            // Set normalized name
            item.standardProfileName = updatedName;

            // Backfill dimensions (height, width, thickness) for the standard UNP profile
            if (updatedName && UNP_PROFILES[updatedName]) {
              const dims = UNP_PROFILES[updatedName];
              item.h = dims.height;
              item.width = dims.width;
              if (dims.webThickness) {
                item.webThickness = dims.webThickness;
              }
            }
          }

          // Programmatic normalization of RURA (Pipes)
          const isRura = item.detectedType === "RURA" || 
            (item.originalText && /(?:^|\b)(?:RURA|R\s*fi|R\s*∅|R\s*Ø|∅|Ø)\b/i.test(item.originalText));

          if (isRura) {
            item.detectedType = "RURA";
            item.isStandard = false;
            item.standardProfileName = null;

            const text = item.originalText || "";
            const textLower = text.toLowerCase();

            // 1. Detect pipeType
            if (!item.pipeType) {
              if (textLower.includes("wiert")) {
                item.pipeType = "wiertnicza";
              } else {
                item.pipeType = "zwykla";
              }
            }

            // 2. Extract diameter (H)
            if (!item.h || item.h === 0) {
              const diaMatch = text.match(/(?:fi|R|∅|Ø|\brura\b)\s*[-_]?\s*(\d+(?:\.\d+)?)/i) || text.match(/\b(\d+)\b/);
              if (diaMatch) {
                item.h = parseFloat(diaMatch[1]);
                item.width = item.h;
              }
            } else {
              item.width = item.h;
            }

            // 3. Detect pipeMode
            let mode = item.pipeMode;
            if (!mode) {
              if (/\b\d+\s*m(?:b)?\b/i.test(text) || textLower.includes("12m")) {
                mode = "meters";
              } else {
                mode = "pieces";
              }
              item.pipeMode = mode;
            }

            // 4. Sum the numbers in the quantities list
            const lastPartMatch = text.match(/(?:L\s*[-_]?\s*|[-–—\s])\s*([0-9a-zA-Z\s+*.,/]+)$/);
            let partToParse = lastPartMatch ? lastPartMatch[1] : "";
            
            if (!partToParse && item.h) {
              const hStr = String(item.h);
              const hIndex = text.indexOf(hStr);
              if (hIndex !== -1) {
                partToParse = text.substring(hIndex + hStr.length);
              }
            }

            if (!partToParse) {
              partToParse = text;
            }

            const numbers = partToParse.match(/\d+(?:\.\d+)?/g);
            if (numbers && numbers.length > 0) {
              const filteredNumbers = (partToParse === text && item.h)
                ? numbers.filter((numStr, index) => {
                    if (index === 0 && parseFloat(numStr) === item.h) return false;
                    return true;
                  })
                : numbers;

              if (filteredNumbers.length > 0) {
                const sum = filteredNumbers.reduce((acc, numStr) => acc + parseFloat(numStr), 0);
                
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
          }

          // Programmatic normalization of RURA_OKRAGLA (Round Pipe with calculated weight)
          const textLower = (item.originalText || "").toLowerCase();
          const isRuraOkragla = item.detectedType === "RURA_OKRAGLA" ||
            /\bro\b/i.test(textLower) ||
            textLower.includes("rura okr") ||
            /(?:rura|ro|fi|∅|Ø)?\s*\d+(?:\.\d+)?\s*x\s*\d+(?:\.\d+)?\s*[-–—]/i.test(textLower) && (textLower.includes("rura") || /\bro\b/i.test(textLower));

          if (isRuraOkragla) {
            item.detectedType = "RURA_OKRAGLA";
            item.isStandard = false;
            item.standardProfileName = null;

            // Extract diameter and wall thickness if present (e.g. 60.3x3.2 or 48x3)
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
              item.webThickness = 3.2; // default wall thickness if missing
            }

            // Sum lengths in meters
            const numbers = (item.originalText || "").match(/(?:[-–—\s])\s*([0-9.,\s+]+)$/);
            if (numbers) {
              const parsedNums = numbers[1].replace(/,/g, '.').match(/\d+(?:\.\d+)?/g);
              if (parsedNums && parsedNums.length > 0) {
                const totalMeters = parsedNums.reduce((acc, val) => acc + parseFloat(val), 0);
                if (totalMeters > 0) {
                  item.length = totalMeters;
                  item.quantity = 1;
                }
              }
            }
          }

          // Programmatic normalization of PRET_PLASKI (Flat Bar / Płaskownik) vs BLACHA
          // Flat bar in notebook always has 2 cross-section dimensions <= 500 (e.g. 80x10, 60x10) followed by meters
          const flatBarMatch = (item.originalText || "").match(/(?:#|pl|płaskownik|płas|pł|b|gr)?\s*(\d+)\s*x\s*(\d+)\s*[-–—]/i);
          if (flatBarMatch) {
            const dim1 = parseFloat(flatBarMatch[1]);
            const dim2 = parseFloat(flatBarMatch[2]);
            // Check if dimensions are typical flat bar dimensions (<= 500mm each)
            if (dim1 > 0 && dim2 > 0 && dim1 <= 500 && dim2 <= 500) {
              // Ensure it's not a closed profile or angle
              if (!textLower.includes("profil") && !textLower.includes("prof") && !textLower.startsWith("l ") && !textLower.includes("katownik")) {
                item.detectedType = "PRET_PLASKI";
                item.isStandard = false;
                item.standardProfileName = null;
                item.width = Math.max(dim1, dim2);
                item.h = Math.min(dim1, dim2);
                item.quantity = 1;

                // Sum lengths after the dash in meters
                const afterDashMatch = (item.originalText || "").match(/[-–—]\s*([0-9.,\s+]+)$/);
                if (afterDashMatch) {
                  const nums = afterDashMatch[1].replace(/,/g, '.').match(/\d+(?:\.\d+)?/g);
                  if (nums && nums.length > 0) {
                    const sum = nums.reduce((acc, val) => acc + parseFloat(val), 0);
                    if (sum > 0) {
                      item.length = sum;
                    }
                  }
                }
              }
            }
          }
          return item;
        });
      }

      res.json(parsedResult);
    } catch (error: any) {
      console.error("Gemini API Proxy Error:", error);
      res.status(500).json({ 
        error: error.message || "Wystąpił nieoczekiwany błąd podczas komunikacji z AI." 
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
