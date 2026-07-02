@echo off
title Kalkulator Wag Stali AI - Instalacja i Uruchomienie
cd /d "%~dp0"
chcp 65001 > nul

echo ====================================================================
echo             Kalkulator Wag Stali AI - Uruchomienie Lokalne
echo ====================================================================
echo.

:: Sprawdzenie czy pliki zostały wypakowane
if exist package.json goto pliki_ok
echo [BŁĄD] Pliki nie zostały prawidłowo wypakowane!
echo Wygląda na to, że uruchomiłeś ten plik bezpośrednio z archiwum ZIP bez jego rozpakowania.
echo.
echo Aby program działał poprawnie:
echo 1. Zamknij to okno.
echo 2. Kliknij PRAWYM przyciskiem myszy na pobrany plik ZIP.
echo 3. Wybierz "Wyodrębnij wszystkie..." lub "Wypakuj tutaj".
echo 4. Wejdź do nowo utworzonego, wypakowanego folderu.
echo 5. Dopiero tam uruchom plik "Instaluj_i_Uruchom_Windows.bat" ponownie.
echo.
pause
exit /b

:pliki_ok

:: Sprawdzenie czy Node.js jest zainstalowany
where node >nul 2>&1
if %errorlevel% equ 0 goto node_ok
echo [BŁĄD] Nie znaleziono zainstalowanego środowiska Node.js!
echo Aby uruchomić ten program lokalnie na swoim komputerze, musisz zainstalować darmowe środowisko Node.js.
echo.
echo Pobierz wersję LTS ze strony: https://nodejs.org/
echo Po zainstalowaniu Node.js, zrestartuj komputer i uruchom ten plik ponownie.
echo.
pause
exit /b

:node_ok

echo [1/4] Wykryto środowisko Node.js:
call node -v
echo.

:: Kopiowanie .env.example do .env jeśli nie istnieje
if exist .env goto env_ok
echo [2/4] Tworzenie konfiguracji .env...
copy .env.example .env > nul
echo Utworzono plik .env. Możesz go otworzyć w notatniku, aby dodać swój klucz GEMINI_API_KEY.
goto env_done

:env_ok
echo [2/4] Konfiguracja .env już istnieje.

:env_done
echo.

:: Instalacja zależności jeśli brak node_modules
if exist node_modules goto modules_ok
echo [3/4] Instalacja niezbędnych bibliotek (może to zająć chwilę)...
call npm install
goto modules_done

:modules_ok
echo [3/4] Biblioteki są już zainstalowane.

:modules_done
echo.

:: Budowanie i uruchamianie
echo [4/4] Budowanie i uruchamianie aplikacji...

:: Tworzenie skrótów z ikoną na Pulpicie oraz w folderze programu
echo Tworzenie skrótów z ikoną na Pulpicie oraz w tym folderze...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$s=(New-Object -ComObject WScript.Shell).CreateShortcut([System.IO.Path]::Combine([System.Environment]::GetFolderPath('Desktop'), 'Kalkulator Wag Stali AI.lnk')); $s.TargetPath='%~dp0Instaluj_i_Uruchom_Windows.bat'; $s.WorkingDirectory='%~dp0'; $s.IconLocation='%~dp0public\favicon.ico'; $s.Save()" >nul 2>&1
powershell -NoProfile -ExecutionPolicy Bypass -Command "$s=(New-Object -ComObject WScript.Shell).CreateShortcut('%~dp0Kalkulator Wag Stali AI.lnk'); $s.TargetPath='%~dp0Instaluj_i_Uruchom_Windows.bat'; $s.WorkingDirectory='%~dp0'; $s.IconLocation='%~dp0public\favicon.ico'; $s.Save()" >nul 2>&1
echo Skróty "Kalkulator Wag Stali AI" z dedykowaną ikoną zostały pomyślnie utworzone!
echo Możesz teraz włączać program klikając bezpośrednio w nową ikonę (jak programy typu Google Chrome).
echo.

echo Program otworzy się automatycznie w Twojej przeglądarce pod adresem: http://localhost:3000
echo.
echo Aby wyłączyć serwer, po prostu zamknij to okno konsoli.
echo.

:: Automatyczne otwarcie przeglądarki
start http://localhost:3000

:: Uruchomienie deweloperskie
call npm run dev
if %errorlevel% neq 0 (
    echo.
    echo [BŁĄD] Nie udało się uruchomić serwera deweloperskiego.
    echo Spróbuj uruchomić ręcznie w tym folderze: npm run dev
    echo.
    pause
)

