import { StandardProfile, ProfileSystem } from '../types';

export const STANDARD_CHANNELS: StandardProfile[] = [
  // UNP (UPN) Profiles
  { name: 'UNP 50', system: 'UNP', height: 50, width: 38, webThickness: 5.0, flangeThickness: 7.0, weightPerMeter: 5.59 },
  { name: 'UNP 65', system: 'UNP', height: 65, width: 42, webThickness: 5.5, flangeThickness: 7.5, weightPerMeter: 7.09 },
  { name: 'UNP 80', system: 'UNP', height: 80, width: 45, webThickness: 6.0, flangeThickness: 8.0, weightPerMeter: 8.64 },
  { name: 'UNP 100', system: 'UNP', height: 100, width: 50, webThickness: 6.0, flangeThickness: 8.5, weightPerMeter: 10.6 },
  { name: 'UNP 120', system: 'UNP', height: 120, width: 55, webThickness: 7.0, flangeThickness: 9.0, weightPerMeter: 13.4 },
  { name: 'UNP 140', system: 'UNP', height: 140, width: 60, webThickness: 7.0, flangeThickness: 10.0, weightPerMeter: 16.0 },
  { name: 'UNP 160', system: 'UNP', height: 160, width: 65, webThickness: 7.5, flangeThickness: 10.5, weightPerMeter: 18.8 },
  { name: 'UNP 180', system: 'UNP', height: 180, width: 70, webThickness: 8.0, flangeThickness: 11.0, weightPerMeter: 22.0 },
  { name: 'UNP 200', system: 'UNP', height: 200, width: 75, webThickness: 8.5, flangeThickness: 11.5, weightPerMeter: 25.3 },
  { name: 'UNP 220', system: 'UNP', height: 220, width: 80, webThickness: 9.0, flangeThickness: 12.5, weightPerMeter: 29.4 },
  { name: 'UNP 240', system: 'UNP', height: 240, width: 85, webThickness: 9.5, flangeThickness: 13.0, weightPerMeter: 33.2 },
  { name: 'UNP 260', system: 'UNP', height: 260, width: 90, webThickness: 10.0, flangeThickness: 14.0, weightPerMeter: 37.9 },
  { name: 'UNP 300', system: 'UNP', height: 300, width: 100, webThickness: 10.0, flangeThickness: 16.0, weightPerMeter: 46.2 },
  { name: 'UNP 320', system: 'UNP', height: 320, width: 100, webThickness: 14.0, flangeThickness: 17.5, weightPerMeter: 59.5 },
  { name: 'UNP 350', system: 'UNP', height: 350, width: 100, webThickness: 14.0, flangeThickness: 16.0, weightPerMeter: 60.6 },
  { name: 'UNP 400', system: 'UNP', height: 400, width: 110, webThickness: 14.0, flangeThickness: 18.0, weightPerMeter: 71.8 }
];

export const STANDARD_IBEAMS: StandardProfile[] = [
  // INP (IPN) Profiles
  { name: 'INP 80', system: 'INP', height: 80, width: 42, webThickness: 3.9, flangeThickness: 5.9, weightPerMeter: 5.94 },
  { name: 'INP 100', system: 'INP', height: 100, width: 50, webThickness: 4.5, flangeThickness: 6.8, weightPerMeter: 8.30 },
  { name: 'INP 120', system: 'INP', height: 120, width: 58, webThickness: 5.1, flangeThickness: 7.7, weightPerMeter: 11.1 },
  { name: 'INP 140', system: 'INP', height: 140, width: 66, webThickness: 5.7, flangeThickness: 8.6, weightPerMeter: 14.3 },
  { name: 'INP 160', system: 'INP', height: 160, width: 74, webThickness: 6.3, flangeThickness: 9.5, weightPerMeter: 17.9 },
  { name: 'INP 180', system: 'INP', height: 180, width: 82, webThickness: 6.9, flangeThickness: 10.4, weightPerMeter: 21.9 },
  { name: 'INP 200', system: 'INP', height: 200, width: 90, webThickness: 7.5, flangeThickness: 11.3, weightPerMeter: 26.2 },
  { name: 'INP 220', system: 'INP', height: 220, width: 98, webThickness: 8.1, flangeThickness: 12.2, weightPerMeter: 31.1 },
  { name: 'INP 240', system: 'INP', height: 240, width: 106, webThickness: 8.7, flangeThickness: 13.1, weightPerMeter: 36.2 },
  { name: 'INP 270', system: 'INP', height: 270, width: 116, webThickness: 9.3, flangeThickness: 14.1, weightPerMeter: 41.9 },
  { name: 'INP 300', system: 'INP', height: 300, width: 125, webThickness: 10.8, flangeThickness: 16.2, weightPerMeter: 54.2 }
];

