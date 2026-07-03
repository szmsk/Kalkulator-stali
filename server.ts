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
        text: `Dokonaj szczegółowej analizy zdjęcia przedstawiającego ręcznie zapisane w zeszycie/notesie linie z wymiarami elementów stalowych (blach, ceowników, dwuteowników, kątowników, prętów okrągłych gładkich, prętów kwadratowych, prętów płaskich/płaskowników, profili zamkniętych oraz rur). Zdjęcia będą robione telefonem iPhone 15 Pro, więc obraz jest wysokiej rozdzielczości, ale tekst może być pisany odręcznie, pod kątem, z cieniami lub skreśleniami.

Twoim zadaniem jest odczytanie KAŻDEJ linii tekstu (może być ich nawet około 20) i dla każdej linii rozpoznanie rodzaju elementu, jego wymiarów i ilości.

Zasady zapisu w zeszycie i rozpoznawania:
1. Sposób zapisu linii dla blachy (BLACHA) - podawana w SZTUKACH:
   Przykład: "H6 - 2500x3000 - 1,3,5,8,20,4" lub "gr. 6 - 2500x3000 - 5,10" lub "g6 2500/3000 - 1,2,3"
   - "H6", "gr. 6", "g6" oznacza grubość blachy H = 6 mm.
   - "2500x3000" lub "2500/3000" oznacza wymiary: szerokość = 2500 mm, długość = 3000 mm. Długość podaną w milimetrach (np. 3000) przelicz na metry i zwróć jako liczbę (np. 3.0).
   - "1,3,5,8,20,4" lub "6,7,8,6,4" na końcu linii to lista ilości sztuk po przecinku. 
     🚨 BARDZO WAŻNE DLA BLACH: Każda z tych liczb oddzielonych przecinkiem to CAŁKOWICIE OSOBNA ilość sztuk (liczba całkowita), które należy zsumować. 
     NIGDY nie łącz ich w ułamki dziesiętne! Np. zapis "6,7,8,6,4" oznacza pięć osobnych ilości sztuk: 6, 7, 8, 6, 4. Suma to 6+7+8+6+4 = 31. Zwróć 31 jako quantity, a "6,7,8,6,4" jako rawQuantityList. Długość (length) to 3.0.

2. Sposób zapisu linii dla kształtowników, prętów i profili (CEOWNIK, DWUTEOWNIK, PRET_OKRAGLY, PRET_KWADRATOWY, PRET_PLASKI, PROFIL_ZAMKNIETY, RURA, KATOWNIK) - podawane w METRACH (M):
   🚨 BARDZO WAŻNE: Dla tych elementów, liczby po przecinku na końcu linii oznaczają długości poszczególnych odcinków w METRACH, a nie sztuki! Sumujemy tylko metry bieżące!
   Przykład: "UNP 120 - 2,2,4" lub "IPE 160 - 6,6,12" lub "fi 16 - 3,3,4" lub "profil 40x40x3 - 6,12" lub "R fi 40 - 6,12" lub "L 50x50x5 - 6,12"
   - Oznaczenie profilu np. "UNP 120", "IPE 160" (isStandard = true), "fi 16", "■14", "płaskownik 40x10", "profil 40x40x3", "L 50x50x5" (isStandard = false).
   - Liczby po przecinku na końcu (np. "2,2,4" lub "6,6,12") to długości odcinków w METRACH. Należy je zsumować, aby otrzymać łączną długość (length).
     Na przykład: dla "UNP 120 - 2,2,4", odcinki mają długości 2m, 2m, 4m. Łączna długość w metrach (length) wynosi 2 + 2 + 4 = 8.0.
   - Ilość sztuk (quantity) dla tych elementów profilowych musi wynosić ZAWSZE 1.
   - Lista tych poszczególnych długości w metrach (np. "2,2,4") powinna być zwrócona w polu rawQuantityList.

3. Sposób zapisu prętów i profili zamkniętych:
   - PRĘT OKRĄGŁY GŁADKI (PRET_OKRAGLY):
     Oznaczany symbolem Ø, "fi", "fi ", "pret okragly", "pret okr." itp.
     Przykład: "Ø12 - 5,5" lub "fi 16 - 3.5,2" lub "fi10 - 10"
     Zwróć: detectedType = "PRET_OKRAGLY", h = średnica w mm (np. 12 lub 16), width = średnica w mm (np. 12 lub 16), isStandard = false, standardProfileName = null. Zsumuj długości po przecinku (np. 5+5 = 10m) i zwróć w length, quantity = 1.
   - PRĘT KWADRATOWY (PRET_KWADRATOWY):
     Oznaczany symbolem małego kwadratu ■, "kw.", "kwadrat", "pret kw." itp.
     Przykład: "■14 - 2,3" lub "kw. 12 - 5"
     Zwróć: detectedType = "PRET_KWADRATOWY", h = bok kwadratu w mm (np. 14 lub 12), width = bok kwadratu w mm (np. 14 lub 12), isStandard = false, standardProfileName = null. Zsumuj długości (np. 2+3 = 5m) i zwróć w length, quantity = 1.
   - PRĘT PŁASKI / PŁASKOWNIK (PRET_PLASKI):
     Oznaczany słowem "płaskownik", "płas.", "pł.", "płaski", "pl" lub formatem "szerokość x grubość" (np. "40x10" lub "10x40" lub "pł. 50x8").
     Przykład: "płaskownik 40x10 - 4,4" lub "pł. 50x8 - 10" lub "PL 80x10 - 6,5"
     Zwróć: detectedType = "PRET_PLASKI", h = grubość w mm (mniejszy wymiar, np. 10 lub 8), width = szerokość w mm (większy wymiar, np. 40, 50, 80), isStandard = false, standardProfileName = null. Zsumuj długości (np. 4+4 = 8m) i zwróć w length, quantity = 1.
   - PROFIL ZAMKNIĘTY / PROFIL BOX (PROFIL_ZAMKNIETY):
     Oznaczany słowem "profil", "prof.", "prof. zam.", "profil zamknięty", "kubełek" lub samym zapisem "wysokość x szerokość x ścianka" (np. "40x40x3" lub "100x100x10").
     🚨 WAŻNA ZASADA (ROZRÓŻNIENIE OD KĄTOWNIKA): Jeśli zapis ma format "100x100x10 L 20m" (gdzie litera L pojawia się DOPIERO PO wymiarach i oznacza długość "length", bez litery L na początku przed wymiarami), to jest to PROFIL_ZAMKNIETY.
     Przykład: "100x100x10 L 20m" (profil zamknięty 100x100x10 o długości 20m) lub "60x40x4 L 12m" lub "profil 40x40x3 - 12,12" lub "60x40x4 - 2,3".
     Zwróć: detectedType = "PROFIL_ZAMKNIETY", h = wysokość w mm (np. 100), width = szerokość w mm (np. 100), webThickness = grubość ścianki w mm (np. 10), isStandard = false, standardProfileName = null. Zsumuj długości (np. 20m -> length = 20) i zwróć w length, quantity = 1.

    - RURA / RURY (RURA):
      Oznaczana słowem "rura", "r.", "R fi", "R" itp., lub formatem "R fi [średnica]".
      Przykład: "R fi 40 - 6,12" lub "rura 50 - 3,4" lub "R fi 60.3 - 6,12"
      Zwróć: detectedType = "RURA", h = średnica w mm (np. 40 lub 50), width = średnica w mm (np. 40 lub 50), webThickness = grubość ścianki w mm (np. 2 lub 3), isStandard = false, standardProfileName = null. Zsumuj długości (np. 6+12 = 18m) i zwróć w length, quantity = 1.

    - KĄTOWNIK / L (KATOWNIK):
      Oznaczany literą "L" na początku/przed wymiarami, np. "L wysokość x szerokość x grubość" lub "L wysokość x szerokość x grubość L długość".
      🚨 WAŻNA ZASADA (ROZRÓŻNIENIE OD PROFILU ZAMKNIĘTEGO): Kątownik ZAWSZE posiada literę „L” na samym początku lub bezpośrednio przed wymiarami (np. "L 100x100x10" lub "L 100x100x10 L - 24m"). Pierwsza litera „L” oznacza profil kątowy (Kątownik), a druga litera „L” po wymiarach oznacza długość.
      Przykład: "L 100x100x10 L - 24m" (kątownik 100x100x10 o długości 24m) lub "L 50x50x5 - 6,12" lub "L 60x40x5 L 12m" lub "L 100x100x10 - 24".
      Zwróć: detectedType = "KATOWNIK", h = ramię 1 w mm (np. 100), width = ramię 2 w mm (np. 100), webThickness = grubość ścianki/półki w mm (np. 10), isStandard = false, standardProfileName = null. Zsumuj długości (np. 24m -> length = 24) i zwróć w length, quantity = 1.

  🚨 PODSUMOWANIE RÓŻNICY MIĘDZY PROFILAMI ZAMKNIĘTYMI A KĄTOWNIKAMI:
  - Zapis typu: "L 100x100x10 L - 24m" -> Zaczyna się od "L" -> KĄTOWNIK (KATOWNIK) o wymiarach ramię 1 = 100, ramię 2 = 100, grubość = 10, długość = 24m.
  - Zapis typu: "100x100x10 L 20m" -> NIE zaczyna się od "L" (litera L pojawia się dopiero po wymiarach) -> PROFIL ZAMKNIĘTY (PROFIL_ZAMKNIETY) o wymiarach wysokość = 100, szerokość = 100, grubość ścianki = 10, długość = 20m.
  Bądź niezwykle czujny i precyzyjny w tym rozróżnieniu! Gdy widzisz "100x100x10 L 20m", pod żadnym pozorem nie oznaczaj tego jako kątownik! To jest PROFIL ZAMKNIĘTY. Gdy widzisz "L 100x100x10" na początku, to jest to KĄTOWNIK.

4. ROZPOZNAWANIE ODRECZNYCH IKON I SYMBOLI (BARDZO WAŻNE):
   W zapiskach, zamiast literowych oznaczeń "IPE", "UPN", "HEB" itp., mogą pojawić się proste, odręczne symbole graficzne lub ikony narysowane obok wymiaru:
   - DWUTEOWNIK: rysowany jako pionowa kreska z dwoma poziomymi poprzeczkami (u góry i u dołu) – przypomina to wielką, wyraźną literę "I" z szerokimi daszkami, profil dwuteownika, lub literę "H". Jeśli przy danej pozycji znajduje się taki symbol, rozpoznaj go jako DWUTEOWNIK.
   - CEOWNIK: rysowany jako pionowa linia z dwiema krótkimi poziomymi kreskami w bok, tworząca kształt otwartego z boku ceownika, nawiasu kwadratowego "[" lub "]" albo obróconej litery "U" lub litery "C". Jeśli przy danej pozycji znajduje się taki symbol, rozpoznaj go jako CEOWNIK.
   - TEOWNIK: rysowany jako litera "T".

5. ⚠️ WAŻNE - ROZPOZNAWANIE CYFR (POLSKIE PISMO RĘCZNE):
   - ROZRÓŻNIENIE 1 OD 7: W polskim piśmie ręcznym cyfra 7 posiada charakterystyczną poziomą poprzeczkę (poziomą kreskę przekreślającą nóżkę) w połowie swojej wysokości. Cyfra bez poprzeczki to zazwyczaj 1. Cyfra 1 jest pisana jako prosta pionowa kreska lub ma krótki skośny daszek u góry skierowany w lewo. Nigdy nie ma poprzeczki w środku! Bądź wyjątkowo ostrożny przy analizie tych znaków i nie myl 1 z 7!
   - CYFRY PO PRZECINKU (UŁAMKI DZIESIĘTNE VS LISTA DŁUGOŚCI ODCINKÓW):
     - W przypadku BLACHY: przecinek na końcu linii (np. "2500x3000 - 1,3,5") oddziela ilości sztuk. Sumujemy te sztuki.
     - W przypadku pozostałych elementów: przecinek na końcu linii (np. "UNP 120 - 6,5, 4" lub "fi 16 - 3,3, 6") oddziela poszczególne odcinki w metrach (np. odcinek 6.5m, odcinek 4m). Jeśli jest pojedyncza liczba zmiennoprzecinkowa (np. "UNP 120 - 6.5" lub "6,5"), to oznacza jeden odcinek o długości 6.5 metra. Sumuj te odcinki i wstaw w length, a quantity = 1!

Wskazówki dodatkowe:
- Pismo może mieć skreślenia, poprawki lub być mało czytelne. Staraj się odczytać jak najwięcej linii (nawet do 20 pozycji na jednym zdjęciu).
- Uważnie rozróżniaj cyfry: 1 od 7, 5 od 6, 8 od 0, 3 od 8.
- Zwróć tablicę wszystkich odczytanych elementów w polu "items".
- W polu "explanation" podsumuj krótko po polsku, ile pozycji wykryłeś, jak przebiegło sumowanie metrów lub sztuk.`
      };

      let lastError: any = null;
      let responseText = "";

      // List of Gemini models to try in sequence for optimal success and quota availability
      const modelsToTry = ["gemini-2.5-flash", "gemini-1.5-flash", "gemini-3.5-flash"];
      
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
                            description: "Musi być dokładnie: BLACHA, CEOWNIK, DWUTEOWNIK, PRET_OKRAGLY, PRET_KWADRATOWY, PRET_PLASKI, PROFIL_ZAMKNIETY, RURA lub KATOWNIK"
                          },
                          h: {
                            type: Type.NUMBER,
                            description: "Grubość blachy, średnica pręta okrągłego, bok pręta kwadratowego, grubość płaskownika, wysokość profilu zamkniętego, średnica rury lub ramię 1 kątownika w mm."
                          },
                          width: {
                            type: Type.NUMBER,
                            description: "Szerokość blachy w mm, szerokość płaskownika w mm, szerokość profilu zamkniętego w mm, ramię 2 kątownika w mm. Dla prętów okrągłych i rur ustaw taką samą jak h."
                          },
                          length: {
                            type: Type.NUMBER,
                            description: "Długość odcinka w metrach. Jeśli podana w mm (np. 3000), przelicz na metry (3.0)."
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
                            description: "Pełna nazwa profilu standardowego, np. 'UNP 120', 'IPE 160'. Dla prętów, płaskowników, profili zamkniętych i blach ustaw null."
                          },
                          webThickness: {
                            type: Type.NUMBER,
                            description: "Grubość ścianki w mm (dla PROFIL_ZAMKNIETY, RURA, KATOWNIK, np. 3 dla profilu 40x40x3). Dla innych null/opcjonalne."
                          },
                          originalText: {
                            type: Type.STRING,
                            description: "Oryginalny odczytany tekst tej linii z zeszytu."
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
