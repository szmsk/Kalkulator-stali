====================================================================
           KALKULATOR WAG STALI AI - INSTRUKCJA URUCHOMIENIA
====================================================================

Gratulacje! Posiadasz pełną wersję aplikacji "Kalkulator Wag Stali AI".
Możesz jej używać zarówno lokalnie na swoim komputerze, jak i zainstalować 
ją bezpośrednio na telefonie/komputerze za pomocą technologii PWA (klikając "Zainstaluj" w przeglądarce).

Poniżej znajdziesz krótką instrukcję jak uruchomić aplikację lokalnie u siebie.

--------------------------------------------------------------------
OPCJA 1: INSTALACJA JAKO APLIKACJA PWA (NAJSZYBSZA I NAJPROSTSZA)
--------------------------------------------------------------------
Aplikacja została wyposażona w pełne wsparcie dla Progressive Web App (PWA). 
Oznacza to, że możesz ją "zainstalować" jak zwykły program jednym kliknięciem:

1. Otwórz link do aplikacji w przeglądarce Google Chrome, Edge lub Safari.
2. W pasku adresu (po prawej stronie, obok gwiazdki zakładek) kliknij ikonkę "Zainstaluj Kalkulator Wag Stali AI" (lub "Dodaj do ekranu głównego").
3. Gotowe! Aplikacja zainstaluje się automatycznie, pojawi się na Twoim pulpicie lub ekranie telefonu z własną ikoną i będzie działać we własnym, dedykowanym oknie jako program!

--------------------------------------------------------------------
OPCJA 2: URUCHOMIENIE PEŁNEGO KODU LOKALNIE NA KOMPUTERZE
--------------------------------------------------------------------
Jeśli chcesz uruchomić serwer aplikacji na własnym komputerze, wykonaj następujące proste kroki:

KROK 1: POBIERZ NODE.JS
Aby uruchomić aplikację, potrzebujesz środowiska Node.js (darmowe, bezpieczne oprogramowanie).
- Jeśli jeszcze go nie masz, wejdź na: https://nodejs.org/
- Pobierz i zainstaluj wersję "LTS" (zalecaną dla większości użytkowników).

KROK 2: KLUCZ API GEMINI (Dla działania Inteligentnego Skanera AI)
Jeśli chcesz korzystać ze Skanera AI do odczytywania stron z zeszytów:
1. Otwórz plik o nazwie ".env" w zwykłym Notatniku.
2. Wpisz swój klucz API w linijce: GEMINI_API_KEY=twój_klucz_api
3. Klucz API Gemini możesz wygenerować całkowicie darmowo na stronie: https://ai.google.dev/

KROK 3: URUCHOM AUTOMATYCZNĄ INSTALACJĘ I PROGRAM
Aplikacja posiada gotowe skrypty, które same pobiorą potrzebne biblioteki i włączą program.

- Jeśli masz system Windows:
  1. Kliknij dwukrotnie (double-click) na plik:
     ==> Instaluj_i_Uruchom_Windows.bat
  2. Skrypt automatycznie UTWORZY dla Ciebie skrót o nazwie "Kalkulator Wag Stali AI" 
     na Twoim Pulpicie (Desktop) oraz w głównym folderze programu.
  3. Skróty te będą miały nową, piękną, dedykowaną ikonę (dwuteownik z symbolem kalkulatora bez tła).
  4. Od tej pory możesz włączać aplikację bezpośrednio klikając w nową ikonę, tak jak otwierasz programy typu Google Chrome!

- Jeśli masz system macOS lub Linux:
  Uruchom w terminalu skrypt:
  ==> ./Instaluj_i_Uruchom_Mac_Linux.sh

Program automatycznie pobierze biblioteki, skonfiguruje się i otworzy Twoją przeglądarkę pod adresem: http://localhost:3000

Dziękujemy za korzystanie z aplikacji!
====================================================================
