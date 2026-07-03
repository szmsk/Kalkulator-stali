import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { CalculationItem } from '../types';

// Helper to remove Polish diacritics for jsPDF built-in fonts to prevent rendering issues
function stripDiacritics(str: string): string {
  const map: { [key: string]: string } = {
    'ą': 'a', 'ć': 'c', 'ę': 'e', 'ł': 'l', 'ń': 'n', 'ó': 'o', 'ś': 's', 'ź': 'z', 'ż': 'z',
    'Ą': 'A', 'Ć': 'C', 'Ę': 'E', 'Ł': 'L', 'Ń': 'N', 'Ó': 'O', 'Ś': 'S', 'Ź': 'Z', 'Ż': 'Z'
  };
  return str.replace(/[ąćęłnósźżĄĆĘŁNÓŚŹŻ]/g, match => map[match] || match);
}

/**
 * Exports calculation items to Excel
 */
export function exportToExcel(items: CalculationItem[], totalWeight: number): void {
  const totalSheetsPieces = items.filter(item => item.type === 'BLACHA').reduce((sum, item) => sum + item.quantity, 0);
  const totalProfilesLength = items.filter(item => item.type !== 'BLACHA').reduce((sum, item) => sum + (item.length * item.quantity), 0);

  const data = items.map((item, index) => {
    const dimensionsStr = item.type === 'BLACHA'
      ? `Grubość: ${item.h} mm, Szerokość: ${item.width} mm, Długość: ${Math.round(item.length * 1000)} mm`
      : item.type === 'RURA'
        ? `Średnica: R fi ${item.h}, Długość: ${item.length} m`
        : `${item.profileName || item.type} (H: ${item.h} mm, S: ${item.width} mm, L: ${item.length} m)`;

    const wallThicknessStr = (item.type !== 'BLACHA' && item.type !== 'RURA')
      ? `Ścianka: ${item.webThickness || '-'} mm, Półka: ${item.flangeThickness || '-'} mm`
      : 'N/A';

    return {
      'Lp.': index + 1,
      'Typ elementu': item.type === 'BLACHA' ? 'Blacha' : item.type === 'CEOWNIK' ? 'Ceownik g/w' : item.type === 'DWUTEOWNIK' ? 'Dwuteownik' : item.type === 'PRET_OKRAGLY' ? 'Pręt okrągły gładki' : item.type === 'PRET_KWADRATOWY' ? 'Pręt kwadratowy' : item.type === 'PRET_PLASKI' ? 'Pręt płaski / Płaskownik' : item.type === 'RURA' ? 'Rura' : 'Profil zamknięty',
      'Profil': item.isStandard ? (item.profileName || 'Standardowy') : (item.type === 'RURA' ? 'Niestandardowy (Rura)' : 'Niestandardowy (Geom.)'),
      'Wymiary podstawowe': dimensionsStr,
      'Grubości ścianek': wallThicknessStr,
      'Ilość': item.type === 'BLACHA' ? `${item.quantity} szt.` : `${item.quantity} szt. x ${item.length} m`,
      'Masa jedn. (kg)': item.calculatedWeightPerUnit,
      'Masa całkowita (kg)': item.calculatedWeightTotal,
      'Uwagi': item.notes || ''
    };
  });

  // Add a summary row
  const summaryQtyStr = [
    totalSheetsPieces > 0 ? `${totalSheetsPieces} szt. blach` : '',
    totalProfilesLength > 0 ? `${totalProfilesLength.toLocaleString('pl-PL', { maximumFractionDigits: 1 })} m profili` : ''
  ].filter(Boolean).join(', ');

  data.push({
    'Lp.': null as any,
    'Typ elementu': 'SUMA',
    'Profil': '',
    'Wymiary podstawowe': '',
    'Grubości ścianek': '',
    'Ilość': summaryQtyStr as any,
    'Masa jedn. (kg)': null as any,
    'Masa całkowita (kg)': totalWeight,
    'Uwagi': ''
  });

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Kalkulacja Stali');

  // Adjust column widths
  const max_vals = [5, 15, 25, 50, 25, 25, 15, 18, 20];
  worksheet['!cols'] = max_vals.map(w => ({ wch: w }));

  XLSX.writeFile(workbook, `Kalkulacja_Wag_Stali_${new Date().toISOString().split('T')[0]}.xlsx`);
}

/**
 * Exports calculation items to a PDF document
 */
