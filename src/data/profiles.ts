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
  { name: 'UNP 400', system: 'UNP', height: 400, width: 110, webThickness: 14.0, flangeThickness: 18.0, weightPerMeter: 71.8 },

  // UPE Profiles
  { name: 'UPE 80', system: 'UPE', height: 80, width: 40, webThickness: 4.5, flangeThickness: 7.4, weightPerMeter: 7.9 },
  { name: 'UPE 100', system: 'UPE', height: 100, width: 45, webThickness: 4.5, flangeThickness: 7.6, weightPerMeter: 9.82 },
  { name: 'UPE 120', system: 'UPE', height: 120, width: 50, webThickness: 5.0, flangeThickness: 7.8, weightPerMeter: 12.1 },
  { name: 'UPE 140', system: 'UPE', height: 140, width: 55, webThickness: 5.0, flangeThickness: 8.0, weightPerMeter: 14.5 },
  { name: 'UPE 160', system: 'UPE', height: 160, width: 60, webThickness: 5.5, flangeThickness: 8.2, weightPerMeter: 17.0 },
  { name: 'UPE 180', system: 'UPE', height: 180, width: 65, webThickness: 5.5, flangeThickness: 8.5, weightPerMeter: 19.7 },
  { name: 'UPE 200', system: 'UPE', height: 200, width: 70, webThickness: 6.0, flangeThickness: 8.8, weightPerMeter: 22.8 },
  { name: 'UPE 220', system: 'UPE', height: 220, width: 75, webThickness: 6.5, flangeThickness: 9.2, weightPerMeter: 26.6 },
  { name: 'UPE 240', system: 'UPE', height: 240, width: 80, webThickness: 7.0, flangeThickness: 9.5, weightPerMeter: 30.2 },
  { name: 'UPE 270', system: 'UPE', height: 270, width: 85, webThickness: 7.5, flangeThickness: 10.0, weightPerMeter: 35.2 },
  { name: 'UPE 300', system: 'UPE', height: 300, width: 90, webThickness: 8.5, flangeThickness: 10.0, weightPerMeter: 44.4 }
];

