export interface MeasurementOption {
  value: string;
  label: string;
}

export const PRESET_MEASUREMENT_OPTIONS: MeasurementOption[] = [
  { value: 'g', label: 'Gram (g)' },
  { value: 'kg', label: 'Kilogram (kg)' },
  { value: 'mg', label: 'Milligram (mg)' },
  { value: 'quintal', label: 'Quintal (100 kg)' },
  { value: 'ton', label: 'Metric Ton (MT)' },
  { value: 'drum', label: 'Drum' },
  { value: 'barrel', label: 'Barrel' },
  { value: 'box', label: 'Box' },
  { value: 'case box', label: 'Case Box' },
  { value: 'case', label: 'Case' },
  { value: 'pkt', label: 'Packet (pkt)' },
  { value: 'pcs', label: 'Pieces (pcs)' },
  { value: 'nos', label: 'Numbers (nos)' },
  { value: 'bag', label: 'Bag' },
  { value: 'sack', label: 'Sack' },
  { value: 'carton', label: 'Carton' },
  { value: 'can', label: 'Can' },
  { value: 'carboy', label: 'Carboy' },
  { value: 'tin', label: 'Tin' },
  { value: 'jar', label: 'Jar' },
  { value: 'bottle', label: 'Bottle' },
  { value: 'bucket', label: 'Bucket' },
  { value: 'tank', label: 'Tank' },
  { value: 'bundle', label: 'Bundle' },
  { value: 'roll', label: 'Roll' },
  { value: 'dozen', label: 'Dozen' },
  { value: 'set', label: 'Set' },
  { value: 'pair', label: 'Pair' },
  { value: 'ml', label: 'Milliliter (ml)' },
  { value: 'ltr', label: 'Liter (ltr)' },
];

export const mergeMeasurementOptions = (
  extraUnits: Array<string | undefined | null>
): MeasurementOption[] => {
  const merged: MeasurementOption[] = [...PRESET_MEASUREMENT_OPTIONS];
  const seen = new Set(merged.map((m) => m.value.toLowerCase()));
  for (const raw of extraUnits) {
    const unit = (raw || '').trim();
    if (unit && !seen.has(unit.toLowerCase())) {
      seen.add(unit.toLowerCase());
      merged.push({ value: unit, label: unit });
    }
  }
  return merged;
};

/**
 * Extracts unique trimmed measurement strings from saved Particular or Performa records.
 */
export const extractSavedMeasurements = (
  records: Array<{ products?: Array<{ measurement?: string }> }> | null | undefined
): string[] => {
  return (records || []).flatMap((rec) =>
    (rec.products || []).map((item) => (item.measurement || '').trim()).filter(Boolean)
  );
};

export interface PerformaProductSpecsSummary {
  measurements: string[];
  measurementText: string;
  unitValues: number[];
  totalUnits: number;
  unitsText: string;
}

/**
 * Summarizes unique measurement labels and per-item / total Units/Pkt for a Performa record.
 */
export const summarizePerformaProductSpecs = (performa: {
  products?: Array<{
    measurement?: string;
    productSnapshot?: { measurement?: string };
    pktPerUnit?: number | string;
    pktUnit?: number | string;
  }>;
} | null | undefined): PerformaProductSpecsSummary => {
  const products = performa?.products || [];
  const measurementSet = new Set<string>();
  const measurements: string[] = [];
  const unitValues: number[] = [];
  let totalRaw = 0;

  for (const item of products) {
    const rawMeas = (item.measurement || item.productSnapshot?.measurement || '').trim();
    if (rawMeas && !measurementSet.has(rawMeas.toLowerCase())) {
      measurementSet.add(rawMeas.toLowerCase());
      measurements.push(rawMeas);
    }

    const rawUnit = parseFloat(String(item.pktPerUnit ?? item.pktUnit ?? 0));
    if (!Number.isNaN(rawUnit) && rawUnit > 0) {
      const cleanUnit = Number(rawUnit.toFixed(2));
      unitValues.push(cleanUnit);
      totalRaw += cleanUnit;
    }
  }

  const totalUnits = Number(totalRaw.toFixed(2));
  const measurementText = measurements.length > 0 ? measurements.join(', ') : '-';
  const unitsText =
    unitValues.length === 0
      ? '-'
      : unitValues.length === 1
        ? String(unitValues[0])
        : String(totalUnits);

  return {
    measurements,
    measurementText,
    unitValues,
    totalUnits,
    unitsText,
  };
};

export const getMatchingMeasurements = (
  options: MeasurementOption[],
  query: string
): MeasurementOption[] => {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const primaryMatches: MeasurementOption[] = [];
  const wordMatches: MeasurementOption[] = [];

  for (const opt of options) {
    const valLower = opt.value.toLowerCase();
    const labelLower = opt.label.toLowerCase();
    if (valLower.startsWith(q) || labelLower.startsWith(q)) {
      primaryMatches.push(opt);
    } else {
      const words = labelLower.split(/[\s()-]+/).filter(Boolean);
      if (words.some((w) => w.startsWith(q))) {
        wordMatches.push(opt);
      }
    }
  }

  return [...primaryMatches, ...wordMatches];
};
