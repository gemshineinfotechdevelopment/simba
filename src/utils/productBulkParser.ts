import * as XLSX from 'xlsx';

export interface ParsedBulkProduct {
  rowNumber: number;
  name: string;
  measurement: string;
  hsnCode: string;
  pktUnit: string;
  amount: number | null;
  gstPercent: number | null;
  error?: string;
}

const normalizeHeaderKey = (cell: string): string =>
  cell.toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Normalizes a 2D spreadsheet matrix into validated product payloads.
 * Expected columns: (Product Name, Measurement, HSN Code, Pkts/Unit, Amount, GST %).
 */
export const parseBulkProductRows = (rows: string[][]): ParsedBulkProduct[] => {
  const cleanedRows = rows
    .map((r) => r.map((cell) => String(cell ?? '').trim()))
    .filter((r) => r.some((cell) => cell.length > 0));

  if (cleanedRows.length === 0) return [];

  let startIdx = 0;
  let colMap = {
    name: 0,
    measurement: 1,
    hsn: 2,
    pktUnit: 3,
    amount: 4,
    gst: 5,
  };

  const firstNormalized = cleanedRows[0].map(normalizeHeaderKey);
  const looksLikeHeader = firstNormalized.some(
    (h) => h === 'name' || h === 'product' || h === 'productname' || h === 'item'
  );

  if (looksLikeHeader) {
    startIdx = 1;
    const findIndex = (candidates: string[], fallback = -1): number => {
      const idx = firstNormalized.findIndex((h) => candidates.some((c) => h.includes(c)));
      return idx !== -1 ? idx : fallback;
    };

    colMap = {
      name: findIndex(['productname', 'name', 'product', 'item', 'particular'], 0),
      measurement: findIndex(['measurement', 'uom'], -1),
      hsn: findIndex(['hsncode', 'hsn'], -1),
      pktUnit: findIndex(['pktsunit', 'pktunit', 'pkts', 'unitspkt'], -1),
      amount: findIndex(['amount', 'rate', 'price'], -1),
      gst: findIndex(['gstpercent', 'gst', 'tax'], -1),
    };
  }

  const parsed: ParsedBulkProduct[] = [];

  for (let i = startIdx; i < cleanedRows.length; i += 1) {
    const cells = cleanedRows[i];
    const name = colMap.name >= 0 ? (cells[colMap.name] || '').trim() : '';
    const measurement = colMap.measurement >= 0 ? (cells[colMap.measurement] || '').trim() : '';
    const hsnCode = colMap.hsn >= 0 ? (cells[colMap.hsn] || '').trim() : '';
    const pktUnit = colMap.pktUnit >= 0 ? (cells[colMap.pktUnit] || '').trim() : '';
    const rawAmountCell = colMap.amount >= 0 ? cells[colMap.amount] || '' : '';
    const rawAmount = rawAmountCell.replace(/[₹,\s]/g, '').trim();
    const rawGstCell = colMap.gst >= 0 ? cells[colMap.gst] || '' : '';
    const rawGst = rawGstCell.replace(/[%\s]/g, '').trim();

    if (!name && !measurement && !hsnCode && !pktUnit && !rawAmount && !rawGst) {
      continue;
    }

    const rowErrors: string[] = [];
    if (!name) {
      rowErrors.push('Product name is required');
    }

    let amount: number | null = null;
    if (rawAmount !== '') {
      const num = Number(rawAmount);
      if (!Number.isFinite(num) || num < 0) {
        rowErrors.push(`Invalid amount "${rawAmountCell}"`);
      } else {
        amount = num;
      }
    }

    let gstPercent: number | null = null;
    if (rawGst !== '') {
      const num = Number(rawGst);
      if (!Number.isFinite(num) || num < 0 || num > 100) {
        rowErrors.push(`Invalid GST% "${rawGstCell}"`);
      } else {
        gstPercent = num;
      }
    }

    parsed.push({
      rowNumber: i + 1,
      name,
      measurement,
      hsnCode,
      pktUnit,
      amount,
      gstPercent,
      error: rowErrors.length > 0 ? rowErrors.join('; ') : undefined,
    });
  }

  return parsed;
};

/**
 * Reads an Excel (.xlsx, .xls) or CSV file and parses product rows from the first sheet.
 */
export const parseBulkSpreadsheetFile = async (file: File): Promise<ParsedBulkProduct[]> => {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) return [];

  const worksheet = workbook.Sheets[firstSheetName];
  const rawRows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
    header: 1,
    raw: false,
    defval: '',
  });

  const normalizedRows = rawRows.map((row) =>
    Array.isArray(row) ? row.map((cell) => String(cell ?? '')) : []
  );

  return parseBulkProductRows(normalizedRows);
};

export const downloadSampleBulkExcel = (companyName: string) => {
  const sampleRows = [
    {
      'Product Name': 'Sample Item A',
      Measurement: 'box',
      'HSN Code': '3604',
      'Pkts/Unit': 5,
      Amount: 250,
      'GST %': 18,
    },
    {
      'Product Name': 'Sample Item B',
      Measurement: 'drum',
      'HSN Code': '2905',
      'Pkts/Unit': 1,
      Amount: 1200,
      'GST %': 12,
    },
  ];

  const worksheet = XLSX.utils.json_to_sheet(sampleRows);
  worksheet['!cols'] = [
    { wch: 24 },
    { wch: 16 },
    { wch: 14 },
    { wch: 12 },
    { wch: 12 },
    { wch: 10 },
  ];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Products');
  const safeName = (companyName || 'company').replace(/[^a-zA-Z0-9_-]/g, '_');
  XLSX.writeFile(workbook, `${safeName}_sample_products.xlsx`);
};
