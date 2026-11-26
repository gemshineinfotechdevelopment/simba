import { useState, useEffect, useMemo, useCallback, type FC } from 'react';
import {
  Autocomplete,
  Box,
  Typography,
  Button,
  InputBase,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  Chip,
  InputAdornment,
} from '@mui/material';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import ClearRoundedIcon from '@mui/icons-material/ClearRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import ModeEditOutlineRoundedIcon from '@mui/icons-material/ModeEditOutlineRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import ApartmentRoundedIcon from '@mui/icons-material/ApartmentRounded';
import FormatListBulletedRoundedIcon from '@mui/icons-material/FormatListBulletedRounded';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import { CompaniesApi, ParticularsApi, PerformasApi, ProductsApi } from '../services/api';
import { printProductsListDirectly } from '../utils/printUtils';
import { extractSavedMeasurements, mergeMeasurementOptions } from '../utils/measurements';
import { MeasurementInput } from './MeasurementInput';
import { BulkUploadProductsDialog } from './BulkUploadProductsDialog';

export interface ProductItem {
  _id?: string;
  id?: string;
  slNo: number;
  name: string;
  companyId?: string | null;
  companyName?: string;
  amount?: number | null;
  rate?: number;
  hsnCode?: string;
  gstPercent?: number | null;
  measurement?: string;
  code?: string;
  category?: string;
  pktUnit?: string;
}

interface CompanyOption {
  _id?: string;
  id?: string;
  name: string;
  avatarLetter?: string;
  avatarBg?: string;
  avatarColor?: string;
  gstin?: string;
}

type ProductsViewMode = 'companies' | 'company-products' | 'all-products';

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

const doesProductBelongToCompany = (product: ProductItem, company: CompanyOption): boolean => {
  const targetId = company._id || company.id;
  if (product.companyId && targetId && String(product.companyId) === String(targetId)) {
    return true;
  }
  return (product.companyName || '').trim().toLowerCase() === company.name.trim().toLowerCase();
};

