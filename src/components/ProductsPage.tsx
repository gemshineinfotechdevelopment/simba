import { useState, useEffect, useMemo, type FC } from 'react';
import {
  Box,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  CircularProgress,
  InputBase,
  Chip,
  InputAdornment,
  Alert,
} from '@mui/material';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import ClearRoundedIcon from '@mui/icons-material/ClearRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import ModeEditOutlineRoundedIcon from '@mui/icons-material/ModeEditOutlineRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { ParticularsApi, PerformasApi, ProductsApi } from '../services/api';
import { printProductsListDirectly } from '../utils/printUtils';
import { extractSavedMeasurements, mergeMeasurementOptions } from '../utils/measurements';
import { MeasurementInput } from './MeasurementInput';

export interface ProductItem {
  _id?: string;
  id?: string;
  slNo: number;
  name: string;
  amount?: number | null;
  rate?: number;
  hsnCode?: string;
  gstPercent?: number | null;
  measurement?: string;
  code?: string;
  category?: string;
  pktUnit?: string;
}

const getResolvedAmount = (product: ProductItem): number | null => {
  if (product.amount !== undefined && product.amount !== null) {
    return Number(product.amount);
  }
  if (product.rate !== undefined && product.rate !== null && Number(product.rate) > 0) {
    return Number(product.rate);
  }
  return null;
};