export const STANDARD_ANGLE_BARS: Record<string, number> = {
  // Kątowniki równoramienne (Equal angle bars): H x H x T
  '20x20x3': 0.88,
  '20x20x4': 1.14,
  '25x25x3': 1.12,
  '25x25x4': 1.45,
  '25x25x5': 1.77,
  '30x30x3': 1.36,
  '30x30x4': 1.78,
  '30x30x5': 2.18,
  '35x35x3': 1.60,
  '35x35x4': 2.09,
  '35x35x5': 2.57,
  '40x40x3': 1.84,
  '40x40x4': 2.42,
  '40x40x5': 2.97,
  '40x40x6': 3.52,
  '45x45x4': 2.74,
  '45x45x5': 3.38,
  '50x50x4': 3.06,
  '50x50x5': 3.77,
  '50x50x6': 4.47,
  '50x50x7': 5.15,
  '50x50x8': 5.82,
  '60x60x5': 4.57,
  '60x60x6': 5.42,
  '60x60x8': 7.09,
  '60x60x10': 8.69,
  '65x65x7': 6.83,
  '65x65x9': 8.62,
  '70x70x6': 6.38,
  '70x70x7': 7.38,
  '70x70x8': 8.36,
  '70x70x9': 9.34,
  '75x75x6': 6.87,
  '75x75x7': 7.94,
  '75x75x8': 9.03,
  '80x80x6': 7.34,
  '80x80x8': 9.63,
  '80x80x10': 11.90,
  '80x80x12': 14.10,
  '90x90x7': 9.61,
  '90x90x8': 10.90,
  '90x90x9': 12.20,
  '90x90x11': 14.70,
  '100x100x8': 12.20,
  '100x100x10': 15.10,
  '100x100x12': 17.80,
  '100x100x14': 20.60,
  '110x110x10': 16.60,
  '120x120x10': 18.20,
  '120x120x11': 19.90,
  '120x120x12': 21.60,
  '120x120x15': 26.60,
  '130x130x12': 23.60,
  '140x140x13': 27.50,
  '140x140x15': 31.40,
  '150x150x12': 27.30,
  '150x150x14': 31.60,
  '150x150x15': 33.80,
  '150x150x16': 35.90,
  '150x150x18': 40.10,
  '160x160x15': 36.20,
  '160x160x17': 40.70,
  '180x180x15': 40.90,
  '180x180x16': 43.50,
  '180x180x18': 48.60,
  '200x200x16': 48.50,
  '200x200x18': 54.30,
  '200x200x20': 59.90,
  '200x200x24': 71.10,
  '250x250x20': 75.30,
  '250x250x25': 93.10,

  // Kątowniki nierównoramienne (Unequal angle bars): H1 x H2 x T (H1 >= H2)
  '30x20x3': 1.11,
  '30x20x4': 1.45,
  '40x20x3': 1.35,
  '40x20x4': 1.77,
  '45x30x4': 2.25,
  '45x30x5': 2.77,
  '50x30x4': 2.41,
  '50x30x5': 2.96,
  '50x40x4': 2.72,
  '50x40x5': 3.35,
  '60x30x5': 3.37,
  '60x40x5': 3.76,
  '60x40x6': 4.46,
  '65x50x5': 4.35,
  '65x50x7': 5.97,
  '75x50x5': 4.74,
  '75x50x6': 5.65,
  '75x50x7': 6.53,
  '75x50x8': 7.39,
  '80x40x6': 5.41,
  '80x60x6': 6.37,
  '80x60x7': 7.36,
  '80x60x8': 8.34,
  '90x60x6': 6.82,
  '90x60x8': 8.96,
  '100x50x6': 6.85,
  '100x50x8': 8.99,
  '100x50x10': 11.10,
  '100x65x7': 8.77,
  '100x65x9': 11.10,
  '100x75x7': 9.32,
  '100x75x8': 10.60,
  '100x75x9': 11.80,
  '100x75x10': 13.00,
  '100x75x12': 15.40,
  '120x80x8': 12.20,
  '120x80x10': 15.00,
  '120x80x12': 17.80,
  '130x65x8': 11.80,
  '130x65x10': 14.60,
  '130x90x10': 16.60,
  '130x90x12': 19.70,
  '150x75x9': 15.30,
  '150x75x11': 18.50,
  '150x90x10': 18.20,
  '150x90x12': 21.60,
  '150x100x10': 19.00,
  '150x100x12': 22.60,
  '150x100x14': 26.10,
  '160x80x10': 18.20,
  '160x80x12': 21.60,
  '180x90x10': 20.60,
  '180x90x12': 24.50,
  '200x100x10': 23.00,
  '200x100x12': 27.30,
  '200x100x14': 31.60,
  '200x100x16': 35.90,
  '250x90x12': 30.70,
  '250x90x14': 35.60,
  '250x90x16': 40.50
};

export function findStandardProfile(name: string): StandardProfile | undefined {
  if (!name) return undefined;
  let normalized = name.toUpperCase().replace(/\s+/g, '');
  
  // Normalize aliases to INP or UNP
  normalized = normalized.replace(/^(?:IPN|IPE|NPE|I)/, 'INP');
  normalized = normalized.replace(/^(?:UPN|UPE|C)/, 'UNP');
  
  const all = [...STANDARD_CHANNELS, ...STANDARD_IBEAMS];
  const direct = all.find(p => p.name.toUpperCase().replace(/\s+/g, '') === normalized);
  if (direct) return direct;

  // Fallback: extract digits (e.g. "120" -> "INP 120" or "UNP 120")
  const numMatch = normalized.match(/\d+/);
  if (numMatch) {
    const num = numMatch[0];
    if (normalized.startsWith('INP')) {
      return all.find(p => p.name === `INP ${num}`);
    }
    if (normalized.startsWith('UNP')) {
      return all.find(p => p.name === `UNP ${num}`);
    }
  }

  return undefined;
}
