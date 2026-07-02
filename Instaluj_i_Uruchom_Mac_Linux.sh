#!/bin/bash
# Kalkulator Wag Stali AI - Instalacja i Uruchomienie na macOS / Linux

# Kolory dla konsoli
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}====================================================================${NC}"
echo -e "${GREEN}            Kalkulator Wag Stali AI - Uruchomienie Lokalne${NC}"
echo -e "${GREEN}====================================================================${NC}"
echo ""

# Sprawdzenie czy Node.js jest zainstalowany
if ! command -v node &> /dev/null
then
    echo -e "${RED}[BŁĄD] Nie znaleziono zainstalowanego środowiska Node.js!${NC}"
    echo "Aby uruchomić ten program lokalnie, musisz zainstalować Node.js."
    echo "Pobierz wersję LTS ze strony: https://nodejs.org/"
    echo "Po zainstalowaniu, uruchom ten skrypt ponownie."
    echo ""
    read -p "Naciśnij [Enter] aby wyjść..."
    exit 1
fi

echo -e "Wykryto Node.js: $(node -v)"
echo ""

# Tworzenie pliku .env jeśli nie istnieje
if [ ! -f .env ]; then
    echo "Tworzenie konfiguracji .env..."
    cp .env.example .env
fi

# Instalacja zależności
if [ ! -d node_modules ]; then
    echo "Instalacja niezbędnych bibliotek..."
    npm install
fi

echo ""
echo -e "${GREEN}Uruchamianie aplikacji...${NC}"
echo "Aplikacja otworzy się automatycznie pod adresem: http://localhost:3000"
echo "Aby zamknąć program, naciśnij Ctrl + C w tym oknie terminala."
echo ""

# Otwarcie przeglądarki w zależności od systemu operacyjnego
if [ "$(uname)" == "Darwin" ]; then
    open http://localhost:3000
elif [ "$(expr substr $(uname -s) 1 5)" == "Linux" ]; then
    xdg-open http://localhost:3000
fi

npm run dev