export const ProductsPage: FC = () => {
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [loading, setLoading] = useState(true);

  const [viewMode, setViewMode] = useState<ProductsViewMode>('companies');
  const [selectedCompany, setSelectedCompany] = useState<CompanyOption | null>(null);
  const [companySearchTerm, setCompanySearchTerm] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Add / Edit Modal State
  const [openModal, setOpenModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductItem | null>(null);
  const [productCompany, setProductCompany] = useState<CompanyOption | null>(null);
  const [productName, setProductName] = useState('');
  const [productPktUnit, setProductPktUnit] = useState('');
  const [productAmount, setProductAmount] = useState('');
  const [productHsnCode, setProductHsnCode] = useState('');
  const [productGst, setProductGst] = useState('');
  const [productMeasurement, setProductMeasurement] = useState('');
  const [formError, setFormError] = useState('');
  const [modalLoading, setModalLoading] = useState(false);

  // Bulk Upload Modal State
  const [bulkUploadCompany, setBulkUploadCompany] = useState<CompanyOption | null>(null);

  const [particularMeasurements, setParticularMeasurements] = useState<string[]>([]);

  const loadData = useCallback(async (showSpinner = true) => {
    try {
      if (showSpinner) setLoading(true);
      const [productsRes, companiesRes, particularsRes, performasRes] = await Promise.all([
        ProductsApi.getAll(),
        CompaniesApi.getAll().catch(() => []),
        ParticularsApi.getAll().catch(() => []),
        PerformasApi.getAll().catch(() => []),
      ]);
      setProducts(productsRes || []);
      setCompanies(companiesRes || []);
      const performaList = Array.isArray(performasRes) ? performasRes : performasRes?.data || [];
      setParticularMeasurements(
        extractSavedMeasurements([...(particularsRes || []), ...performaList])
      );
    } catch (err) {
      console.error('Failed to fetch products:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData(false);
  }, [loadData]);

  const filteredCompanies = useMemo(() => {
    const q = companySearchTerm.trim().toLowerCase();
    const list = q
      ? companies.filter(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            (c.gstin && c.gstin.toLowerCase().includes(q))
        )
      : companies;
    return [...list].sort((a, b) =>
      (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' })
    );
  }, [companies, companySearchTerm]);

  const companyProductCountMap = useMemo(() => {
    const counts = new Map<string, number>();
    for (const company of companies) {
      const key = company._id || company.id || company.name;
      counts.set(
        key,
        products.filter((product) => doesProductBelongToCompany(product, company)).length
      );
    }
    return counts;
  }, [companies, products]);

  const scopedProducts = useMemo(() => {
    if (viewMode === 'company-products' && selectedCompany) {
      return products.filter((p) => doesProductBelongToCompany(p, selectedCompany));
    }
    return products;
  }, [products, viewMode, selectedCompany]);

  const filteredProducts = useMemo(() => {
    if (!searchTerm.trim()) return scopedProducts;
    const term = searchTerm.toLowerCase().trim();
    return scopedProducts.filter((p) => {
      const amt = getResolvedAmount(p);
      return (
        p.name.toLowerCase().includes(term) ||
        String(p.slNo).includes(term) ||
        (p.companyName && p.companyName.toLowerCase().includes(term)) ||
        (p.pktUnit && p.pktUnit.toLowerCase().includes(term)) ||
        (p.hsnCode && p.hsnCode.toLowerCase().includes(term)) ||
        (p.measurement && p.measurement.toLowerCase().includes(term)) ||
        (p.gstPercent !== undefined && p.gstPercent !== null && String(p.gstPercent).includes(term)) ||
        (amt !== null && String(amt).includes(term))
      );
    });
  }, [scopedProducts, searchTerm]);

  const measurementOptions = useMemo(
    () =>
      mergeMeasurementOptions([
        ...products.map((p) => p.measurement),
        ...particularMeasurements,
      ]),
    [products, particularMeasurements]
  );

  const handleOpenCompanyProducts = (company: CompanyOption) => {
    setSelectedCompany(company);
    setSearchTerm('');
    setViewMode('company-products');
  };

  const handleOpenAllProducts = () => {
    setSelectedCompany(null);
    setSearchTerm('');
    setViewMode('all-products');
  };

  const handleBackToCompanies = () => {
    setSelectedCompany(null);
    setSearchTerm('');
    setViewMode('companies');
  };

  const handleOpenAdd = () => {
    setEditingProduct(null);
    setProductCompany(viewMode === 'company-products' ? selectedCompany : null);
    setProductName('');
    setProductPktUnit('');
    setProductAmount('');
    setProductHsnCode('');
    setProductGst('');
    setProductMeasurement('');
    setFormError('');
    setOpenModal(true);
  };

  const handleOpenEdit = (product: ProductItem) => {
    setEditingProduct(product);
    const matchedCompany =
      companies.find((c) => doesProductBelongToCompany(product, c)) ||
      (product.companyName ? { name: product.companyName, _id: product.companyId || undefined } : null);
    setProductCompany(matchedCompany);
    setProductName(product.name || '');
    setProductPktUnit((product.pktUnit || '').trim());
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
      companyId: productCompany?._id || productCompany?.id || null,
      companyName: productCompany?.name?.trim() || '',
      pktUnit: productPktUnit.trim(),
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
      await loadData(false);
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

  const isCompanyProductsView = viewMode === 'company-products';
  const showCompanyColumn = viewMode === 'all-products';

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
          borderRadius: '10px',
          border: '1px solid #E2E8F0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          overflow: 'hidden',
        }}
      >
        {viewMode === 'companies' ? (
          <>
            {/* Top Blue Header Banner: Products by Company */}
            <Box
              sx={{
                background: 'linear-gradient(90deg, #0B4DB7 0%, #1D72E8 100%)',
                px: { xs: 2, sm: 3 },
                py: 1.75,
                display: 'flex',
                flexDirection: { xs: 'column', sm: 'row' },
                alignItems: { xs: 'stretch', sm: 'center' },
                justifyContent: 'space-between',
                gap: 1.5,
                minHeight: '62px',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.4 }}>
                <ApartmentRoundedIcon sx={{ color: '#FFFFFF', fontSize: 22 }} />
                <Typography
                  sx={{
                    color: '#FFFFFF',
                    fontSize: '18px',
                    fontWeight: 700,
                    letterSpacing: '-0.01em',
                  }}
                >
                  Products by Company
                </Typography>
                <Typography
                  sx={{
                    color: '#FFFFFF',
                    fontSize: '12px',
                    fontWeight: 600,
                    backgroundColor: 'rgba(255, 255, 255, 0.18)',
                    px: 1.3,
                    py: 0.35,
                    borderRadius: '14px',
                  }}
                >
                  {filteredCompanies.length}{' '}
                  {filteredCompanies.length === 1 ? 'Company' : 'Companies'}
                </Typography>
              </Box>

              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.25,
                  flexWrap: { xs: 'wrap', sm: 'nowrap' },
                }}
              >
                {/* Search Company Input */}
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    backgroundColor: '#FFFFFF',
                    borderRadius: '8px',
                    px: 1.3,
                    height: '38px',
                    width: { xs: '100%', sm: '230px' },
                    boxSizing: 'border-box',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
                  }}
                >
                  <SearchRoundedIcon sx={{ color: '#64748B', fontSize: 19, mr: 0.8, flexShrink: 0 }} />
                  <InputBase
                    placeholder="Search company..."
                    value={companySearchTerm}
                    onChange={(e) => setCompanySearchTerm(e.target.value)}
                    sx={{
                      fontSize: '13.5px',
                      fontWeight: 500,
                      color: '#0F172A',
                      width: '100%',
                      '& input': {
                        p: 0,
                        '&::placeholder': { color: '#94A3B8', opacity: 1 },
                      },
                    }}
                  />
                  {companySearchTerm && (
                    <IconButton
                      size="small"
                      onClick={() => setCompanySearchTerm('')}
                      sx={{ p: 0.4, color: '#94A3B8', '&:hover': { color: '#64748B' } }}
                    >
                      <ClearRoundedIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  )}
                </Box>

                {/* View All Products Table Button */}
                <Button
                  variant="contained"
                  disableElevation
                  onClick={handleOpenAllProducts}
                  startIcon={<FormatListBulletedRoundedIcon sx={{ fontSize: 18 }} />}
                  sx={{
                    backgroundColor: 'rgba(255, 255, 255, 0.16)',
                    color: '#FFFFFF',
                    border: '1px solid rgba(255, 255, 255, 0.3)',
                    fontSize: '13px',
                    fontWeight: 700,
                    textTransform: 'none',
                    px: 2,
                    height: '38px',
                    borderRadius: '8px',
                    whiteSpace: 'nowrap',
                    '&:hover': {
                      backgroundColor: 'rgba(255, 255, 255, 0.25)',
                    },
                  }}
                >
                  View All Products Table
                </Button>
              </Box>
            </Box>

            {/* Company Cards Grid */}
            <Box sx={{ p: { xs: 2, sm: 3 }, backgroundColor: '#FFFFFF' }}>
              {loading ? (
                <Box sx={{ py: 6, display: 'flex', justifyContent: 'center' }}>
                  <CircularProgress size={32} sx={{ color: '#0B4DB7' }} />
                </Box>
              ) : filteredCompanies.length === 0 ? (
                <Box sx={{ py: 6, textAlign: 'center', color: '#64748B' }}>
                  {companySearchTerm ? (
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                      <Typography sx={{ fontSize: '14px', fontWeight: 500 }}>
                        No companies matching "{companySearchTerm}" found.
                      </Typography>
                      <Button
                        size="small"
                        onClick={() => setCompanySearchTerm('')}
                        sx={{ textTransform: 'none', color: '#0B4DB7', fontWeight: 600 }}
                      >
                        Clear Search
                      </Button>
                    </Box>
                  ) : (
                    <Typography sx={{ fontSize: '14px', fontWeight: 500 }}>
                      No companies registered yet. Add a company first or click "View All Products Table".
                    </Typography>
                  )}
                </Box>
              ) : (
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: {
                      xs: '1fr',
                      sm: 'repeat(2, minmax(0, 1fr))',
                      lg: 'repeat(3, minmax(0, 1fr))',
                    },
                    gap: 2.5,
                  }}
                >
                  {filteredCompanies.map((company) => {
                    const companyKey = company._id || company.id || company.name;
                    const count = companyProductCountMap.get(companyKey) || 0;
                    const letter = (company.avatarLetter || company.name.charAt(0) || 'C').toUpperCase();

                    return (
                      <Paper
                        key={companyKey}
                        elevation={0}
                        sx={{
                          p: 2.25,
                          borderRadius: '10px',
                          border: '1px solid #E2E8F0',
                          backgroundColor: '#FFFFFF',
                          boxShadow: '0 1px 2px rgba(15, 23, 42, 0.03)',
                          transition: 'all 0.15s ease',
                          '&:hover': {
                            borderColor: '#BFDBFE',
                            boxShadow: '0 4px 12px rgba(15, 23, 42, 0.06)',
                          },
                        }}
                      >
                        {/* Card Top: Avatar + Company Name */}
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                          <Box
                            sx={{
                              width: 44,
                              height: 44,
                              borderRadius: '10px',
                              backgroundColor: company.avatarBg || '#DBEAFE',
                              color: company.avatarColor || '#0B4DB7',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '18px',
                              fontWeight: 800,
                              flexShrink: 0,
                            }}
                          >
                            {letter}
                          </Box>
                          <Box sx={{ minWidth: 0 }}>
                            <Typography
                              sx={{
                                fontSize: '15.5px',
                                fontWeight: 700,
                                color: '#0F172A',
                                letterSpacing: '-0.01em',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {company.name}
                            </Typography>
                          </Box>
                        </Box>

                        {/* Middle Stat Box: Total Products */}
                        <Box
                          sx={{
                            my: 1.8,
                            px: 1.5,
                            py: 1.1,
                            borderRadius: '8px',
                            backgroundColor: '#F8FAFC',
                            border: '1px solid #F1F5F9',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                          }}
                        >
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Inventory2OutlinedIcon sx={{ fontSize: 17, color: '#0B4DB7' }} />
                            <Typography sx={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}>
                              Total Products
                            </Typography>
                          </Box>
                          <Box
                            sx={{
                              minWidth: '28px',
                              height: '24px',
                              px: 0.9,
                              borderRadius: '12px',
                              backgroundColor: count > 0 ? '#DBEAFE' : '#E2E8F0',
                              color: count > 0 ? '#0B4DB7' : '#64748B',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '12px',
                              fontWeight: 700,
                            }}
                          >
                            {count}
                          </Box>
                        </Box>

                        {/* Action Buttons */}
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                          <Button
                            variant="outlined"
                            onClick={() => setBulkUploadCompany(company)}
                            startIcon={<UploadFileOutlinedIcon sx={{ fontSize: 17 }} />}
                            sx={{
                              flex: 1,
                              height: '38px',
                              borderRadius: '8px',
                              borderColor: '#10B981',
                              color: '#059669',
                              fontSize: '13px',
                              fontWeight: 700,
                              textTransform: 'none',
                              '&:hover': {
                                borderColor: '#059669',
                                backgroundColor: '#ECFDF5',
                              },
                            }}
                          >
                            Bulk Upload
                          </Button>

                          <Button
                            variant="contained"
                            disableElevation
                            onClick={() => handleOpenCompanyProducts(company)}
                            endIcon={<ArrowForwardRoundedIcon sx={{ fontSize: 17 }} />}
                            sx={{
                              flex: 1,
                              height: '38px',
                              borderRadius: '8px',
                              backgroundColor: '#0B4DB7',
                              color: '#FFFFFF',
                              fontSize: '13px',
                              fontWeight: 700,
                              textTransform: 'none',
                              '&:hover': {
                                backgroundColor: '#083B8D',
                              },
                            }}
                          >
                            View Products
                          </Button>
                        </Box>
                      </Paper>
                    );
                  })}
                </Box>
              )}
            </Box>
          </>
        ) : (
          <>
            {/* Company Products or All Products Header Banner */}
            <Box
              sx={{
                background: 'linear-gradient(90deg, #0B4DB7 0%, #1D72E8 100%)',
                px: { xs: 2, sm: 3 },
                py: 1.5,
                display: 'flex',
                flexDirection: { xs: 'column', sm: 'row' },
                alignItems: { xs: 'stretch', sm: 'center' },
                justifyContent: 'space-between',
                gap: 1.5,
                minHeight: '60px',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, flexWrap: 'wrap' }}>
                <Button
                  size="small"
                  onClick={handleBackToCompanies}
                  startIcon={<ArrowBackRoundedIcon sx={{ fontSize: 17 }} />}
                  sx={{
                    color: '#FFFFFF',
                    backgroundColor: 'rgba(255, 255, 255, 0.16)',
                    border: '1px solid rgba(255, 255, 255, 0.25)',
                    fontSize: '12.5px',
                    fontWeight: 700,
                    textTransform: 'none',
                    borderRadius: '6px',
                    px: 1.3,
                    height: '32px',
                    '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.25)' },
                  }}
                >
                  Companies
                </Button>
                <Typography
                  sx={{
                    color: '#FFFFFF',
                    fontSize: '17px',
                    fontWeight: 700,
                    letterSpacing: '-0.01em',
                  }}
                >
                  {isCompanyProductsView && selectedCompany
                    ? `${selectedCompany.name} Products`
                    : 'All Products'}
                </Typography>
                <Typography
                  sx={{
                    color: '#FFFFFF',
                    fontSize: '12px',
                    fontWeight: 600,
                    backgroundColor: 'rgba(255, 255, 255, 0.18)',
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
                  gap: 1.2,
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
                    width: { xs: '100%', sm: '230px' },
                    boxSizing: 'border-box',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                  }}
                >
                  <SearchRoundedIcon sx={{ color: '#64748B', fontSize: 19, mr: 0.8, flexShrink: 0 }} />
                  <InputBase
                    placeholder={showCompanyColumn ? 'Search name, company, HSN...' : 'Search name, HSN, unit...'}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    sx={{
                      fontSize: '13px',
                      fontWeight: 500,
                      color: '#0F172A',
                      width: '100%',
                      '& input': {
                        p: 0,
                        '&::placeholder': { color: '#94A3B8', opacity: 1 },
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

                {/* Print List Button */}
                <Button
                  variant="contained"
                  disableElevation
                  onClick={() =>
                    printProductsListDirectly(
                      filteredProducts,
                      isCompanyProductsView && selectedCompany ? selectedCompany.name : undefined
                    )
                  }
                  startIcon={<PrintOutlinedIcon sx={{ fontSize: 18 }} />}
                  sx={{
                    backgroundColor: 'rgba(255, 255, 255, 0.15)',
                    color: '#FFFFFF',
                    border: '1px solid rgba(255, 255, 255, 0.3)',
                    fontSize: '13px',
                    fontWeight: 700,
                    textTransform: 'none',
                    px: 1.6,
                    height: '36px',
                    borderRadius: '6px',
                    whiteSpace: 'nowrap',
                    '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.25)' },
                  }}
                >
                  Print List ({filteredProducts.length})
                </Button>

                {isCompanyProductsView && selectedCompany && (
                  <Button
                    variant="contained"
                    disableElevation
                    onClick={() => setBulkUploadCompany(selectedCompany)}
                    startIcon={<UploadFileOutlinedIcon sx={{ fontSize: 18 }} />}
                    sx={{
                      backgroundColor: '#10B981',
                      color: '#FFFFFF',
                      fontSize: '13px',
                      fontWeight: 700,
                      textTransform: 'none',
                      px: 1.6,
                      height: '36px',
                      borderRadius: '6px',
                      whiteSpace: 'nowrap',
                      '&:hover': { backgroundColor: '#059669' },
                    }}
                  >
                    Bulk Upload
                  </Button>
                )}

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
                    px: 1.8,
                    height: '36px',
                    borderRadius: '6px',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                    minWidth: 'auto',
                    whiteSpace: 'nowrap',
                    '&:hover': { backgroundColor: '#F8FAFC' },
                  }}
                >
                  Add Product
                </Button>
              </Box>
            </Box>

            {/* Table Container */}
            <TableContainer sx={{ overflowX: 'auto' }}>
              <Table sx={{ width: '100%', minWidth: 840 }} aria-label="product table">
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
                        width: '75px',
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
                    {showCompanyColumn && (
                      <TableCell
                        sx={{
                          py: 1.5,
                          px: { xs: 1.5, sm: 2 },
                          fontSize: '11.5px',
                          fontWeight: 700,
                          color: '#1E293B',
                          letterSpacing: '0.04em',
                          borderBottom: '1px solid #E2E8F0',
                          width: '170px',
                        }}
                      >
                        COMPANY
                      </TableCell>
                    )}
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
                        width: '125px',
                      }}
                    >
                      MEASUREMENT
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
                        width: '125px',
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
                        width: '110px',
                      }}
                    >
                      PKTS/UNIT
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
                        width: '130px',
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
                        width: '90px',
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
                        width: '75px',
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
                        width: '75px',
                      }}
                    >
                      DELETE
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={showCompanyColumn ? 10 : 9} align="center" sx={{ py: 6 }}>
                        <CircularProgress size={32} sx={{ color: '#0B4DB7' }} />
                      </TableCell>
                    </TableRow>
                  ) : filteredProducts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={showCompanyColumn ? 10 : 9} align="center" sx={{ py: 6, color: '#64748B' }}>
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
                        ) : isCompanyProductsView && selectedCompany ? (
                          <Box
                            sx={{
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              gap: 2,
                              py: 2,
                            }}
                          >
                            <Typography sx={{ fontSize: '14.5px', color: '#64748B', fontWeight: 500 }}>
                              No products added for{' '}
                              <Box component="span" sx={{ fontWeight: 700, color: '#475569' }}>
                                {selectedCompany.name}
                              </Box>{' '}
                              yet.
                            </Typography>
                            <Box
                              sx={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 1.5,
                                flexWrap: 'wrap',
                              }}
                            >
                              <Button
                                variant="outlined"
                                onClick={() => setBulkUploadCompany(selectedCompany)}
                                startIcon={<UploadFileOutlinedIcon sx={{ fontSize: 18 }} />}
                                sx={{
                                  borderColor: '#10B981',
                                  color: '#059669',
                                  backgroundColor: '#FFFFFF',
                                  fontSize: '13.5px',
                                  fontWeight: 700,
                                  textTransform: 'none',
                                  px: 2.2,
                                  height: '40px',
                                  borderRadius: '8px',
                                  '&:hover': {
                                    borderColor: '#059669',
                                    backgroundColor: '#ECFDF5',
                                  },
                                }}
                              >
                                Bulk Upload Excel for {selectedCompany.name}
                              </Button>

                              <Button
                                variant="contained"
                                disableElevation
                                onClick={handleOpenAdd}
                                startIcon={<AddRoundedIcon sx={{ fontSize: 18 }} />}
                                sx={{
                                  backgroundColor: '#0B4DB7',
                                  color: '#FFFFFF',
                                  fontSize: '13.5px',
                                  fontWeight: 700,
                                  textTransform: 'none',
                                  px: 2.2,
                                  height: '40px',
                                  borderRadius: '8px',
                                  '&:hover': { backgroundColor: '#083B8D' },
                                }}
                              >
                                Add Product
                              </Button>
                            </Box>
                          </Box>
                        ) : (
                          <Box
                            sx={{
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              gap: 2,
                              py: 2,
                            }}
                          >
                            <Typography sx={{ fontSize: '14.5px', color: '#64748B', fontWeight: 500 }}>
                              No products found. Click "Add Product" to add one.
                            </Typography>
                            <Button
                              variant="contained"
                              disableElevation
                              onClick={handleOpenAdd}
                              startIcon={<AddRoundedIcon sx={{ fontSize: 18 }} />}
                              sx={{
                                backgroundColor: '#0B4DB7',
                                color: '#FFFFFF',
                                fontSize: '13.5px',
                                fontWeight: 700,
                                textTransform: 'none',
                                px: 2.2,
                                height: '40px',
                                borderRadius: '8px',
                                '&:hover': { backgroundColor: '#083B8D' },
                              }}
                            >
                              Add Product
                            </Button>
                          </Box>
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
                          sx={{ '&:hover': { backgroundColor: '#F8FAFC' } }}
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
                            {isCompanyProductsView ? index + 1 : product.slNo || index + 1}
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
                          {showCompanyColumn && (
                            <TableCell
                              sx={{
                                py: 1.6,
                                px: { xs: 1.5, sm: 2 },
                                borderBottom: isLast ? 'none' : '1px solid #EEF2F6',
                              }}
                            >
                              {product.companyName ? (
                                <Chip
                                  label={product.companyName}
                                  size="small"
                                  sx={{
                                    height: '24px',
                                    fontSize: '12px',
                                    fontWeight: 700,
                                    backgroundColor: '#F1F5F9',
                                    color: '#334155',
                                  }}
                                />
                              ) : (
                                <Typography component="span" sx={{ fontSize: '12.5px', color: '#94A3B8' }}>
                                  Unassigned
                                </Typography>
                              )}
                            </TableCell>
                          )}
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
                              fontSize: '13px',
                              fontWeight: 600,
                              color: product.pktUnit ? '#334155' : '#94A3B8',
                              borderBottom: isLast ? 'none' : '1px solid #EEF2F6',
                            }}
                          >
                            {product.pktUnit || '-'}
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
          </>
        )}
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
              Assign a company and enter product details along with measurement unit, HSN code, pkts/unit, amount, and GST %.
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

          {/* Company Selector */}
          <Box sx={{ mb: 2 }}>
            <Typography sx={{ fontSize: '12.5px', fontWeight: 600, color: '#334155', mb: 0.75 }}>
              Company
            </Typography>
            <Autocomplete
              openOnFocus
              size="small"
              options={companies}
              getOptionLabel={(opt) => opt.name || ''}
              isOptionEqualToValue={(a, b) =>
                (a._id && b._id && a._id === b._id) ||
                a.name.trim().toLowerCase() === b.name.trim().toLowerCase()
              }
              value={productCompany}
              onChange={(_e, val) => setProductCompany(val)}
              renderInput={(params) => (
                <TextField
                  {...params}
                  placeholder="Select company..."
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      height: '40px',
                      py: '0 !important',
                      fontSize: '13.5px',
                      fontWeight: 500,
                      borderRadius: '8px',
                      backgroundColor: '#FFFFFF',
                      '& .MuiAutocomplete-input': {
                        py: '0 !important',
                      },
                    },
                  }}
                />
              )}
            />
          </Box>

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

          {/* Extra Section: Measurement, HSN Code, Pkts/Unit, Amount, GST % */}
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

              {/* Pkts/Unit */}
              <Box>
                <Typography sx={{ fontSize: '12.5px', fontWeight: 600, color: '#334155', mb: 0.75 }}>
                  Pkts/Unit
                </Typography>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="e.g. 10"
                  value={productPktUnit}
                  onChange={(e) => setProductPktUnit(e.target.value)}
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

      {/* Bulk Upload Modal */}
      <BulkUploadProductsDialog
        open={Boolean(bulkUploadCompany)}
        company={bulkUploadCompany}
        companies={companies}
        onClose={() => setBulkUploadCompany(null)}
        onUploaded={() => {
          setBulkUploadCompany(null);
          void loadData(false);
        }}
      />
    </Box>
  );
};