const formatInr = (value: number): string =>
  value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const ProductsPage: FC = () => {
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Add / Edit Modal State
  const [openModal, setOpenModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductItem | null>(null);
  const [productName, setProductName] = useState('');
  const [productAmount, setProductAmount] = useState('');
  const [productHsnCode, setProductHsnCode] = useState('');
  const [productGst, setProductGst] = useState('');
  const [productMeasurement, setProductMeasurement] = useState('');
  const [formError, setFormError] = useState('');
  const [modalLoading, setModalLoading] = useState(false);

  const [particularMeasurements, setParticularMeasurements] = useState<string[]>([]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const [data, particularsData, performasRes] = await Promise.all([
        ProductsApi.getAll(),
        ParticularsApi.getAll().catch(() => []),
        PerformasApi.getAll().catch(() => []),
      ]);
      setProducts(data || []);
      const performaList = Array.isArray(performasRes) ? performasRes : performasRes?.data || [];
      setParticularMeasurements(
        extractSavedMeasurements([...(particularsData || []), ...performaList])
      );
    } catch (err) {
      console.error('Failed to fetch products:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const filteredProducts = useMemo(() => {
    if (!searchTerm.trim()) return products;
    const term = searchTerm.toLowerCase().trim();
    return products.filter((p) => {
      const amt = getResolvedAmount(p);
      return (
        p.name.toLowerCase().includes(term) ||
        String(p.slNo).includes(term) ||
        (p.hsnCode && p.hsnCode.toLowerCase().includes(term)) ||
        (p.measurement && p.measurement.toLowerCase().includes(term)) ||
        (p.gstPercent !== undefined && p.gstPercent !== null && String(p.gstPercent).includes(term)) ||
        (amt !== null && String(amt).includes(term))
      );
    });
  }, [products, searchTerm]);

  // Merge stored product and particular measurements from DB with preset options
  const measurementOptions = useMemo(
    () =>
      mergeMeasurementOptions([
        ...products.map((p) => p.measurement),
        ...particularMeasurements,
      ]),
    [products, particularMeasurements]
  );

  const handleOpenAdd = () => {
    setEditingProduct(null);
    setProductName('');
    setProductAmount('');
    setProductHsnCode('');
    setProductGst('');
    setProductMeasurement('');
    setFormError('');
    setOpenModal(true);
  };

  const handleOpenEdit = (product: ProductItem) => {
    setEditingProduct(product);
    setProductName(product.name || '');
    const resolvedAmt = getResolvedAmount(product);
    setProductAmount(resolvedAmt !== null ? String(resolvedAmt) : '');
    setProductHsnCode(product.hsnCode || '');
    setProductGst(
      product.gstPercent !== undefined && product.gstPercent !== null
        ? String(product.gstPercent)
        : ''
    );
    setProductMeasurement((product.measurement || '').trim());
    setFormError('');
    setOpenModal(true);
  };

  const handleSaveProduct = async () => {
    const trimmedName = productName.trim();
    if (!trimmedName) {
      setFormError('Please enter a product name.');
      return;
    }

    const trimmedAmount = productAmount.trim();
    let parsedAmount: number | null = null;
    if (trimmedAmount !== '') {
      parsedAmount = Number(trimmedAmount);
      if (!Number.isFinite(parsedAmount) || parsedAmount < 0) {
        setFormError('Amount must be a valid non-negative number.');
        return;
      }
    }

    const trimmedGst = productGst.trim();
    let parsedGst: number | null = null;
    if (trimmedGst !== '') {
      parsedGst = Number(trimmedGst);
      if (!Number.isFinite(parsedGst) || parsedGst < 0 || parsedGst > 100) {
        setFormError('GST % must be a number between 0 and 100.');
        return;
      }
    }

    setFormError('');

    const payload = {
      name: trimmedName,
      amount: parsedAmount,
      hsnCode: productHsnCode.trim(),
      gstPercent: parsedGst,
      measurement: productMeasurement.trim(),
    };

    try {
      setModalLoading(true);
      if (editingProduct) {
        const id = editingProduct._id || editingProduct.id || '';
        await ProductsApi.update(id, payload);
      } else {
        const nextSlNo = products.length > 0 ? Math.max(...products.map((p) => p.slNo || 0)) + 1 : 1;
        await ProductsApi.create({
          slNo: nextSlNo,
          ...payload,
        });
      }
      setOpenModal(false);
      fetchProducts();
    } catch (err: any) {
      console.error('Failed to save product:', err);
      setFormError(err?.message || 'Error saving product. Please try again.');
    } finally {
      setModalLoading(false);
    }
  };

  const handleDeleteProduct = async (product: ProductItem) => {
    const id = product._id || product.id || '';
    if (!id) return;
    if (!window.confirm(`Delete product "${product.name}"?`)) return;

    try {
      await ProductsApi.delete(id);
      setProducts((prev) => prev.filter((p) => (p._id || p.id) !== id));
    } catch (err) {
      console.error('Failed to delete product:', err);
      alert('Error deleting product');
    }
  };

  return (
    <Box
      sx={{
        width: '100%',
        p: { xs: 2, sm: 2.5, md: 3 },
        boxSizing: 'border-box',
      }}
    >
      <Paper
        elevation={0}
        sx={{
          width: '100%',
          backgroundColor: '#FFFFFF',
          borderRadius: '8px',
          border: '1px solid #E2E8F0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
          overflow: 'hidden',
        }}
      >
        {/* Blue Header Banner */}
        <Box
          sx={{
            backgroundColor: '#0B4DB7',
            px: { xs: 2, sm: 3 },
            py: 1.5,
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            alignItems: { xs: 'stretch', sm: 'center' },
            justifyContent: 'space-between',
            gap: 1.5,
            minHeight: '56px',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Typography
              sx={{
                color: '#FFFFFF',
                fontSize: '16px',
                fontWeight: 700,
                letterSpacing: '-0.01em',
              }}
            >
              View Product
            </Typography>
            <Typography
              sx={{
                color: 'rgba(255, 255, 255, 0.8)',
                fontSize: '12px',
                fontWeight: 600,
                backgroundColor: 'rgba(255, 255, 255, 0.15)',
                px: 1.2,
                py: 0.3,
                borderRadius: '12px',
              }}
            >
              {filteredProducts.length} {filteredProducts.length === 1 ? 'item' : 'items'}
            </Typography>
          </Box>

          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              flexWrap: { xs: 'wrap', sm: 'nowrap' },
            }}
          >
            {/* Search Box */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                backgroundColor: '#FFFFFF',
                borderRadius: '6px',
                px: 1.2,
                height: '36px',
                width: { xs: '100%', sm: '240px' },
                boxSizing: 'border-box',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                transition: 'all 0.2s ease',
              }}
            >
              <SearchRoundedIcon
                sx={{
                  color: '#64748B',
                  fontSize: 19,
                  mr: 0.8,
                  flexShrink: 0,
                }}
              />
              <InputBase
                placeholder="Search name, HSN, unit..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                sx={{
                  fontSize: '13px',
                  fontWeight: 500,
                  color: '#0F172A',
                  width: '100%',
                  '& input': {
                    p: 0,
                    '&::placeholder': {
                      color: '#94A3B8',
                      opacity: 1,
                    },
                  },
                }}
              />
              {searchTerm && (
                <IconButton
                  size="small"
                  onClick={() => setSearchTerm('')}
                  sx={{ p: 0.4, color: '#94A3B8', '&:hover': { color: '#64748B' } }}
                >
                  <ClearRoundedIcon sx={{ fontSize: 16 }} />
                </IconButton>
              )}
            </Box>

            {/* Print Products List Button */}
            <Button
              variant="contained"
              disableElevation
              onClick={() => printProductsListDirectly(filteredProducts)}
              startIcon={<PrintOutlinedIcon sx={{ fontSize: 18 }} />}
              sx={{
                backgroundColor: 'rgba(255, 255, 255, 0.15)',
                color: '#FFFFFF',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                fontSize: '13px',
                fontWeight: 700,
                textTransform: 'none',
                px: 1.8,
                height: '36px',
                borderRadius: '6px',
                '&:hover': {
                  backgroundColor: 'rgba(255, 255, 255, 0.25)',
                },
              }}
            >
              Print List ({filteredProducts.length})
            </Button>

            {/* Add Product Button */}
            <Button
              variant="contained"
              disableElevation
              onClick={handleOpenAdd}
              startIcon={<AddRoundedIcon sx={{ fontSize: 18 }} />}
              sx={{
                backgroundColor: '#FFFFFF',
                color: '#0B4DB7',
                fontSize: '13px',
                fontWeight: 700,
                textTransform: 'none',
                px: 2,
                height: '36px',
                borderRadius: '6px',
                boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                minWidth: 'auto',
                whiteSpace: 'nowrap',
                '&:hover': {
                  backgroundColor: '#F8FAFC',
                },
              }}
            >
              Add Product
            </Button>
          </Box>
        </Box>

        {/* Table Container */}
        <TableContainer sx={{ overflowX: 'auto' }}>
          <Table sx={{ width: '100%', minWidth: 720 }} aria-label="product table">
            <TableHead>
              <TableRow sx={{ backgroundColor: '#F8FAFC' }}>
                <TableCell
                  sx={{
                    py: 1.5,
                    px: { xs: 2, sm: 3 },
                    fontSize: '11.5px',
                    fontWeight: 700,
                    color: '#1E293B',
                    letterSpacing: '0.04em',
                    borderBottom: '1px solid #E2E8F0',
                    width: '80px',
                  }}
                >
                  SL.NO
                </TableCell>
                <TableCell
                  sx={{
                    py: 1.5,
                    px: { xs: 2, sm: 3 },
                    fontSize: '11.5px',
                    fontWeight: 700,
                    color: '#1E293B',
                    letterSpacing: '0.04em',
                    borderBottom: '1px solid #E2E8F0',
                  }}
                >
                  NAME
                </TableCell>
                <TableCell
                  align="center"
                  sx={{
                    py: 1.5,
                    px: { xs: 1.5, sm: 2 },
                    fontSize: '11.5px',
                    fontWeight: 700,
                    color: '#1E293B',
                    letterSpacing: '0.04em',
                    borderBottom: '1px solid #E2E8F0',
                    width: '130px',
                  }}
                >
                  HSN CODE
                </TableCell>
                <TableCell
                  align="center"
                  sx={{
                    py: 1.5,
                    px: { xs: 1.5, sm: 2 },
                    fontSize: '11.5px',
                    fontWeight: 700,
                    color: '#1E293B',
                    letterSpacing: '0.04em',
                    borderBottom: '1px solid #E2E8F0',
                    width: '130px',
                  }}
                >
                  MEASUREMENT
                </TableCell>
                <TableCell
                  align="right"
                  sx={{
                    py: 1.5,
                    px: { xs: 1.5, sm: 2.5 },
                    fontSize: '11.5px',
                    fontWeight: 700,
                    color: '#1E293B',
                    letterSpacing: '0.04em',
                    borderBottom: '1px solid #E2E8F0',
                    width: '135px',
                  }}
                >
                  AMOUNT (₹)
                </TableCell>
                <TableCell
                  align="center"
                  sx={{
                    py: 1.5,
                    px: { xs: 1.5, sm: 2 },
                    fontSize: '11.5px',
                    fontWeight: 700,
                    color: '#1E293B',
                    letterSpacing: '0.04em',
                    borderBottom: '1px solid #E2E8F0',
                    width: '95px',
                  }}
                >
                  GST %
                </TableCell>
                <TableCell
                  align="center"
                  sx={{
                    py: 1.5,
                    px: { xs: 1.5, sm: 2 },
                    fontSize: '11.5px',
                    fontWeight: 700,
                    color: '#1E293B',
                    letterSpacing: '0.04em',
                    borderBottom: '1px solid #E2E8F0',
                    width: '80px',
                  }}
                >
                  EDIT
                </TableCell>
                <TableCell
                  align="center"
                  sx={{
                    py: 1.5,
                    px: { xs: 2, sm: 3 },
                    fontSize: '11.5px',
                    fontWeight: 700,
                    color: '#1E293B',
                    letterSpacing: '0.04em',
                    borderBottom: '1px solid #E2E8F0',
                    width: '80px',
                  }}
                >
                  DELETE
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 6 }}>
                    <CircularProgress size={32} sx={{ color: '#0B4DB7' }} />
                  </TableCell>
                </TableRow>
              ) : filteredProducts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 6, color: '#64748B' }}>
                    {searchTerm ? (
                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                        <Typography sx={{ fontSize: '14px', color: '#64748B', fontWeight: 500 }}>
                          No products matching "{searchTerm}" found.
                        </Typography>
                        <Button
                          size="small"
                          onClick={() => setSearchTerm('')}
                          sx={{ textTransform: 'none', color: '#0B4DB7', fontWeight: 600 }}
                        >
                          Clear Search
                        </Button>
                      </Box>
                    ) : (
                      'No products found. Click "Add Product" to add one.'
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                filteredProducts.map((product, index) => {
                  const isLast = index === filteredProducts.length - 1;
                  const resolvedAmt = getResolvedAmount(product);
                  const hasGst =
                    product.gstPercent !== undefined && product.gstPercent !== null;
                  return (
                    <TableRow
                      key={product._id || product.id || index}
                      sx={{
                        '&:hover': {
                          backgroundColor: '#F8FAFC',
                        },
                      }}
                    >
                      <TableCell
                        sx={{
                          py: 1.6,
                          px: { xs: 2, sm: 3 },
                          fontSize: '13.5px',
                          fontWeight: 600,
                          color: '#1E293B',
                          borderBottom: isLast ? 'none' : '1px solid #EEF2F6',
                        }}
                      >
                        {product.slNo || index + 1}
                      </TableCell>
                      <TableCell
                        sx={{
                          py: 1.6,
                          px: { xs: 2, sm: 3 },
                          fontSize: '13.5px',
                          fontWeight: 600,
                          color: '#0F172A',
                          letterSpacing: '0.01em',
                          borderBottom: isLast ? 'none' : '1px solid #EEF2F6',
                        }}
                      >
                        {product.name}
                      </TableCell>
                      <TableCell
                        align="center"
                        sx={{
                          py: 1.6,
                          px: { xs: 1.5, sm: 2 },
                          fontSize: '13px',
                          fontWeight: 600,
                          color: product.hsnCode ? '#334155' : '#94A3B8',
                          borderBottom: isLast ? 'none' : '1px solid #EEF2F6',
                        }}
                      >
                        {product.hsnCode || '-'}
                      </TableCell>
                      <TableCell
                        align="center"
                        sx={{
                          py: 1.6,
                          px: { xs: 1.5, sm: 2 },
                          borderBottom: isLast ? 'none' : '1px solid #EEF2F6',
                        }}
                      >
                        {product.measurement ? (
                          <Chip
                            label={product.measurement}
                            size="small"
                            sx={{
                              height: '24px',
                              fontSize: '12px',
                              fontWeight: 700,
                              backgroundColor: '#EFF6FF',
                              color: '#0B4DB7',
                              border: '1px solid #DBEAFE',
                            }}
                          />
                        ) : (
                          <Typography component="span" sx={{ fontSize: '13px', color: '#94A3B8' }}>
                            -
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell
                        align="right"
                        sx={{
                          py: 1.6,
                          px: { xs: 1.5, sm: 2.5 },
                          fontSize: '13.5px',
                          fontWeight: 700,
                          color: resolvedAmt !== null ? '#0F172A' : '#94A3B8',
                          borderBottom: isLast ? 'none' : '1px solid #EEF2F6',
                        }}
                      >
                        {resolvedAmt !== null ? `₹ ${formatInr(resolvedAmt)}` : '-'}
                      </TableCell>
                      <TableCell
                        align="center"
                        sx={{
                          py: 1.6,
                          px: { xs: 1.5, sm: 2 },
                          borderBottom: isLast ? 'none' : '1px solid #EEF2F6',
                        }}
                      >
                        {hasGst ? (
                          <Chip
                            label={`${product.gstPercent}%`}
                            size="small"
                            sx={{
                              height: '24px',
                              fontSize: '12px',
                              fontWeight: 700,
                              backgroundColor: '#F0FDF4',
                              color: '#166534',
                              border: '1px solid #BBF7D0',
                            }}
                          />
                        ) : (
                          <Typography component="span" sx={{ fontSize: '13px', color: '#94A3B8' }}>
                            -
                          </Typography>
                        )}
                      </TableCell>

                      {/* Edit Button */}
                      <TableCell
                        align="center"
                        sx={{
                          py: 1.6,
                          px: { xs: 1.5, sm: 2 },
                          borderBottom: isLast ? 'none' : '1px solid #EEF2F6',
                        }}
                      >
                        <Tooltip title="Edit Product" arrow>
                          <IconButton
                            size="small"
                            onClick={() => handleOpenEdit(product)}
                            sx={{
                              color: '#64748B',
                              backgroundColor: '#F8FAFC',
                              border: '1px solid #E2E8F0',
                              borderRadius: '6px',
                              p: 0.7,
                              transition: 'all 0.15s ease',
                              '&:hover': {
                                color: '#0B4DB7',
                                backgroundColor: '#EFF6FF',
                                borderColor: '#BFDBFE',
                              },
                            }}
                          >
                            <ModeEditOutlineRoundedIcon sx={{ fontSize: 16 }} />
                          </IconButton>
                        </Tooltip>
                      </TableCell>

                      {/* Delete Button */}
                      <TableCell
                        align="center"
                        sx={{
                          py: 1.6,
                          px: { xs: 2, sm: 3 },
                          borderBottom: isLast ? 'none' : '1px solid #EEF2F6',
                        }}
                      >
                        <Tooltip title="Delete Product" arrow>
                          <IconButton
                            size="small"
                            onClick={() => handleDeleteProduct(product)}
                            sx={{
                              color: '#64748B',
                              backgroundColor: '#F8FAFC',
                              border: '1px solid #E2E8F0',
                              borderRadius: '6px',
                              p: 0.7,
                              transition: 'all 0.15s ease',
                              '&:hover': {
                                color: '#DC2626',
                                backgroundColor: '#FEF2F2',
                                borderColor: '#FECACA',
                              },
                            }}
                          >
                            <DeleteOutlineRoundedIcon sx={{ fontSize: 16 }} />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Add / Edit Product Modal */}
      <Dialog
        open={openModal}
        onClose={() => setOpenModal(false)}
        maxWidth="sm"
        fullWidth
        slotProps={{
          paper: {
            sx: {
              borderRadius: '12px',
              overflow: 'hidden',
            },
          },
        }}
      >
        <DialogTitle
          sx={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            px: 3,
            pt: 2.5,
            pb: 1.5,
            borderBottom: '1px solid #EEF2F6',
          }}
        >
          <Box>
            <Typography sx={{ fontSize: '18px', fontWeight: 700, color: '#0F172A', lineHeight: 1.3 }}>
              {editingProduct ? 'Edit Product' : 'Add New Product'}
            </Typography>
            <Typography sx={{ fontSize: '12.5px', color: '#64748B', mt: 0.4 }}>
              Enter product name along with amount, HSN code, GST %, and measurement unit.
            </Typography>
          </Box>
          <IconButton
            size="small"
            onClick={() => setOpenModal(false)}
            sx={{ color: '#64748B', mt: -0.25, mr: -0.5 }}
          >
            <CloseRoundedIcon fontSize="small" />
          </IconButton>
        </DialogTitle>

        <DialogContent
          sx={{
            px: 3,
            pb: 2,
            '&.MuiDialogContent-root': {
              pt: 2.5,
            },
          }}
        >
          {formError && (
            <Alert severity="error" sx={{ mb: 2, borderRadius: '8px' }}>
              {formError}
            </Alert>
          )}

          {/* Product Name */}
          <Box sx={{ mb: 2 }}>
            <Typography sx={{ fontSize: '12.5px', fontWeight: 600, color: '#334155', mb: 0.75 }}>
              Product Name *
            </Typography>
            <TextField
              autoFocus
              fullWidth
              size="small"
              placeholder="e.g. 2 1/2 KURUVI"
              value={productName}
              onChange={(e) => {
                setProductName(e.target.value);
                if (formError) setFormError('');
              }}
              slotProps={{
                input: {
                  sx: {
                    height: '40px',
                    fontSize: '13.5px',
                    fontWeight: 500,
                    borderRadius: '8px',
                    backgroundColor: '#FFFFFF',
                  },
                },
              }}
            />
          </Box>

          {/* Extra Section: Amount, HSN Code, GST %, Measurement */}
          <Box
            sx={{
              p: 2,
              borderRadius: '10px',
              border: '1px solid #E2E8F0',
              backgroundColor: '#F8FAFC',
            }}
          >
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                columnGap: 2,
                rowGap: 2,
                alignItems: 'start',
              }}
            >
              {/* Amount */}
              <Box>
                <Typography sx={{ fontSize: '12.5px', fontWeight: 600, color: '#334155', mb: 0.75 }}>
                  Amount (₹)
                </Typography>
                <TextField
                  fullWidth
                  size="small"
                  type="number"
                  placeholder="e.g. 500.00"
                  value={productAmount}
                  onChange={(e) => {
                    setProductAmount(e.target.value);
                    if (formError) setFormError('');
                  }}
                  slotProps={{
                    htmlInput: { min: 0, step: 'any' },
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <Typography sx={{ fontWeight: 700, color: '#475569', fontSize: '13.5px' }}>
                            ₹
                          </Typography>
                        </InputAdornment>
                      ),
                      sx: {
                        height: '40px',
                        fontSize: '13.5px',
                        fontWeight: 500,
                        borderRadius: '8px',
                        backgroundColor: '#FFFFFF',
                      },
                    },
                  }}
                />
              </Box>

              {/* HSN Code */}
              <Box>
                <Typography sx={{ fontSize: '12.5px', fontWeight: 600, color: '#334155', mb: 0.75 }}>
                  HSN Code
                </Typography>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="e.g. 3604 or 290511"
                  value={productHsnCode}
                  onChange={(e) => setProductHsnCode(e.target.value)}
                  slotProps={{
                    input: {
                      sx: {
                        height: '40px',
                        fontSize: '13.5px',
                        fontWeight: 500,
                        borderRadius: '8px',
                        backgroundColor: '#FFFFFF',
                      },
                    },
                  }}
                />
              </Box>

              {/* GST % */}
              <Box>
                <Typography sx={{ fontSize: '12.5px', fontWeight: 600, color: '#334155', mb: 0.75 }}>
                  GST %
                </Typography>
                <TextField
                  fullWidth
                  size="small"
                  type="number"
                  placeholder="e.g. 18"
                  value={productGst}
                  onChange={(e) => {
                    setProductGst(e.target.value);
                    if (formError) setFormError('');
                  }}
                  slotProps={{
                    htmlInput: { min: 0, max: 100, step: 'any' },
                    input: {
                      endAdornment: (
                        <InputAdornment position="end">
                          <Typography sx={{ fontWeight: 700, color: '#475569', fontSize: '13px' }}>
                            %
                          </Typography>
                        </InputAdornment>
                      ),
                      sx: {
                        height: '40px',
                        fontSize: '13.5px',
                        fontWeight: 500,
                        borderRadius: '8px',
                        backgroundColor: '#FFFFFF',
                      },
                    },
                  }}
                />
              </Box>

              {/* Measurement Type-Ahead */}
              <Box>
                <Typography sx={{ fontSize: '12.5px', fontWeight: 600, color: '#334155', mb: 0.75 }}>
                  Measurement
                </Typography>
                <MeasurementInput
                  value={productMeasurement}
                  onChange={setProductMeasurement}
                  options={measurementOptions}
                  placeholder="Type unit (e.g. g, kg, drum, box)"
                  height="40px"
                  borderRadius="8px"
                  fontSize="13.5px"
                />
              </Box>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, pt: 1, gap: 1 }}>
          <Button
            onClick={() => setOpenModal(false)}
            sx={{ color: '#64748B', fontWeight: 600, textTransform: 'none' }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            disableElevation
            onClick={handleSaveProduct}
            disabled={modalLoading}
            sx={{
              backgroundColor: '#0B4DB7',
              color: '#FFFFFF',
              fontWeight: 700,
              textTransform: 'none',
              px: 2.5,
              borderRadius: '6px',
              '&:hover': { backgroundColor: '#083B8D' },
            }}
          >
            {modalLoading ? 'Saving...' : 'Save Product'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