export function exportToPDF(items: CalculationItem[], totalWeight: number): void {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  const dateStr = new Date().toLocaleString('pl-PL');
  const totalSheetsPieces = items.filter(item => item.type === 'BLACHA').reduce((sum, item) => sum + item.quantity, 0);
  const totalProfilesLength = items.filter(item => item.type !== 'BLACHA').reduce((sum, item) => sum + (item.length * item.quantity), 0);

  // Document Title & Header
  doc.setFillColor(30, 41, 59); // Slate-800
  doc.rect(0, 0, 297, 40, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(22);
  doc.text(stripDiacritics('KALKULATOR WAG STALI'), 15, 18);
  
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(203, 213, 225); // Slate-300
  doc.text(stripDiacritics('Raport wygenerowany automatycznie na podstawie biastal.pl'), 15, 26);
  doc.text(stripDiacritics(`Data kalkulacji: ${dateStr}`), 15, 32);

  // Summary widgets on the right side of header
  doc.setFillColor(249, 115, 22); // Orange-500
  doc.rect(190, 8, 92, 24, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(stripDiacritics('SUMA CAŁKOWITA:'), 194, 15);
  doc.setFontSize(18);
  doc.text(`${totalWeight.toLocaleString('pl-PL', { minimumFractionDigits: 2 })} kg`, 194, 26);

  // Table columns definition
  const tableHeaders = [
    'Lp.',
    'Typ',
    'Profil / Spec.',
    'Wymiary (H x Szer x Dl)',
    'Gr. Scianek (tw / tf)',
    'Ilosc / Dlugosc',
    'Waga jedn.',
    'Waga laczna'
  ];

  const tableRows = items.map((item, index) => {
    // Determine the type label
    const typeLabel = item.type === 'BLACHA' ? 'Blacha' : 
                      item.type === 'CEOWNIK' ? 'Ceownik g/w' : 
                      item.type === 'DWUTEOWNIK' ? 'Dwuteownik' : 
                      item.type === 'PRET_OKRAGLY' ? 'Pręt okrągły' : 
                      item.type === 'PRET_KWADRATOWY' ? 'Pręt kwadratowy' : 
                      item.type === 'PRET_PLASKI' ? 'Pręt płaski' : 
                      item.type === 'RURA' ? 'Rura' : 
                      'Profil zamknięty';

    // Determine profile specification label
    let profileLabel = '';
    if (item.type === 'PRET_OKRAGLY') {
      profileLabel = `Srednica: fi ${item.h} mm`;
    } else if (item.type === 'RURA') {
      profileLabel = `Srednica: R fi ${item.h}`;
    } else if (item.type === 'PRET_KWADRATOWY') {
      profileLabel = `Bok: ${item.h}x${item.h} mm`;
    } else if (item.type === 'PRET_PLASKI') {
      profileLabel = `Szerokosc: ${item.width} mm`;
    } else if (item.type === 'PROFIL_ZAMKNIETY') {
      profileLabel = `${item.h}x${item.width} mm`;
    } else {
      profileLabel = item.isStandard ? (item.profileName || 'Standard') : 'Niestandardowy';
    }

    // Determine dimensions label
    let dimLabel = '';
    if (item.type === 'BLACHA') {
      dimLabel = `${item.h} x ${item.width} x ${Math.round(item.length * 1000)} mm`;
    } else if (item.type === 'PRET_OKRAGLY' || item.type === 'PRET_KWADRATOWY' || item.type === 'RURA') {
      dimLabel = `Dlugosc: ${item.length.toFixed(2)} m`;
    } else if (item.type === 'PRET_PLASKI') {
      dimLabel = `Grubosc: ${item.h} mm, Dl: ${item.length.toFixed(2)} m`;
    } else {
      dimLabel = `${item.h} x ${item.width} mm x ${item.length.toFixed(2)} m`;
    }

    // Determine thickness label
    let thickLabel = '-';
    if (item.type === 'PROFIL_ZAMKNIETY') {
      thickLabel = `Scianka: ${item.webThickness || 2} mm`;
    } else if (item.type !== 'BLACHA' && item.type !== 'PRET_OKRAGLY' && item.type !== 'PRET_KWADRATOWY' && item.type !== 'PRET_PLASKI' && item.type !== 'RURA') {
      thickLabel = `${item.webThickness || '-'} / ${item.flangeThickness || '-'} mm`;
    }
    
    return [
      (index + 1).toString(),
      stripDiacritics(typeLabel),
      stripDiacritics(profileLabel),
      stripDiacritics(dimLabel),
      stripDiacritics(thickLabel),
      item.type === 'BLACHA' ? `${item.quantity} szt.` : `${item.quantity} szt. x ${item.length.toFixed(2)} m`,
      `${item.calculatedWeightPerUnit.toFixed(2)} kg`,
      `${item.calculatedWeightTotal.toFixed(2)} kg`
    ];
  });

  const summaryQtyStr = [
    totalSheetsPieces > 0 ? `${totalSheetsPieces} szt.` : '',
    totalProfilesLength > 0 ? `${totalProfilesLength.toFixed(1)} m` : ''
  ].filter(Boolean).join(' / ');

  // Add the totals row to the table
  tableRows.push([
    '',
    'RAZEM',
    '',
    '',
    '',
    summaryQtyStr,
    '',
    `${totalWeight.toFixed(2)} kg`
  ]);

  autoTable(doc, {
    head: [tableHeaders],
    body: tableRows,
    startY: 48,
    margin: { left: 15, right: 15 },
    styles: {
      font: 'Helvetica',
      fontSize: 9,
      cellPadding: 3
    },
    headStyles: {
      fillColor: [51, 65, 85], // Slate-700
      textColor: [255, 255, 255],
      fontStyle: 'bold'
    },
    footStyles: {
      fillColor: [241, 245, 249], // Slate-100
      textColor: [15, 23, 42],
      fontStyle: 'bold'
    },
    columnStyles: {
      0: { cellWidth: 10 },
      1: { cellWidth: 30 },
      2: { cellWidth: 45 },
      3: { cellWidth: 65 },
      4: { cellWidth: 40 },
      5: { cellWidth: 20 },
      6: { cellWidth: 25 },
      7: { cellWidth: 30, fontStyle: 'bold' }
    },
    didParseCell: (data) => {
      // Highlight the totals row
      if (data.row.index === tableRows.length - 1) {
        data.cell.styles.fillColor = [220, 252, 231]; // Green-100
        data.cell.styles.textColor = [21, 128, 61]; // Green-700
      } else {
        // Highlight Rura row with a different color (Orange-100 background, Orange-700 text)
        const item = items[data.row.index];
        if (item && item.type === 'RURA') {
          data.cell.styles.fillColor = [255, 237, 213]; // Orange-100 / Amber-100
          data.cell.styles.textColor = [194, 65, 12]; // Orange-700
        }
      }
    }
  });

  // Save the PDF
  doc.save(`Raport_Wag_Stali_${new Date().toISOString().split('T')[0]}.pdf`);
}
