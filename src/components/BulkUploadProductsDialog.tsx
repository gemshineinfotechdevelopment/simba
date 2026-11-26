import { useMemo, useRef, useState, type ChangeEvent, type DragEvent, type FC } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import UploadFileRoundedIcon from '@mui/icons-material/UploadFileRounded';
import InsertDriveFileRoundedIcon from '@mui/icons-material/InsertDriveFileRounded';
import { ProductsApi } from '../services/api';
import {
  downloadSampleBulkExcel,
  parseBulkSpreadsheetFile,
  type ParsedBulkProduct,
} from '../utils/productBulkParser';

interface BulkCompanyOption {
  _id?: string;
  id?: string;
  name: string;
}

interface BulkUploadProductsDialogProps {
  open: boolean;
  company: BulkCompanyOption | null;
  companies: BulkCompanyOption[];
  onClose: () => void;
  onUploaded: () => void;
}

export const BulkUploadProductsDialog: FC<BulkUploadProductsDialogProps> = ({
  open,
  company,
  companies,
  onClose,
  onUploaded,
}) => {
  const [companyOverride, setCompanyOverride] = useState<BulkCompanyOption | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedBulkProduct[]>([]);
  const [fileName, setFileName] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const selectedCompany = companyOverride || company;

  const validRows = useMemo(() => parsedRows.filter((r) => !r.error), [parsedRows]);
  const invalidCount = parsedRows.length - validRows.length;

  const activeCompanyName = selectedCompany?.name || 'Company';

  const handleClose = () => {
    if (uploading) return;
    setCompanyOverride(null);
    setParsedRows([]);
    setFileName('');
    setIsDragging(false);
    setSubmitError('');
    onClose();
  };

  const processFile = async (file: File) => {
    setFileName(file.name);
    setSubmitError('');
    try {
      const rows = await parseBulkSpreadsheetFile(file);
      if (rows.length === 0) {
        setParsedRows([]);
        setSubmitError('No product rows were found in the selected file.');
        return;
      }
      setParsedRows(rows);
    } catch (err) {
      console.error('Spreadsheet parse error:', err);
      setParsedRows([]);
      setSubmitError('Unable to read the selected file. Please upload a valid .xlsx, .xls, or .csv file.');
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    void processFile(file);
    e.target.value = '';
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      void processFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedCompany) {
      setSubmitError('Please select a company first.');
      return;
    }
    if (parsedRows.length === 0) {
      setSubmitError('Please select an Excel (.xlsx, .xls) or CSV file first.');
      return;
    }
    if (invalidCount > 0) {
      setSubmitError(`Please fix ${invalidCount} invalid row(s) highlighted below before uploading.`);
      return;
    }

    try {
      setUploading(true);
      setSubmitError('');
      await ProductsApi.bulkCreate({
        companyId: selectedCompany._id || selectedCompany.id,
        companyName: selectedCompany.name,
        products: validRows.map((row) => ({
          name: row.name,
          measurement: row.measurement,
          hsnCode: row.hsnCode,
          pktUnit: row.pktUnit,
          amount: row.amount,
          gstPercent: row.gstPercent,
        })),
      });
      setCompanyOverride(null);
      setParsedRows([]);
      setFileName('');
      onUploaded();
    } catch (err: any) {
      setSubmitError(err?.message || 'Bulk upload failed. Please verify the file and try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      slotProps={{
        paper: {
          sx: { borderRadius: '14px', overflow: 'hidden' },
        },
      }}
    >
      <DialogTitle sx={{ px: 3.5, pt: 3, pb: 1.5 }}>
        <Typography sx={{ fontSize: '20px', fontWeight: 700, color: '#0F172A', lineHeight: 1.3 }}>
          Bulk Upload Products for:{' '}
          <Box component="span" sx={{ color: '#1D4ED8', fontWeight: 700 }}>
            {activeCompanyName}
          </Box>
        </Typography>
      </DialogTitle>

      <DialogContent sx={{ px: 3.5, pb: 2, pt: '8px !important' }}>
        {submitError && (
          <Alert severity="error" sx={{ mb: 2, borderRadius: '8px' }}>
            {submitError}
          </Alert>
        )}

        {/* Selected Company + Download Sample Excel Card */}
        <Box
          sx={{
            p: 2.25,
            mb: 2.5,
            borderRadius: '10px',
            border: '1px solid #E2E8F0',
            backgroundColor: '#FFFFFF',
          }}
        >
          <Typography sx={{ fontSize: '13.5px', fontWeight: 600, color: '#1E293B', mb: 1.25 }}>
            Selected Company:
          </Typography>
          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              alignItems: { xs: 'stretch', sm: 'center' },
              gap: 1.5,
            }}
          >
            <Autocomplete
              openOnFocus
              size="small"
              options={companies}
              getOptionLabel={(opt) => opt.name || ''}
              isOptionEqualToValue={(a, b) =>
                (a._id && b._id && a._id === b._id) ||
                a.name.trim().toLowerCase() === b.name.trim().toLowerCase()
              }
              value={selectedCompany}
              onChange={(_e, val) => setCompanyOverride(val)}
              sx={{
                flex: 1,
                '& .MuiAutocomplete-clearIndicator': { display: 'none' },
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  placeholder="Select company..."
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      height: '42px',
                      py: '0 !important',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: 600,
                      color: '#1D4ED8',
                      backgroundColor: '#FFFFFF',
                      '& .MuiAutocomplete-input': {
                        py: '0 !important',
                        color: '#1D4ED8',
                      },
                      '& fieldset': { borderColor: '#CBD5E1' },
                      '&:hover fieldset': { borderColor: '#94A3B8' },
                      '&.Mui-focused fieldset': { borderColor: '#1D4ED8' },
                    },
                  }}
                />
              )}
            />

            <Button
              variant="outlined"
              onClick={() => downloadSampleBulkExcel(activeCompanyName)}
              startIcon={<DownloadRoundedIcon sx={{ fontSize: 18 }} />}
              sx={{
                height: '42px',
                px: 2.2,
                borderRadius: '8px',
                borderColor: '#1D4ED8',
                color: '#1D4ED8',
                fontSize: '13.5px',
                fontWeight: 600,
                textTransform: 'none',
                whiteSpace: 'nowrap',
                '&:hover': {
                  borderColor: '#1E40AF',
                  backgroundColor: '#EFF6FF',
                },
              }}
            >
              Download Sample Excel
            </Button>
          </Box>
        </Box>

        {/* Dashed Dropzone Card */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />

        <Box
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          sx={{
            border: `1.5px dashed ${isDragging ? '#2563EB' : '#CBD5E1'}`,
            borderRadius: '10px',
            backgroundColor: isDragging ? '#EFF6FF' : '#F8FAFC',
            py: 5,
            px: 3,
            textAlign: 'center',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            '&:hover': {
              borderColor: '#2563EB',
              backgroundColor: '#F1F5F9',
            },
          }}
        >
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#2563EB',
              mb: 1.5,
            }}
          >
            <UploadFileRoundedIcon sx={{ fontSize: 44 }} />
          </Box>

          <Typography sx={{ fontSize: '15px', fontWeight: 700, color: '#0F172A', mb: 0.6 }}>
            Click to select Excel (.xlsx, .xls) or CSV file for {activeCompanyName}
          </Typography>
          <Typography sx={{ fontSize: '13px', color: '#64748B', fontWeight: 500 }}>
            Expected format:{' '}
            <Box component="span" sx={{ fontWeight: 700, color: '#475569' }}>
              Product Name, Measurement, HSN Code, Pkts/Unit, Amount, GST %
            </Box>
          </Typography>

          {fileName && (
            <Box sx={{ mt: 2 }}>
              <Chip
                icon={<InsertDriveFileRoundedIcon sx={{ fontSize: 16 }} />}
                label={`${fileName} (${parsedRows.length} rows detected)`}
                size="small"
                sx={{
                  fontWeight: 600,
                  backgroundColor: '#DBEAFE',
                  color: '#1E40AF',
                }}
              />
            </Box>
          )}
        </Box>

        {/* Parsed Preview Table */}
        {parsedRows.length > 0 && (
          <Box sx={{ mt: 2.5 }}>
            <Typography sx={{ fontSize: '13px', fontWeight: 700, color: '#0F172A', mb: 1 }}>
              Preview ({validRows.length} valid{invalidCount > 0 ? `, ${invalidCount} invalid` : ''})
            </Typography>
            <TableContainer sx={{ maxHeight: 220, border: '1px solid #E2E8F0', borderRadius: '8px' }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700, fontSize: '11.5px', backgroundColor: '#F8FAFC' }}>#</TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: '11.5px', backgroundColor: '#F8FAFC' }}>Product Name</TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: '11.5px', backgroundColor: '#F8FAFC' }} align="center">Measurement</TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: '11.5px', backgroundColor: '#F8FAFC' }} align="center">HSN Code</TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: '11.5px', backgroundColor: '#F8FAFC' }} align="center">Pkts/Unit</TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: '11.5px', backgroundColor: '#F8FAFC' }} align="right">Amount (₹)</TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: '11.5px', backgroundColor: '#F8FAFC' }} align="center">GST %</TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: '11.5px', backgroundColor: '#F8FAFC' }}>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {parsedRows.map((row, idx) => (
                    <TableRow key={`${row.rowNumber}-${idx}`} sx={{ backgroundColor: row.error ? '#FEF2F2' : '#FFFFFF' }}>
                      <TableCell sx={{ fontSize: '12px' }}>{idx + 1}</TableCell>
                      <TableCell sx={{ fontSize: '12.5px', fontWeight: 600 }}>{row.name || '-'}</TableCell>
                      <TableCell sx={{ fontSize: '12px' }} align="center">{row.measurement || '-'}</TableCell>
                      <TableCell sx={{ fontSize: '12px' }} align="center">{row.hsnCode || '-'}</TableCell>
                      <TableCell sx={{ fontSize: '12px' }} align="center">{row.pktUnit || '-'}</TableCell>
                      <TableCell sx={{ fontSize: '12.5px' }} align="right">
                        {row.amount !== null ? row.amount.toLocaleString('en-IN') : '-'}
                      </TableCell>
                      <TableCell sx={{ fontSize: '12px' }} align="center">
                        {row.gstPercent !== null ? `${row.gstPercent}%` : '-'}
                      </TableCell>
                      <TableCell sx={{ fontSize: '11.5px', color: row.error ? '#DC2626' : '#16A34A', fontWeight: 600 }}>
                        {row.error || 'Ready'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3.5, pb: 3, pt: 1.5, gap: 1.5 }}>
        <Button
          onClick={handleClose}
          disabled={uploading}
          sx={{ color: '#475569', fontSize: '14px', fontWeight: 600, textTransform: 'none', px: 2 }}
        >
          Cancel
        </Button>
        <Button
          variant="contained"
          disableElevation
          onClick={handleUpload}
          disabled={uploading || validRows.length === 0 || invalidCount > 0}
          startIcon={<UploadFileRoundedIcon sx={{ fontSize: 19 }} />}
          sx={{
            backgroundColor: '#10B981',
            color: '#FFFFFF',
            fontSize: '14px',
            fontWeight: 700,
            textTransform: 'none',
            px: 3,
            height: '42px',
            borderRadius: '8px',
            '&:hover': { backgroundColor: '#059669' },
            '&.Mui-disabled': {
              backgroundColor: '#10B981',
              color: '#FFFFFF',
              opacity: 0.72,
            },
          }}
        >
          {uploading
            ? 'Uploading...'
            : `Upload (${validRows.length}) Products to ${activeCompanyName}`}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
