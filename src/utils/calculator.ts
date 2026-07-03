import { ShapeType, CalculationItem } from '../types';
import { findStandardProfile, STANDARD_ANGLE_BARS } from '../data/profiles';

export const STEEL_DENSITY = 7.85; // kg/dm^3

/**
 * Calculates the weight of a single unit and the total weight for a calculation item
 */
export function calculateWeight(params: {
  type: ShapeType;
  isStandard: boolean;
  profileName?: string;
  h: number; // mm
  width: number; // mm
  length: number; // m
  quantity: number;
  webThickness?: number; // mm
  flangeThickness?: number; // mm
  manualWeight?: number; // optional manual weight override (e.g., for RURA)
}): { unitWeight: number; totalWeight: number; webThickness: number; flangeThickness: number } {
  const { type, isStandard, profileName, h, width, length, quantity, manualWeight } = params;
  
  let unitWeight = 0;
  let finalWebThickness = params.webThickness || 0;
  let finalFlangeThickness = params.flangeThickness || 0;

  if (type === 'RURA') {
    // Rura: do not calculate automatically from dimensions. Return manual weight or 0.
    const totalW = manualWeight !== undefined ? manualWeight : 0;
    const unitW = quantity > 0 ? totalW / quantity : totalW;
    return {
      unitWeight: Math.round(unitW * 1000) / 1000,
      totalWeight: Math.round(totalW * 1000) / 1000,
      webThickness: params.webThickness || 2,
      flangeThickness: 0
    };
  } else if (type === 'KATOWNIK') {
    // Kątownik g/w (gorącowalcowany): h is height/leg1, width is width/leg2, webThickness is thickness
    const wall = params.webThickness || 3;
    const maxDim = Math.max(h, width);
    const minDim = Math.min(h, width);
    const key = `${maxDim}x${minDim}x${wall}`;
    
    let weightPerMeter = 0;
    if (key in STANDARD_ANGLE_BARS) {
      weightPerMeter = STANDARD_ANGLE_BARS[key];
    } else {
      // Fallback to geometric standard root/toe radii formula in mm^2
      const r1 = wall + 2;
      const r2 = wall <= 4 ? 2.5 : r1 / 2;
      const area = wall * (h + width - wall) + (Math.pow(r1, 2) - 2 * Math.pow(r2, 2)) * (1 - Math.PI / 4);
      weightPerMeter = (area * STEEL_DENSITY) / 1000;
    }
    
    unitWeight = weightPerMeter * length;
    finalWebThickness = wall;
    finalFlangeThickness = 0;
  } else if (type === 'BLACHA') {
    // Blacha: H is thickness (mm), width is mm, length is m
    // Volume in dm^3 = (H / 10) * (width / 100) * (length * 10)
    // Weight = Volume * STEEL_DENSITY
    unitWeight = (h * width * length * STEEL_DENSITY) / 1000;
  } else if (type === 'PRET_OKRAGLY') {
    // Pręt okrągły gładki: h is diameter in mm
    unitWeight = (Math.PI * Math.pow(h, 2) * STEEL_DENSITY / 4000) * length;
  } else if (type === 'PRET_KWADRATOWY') {
    // Pręt kwadratowy: h is side in mm
    unitWeight = (Math.pow(h, 2) * STEEL_DENSITY / 1000) * length;
  } else if (type === 'PRET_PLASKI') {
    // Pręt płaski (płaskownik): h is thickness in mm, width is width in mm
    unitWeight = (h * width * STEEL_DENSITY / 1000) * length;
  } else if (type === 'PROFIL_ZAMKNIETY') {
    // Profil zamknięty: h is height in mm, width is width in mm, webThickness is wall thickness in mm
    const wall = params.webThickness || 2;
    unitWeight = (2 * wall * (h + width - 2 * wall) * STEEL_DENSITY / 1000) * length;
    finalWebThickness = wall;
  } else {
    // Profiles: CEOWNIK or DWUTEOWNIK
    if (isStandard && profileName) {
      const standard = findStandardProfile(profileName);
      if (standard) {
        unitWeight = standard.weightPerMeter * length;
        finalWebThickness = standard.webThickness || 0;
        finalFlangeThickness = standard.flangeThickness || 0;
      } else {
        // Fallback to geometric calculation if standard profile not found
        const { area, wThick, fThick } = calculateProfileArea(type, h, width, params.webThickness, params.flangeThickness);
        unitWeight = (area * length * STEEL_DENSITY) / 1000;
        finalWebThickness = wThick;
        finalFlangeThickness = fThick;
      }
    } else {
      // Custom profile calculation
      const { area, wThick, fThick } = calculateProfileArea(type, h, width, params.webThickness, params.flangeThickness);
      unitWeight = (area * length * STEEL_DENSITY) / 1000;
      finalWebThickness = wThick;
      finalFlangeThickness = fThick;
    }
  }

  // Round to 3 decimal places for precision
  unitWeight = Math.round(unitWeight * 1000) / 1000;
  const totalWeight = Math.round(unitWeight * quantity * 1000) / 1000;

  return {
    unitWeight,
    totalWeight,
    webThickness: finalWebThickness,
    flangeThickness: finalFlangeThickness
  };
}

/**
 * Calculates cross-section area in mm^2 for channels and I-beams
 */
function calculateProfileArea(
  type: ShapeType,
  h: number, // mm
  width: number, // mm
  webThickness?: number,
  flangeThickness?: number
): { area: number; wThick: number; fThick: number } {
  // Estimate thickness values if they aren't provided
  let wThick = webThickness || 0;
  let fThick = flangeThickness || 0;

  if (type === 'CEOWNIK') {
    if (!wThick) wThick = Math.max(3, Math.round(h * 0.06 * 10) / 10);
    if (!fThick) fThick = Math.max(4, Math.round(width * 0.095 * 10) / 10);
  } else {
    // DWUTEOWNIK
    if (!wThick) wThick = Math.max(3, Math.round(h * 0.05 * 10) / 10);
    if (!fThick) fThick = Math.max(4, Math.round(width * 0.08 * 10) / 10);
  }

  // Cross section formula: web + 2 * flanges
  // Area (mm^2) = (H - 2 * t_f) * t_w + 2 * W * t_f
  // If H <= 2 * t_f, fallback to simple solid area
  let area = 0;
  if (h > 2 * fThick) {
    area = (h - 2 * fThick) * wThick + 2 * width * fThick;
  } else {
    area = h * wThick + 2 * width * fThick;
  }

  return { area, wThick, fThick };
}
