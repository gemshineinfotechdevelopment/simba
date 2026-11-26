export type TaxProofType = 'GSTIN' | 'PAN' | 'AADHAAR';

export interface TaxProofMeta {
  type: TaxProofType;
  menuLabel: string;
  inputLabel: string;
  shortLabel: string;
  placeholder: string;
  maxLength: number;
}

export const TAX_PROOF_OPTIONS: TaxProofMeta[] = [
  {
    type: 'GSTIN',
    menuLabel: 'GSTIN (Tax ID)',
    inputLabel: 'GSTIN (Tax ID) Number',
    shortLabel: 'GSTIN',
    placeholder: 'e.g. 33AABCS1111A1Z1 (15 characters)',
    maxLength: 15,
  },
  {
    type: 'PAN',
    menuLabel: 'PAN Number',
    inputLabel: 'PAN Number',
    shortLabel: 'PAN',
    placeholder: 'e.g. ABCDE1234F (10 characters)',
    maxLength: 10,
  },
  {
    type: 'AADHAAR',
    menuLabel: 'Aadhaar Card',
    inputLabel: 'Aadhaar Number',
    shortLabel: 'Aadhaar',
    placeholder: 'e.g. 123456789012 (12 digits)',
    maxLength: 12,
  },
];

export const GSTIN_STATE_CODES: Record<string, string> = {
  '01': 'Jammu & Kashmir',
  '02': 'Himachal Pradesh',
  '03': 'Punjab',
  '04': 'Chandigarh',
  '05': 'Uttarakhand',
  '06': 'Haryana',
  '07': 'Delhi',
  '08': 'Rajasthan',
  '09': 'Uttar Pradesh',
  '10': 'Bihar',
  '11': 'Sikkim',
  '12': 'Arunachal Pradesh',
  '13': 'Nagaland',
  '14': 'Manipur',
  '15': 'Mizoram',
  '16': 'Tripura',
  '17': 'Meghalaya',
  '18': 'Assam',
  '19': 'West Bengal',
  '20': 'Jharkhand',
  '21': 'Odisha',
  '22': 'Chhattisgarh',
  '23': 'Madhya Pradesh',
  '24': 'Gujarat',
  '26': 'Dadra & Nagar Haveli and Daman & Diu',
  '27': 'Maharashtra',
  '29': 'Karnataka',
  '30': 'Goa',
  '31': 'Lakshadweep',
  '32': 'Kerala',
  '33': 'Tamil Nadu',
  '34': 'Puducherry',
  '35': 'Andaman & Nicobar Islands',
  '36': 'Telangana',
  '37': 'Andhra Pradesh',
  '38': 'Ladakh',
};

export const INDIAN_STATES: string[] = Object.values(GSTIN_STATE_CODES).sort((a, b) =>
  a.localeCompare(b)
);

export const getTaxProofMeta = (type?: string): TaxProofMeta => {
  const normalized = (type || '').toUpperCase();
  return TAX_PROOF_OPTIONS.find((opt) => opt.type === normalized) || TAX_PROOF_OPTIONS[0];
};

export const inferTaxProofType = (value?: string, explicitType?: string): TaxProofType => {
  const explicit = (explicitType || '').toUpperCase();
  if (explicit === 'GSTIN' || explicit === 'PAN' || explicit === 'AADHAAR') {
    return explicit;
  }
  const clean = (value || '').trim();
  if (/^\d{12}$/.test(clean)) return 'AADHAAR';
  if (/^[A-Za-z0-9]{10}$/.test(clean)) return 'PAN';
  return 'GSTIN';
};

export const sanitizeProofNumber = (type: TaxProofType, raw: string): string => {
  if (type === 'AADHAAR') {
    return raw.replace(/\D/g, '').slice(0, 12);
  }
  if (type === 'PAN') {
    return raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
  }
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 15);
};

export const resolveProofInputChange = (
  type: TaxProofType,
  raw: string,
  currentState: string
): { value: string; state: string } => {
  const value = sanitizeProofNumber(type, raw);
  const autoState =
    type === 'GSTIN' && value.length >= 2 && !currentState
      ? GSTIN_STATE_CODES[value.slice(0, 2)] || ''
      : currentState;
  return { value, state: autoState };
};