export const STANDARD_IBEAMS: StandardProfile[] = [
  // IPE Profiles
  { name: 'IPE 80', system: 'IPE', height: 80, width: 46, webThickness: 3.8, flangeThickness: 5.2, weightPerMeter: 6.0 },
  { name: 'IPE 100', system: 'IPE', height: 100, width: 55, webThickness: 4.1, flangeThickness: 5.7, weightPerMeter: 8.1 },
  { name: 'IPE 120', system: 'IPE', height: 120, width: 64, webThickness: 4.4, flangeThickness: 6.3, weightPerMeter: 10.4 },
  { name: 'IPE 140', system: 'IPE', height: 140, width: 73, webThickness: 4.7, flangeThickness: 6.9, weightPerMeter: 12.9 },
  { name: 'IPE 160', system: 'IPE', height: 160, width: 82, webThickness: 5.0, flangeThickness: 7.4, weightPerMeter: 15.8 },
  { name: 'IPE 180', system: 'IPE', height: 180, width: 91, webThickness: 5.3, flangeThickness: 8.0, weightPerMeter: 18.8 },
  { name: 'IPE 200', system: 'IPE', height: 200, width: 100, webThickness: 5.6, flangeThickness: 8.5, weightPerMeter: 22.4 },
  { name: 'IPE 220', system: 'IPE', height: 220, width: 110, webThickness: 5.9, flangeThickness: 9.2, weightPerMeter: 26.2 },
  { name: 'IPE 240', system: 'IPE', height: 240, width: 120, webThickness: 6.2, flangeThickness: 9.8, weightPerMeter: 30.7 },
  { name: 'IPE 270', system: 'IPE', height: 270, width: 135, webThickness: 6.6, flangeThickness: 10.2, weightPerMeter: 36.1 },
  { name: 'IPE 300', system: 'IPE', height: 300, width: 150, webThickness: 7.1, flangeThickness: 10.7, weightPerMeter: 42.2 },
  { name: 'IPE 330', system: 'IPE', height: 330, width: 160, webThickness: 7.5, flangeThickness: 11.5, weightPerMeter: 49.1 },
  { name: 'IPE 360', system: 'IPE', height: 360, width: 170, webThickness: 8.0, flangeThickness: 12.7, weightPerMeter: 57.1 },
  { name: 'IPE 400', system: 'IPE', height: 400, width: 180, webThickness: 8.6, flangeThickness: 13.5, weightPerMeter: 66.3 },

  // IPN Profiles
  { name: 'IPN 80', system: 'IPN', height: 80, width: 42, webThickness: 3.9, flangeThickness: 5.9, weightPerMeter: 5.94 },
  { name: 'IPN 100', system: 'IPN', height: 100, width: 50, webThickness: 4.5, flangeThickness: 6.8, weightPerMeter: 8.30 },
  { name: 'IPN 120', system: 'IPN', height: 120, width: 58, webThickness: 5.1, flangeThickness: 7.7, weightPerMeter: 11.1 },
  { name: 'IPN 140', system: 'IPN', height: 140, width: 66, webThickness: 5.7, flangeThickness: 8.6, weightPerMeter: 14.3 },
  { name: 'IPN 160', system: 'IPN', height: 160, width: 74, webThickness: 6.3, flangeThickness: 9.5, weightPerMeter: 17.9 },
  { name: 'IPN 180', system: 'IPN', height: 180, width: 82, webThickness: 6.9, flangeThickness: 10.4, weightPerMeter: 21.9 },
  { name: 'IPN 200', system: 'IPN', height: 200, width: 90, webThickness: 7.5, flangeThickness: 11.3, weightPerMeter: 26.2 },
  { name: 'IPN 220', system: 'IPN', height: 220, width: 98, webThickness: 8.1, flangeThickness: 12.2, weightPerMeter: 31.1 },
  { name: 'IPN 240', system: 'IPN', height: 240, width: 106, webThickness: 8.7, flangeThickness: 13.1, weightPerMeter: 36.2 },
  { name: 'IPN 270', system: 'IPN', height: 270, width: 116, webThickness: 9.3, flangeThickness: 14.1, weightPerMeter: 41.9 },
  { name: 'IPN 300', system: 'IPN', height: 300, width: 125, webThickness: 10.8, flangeThickness: 16.2, weightPerMeter: 54.2 },

  // HEB Profiles
  { name: 'HEB 100', system: 'HEB', height: 100, width: 100, webThickness: 6.0, flangeThickness: 10.0, weightPerMeter: 20.4 },
  { name: 'HEB 120', system: 'HEB', height: 120, width: 120, webThickness: 6.5, flangeThickness: 11.0, weightPerMeter: 26.7 },
  { name: 'HEB 140', system: 'HEB', height: 140, width: 140, webThickness: 7.0, flangeThickness: 12.0, weightPerMeter: 33.7 },
  { name: 'HEB 160', system: 'HEB', height: 160, width: 160, webThickness: 8.0, flangeThickness: 13.0, weightPerMeter: 42.6 },
  { name: 'HEB 180', system: 'HEB', height: 180, width: 180, webThickness: 8.5, flangeThickness: 14.0, weightPerMeter: 51.2 },
  { name: 'HEB 200', system: 'HEB', height: 200, width: 200, webThickness: 9.0, flangeThickness: 15.0, weightPerMeter: 61.3 },
  { name: 'HEB 220', system: 'HEB', height: 220, width: 220, webThickness: 9.5, flangeThickness: 16.0, weightPerMeter: 71.5 },
  { name: 'HEB 240', system: 'HEB', height: 240, width: 240, webThickness: 10.0, flangeThickness: 17.0, weightPerMeter: 83.2 },
  { name: 'HEB 260', system: 'HEB', height: 260, width: 260, webThickness: 10.0, flangeThickness: 17.5, weightPerMeter: 93.0 },
  { name: 'HEB 280', system: 'HEB', height: 280, width: 280, webThickness: 10.5, flangeThickness: 18.0, weightPerMeter: 103.0 },
  { name: 'HEB 300', system: 'HEB', height: 300, width: 300, webThickness: 11.0, flangeThickness: 19.0, weightPerMeter: 117.0 },

  // HEA Profiles
  { name: 'HEA 100', system: 'HEA', height: 96, width: 100, webThickness: 5.0, flangeThickness: 8.0, weightPerMeter: 16.7 },
  { name: 'HEA 120', system: 'HEA', height: 114, width: 120, webThickness: 5.0, flangeThickness: 8.0, weightPerMeter: 19.9 },
  { name: 'HEA 140', system: 'HEA', height: 133, width: 140, webThickness: 5.5, flangeThickness: 8.5, weightPerMeter: 24.7 },
  { name: 'HEA 160', system: 'HEA', height: 152, width: 160, webThickness: 6.0, flangeThickness: 9.0, weightPerMeter: 30.4 },
  { name: 'HEA 180', system: 'HEA', height: 171, width: 180, webThickness: 6.0, flangeThickness: 9.5, weightPerMeter: 35.5 },
  { name: 'HEA 200', system: 'HEA', height: 190, width: 200, webThickness: 6.5, flangeThickness: 10.0, weightPerMeter: 42.3 },
  { name: 'HEA 220', system: 'HEA', height: 210, width: 220, webThickness: 7.0, flangeThickness: 11.0, weightPerMeter: 50.5 },
  { name: 'HEA 240', system: 'HEA', height: 230, width: 240, webThickness: 7.5, flangeThickness: 12.0, weightPerMeter: 60.3 },
  { name: 'HEA 260', system: 'HEA', height: 250, width: 260, webThickness: 7.5, flangeThickness: 12.5, weightPerMeter: 68.2 },
  { name: 'HEA 280', system: 'HEA', height: 270, width: 280, webThickness: 8.0, flangeThickness: 13.0, weightPerMeter: 76.4 },
  { name: 'HEA 300', system: 'HEA', height: 290, width: 300, webThickness: 8.5, flangeThickness: 14.0, weightPerMeter: 88.3 }
];

export function findStandardProfile(name: string): StandardProfile | undefined {
  const normalized = name.toUpperCase().replace(/\s+/g, '');
  
  const all = [...STANDARD_CHANNELS, ...STANDARD_IBEAMS];
  return all.find(p => p.name.toUpperCase().replace(/\s+/g, '') === normalized);
}
