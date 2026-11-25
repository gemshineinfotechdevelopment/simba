import { useState, useEffect, useMemo, useRef, type FC } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  TextField,
  Autocomplete,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
  CircularProgress,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Snackbar,
  Alert,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import RemoveRoundedIcon from '@mui/icons-material/RemoveRounded';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import ModeEditOutlineRoundedIcon from '@mui/icons-material/ModeEditOutlineRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded';
import AccountBalanceWalletRoundedIcon from '@mui/icons-material/AccountBalanceWalletRounded';
import UploadFileRoundedIcon from '@mui/icons-material/UploadFileRounded';
import PictureAsPdfRoundedIcon from '@mui/icons-material/PictureAsPdfRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import {
  CustomersApi,
  CompaniesApi,
  ProductsApi,
  ParticularsApi,
  AccountsApi,
  PerformasApi,
} from '../services/api';
import { BillPrintModal } from './BillPrintModal';
import type { BillPrintData } from './BillPrintTemplate';
import { printBillDirectly, printLedgerStatementDirectly, printParticularsListDirectly, parseDateToTimestamp } from '../utils/printUtils';
import {
  shareBillOnWhatsApp,
  shareLedgerOnWhatsApp,
  shareParticularsListOnWhatsApp,
} from '../utils/whatsappUtils';
import { DateRangePrintModal } from './DateRangePrintModal';
import { DatePickerField } from './DatePickerField';
import { extractSavedMeasurements, mergeMeasurementOptions } from '../utils/measurements';
import { formatChargeDisplay, parseChargeValue } from '../utils/chargeUtils';
import { MeasurementInput } from './MeasurementInput';

export type ParticularSubTab =
  | 'Select Customer'
  | 'Create Particular'
  | 'Account Details'
  | 'Particular Details'
  | 'Add Credit';

const SUB_TABS: ParticularSubTab[] = [
  'Select Customer',
  'Create Particular',
  'Account Details',
  'Particular Details',
  'Add Credit',
];

interface ProductRowItem {
  id: string;
  particular: string;
  quantity: string;
  rate: string;
  pktUnit: string;
  measurement?: string;
  amount: string;
}

interface ParticularsPageProps {
  initialCustomerName?: string;
  initialSubTab?: ParticularSubTab;
}

export const ParticularsPage: FC<ParticularsPageProps> = ({ initialCustomerName, initialSubTab }) => {
  const [activeSubTab, setActiveSubTab] = useState<ParticularSubTab>(() => {
    return (
      initialSubTab ||
      (localStorage.getItem('simba_particular_subtab') as ParticularSubTab) ||
      'Select Customer'
    );
  });

  // Live Dropdown options
  const [customerOptions, setCustomerOptions] = useState<{ id: string; name: string }[]>([]);
  const [companyOptions, setCompanyOptions] = useState<{ id: string; name: string }[]>([]);
  const [productOptions, setProductOptions] = useState<
    { id: string; name: string; rate?: number | null; measurement?: string }[]
  >([]);

  // Persistent Selected Customer for Creation & Filter
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [currentCustomerName, setCurrentCustomerName] = useState<string>(() => {
    return initialCustomerName || '';
  });
  const [filterCustomer, setFilterCustomer] = useState<string>(() => {
    return initialCustomerName || '';
  });

  const [accountCustomerInput, setAccountCustomerInput] = useState<string>(() => {
    return initialCustomerName && initialCustomerName !== 'ALL' ? initialCustomerName : 'All Customers';
  });
  const [particularCustomerInput, setParticularCustomerInput] = useState<string>(() => {
    return initialCustomerName && initialCustomerName !== 'ALL' ? initialCustomerName : 'All Customers';
  });

  useEffect(() => {
    const name = filterCustomer && filterCustomer !== 'ALL'
      ? filterCustomer
      : (currentCustomerName && currentCustomerName !== 'ALL' ? currentCustomerName : 'All Customers');
    setAccountCustomerInput(name);
    setParticularCustomerInput(name);
  }, [filterCustomer, currentCustomerName]);

  // Subtab 2: Create Particular Form State
  const [caseCount, setCaseCount] = useState<string>('0');
  const [company, setCompany] = useState<string>('');
  const [discount, setDiscount] = useState<string>('');
  const [transport, setTransport] = useState<string>('');
  const [packing, setPacking] = useState<string>('');
  const [billNo, setBillNo] = useState<string>('');
  const [tax, setTax] = useState<string>('');
  const [date, setDate] = useState<string>(() => {
    const today = new Date();
    return today.toLocaleDateString('en-GB').replace(/\//g, '-');
  });

  // Product Entry Form State
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [productMeasurement, setProductMeasurement] = useState<string>('');
  const [quantity, setQuantity] = useState<string>('');
  const [rate, setRate] = useState<string>('');
  const [pkt, setPkt] = useState<string>('');
  const [productRows, setProductRows] = useState<ProductRowItem[]>([]);
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [editRowData, setEditRowData] = useState<{
    particular: string;
    measurement: string;
    quantity: string;
    rate: string;
    pktUnit: string;
  }>({ particular: '', measurement: '', quantity: '', rate: '', pktUnit: '' });
  const [createLoading, setCreateLoading] = useState(false);

  // Subtab 3: Account Details State
  const [accountDetails, setAccountDetails] = useState<any[]>([]);
  const [accountLoading, setAccountLoading] = useState(false);

  // Subtab 4: Particular Details State
  const [particularDetails, setParticularDetails] = useState<any[]>([]);
  const [particularLoading, setParticularLoading] = useState(false);

  // Subtab 5: Add Credit Form State
  const [addCreditCustomerName, setAddCreditCustomerName] = useState<string>('');
  const [creditAmount, setCreditAmount] = useState<string>('');
  const [creditPaymentMode, setCreditPaymentMode] = useState<string>('Bank');
  const [creditNotes, setCreditNotes] = useState<string>('Additional customer advance');
  const [creditDate, setCreditDate] = useState<string>(() => {
    const today = new Date();
    return today.toLocaleDateString('en-GB').replace(/\//g, '-');
  });
  const [creditLoading, setCreditLoading] = useState(false);

  // Bill Print Modal State
  const [selectedBillForPrint, setSelectedBillForPrint] = useState<BillPrintData | null>(null);
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [openAccountDateModal, setOpenAccountDateModal] = useState(false);
  const [openParticularDateModal, setOpenParticularDateModal] = useState(false);

  // Edit Particular Modal State
  const [openEditParticularModal, setOpenEditParticularModal] = useState(false);
  const [editingParticularId, setEditingParticularId] = useState<string | null>(null);
  const [editBillForm, setEditBillForm] = useState<{
    billNo: string;
    date: string;
    customerName: string;
    companyName: string;
    transport: string;
    caseCount: string;
    discount: string;
    packing: string;
    tax: string;
    products: Array<{
      id?: string;
      particular: string;
      measurement?: string;
      quantity: string;
      rate: string;
      pktUnit: string;
      amount: string;
    }>;
  }>({
    billNo: '',
    date: '',
    customerName: '',
    companyName: '',
    transport: '',
    caseCount: '0',
    discount: '0',
    packing: '0',
    tax: '0',
    products: [],
  });
  const [editBillLoading, setEditBillLoading] = useState(false);

  // PDF Upload & Preview State (under 1 MB)
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadTargetBillId, setUploadTargetBillId] = useState<string | null>(null);
  const [uploadingBillId, setUploadingBillId] = useState<string | null>(null);
  const [pdfPreviewModal, setPdfPreviewModal] = useState<{
    open: boolean;
    url: string;
    name: string;
    id: string;
    billNo?: string;
  } | null>(null);
  const [pdfToast, setPdfToast] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info';
  }>({
    open: false,
    message: '',
    severity: 'success',
  });

  // Automatically calculate total case count from added product rows
  useEffect(() => {
    if (productRows.length > 0) {
      const totalCases = productRows.reduce((acc, row) => acc + (parseFloat(row.quantity) || 0), 0);
      setCaseCount(String(totalCases));
    } else {
      setCaseCount('0');
    }
  }, [productRows]);

  // Update customer when prop changes
  useEffect(() => {
    if (initialCustomerName) {
      setCurrentCustomerName(initialCustomerName);
      setFilterCustomer(initialCustomerName);
      setAddCreditCustomerName(initialCustomerName);
      const match = customerOptions.find((c) => c.name === initialCustomerName);
      if (match) {
        setSelectedCustomerId(match.id);
      }
    } else {
      setCurrentCustomerName('');
      setFilterCustomer('');
      setAddCreditCustomerName('');
      setSelectedCustomerId('');
    }
  }, [initialCustomerName, customerOptions]);

  // Update subtab when prop changes
  useEffect(() => {
    if (initialSubTab) {
      setActiveSubTab(initialSubTab);
      localStorage.setItem('simba_particular_subtab', initialSubTab);
    }
  }, [initialSubTab]);

  // Persist activeSubTab whenever it changes
  useEffect(() => {
    if (activeSubTab) {
      localStorage.setItem('simba_particular_subtab', activeSubTab);
    }
  }, [activeSubTab]);

  // Load Dropdown Options
  useEffect(() => {
    const loadOptions = async () => {
      try {
        const [custRes, compRes, prodRes] = await Promise.all([
          CustomersApi.getAll(),
          CompaniesApi.getAll(),
          ProductsApi.getAll(),
        ]);

        if (custRes && custRes.length > 0) {
          const mapped = custRes.map((c: any) => ({ id: c._id || c.id, name: c.name }));
          setCustomerOptions(mapped);

          if (currentCustomerName) {
            const existing = mapped.find((c: any) => c.name === currentCustomerName);
            if (existing) {
              setSelectedCustomerId(existing.id);
              setAddCreditCustomerName(existing.name);
              setFilterCustomer(existing.name);
            }
          }
        }

        if (compRes && compRes.length > 0) {
          const mapped = compRes.map((c: any) => ({ id: c._id || c.id, name: c.name }));
          setCompanyOptions(mapped);
        }

        if (prodRes && prodRes.length > 0) {
          const mapped = prodRes.map((p: any) => ({
            id: p._id || p.id,
            name: p.name,
            rate: p.amount ?? p.rate ?? null,
            measurement: p.measurement || '',
          }));
          setProductOptions(mapped);
        }
      } catch (err) {
        console.error('Error loading dropdown options:', err);
      }
    };
    loadOptions();
  }, []);

  // Fetch Accounts
  const fetchAccounts = async (targetCustomer?: string) => {
    try {
      setAccountLoading(true);
      const cust = targetCustomer !== undefined ? targetCustomer : (filterCustomer || currentCustomerName);
      const data = await AccountsApi.getAll(cust && cust !== 'ALL' ? cust : undefined);
      const sorted = (data || []).slice().sort((a: any, b: any) => {
        const timeA = parseDateToTimestamp(a.date) || (a.createdAt ? new Date(a.createdAt).getTime() : 0);
        const timeB = parseDateToTimestamp(b.date) || (b.createdAt ? new Date(b.createdAt).getTime() : 0);
        if (timeB !== timeA) return timeB - timeA;
        const cA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const cB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return cB - cA;
      });
      setAccountDetails(sorted);
    } catch (err) {
      console.error('Failed to load accounts:', err);
    } finally {
      setAccountLoading(false);
    }
  };

  // Fetch Particulars (Loads bills filtered by customer, or all)
  const fetchParticulars = async (targetCustomer?: string) => {
    try {
      setParticularLoading(true);
      const cust = targetCustomer !== undefined ? targetCustomer : (filterCustomer || currentCustomerName);
      const data = await ParticularsApi.getAll(cust && cust !== 'ALL' ? cust : undefined);
      const sorted = (data || []).slice().sort((a: any, b: any) => {
        const timeA = parseDateToTimestamp(a.date) || (a.createdAt ? new Date(a.createdAt).getTime() : 0);
        const timeB = parseDateToTimestamp(b.date) || (b.createdAt ? new Date(b.createdAt).getTime() : 0);
        if (timeB !== timeA) return timeB - timeA;
        const cA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const cB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return cB - cA;
      });
      setParticularDetails(sorted);
    } catch (err) {
      console.error('Failed to load particulars:', err);
    } finally {
      setParticularLoading(false);
    }
  };

  // Memoized date-wise descending sorted records (today's date first, previous dates below)
  const sortedAccountDetails = useMemo(() => {
    return [...accountDetails].sort((a: any, b: any) => {
      const timeA = parseDateToTimestamp(a.date) || (a.createdAt ? new Date(a.createdAt).getTime() : 0);
      const timeB = parseDateToTimestamp(b.date) || (b.createdAt ? new Date(b.createdAt).getTime() : 0);
      if (timeB !== timeA) return timeB - timeA;
      const cA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const cB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return cB - cA;
    });
  }, [accountDetails]);

  const sortedParticularDetails = useMemo(() => {
    return [...particularDetails].sort((a: any, b: any) => {
      const timeA = parseDateToTimestamp(a.date) || (a.createdAt ? new Date(a.createdAt).getTime() : 0);
      const timeB = parseDateToTimestamp(b.date) || (b.createdAt ? new Date(b.createdAt).getTime() : 0);
      if (timeB !== timeA) return timeB - timeA;
      const cA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const cB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return cB - cA;
    });
  }, [particularDetails]);

  useEffect(() => {
    const custToFetch = filterCustomer || currentCustomerName;
    if (activeSubTab === 'Account Details') {
      fetchAccounts(custToFetch);
    } else if (activeSubTab === 'Particular Details') {
      fetchParticulars(custToFetch);
    }
  }, [activeSubTab, filterCustomer, currentCustomerName]);

  // Overall totals
  const overallTotals = useMemo(() => {
    let totalDebit = 0;
    let totalCredit = 0;
    accountDetails.forEach((row) => {
      totalDebit += parseFloat(String(row.debit || '0').replace(/,/g, '')) || 0;
      totalCredit += parseFloat(String(row.credit || '0').replace(/,/g, '')) || 0;
    });
    return {
      totalDebit,
      totalCredit,
      netBalance: totalCredit - totalDebit,
    };
  }, [accountDetails]);

  const handleSelectCustomerClick = () => {
    if (!selectedCustomerId && !currentCustomerName) {
      alert('Please select a customer first');
      return;
    }
    setActiveSubTab('Create Particular');
  };

  const [savedBillMeasurements, setSavedBillMeasurements] = useState<string[]>([]);
  const isProductRowsEmpty = productRows.length === 0;

  useEffect(() => {
    if (!isProductRowsEmpty) return;
    let active = true;
    Promise.all([ParticularsApi.getAll().catch(() => []), PerformasApi.getAll().catch(() => [])])
      .then(([bills, performasRes]) => {
        if (!active) return;
        const performaList = Array.isArray(performasRes) ? performasRes : performasRes?.data || [];
        setSavedBillMeasurements(
          extractSavedMeasurements([...(bills || []), ...performaList])
        );
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [isProductRowsEmpty]);

  const measurementOptions = useMemo(
    () =>
      mergeMeasurementOptions([
        ...productOptions.map((p) => p.measurement),
        ...savedBillMeasurements,
        ...productRows.map((r) => r.measurement),
      ]),
    [productOptions, savedBillMeasurements, productRows]
  );

  // Product Entry keyboard flow & focus management
  const productSearchInputRef = useRef<HTMLInputElement | null>(null);
  const productMenuOpenRef = useRef(false);
  const highlightedProductRef = useRef<{
    id: string;
    name: string;
    rate?: number | null;
    measurement?: string;
  } | null>(null);
  const productHighlightReasonRef = useRef<string | null>(null);
  const productSearchTextRef = useRef('');

  const focusProductSearch = () => {
    requestAnimationFrame(() => {
      productSearchInputRef.current?.focus();
    });
  };

  const resetProductEntryInputs = () => {
    setSelectedProduct('');
    setProductMeasurement('');
    setQuantity('');
    setRate('');
    setPkt('');
    productMenuOpenRef.current = false;
    highlightedProductRef.current = null;
    productHighlightReasonRef.current = null;
    productSearchTextRef.current = '';
  };

  const selectProductOption = (
    val: { id: string; name: string; rate?: number | null; measurement?: string } | null
  ) => {
    setSelectedProduct(val ? val.name : '');
    if (val && val.rate !== undefined && val.rate !== null && Number(val.rate) > 0) {
      setRate(String(val.rate));
    }
    setProductMeasurement(val?.measurement ? String(val.measurement) : '');
    highlightedProductRef.current = null;
    productHighlightReasonRef.current = null;
    productSearchTextRef.current = val ? val.name : '';
  };

  // Subtab 2: Product Line Addition
  const handleAddProductRow = () => {
    if (!selectedProduct || !quantity || !rate) {
      alert('Please select Product, enter Case and Rate');
      return;
    }
    const caseVal = parseFloat(quantity) || 0;
    const piecesPerCase = parseFloat(pkt) || 1;
    const totalPieces = caseVal * piecesPerCase;
    const lineAmt = (totalPieces * (parseFloat(rate) || 0)).toFixed(2);

    const newRow: ProductRowItem = {
      id: Date.now().toString(),
      particular: selectedProduct,
      measurement: productMeasurement.trim(),
      quantity,
      rate,
      pktUnit: pkt ? pkt : '-',
      amount: lineAmt,
    };
    setProductRows((prev) => [...prev, newRow]);
    resetProductEntryInputs();
    focusProductSearch();
  };

  const handleRemoveOrClearProductEntry = () => {
    if (selectedProduct || productMeasurement || quantity || rate || pkt) {
      resetProductEntryInputs();
      focusProductSearch();
      return;
    }
    if (productRows.length > 0) {
      setProductRows((prev) => prev.slice(0, -1));
    }
  };

  // Start editing a product row
  const handleStartEditRow = (row: ProductRowItem) => {
    setEditingRowId(row.id);
    setEditRowData({
      particular: row.particular,
      measurement: row.measurement || '',
      quantity: row.quantity,
      rate: row.rate,
      pktUnit: row.pktUnit === '-' ? '' : row.pktUnit,
    });
  };

  // Save edited product row
  const handleSaveEditRow = (id: string) => {
    if (!editRowData.particular || !editRowData.quantity || !editRowData.rate) {
      alert('Please enter Product, Cases, and Rate');
      return;
    }
    const caseVal = parseFloat(editRowData.quantity) || 0;
    const piecesPerCase = parseFloat(editRowData.pktUnit) || 1;
    const totalPieces = caseVal * (piecesPerCase > 0 ? piecesPerCase : 1);
    const lineAmt = (totalPieces * (parseFloat(editRowData.rate) || 0)).toFixed(2);

    setProductRows((prev) =>
      prev.map((row) =>
        row.id === id
          ? {
              ...row,
              particular: editRowData.particular.trim(),
              measurement: editRowData.measurement.trim(),
              quantity: editRowData.quantity.trim(),
              rate: editRowData.rate.trim(),
              pktUnit: editRowData.pktUnit.trim() !== '' ? editRowData.pktUnit.trim() : '-',
              amount: lineAmt,
            }
          : row
      )
    );
    setEditingRowId(null);
  };

  // Cancel editing product row
  const handleCancelEditRow = () => {
    setEditingRowId(null);
  };

  // Subtotal (Sum of all products)
  const subtotalAmount = useMemo(() => {
    return productRows.reduce((acc, row) => acc + (parseFloat(row.amount) || 0), 0);
  }, [productRows]);

  // Discount Calculation (Supports % like 5% or flat rupees like 500)
  const discountVal = useMemo(() => {
    return parseChargeValue(discount, subtotalAmount).amount;
  }, [discount, subtotalAmount]);

  // Packing Calculation (Calculated from reduced amount after discount)
  const packingVal = useMemo(() => {
    const baseAfterDiscount = Math.max(0, subtotalAmount - discountVal);
    return parseChargeValue(packing, baseAfterDiscount).amount;
  }, [packing, subtotalAmount, discountVal]);

  // Tax Calculation (Supports % like 18% on taxable base or flat ₹ amount)
  const taxBreakdown = useMemo(() => {
    const taxableBase = Math.max(0, subtotalAmount - discountVal + packingVal);
    return parseChargeValue(tax, taxableBase);
  }, [tax, subtotalAmount, discountVal, packingVal]);

  const taxVal = taxBreakdown.amount;

  // Final Net Total Amount
  const finalTotalAmount = useMemo(() => {
    const net = Math.max(0, subtotalAmount - discountVal + packingVal + taxVal);
    return net.toFixed(2);
  }, [subtotalAmount, discountVal, packingVal, taxVal]);

  // Subtab 2: Submit Particular Bill
  const handleCreateParticular = async () => {
    if (!billNo || !billNo.trim()) {
      alert('Please enter a Bill Number');
      return;
    }
    if (!currentCustomerName) {
      alert('Please select a Customer');
      return;
    }
    if (productRows.length === 0) {
      alert('Please add at least one Product Item');
      return;
    }

    try {
      setCreateLoading(true);
      const created = await ParticularsApi.create({
        customerName: currentCustomerName || 'General',
        caseCount: caseCount || '0',
        companyName: company ? company.trim() : '',
        discount: discount || '0',
        transport: transport || '-',
        packing: packing || '0',
        billNo: billNo.trim(),
        tax: tax || '0',
        amount: subtotalAmount.toFixed(2),
        total: finalTotalAmount,
        date: date,
        products: productRows,
      });

      const assignedBillNo = created?.billNo || billNo.trim();
      const createdBillData: BillPrintData = {
        billNo: assignedBillNo,
        customerName: currentCustomerName || 'General',
        companyName: company ? company.trim() : '',
        preparedBy: '',
        phone: '+91 98765 43210',
        email: 'info@simba.com',
        website: 'www.simba.com',
        transport: transport && transport.trim() !== '' && transport !== '-' ? transport.trim() : '-',
        caseCount: caseCount || '0',
        date: date,
        products: productRows.map((p) => ({
          particular: p.particular,
          measurement: p.measurement || '',
          quantity: p.quantity,
          rate: p.rate,
          pktUnit: p.pktUnit,
          amount: p.amount,
        })),
        amount: subtotalAmount.toFixed(2),
        discount: discount || '0',
        packing: packing || '0',
        tax: tax || '0',
        total: finalTotalAmount,
      };

      const successMsg = `Particular bill #${assignedBillNo}${company && company.trim() ? ` for ${company.trim()}` : ''} created successfully!`;
      alert(successMsg);

      setBillNo('');
      setCompany('');
      setSelectedProduct('');
      setProductMeasurement('');
      setProductRows([]);
      setCaseCount('0');
      setDiscount('');
      setTransport('');
      setPacking('');
      setTax('');
      fetchAccounts(filterCustomer);
      fetchParticulars();

      setActiveSubTab('Particular Details');

      // Open the print invoice modal automatically
      setSelectedBillForPrint(createdBillData);
      setPrintModalOpen(true);
    } catch (err) {
      console.error('Failed to create particular:', err);
      alert('Error creating particular bill');
    } finally {
      setCreateLoading(false);
    }
  };

  // Subtab 5: Submit Credit
  const handleAddCreditSubmit = async () => {
    const targetCust = addCreditCustomerName || currentCustomerName || (customerOptions[0]?.name ?? 'General');
    if (!creditAmount || parseFloat(creditAmount) <= 0) {
      alert('Please enter a valid credit amount');
      return;
    }

    try {
      setCreditLoading(true);
      const res = await AccountsApi.addCredit({
        customerName: targetCust,
        creditAmount: creditAmount.trim(),
        date: creditDate,
        paymentMode: creditPaymentMode.trim() || 'Bank',
        reference: '',
        notes: creditNotes.trim(),
      });

      alert(res?.message || 'Credit added successfully!');
      setCreditAmount('');
      setCreditPaymentMode('Bank');
      setCreditNotes('Additional customer payment');
      
      // Refresh all financial states
      fetchAccounts(filterCustomer);
      fetchParticulars();
      setActiveSubTab('Account Details');
    } catch (err: any) {
      console.error('Failed to add credit:', err);
      alert(err?.message || 'Error adding credit');
    } finally {
      setCreditLoading(false);
    }
  };

  // Delete handlers
  const handleDeleteAccountEntry = async (id: string) => {
    if (!window.confirm('Delete this account ledger transaction?')) return;
    try {
      const entryToDelete = accountDetails.find((a) => (a._id || a.id) === id);
      await AccountsApi.delete(id);
      setAccountDetails((prev) => prev.filter((a) => (a._id || a.id) !== id));
      if (entryToDelete) {
        setParticularDetails((prev) =>
          prev.filter((p) => {
            const pId = p._id || p.id;
            if (entryToDelete.particularId && (pId === entryToDelete.particularId || p._id === entryToDelete.particularId)) return false;
            if (entryToDelete.billNo && p.billNo === entryToDelete.billNo) return false;
            return true;
          })
        );
      }
      fetchAccounts(filterCustomer);
      fetchParticulars();
    } catch (err) {
      console.error('Failed to delete account entry:', err);
    }
  };

  const handleDeleteParticular = async (id: string) => {
    if (!window.confirm('Delete this particular bill?')) return;
    try {
      const billToDelete = particularDetails.find((p) => (p._id || p.id) === id);
      await ParticularsApi.delete(id);
      setParticularDetails((prev) => prev.filter((p) => (p._id || p.id) !== id));
      setAccountDetails((prev) =>
        prev.filter((a) => {
          if (a.particularId && (a.particularId === id || (billToDelete && a.particularId === (billToDelete._id || billToDelete.id)))) {
            return false;
          }
          if (billToDelete?.billNo && a.billNo && a.billNo === billToDelete.billNo) {
            return false;
          }
          return true;
        })
      );
      fetchAccounts(filterCustomer);
      fetchParticulars();
    } catch (err) {
      console.error('Failed to delete particular bill:', err);
    }
  };

  const handleOpenBillPrint = (billData: any, autoTrigger = false) => {
    const formattedBill: BillPrintData = {
      billNo: billData.billNo || '',
      date: billData.date || '',
      customerName: billData.customerName || currentCustomerName || '',
      companyName: billData.companyName || company || '',
      preparedBy: billData.preparedBy || '',
      phone: '+91 98765 43210',
      email: 'info@simba.com',
      website: 'www.simba.com',
      transport: billData.transport && billData.transport.trim() !== '' && billData.transport !== '-' ? billData.transport.trim() : '-',
      caseCount: billData.caseCount || billData.cases || (billData.products ? billData.products.reduce((acc: number, p: any) => acc + (parseFloat(p.quantity) || 0), 0) : 0),
      products: (billData.products || []).map((p: any) => ({
        particular: p.particular || p.particularName || p.name || '',
        measurement: p.measurement || '',
        quantity: p.quantity || '',
        rate: p.rate || '',
        pktUnit: p.pktUnit || p.pkt || '',
        amount: p.amount || '',
      })),
      amount: billData.amount || billData.total || '0.00',
      discount: billData.discount !== undefined && billData.discount !== null ? String(billData.discount) : '0',
      packing: billData.packing !== undefined && billData.packing !== null ? String(billData.packing) : '0',
      tax: billData.tax !== undefined && billData.tax !== null ? String(billData.tax) : '0',
      total: billData.total || billData.amount || '0.00',
      pdfData: billData.pdfData || '',
      pdfUrl: billData.pdfUrl || '',
      pdfName: billData.pdfName || '',
    };

    setSelectedBillForPrint(formattedBill);

    if (autoTrigger) {
      printBillDirectly(formattedBill);
    } else {
      setPrintModalOpen(true);
    }
  };

  // WhatsApp Share Handlers
  const handleShareBillWhatsApp = async (billData: any) => {
    try {
      const formattedBill: BillPrintData = {
        billNo: billData.billNo || '',
        customerName: billData.customerName || 'General',
        companyName: billData.companyName || '',
        preparedBy: '',
        phone: billData.phone || '+91 98765 43210',
        email: 'info@simba.com',
        website: 'www.simba.com',
        transport: billData.transport && billData.transport !== '-' ? billData.transport : '-',
        caseCount: billData.caseCount || '0',
        date: billData.date || new Date().toISOString().split('T')[0],
        products: (billData.products || []).map((p: any) => ({
          particular: p.particular || p.particularName || p.name || 'Product',
          quantity: String(p.quantity || '0'),
          rate: String(p.rate || '0'),
          pktUnit: p.pktUnit || p.pkt || '-',
          amount: String(p.amount || '0'),
        })),
        amount: billData.amount || '0.00',
        discount: billData.discount !== undefined && billData.discount !== null ? String(billData.discount) : '0',
        packing: billData.packing !== undefined && billData.packing !== null ? String(billData.packing) : '0',
        tax: billData.tax !== undefined && billData.tax !== null ? String(billData.tax) : '0',
        total: billData.total || billData.amount || '0.00',
      };
      await shareBillOnWhatsApp(formattedBill);
    } catch (err) {
      console.error('Failed to share bill on WhatsApp:', err);
    }
  };

  const handleShareParticularsListWhatsApp = async () => {
    try {
      const cust = filterCustomer || currentCustomerName || 'All Customers';
      await shareParticularsListOnWhatsApp(cust, sortedParticularDetails);
    } catch (err) {
      console.error('Failed to share particulars on WhatsApp:', err);
    }
  };

  const handleShareLedgerWhatsApp = async () => {
    try {
      const cust = filterCustomer || currentCustomerName || 'All Customers';
      await shareLedgerOnWhatsApp(cust, sortedAccountDetails);
    } catch (err) {
      console.error('Failed to share ledger on WhatsApp:', err);
    }
  };

  // Edit Particular Handlers
  const handleOpenEditParticular = (row: any) => {
    const rowId = row._id || row.id || '';
    setEditingParticularId(rowId);
    setEditBillForm({
      billNo: row.billNo || '',
      date: row.date || '',
      customerName: row.customerName || '',
      companyName: row.companyName || '',
      transport: row.transport && row.transport !== '-' ? row.transport : '',
      caseCount: String(row.caseCount || '0'),
      discount: String(row.discount || '0'),
      packing: String(row.packing || '0'),
      tax: String(row.tax || '0'),
      products: (row.products || []).map((p: any, idx: number) => ({
        id: p._id || p.id || `edit-prod-${idx}`,
        particular: p.particular || p.particularName || p.name || '',
        measurement: p.measurement || '',
        quantity: String(p.quantity || '0'),
        rate: String(p.rate || '0'),
        pktUnit: p.pktUnit || p.pkt || '-',
        amount: String(p.amount || '0'),
      })),
    });
    setOpenEditParticularModal(true);
  };

  const handleAddEditProductRow = () => {
    setEditBillForm((prev) => {
      const updated = [
        ...prev.products,
        {
          id: `edit-prod-${Date.now()}`,
          particular: productOptions[0]?.name || '',
          measurement: productOptions[0]?.measurement || '',
          quantity: '1',
          rate: '0',
          pktUnit: '-',
          amount: '0.00',
        },
      ];
      const totalCases = updated.reduce((sum, p) => sum + (parseFloat(p.quantity) || 0), 0);
      return { ...prev, products: updated, caseCount: String(totalCases) };
    });
  };

  const handleUpdateEditProductRow = (index: number, field: string, val: string) => {
    setEditBillForm((prev) => {
      const updated = [...prev.products];
      const row = { ...updated[index], [field]: val };
      if (field === 'quantity' || field === 'rate' || field === 'pktUnit') {
        const q = parseFloat(field === 'quantity' ? val : row.quantity) || 0;
        const r = parseFloat(field === 'rate' ? val : row.rate) || 0;
        const pktStr = (field === 'pktUnit' ? val : row.pktUnit) || '';
        const pNum = parseFloat(pktStr);
        const pieces = !isNaN(pNum) && pNum > 0 ? pNum : 1;
        row.amount = (q * pieces * r).toFixed(2);
      }
      updated[index] = row;
      const totalCases = updated.reduce((sum, p) => sum + (parseFloat(p.quantity) || 0), 0);
      return { ...prev, products: updated, caseCount: String(totalCases) };
    });
  };

  const handleDeleteEditProductRow = (index: number) => {
    setEditBillForm((prev) => {
      const updated = prev.products.filter((_, i) => i !== index);
      const totalCases = updated.reduce((sum, p) => sum + (parseFloat(p.quantity) || 0), 0);
      return { ...prev, products: updated, caseCount: String(totalCases) };
    });
  };

  // Edit Calculation Hooks
  const editSubtotal = useMemo(() => {
    return editBillForm.products.reduce((acc, p) => acc + (parseFloat(p.amount) || 0), 0);
  }, [editBillForm.products]);

  const editDiscountVal = useMemo(() => {
    return parseChargeValue(editBillForm.discount, editSubtotal).amount;
  }, [editSubtotal, editBillForm.discount]);

  const editPackingVal = useMemo(() => {
    const baseAfterDiscount = Math.max(0, editSubtotal - editDiscountVal);
    return parseChargeValue(editBillForm.packing, baseAfterDiscount).amount;
  }, [editSubtotal, editDiscountVal, editBillForm.packing]);

  const editTaxVal = useMemo(() => {
    const taxableBase = Math.max(0, editSubtotal - editDiscountVal + editPackingVal);
    return parseChargeValue(editBillForm.tax, taxableBase).amount;
  }, [editSubtotal, editDiscountVal, editPackingVal, editBillForm.tax]);

  const editFinalTotal = useMemo(() => {
    const net = Math.max(0, editSubtotal - editDiscountVal + editPackingVal + editTaxVal);
    return net.toFixed(2);
  }, [editSubtotal, editDiscountVal, editPackingVal, editTaxVal]);

  const handleSaveEditParticular = async () => {
    if (!editingParticularId) return;
    try {
      setEditBillLoading(true);
      await ParticularsApi.update(editingParticularId, {
        customerName: editBillForm.customerName,
        companyName: editBillForm.companyName,
        date: editBillForm.date,
        transport: editBillForm.transport || '-',
        caseCount: editBillForm.caseCount || '0',
        discount: editBillForm.discount || '0',
        packing: editBillForm.packing || '0',
        tax: editBillForm.tax || '0',
        billNo: editBillForm.billNo,
        amount: editSubtotal.toFixed(2),
        total: editFinalTotal,
        products: editBillForm.products,
      });

      await fetchParticulars();
      await fetchAccounts(filterCustomer);
      setOpenEditParticularModal(false);
      setPdfToast({
        open: true,
        message: `Bill #${editBillForm.billNo} updated successfully!`,
        severity: 'success',
      });
    } catch (err) {
      console.error('Failed to update particular bill:', err);
      alert('Error updating bill details');
    } finally {
      setEditBillLoading(false);
    }
  };

  // Transport Receipt / PDF Upload Handlers (Up to 5 MB)
  const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

  const handleTriggerPdfUpload = (id: string) => {
    setUploadTargetBillId(id);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handlePdfFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const targetId = uploadTargetBillId;
    if (!file || !targetId) return;

    // Reset input so same file can be selected again if needed
    e.target.value = '';

    // 1. Verify file type is Image or PDF
    const isImageOrPdf =
      file.type.startsWith('image/') ||
      file.type === 'application/pdf' ||
      /\.(jpg|jpeg|png|webp|gif|pdf)$/i.test(file.name);
    if (!isImageOrPdf) {
      setPdfToast({
        open: true,
        message: 'Invalid file format. Please upload an Image (JPG, PNG, WEBP) or PDF file.',
        severity: 'error',
      });
      return;
    }

    // 2. Verify file size is under 5 MB
    if (file.size > MAX_FILE_SIZE_BYTES) {
      const sizeInMb = (file.size / (1024 * 1024)).toFixed(2);
      setPdfToast({
        open: true,
        message: `File size (${sizeInMb} MB) exceeds 5 MB limit. Please select a smaller file.`,
        severity: 'error',
      });
      return;
    }

    try {
      setUploadingBillId(targetId);
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64Data = reader.result as string;
          const uploadRes = await ParticularsApi.uploadPdf(targetId, base64Data, file.name);
          const savedData = uploadRes?.data?.pdfData || base64Data;

          // Update local state in particularDetails
          setParticularDetails((prev) =>
            prev.map((p) => {
              const pId = p._id || p.id;
              if (pId === targetId) {
                return { ...p, pdfData: savedData, pdfName: file.name };
              }
              return p;
            })
          );

          setPdfToast({
            open: true,
            message: `Receipt document "${file.name}" uploaded successfully!`,
            severity: 'success',
          });
        } catch (uploadErr) {
          console.error('Failed to save document to server:', uploadErr);
          setPdfToast({
            open: true,
            message: 'Failed to upload receipt. Please try again.',
            severity: 'error',
          });
        } finally {
          setUploadingBillId(null);
        }
      };

      reader.onerror = () => {
        setUploadingBillId(null);
        setPdfToast({
          open: true,
          message: 'Error reading file.',
          severity: 'error',
        });
      };

      reader.readAsDataURL(file);
    } catch (err) {
      console.error('Failed to initiate upload:', err);
      setUploadingBillId(null);
    }
  };

  const handleOpenPdfPreview = (row: any) => {
    const rowId = row._id || row.id || '';
    if (!row.pdfData) {
      handleTriggerPdfUpload(rowId);
      return;
    }

    setPdfPreviewModal({
      open: true,
      url: row.pdfData,
      name: row.pdfName || `Bill-${row.billNo || 'document'}.pdf`,
      id: rowId,
      billNo: row.billNo,
    });
  };

  const handleDeleteAttachedPdf = async (id: string) => {
    if (!window.confirm('Are you sure you want to remove the attached PDF from this bill?')) return;
    try {
      await ParticularsApi.deletePdf(id);
      setParticularDetails((prev) =>
        prev.map((p) => {
          const pId = p._id || p.id;
          if (pId === id) {
            return { ...p, pdfData: '', pdfName: '' };
          }
          return p;
        })
      );
      if (pdfPreviewModal?.id === id) {
        setPdfPreviewModal(null);
      }
      setPdfToast({
        open: true,
        message: 'Attached PDF deleted successfully.',
        severity: 'success',
      });
    } catch (err) {
      console.error('Failed to delete attached PDF:', err);
      setPdfToast({
        open: true,
        message: 'Failed to delete attached PDF.',
        severity: 'error',
      });
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
      {/* Subtabs Bar */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: { xs: 2, sm: 3, md: 4 },
          mb: 2.5,
          flexWrap: 'wrap',
          borderBottom: '1px solid #EEF2F6',
          pb: 0.5,
        }}
      >
        {SUB_TABS.map((tab) => {
          const isActive = activeSubTab === tab;
          return (
            <Box
              key={tab}
              onClick={() => setActiveSubTab(tab)}
              sx={{
                position: 'relative',
                pb: 1.2,
                cursor: 'pointer',
              }}
            >
              <Typography
                sx={{
                  fontSize: '14px',
                  fontWeight: isActive ? 700 : 600,
                  color: isActive ? '#0B4DB7' : '#475569',
                  backgroundColor: isActive && tab === 'Add Credit' ? '#EFF6FF' : 'transparent',
                  px: isActive && tab === 'Add Credit' ? 1.5 : 0.5,
                  py: isActive && tab === 'Add Credit' ? 0.6 : 0,
                  borderRadius: '6px',
                  transition: 'all 0.15s ease',
                  '&:hover': {
                    color: '#0B4DB7',
                  },
                }}
              >
                {tab}
              </Typography>

              {/* Active Tab Underline Bar */}
              {isActive && (
                <Box
                  sx={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: '2.5px',
                    backgroundColor: '#0B4DB7',
                    borderTopLeftRadius: '2px',
                    borderTopRightRadius: '2px',
                  }}
                />
              )}
            </Box>
          );
        })}
      </Box>

      {/* View 1: Select Customer View */}
      {activeSubTab === 'Select Customer' && (
        <Paper
          elevation={0}
          sx={{
            width: '100%',
            backgroundColor: '#FFFFFF',
            borderRadius: '8px',
            border: '1px solid #E2E8F0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            overflow: 'hidden',
          }}
        >
          <Box
            sx={{
              backgroundColor: '#0B4DB7',
              px: { xs: 2, sm: 3 },
              py: 1.6,
              minHeight: '52px',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <Typography
              sx={{
                color: '#FFFFFF',
                fontSize: '16px',
                fontWeight: 700,
                letterSpacing: '-0.01em',
              }}
            >
              Select Customer
            </Typography>
          </Box>

          <Box
            sx={{
              p: { xs: 3, sm: 4, md: 5 },
              pt: { xs: 4, md: 5 },
              pb: { xs: 5, md: 6 },
            }}
          >
            <Box
              sx={{
                display: 'flex',
                flexDirection: { xs: 'column', sm: 'row' },
                alignItems: { xs: 'flex-start', sm: 'center' },
                gap: { xs: 1.5, sm: 4 },
                maxWidth: '800px',
              }}
            >
              <Typography
                sx={{
                  fontSize: '14px',
                  fontWeight: 600,
                  color: '#0F172A',
                  minWidth: '140px',
                }}
              >
                Select Customer
              </Typography>

              <Box sx={{ width: { xs: '100%', sm: '380px', md: '420px' } }}>
                <Autocomplete
                  fullWidth
                  size="small"
                  autoHighlight
                  options={customerOptions}
                  getOptionLabel={(option) => (typeof option === 'string' ? option : option.name || '')}
                  isOptionEqualToValue={(option, val) => option.id === val.id || option.name === val.name}
                  value={customerOptions.find((c) => c.id === selectedCustomerId) || null}
                  onChange={(_, val) => {
                    if (val) {
                      setSelectedCustomerId(val.id);
                      setCurrentCustomerName(val.name);
                      setFilterCustomer(val.name);
                      setAddCreditCustomerName(val.name);
                      localStorage.setItem('simba_active_customer', val.name);
                    } else {
                      setSelectedCustomerId('');
                      setCurrentCustomerName('');
                      setFilterCustomer('');
                      setAddCreditCustomerName('');
                      localStorage.removeItem('simba_active_customer');
                    }
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      placeholder="Type or select customer..."
                      sx={{
                        backgroundColor: '#FFFFFF',
                        borderRadius: '6px',
                        '& .MuiOutlinedInput-root': {
                          height: '40px',
                          borderRadius: '6px',
                          fontSize: '13.5px',
                          fontWeight: 500,
                          '& fieldset': {
                            borderColor: '#CBD5E1',
                          },
                          '&:hover fieldset': {
                            borderColor: '#94A3B8',
                          },
                          '&.Mui-focused fieldset': {
                            borderColor: '#0B4DB7',
                            borderWidth: '1.5px',
                          },
                        },
                      }}
                    />
                  )}
                />

                <Box sx={{ mt: 3 }}>
                  <Button
                    variant="contained"
                    disableElevation
                    onClick={handleSelectCustomerClick}
                    sx={{
                      backgroundColor: '#0B4DB7',
                      color: '#FFFFFF',
                      fontSize: '13.5px',
                      fontWeight: 700,
                      textTransform: 'none',
                      px: 2.6,
                      py: 0.9,
                      borderRadius: '6px',
                      lineHeight: 1.3,
                      '&:hover': {
                        backgroundColor: '#083B8D',
                      },
                    }}
                  >
                    Click to Select
                  </Button>
                </Box>
              </Box>
            </Box>
          </Box>
        </Paper>
      )}

      {/* View 2: Create Particular View */}
      {activeSubTab === 'Create Particular' && (
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', lg: 'row' },
            gap: 2.5,
            width: '100%',
            alignItems: 'flex-start',
          }}
        >
          {/* Left Card: Create Particular Form */}
          <Paper
            elevation={0}
            sx={{
              width: { xs: '100%', lg: '310px', xl: '330px' },
              flexShrink: 0,
              backgroundColor: '#FFFFFF',
              borderRadius: '8px',
              border: '1px solid #E2E8F0',
              overflow: 'hidden',
            }}
          >
            <Box
              sx={{
                background: 'linear-gradient(90deg, #0B4DB7 0%, #0EA5E9 100%)',
                px: 2.2,
                py: 1.4,
                minHeight: '48px',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <Typography
                sx={{
                  color: '#FFFFFF',
                  fontSize: '14px',
                  fontWeight: 700,
                  letterSpacing: '-0.01em',
                }}
              >
                Create Particular - {currentCustomerName || 'Customer'}
              </Typography>
            </Box>

            <Box sx={{ p: 2.2, display: 'flex', flexDirection: 'column', gap: 1.8 }}>
              {/* Date * */}
              <Box>
                <Typography sx={{ fontSize: '12px', fontWeight: 600, color: '#475569', mb: 0.6 }}>
                  Date *
                </Typography>
                <DatePickerField
                  value={date}
                  onChange={setDate}
                  placeholder="dd-mm-yyyy"
                  iconSize={17}
                  inputSx={{ height: '38px', fontSize: '13px', fontWeight: 600 }}
                />
              </Box>

              {/* Customer * */}
              <Box>
                <Typography sx={{ fontSize: '12px', fontWeight: 600, color: '#475569', mb: 0.6 }}>
                  Customer *
                </Typography>
                <Autocomplete
                  fullWidth
                  size="small"
                  autoHighlight
                  options={customerOptions}
                  getOptionLabel={(option) => (typeof option === 'string' ? option : option.name || '')}
                  isOptionEqualToValue={(option, val) => option.id === val.id || option.name === val.name}
                  value={customerOptions.find((c) => c.name === currentCustomerName) || null}
                  onChange={(_, val) => {
                    const name = val ? val.name : '';
                    setCurrentCustomerName(name);
                    localStorage.setItem('simba_active_customer', name);
                    if (val) {
                      setSelectedCustomerId(val.id);
                      setFilterCustomer(val.name);
                      setAddCreditCustomerName(val.name);
                    } else {
                      setSelectedCustomerId('');
                    }
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      placeholder="Search Customer..."
                      sx={{
                        backgroundColor: '#FFFFFF',
                        borderRadius: '6px',
                        '& .MuiOutlinedInput-root': {
                          height: '38px',
                          borderRadius: '6px',
                          fontSize: '13px',
                          fontWeight: 600,
                          color: '#0F172A',
                          '& fieldset': {
                            borderColor: '#CBD5E1',
                          },
                          '&:hover fieldset': {
                            borderColor: '#94A3B8',
                          },
                          '&.Mui-focused fieldset': {
                            borderColor: '#0B4DB7',
                            borderWidth: '1.5px',
                          },
                        },
                      }}
                    />
                  )}
                />
              </Box>

              {/* Bill No * */}
              <Box>
                <Typography sx={{ fontSize: '12px', fontWeight: 600, color: '#475569', mb: 0.6 }}>
                  Bill No *
                </Typography>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="Enter Bill No (e.g. 101)"
                  value={billNo}
                  onChange={(e) => setBillNo(e.target.value)}
                  slotProps={{
                    input: {
                      sx: {
                        fontSize: '13px',
                        fontWeight: 600,
                        height: '38px',
                        backgroundColor: '#FFFFFF',
                        borderRadius: '6px',
                        '& .MuiOutlinedInput-notchedOutline': {
                          borderColor: '#CBD5E1',
                        },
                      },
                    },
                  }}
                />
              </Box>

              {/* Transport Name */}
              <Box>
                <Typography sx={{ fontSize: '12px', fontWeight: 600, color: '#475569', mb: 0.6 }}>
                  Transport Name
                </Typography>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="Enter Transport Name"
                  value={transport}
                  onChange={(e) => setTransport(e.target.value)}
                  slotProps={{
                    input: {
                      sx: {
                        fontSize: '13px',
                        fontWeight: 500,
                        height: '38px',
                        backgroundColor: '#FFFFFF',
                        borderRadius: '6px',
                        '& .MuiOutlinedInput-notchedOutline': {
                          borderColor: '#CBD5E1',
                        },
                      },
                    },
                  }}
                />
              </Box>
            </Box>
          </Paper>

          {/* Right Card: Product Grid & Entry */}
          <Paper
            elevation={0}
            sx={{
              flex: 1,
              width: '100%',
              backgroundColor: '#FFFFFF',
              borderRadius: '8px',
              border: '1px solid #E2E8F0',
              overflow: 'hidden',
            }}
          >
            <Box
              sx={{
                background: 'linear-gradient(90deg, #0B4DB7 0%, #0EA5E9 100%)',
                px: 2.2,
                py: 1.4,
                minHeight: '48px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Typography
                sx={{
                  color: '#FFFFFF',
                  fontSize: '14px',
                  fontWeight: 700,
                  letterSpacing: '-0.01em',
                }}
              >
                Product Entry
              </Typography>
            </Box>

            <Box
              sx={{
                p: 2,
                display: 'flex',
                alignItems: 'center',
                gap: 1.2,
                flexWrap: { xs: 'wrap', md: 'nowrap' },
                borderBottom: '1px solid #E2E8F0',
              }}
            >
              <Autocomplete
                size="small"
                autoHighlight
                sx={{ flex: { xs: '1 1 100%', md: 2.5 }, minWidth: '170px' }}
                options={productOptions}
                getOptionLabel={(option) => (typeof option === 'string' ? option : option.name || '')}
                isOptionEqualToValue={(option, val) => option.id === val.id || option.name === val.name}
                value={productOptions.find((p) => p.name === selectedProduct) || null}
                onOpen={() => {
                  productMenuOpenRef.current = true;
                }}
                onClose={() => {
                  productMenuOpenRef.current = false;
                  highlightedProductRef.current = null;
                  productHighlightReasonRef.current = null;
                }}
                onHighlightChange={(_e, option, reason) => {
                  highlightedProductRef.current = option;
                  productHighlightReasonRef.current = reason;
                }}
                onInputChange={(_e, newInputValue, reason) => {
                  if (reason === 'input' || reason === 'clear') {
                    productSearchTextRef.current = newInputValue;
                  }
                }}
                onChange={(_, val) => {
                  selectProductOption(val);
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    inputRef={productSearchInputRef}
                    placeholder="Search Product..."
                    onKeyDown={(e) => {
                      if (e.key === 'Tab' && !e.shiftKey && productMenuOpenRef.current) {
                        const typedQuery = productSearchTextRef.current.trim().toLowerCase();
                        const shouldAutoPick =
                          (typedQuery.length > 0 && typedQuery !== selectedProduct.toLowerCase()) ||
                          productHighlightReasonRef.current === 'keyboard';
                        if (shouldAutoPick) {
                          const target =
                            highlightedProductRef.current ||
                            productOptions.find((p) => p.name.toLowerCase().startsWith(typedQuery)) ||
                            productOptions.find((p) => p.name.toLowerCase().includes(typedQuery)) ||
                            null;
                          if (target && target.name !== selectedProduct) {
                            selectProductOption(target);
                          }
                        }
                      }
                    }}
                    sx={{
                      backgroundColor: '#FFFFFF',
                      borderRadius: '6px',
                      '& .MuiOutlinedInput-root': {
                        height: '36px',
                        borderRadius: '6px',
                        fontSize: '13px',
                        fontWeight: 500,
                        color: '#0F172A',
                        '& fieldset': {
                          borderColor: '#CBD5E1',
                        },
                        '&:hover fieldset': {
                          borderColor: '#94A3B8',
                        },
                        '&.Mui-focused fieldset': {
                          borderColor: '#0B4DB7',
                          borderWidth: '1.5px',
                        },
                      },
                    }}
                  />
                )}
              />

              {/* Per-Bill Measurement Override (does not alter fixed Product measurement) */}
              <MeasurementInput
                value={productMeasurement}
                onChange={setProductMeasurement}
                options={measurementOptions}
                placeholder="Measurement"
                height="36px"
                borderRadius="6px"
                fontSize="13px"
                sx={{ flex: { xs: '1 1 45%', md: 1.3 }, minWidth: '140px' }}
              />

              <TextField
                size="small"
                placeholder="Case"
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                sx={{
                  flex: { xs: '1 1 45%', md: 1 },
                  '& .MuiOutlinedInput-root': {
                    height: '36px',
                    fontSize: '13px',
                    fontWeight: 500,
                    borderRadius: '6px',
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: '#CBD5E1' },
                  },
                }}
              />

              <TextField
                size="small"
                placeholder="Rate"
                type="number"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                sx={{
                  flex: { xs: '1 1 45%', md: 1 },
                  '& .MuiOutlinedInput-root': {
                    height: '36px',
                    fontSize: '13px',
                    fontWeight: 500,
                    borderRadius: '6px',
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: '#CBD5E1' },
                  },
                }}
              />

              <TextField
                size="small"
                placeholder="Pkt / Units"
                type="number"
                value={pkt}
                onChange={(e) => setPkt(e.target.value)}
                sx={{
                  flex: { xs: '1 1 45%', md: 1 },
                  '& .MuiOutlinedInput-root': {
                    height: '36px',
                    fontSize: '13px',
                    fontWeight: 500,
                    borderRadius: '6px',
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: '#CBD5E1' },
                  },
                }}
              />

              <TextField
                size="small"
                placeholder="Amount"
                value={
                  quantity && rate
                    ? (((parseFloat(quantity) || 0) * (parseFloat(pkt) || 1)) * (parseFloat(rate) || 0)).toFixed(2)
                    : ''
                }
                slotProps={{
                  input: {
                    readOnly: true,
                    sx: {
                      height: '36px',
                      fontSize: '13px',
                      fontWeight: 600,
                      backgroundColor: '#F1F5F9',
                      borderRadius: '6px',
                      '& .MuiOutlinedInput-notchedOutline': { borderColor: '#CBD5E1' },
                    },
                  },
                  htmlInput: {
                    tabIndex: -1,
                  },
                }}
                sx={{ flex: { xs: '1 1 45%', md: 1.2 } }}
              />

              <Tooltip title="Add Product" arrow>
                <Button
                  type="button"
                  variant="contained"
                  disableElevation
                  onClick={handleAddProductRow}
                  sx={{
                    backgroundColor: '#0B4DB7',
                    color: '#FFFFFF',
                    minWidth: '36px',
                    width: '36px',
                    height: '36px',
                    p: 0,
                    borderRadius: '6px',
                    '&:hover': {
                      backgroundColor: '#083B8D',
                    },
                    '&:focus-visible': {
                      outline: '2px solid #0B4DB7',
                      outlineOffset: '2px',
                      backgroundColor: '#083B8D',
                    },
                  }}
                >
                  <AddRoundedIcon sx={{ fontSize: 20 }} />
                </Button>
              </Tooltip>

              <Tooltip title="Clear / Remove Last Item" arrow>
                <Button
                  variant="contained"
                  disableElevation
                  onClick={handleRemoveOrClearProductEntry}
                  sx={{
                    backgroundColor: '#EF4444',
                    color: '#FFFFFF',
                    minWidth: '36px',
                    width: '36px',
                    height: '36px',
                    p: 0,
                    borderRadius: '6px',
                    '&:hover': {
                      backgroundColor: '#DC2626',
                    },
                  }}
                >
                  <RemoveRoundedIcon sx={{ fontSize: 20 }} />
                </Button>
              </Tooltip>
            </Box>

            <TableContainer>
              <Table sx={{ width: '100%', borderCollapse: 'collapse' }} aria-label="particular product table">
                <TableHead>
                  <TableRow sx={{ backgroundColor: '#F8FAFC' }}>
                    <TableCell
                      sx={{
                        py: 1.4,
                        px: 2,
                        fontSize: '11.5px',
                        fontWeight: 700,
                        color: '#1E293B',
                        letterSpacing: '0.04em',
                        textAlign: 'center',
                        borderBottom: '1px solid #E2E8F0',
                        borderRight: '1px solid #E2E8F0',
                        width: '26%',
                      }}
                    >
                      PARTICULAR
                    </TableCell>
                    <TableCell
                      sx={{
                        py: 1.4,
                        px: 1.5,
                        fontSize: '11.5px',
                        fontWeight: 700,
                        color: '#1E293B',
                        letterSpacing: '0.04em',
                        textAlign: 'center',
                        borderBottom: '1px solid #E2E8F0',
                        borderRight: '1px solid #E2E8F0',
                        width: '12%',
                      }}
                    >
                      MEASUREMENT
                    </TableCell>
                    <TableCell
                      sx={{
                        py: 1.4,
                        px: 1.5,
                        fontSize: '11.5px',
                        fontWeight: 700,
                        color: '#1E293B',
                        letterSpacing: '0.04em',
                        textAlign: 'center',
                        borderBottom: '1px solid #E2E8F0',
                        borderRight: '1px solid #E2E8F0',
                        width: '11%',
                      }}
                    >
                      CASE
                    </TableCell>
                    <TableCell
                      sx={{
                        py: 1.4,
                        px: 1.5,
                        fontSize: '11.5px',
                        fontWeight: 700,
                        color: '#1E293B',
                        letterSpacing: '0.04em',
                        textAlign: 'center',
                        borderBottom: '1px solid #E2E8F0',
                        borderRight: '1px solid #E2E8F0',
                        width: '12%',
                      }}
                    >
                      RATE
                    </TableCell>
                    <TableCell
                      sx={{
                        py: 1.4,
                        px: 1.5,
                        fontSize: '11.5px',
                        fontWeight: 700,
                        color: '#1E293B',
                        letterSpacing: '0.04em',
                        textAlign: 'center',
                        borderBottom: '1px solid #E2E8F0',
                        borderRight: '1px solid #E2E8F0',
                        width: '13%',
                      }}
                    >
                      PKT / UNITS
                    </TableCell>
                    <TableCell
                      sx={{
                        py: 1.4,
                        px: 1.5,
                        fontSize: '11.5px',
                        fontWeight: 700,
                        color: '#1E293B',
                        letterSpacing: '0.04em',
                        textAlign: 'center',
                        borderBottom: '1px solid #E2E8F0',
                        borderRight: '1px solid #E2E8F0',
                        width: '13%',
                      }}
                    >
                      AMOUNT
                    </TableCell>
                    <TableCell
                      sx={{
                        py: 1.4,
                        px: 1.5,
                        fontSize: '11.5px',
                        fontWeight: 700,
                        color: '#1E293B',
                        letterSpacing: '0.04em',
                        textAlign: 'center',
                        borderBottom: '1px solid #E2E8F0',
                        width: '13%',
                      }}
                    >
                      ACTION
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {productRows.length > 0 ? (
                    productRows.map((row) => {
                      const isEditing = editingRowId === row.id;
                      const liveAmount = isEditing
                        ? (
                            (parseFloat(editRowData.quantity) || 0) *
                            (parseFloat(editRowData.pktUnit) || 1) *
                            (parseFloat(editRowData.rate) || 0)
                          ).toFixed(2)
                        : row.amount;

                      return (
                        <TableRow
                          key={row.id}
                          sx={{
                            backgroundColor: isEditing ? '#F8FAFC' : 'inherit',
                            '&:hover': {
                              backgroundColor: isEditing ? '#F1F5F9' : '#FAFAFA',
                            },
                          }}
                        >
                          <TableCell
                            sx={{
                              borderBottom: '1px solid #E2E8F0',
                              borderRight: '1px solid #E2E8F0',
                              fontWeight: 600,
                              fontSize: '13px',
                              color: '#0F172A',
                              py: isEditing ? 0.8 : 1.2,
                            }}
                          >
                            {isEditing ? (
                              <Autocomplete
                                freeSolo
                                size="small"
                                options={productOptions.map((p) => p.name)}
                                value={editRowData.particular}
                                onInputChange={(_e, val) =>
                                  setEditRowData((prev) => ({ ...prev, particular: val || '' }))
                                }
                                onChange={(_e, val) =>
                                  setEditRowData((prev) => ({ ...prev, particular: val || '' }))
                                }
                                renderInput={(params) => (
                                  <TextField
                                    {...params}
                                    size="small"
                                    placeholder="Product Name"
                                    autoFocus
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleSaveEditRow(row.id);
                                      } else if (e.key === 'Escape') {
                                        handleCancelEditRow();
                                      }
                                    }}
                                    sx={{
                                      backgroundColor: '#FFFFFF',
                                      '& .MuiInputBase-input': {
                                        fontSize: '12.5px',
                                        fontWeight: 600,
                                        py: 0.5,
                                      },
                                    }}
                                  />
                                )}
                                sx={{ minWidth: '140px' }}
                              />
                            ) : (
                              row.particular
                            )}
                          </TableCell>

                          <TableCell
                            align="center"
                            sx={{
                              borderBottom: '1px solid #E2E8F0',
                              borderRight: '1px solid #E2E8F0',
                              fontWeight: 600,
                              fontSize: '13px',
                              py: isEditing ? 0.8 : 1.2,
                            }}
                          >
                            {isEditing ? (
                              <MeasurementInput
                                value={editRowData.measurement}
                                onChange={(val) =>
                                  setEditRowData((prev) => ({ ...prev, measurement: val }))
                                }
                                options={measurementOptions}
                                placeholder="e.g. drum"
                                height="32px"
                                borderRadius="4px"
                                fontSize="12.5px"
                                sx={{ width: '115px', mx: 'auto' }}
                                onEnterWithClosedMenu={() => handleSaveEditRow(row.id)}
                              />
                            ) : row.measurement ? (
                              <Chip
                                label={row.measurement}
                                size="small"
                                sx={{
                                  height: '22px',
                                  fontSize: '11.5px',
                                  fontWeight: 700,
                                  backgroundColor: '#EFF6FF',
                                  color: '#0B4DB7',
                                  border: '1px solid #DBEAFE',
                                }}
                              />
                            ) : (
                              '-'
                            )}
                          </TableCell>

                          <TableCell
                            align="center"
                            sx={{
                              borderBottom: '1px solid #E2E8F0',
                              borderRight: '1px solid #E2E8F0',
                              fontWeight: 600,
                              fontSize: '13px',
                              py: isEditing ? 0.8 : 1.2,
                            }}
                          >
                            {isEditing ? (
                              <TextField
                                size="small"
                                type="number"
                                value={editRowData.quantity}
                                onChange={(e) =>
                                  setEditRowData((prev) => ({ ...prev, quantity: e.target.value }))
                                }
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleSaveEditRow(row.id);
                                  } else if (e.key === 'Escape') {
                                    handleCancelEditRow();
                                  }
                                }}
                                slotProps={{
                                  input: {
                                    sx: {
                                      fontSize: '13px',
                                      fontWeight: 700,
                                      textAlign: 'center',
                                      backgroundColor: '#FFFFFF',
                                      '& input': { textAlign: 'center', py: 0.5, px: 0.5 },
                                    },
                                  },
                                }}
                                sx={{ width: '80px' }}
                              />
                            ) : (
                              row.quantity
                            )}
                          </TableCell>

                          <TableCell
                            align="center"
                            sx={{
                              borderBottom: '1px solid #E2E8F0',
                              borderRight: '1px solid #E2E8F0',
                              fontWeight: 600,
                              fontSize: '13px',
                              py: isEditing ? 0.8 : 1.2,
                            }}
                          >
                            {isEditing ? (
                              <TextField
                                size="small"
                                type="number"
                                value={editRowData.rate}
                                onChange={(e) =>
                                  setEditRowData((prev) => ({ ...prev, rate: e.target.value }))
                                }
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleSaveEditRow(row.id);
                                  } else if (e.key === 'Escape') {
                                    handleCancelEditRow();
                                  }
                                }}
                                slotProps={{
                                  input: {
                                    sx: {
                                      fontSize: '13px',
                                      fontWeight: 700,
                                      textAlign: 'center',
                                      backgroundColor: '#FFFFFF',
                                      '& input': { textAlign: 'center', py: 0.5, px: 0.5 },
                                    },
                                  },
                                }}
                                sx={{ width: '85px' }}
                              />
                            ) : (
                              row.rate
                            )}
                          </TableCell>

                          <TableCell
                            align="center"
                            sx={{
                              borderBottom: '1px solid #E2E8F0',
                              borderRight: '1px solid #E2E8F0',
                              fontWeight: 600,
                              fontSize: '13px',
                              py: isEditing ? 0.8 : 1.2,
                            }}
                          >
                            {isEditing ? (
                              <TextField
                                size="small"
                                type="number"
                                placeholder="1"
                                value={editRowData.pktUnit}
                                onChange={(e) =>
                                  setEditRowData((prev) => ({ ...prev, pktUnit: e.target.value }))
                                }
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleSaveEditRow(row.id);
                                  } else if (e.key === 'Escape') {
                                    handleCancelEditRow();
                                  }
                                }}
                                slotProps={{
                                  input: {
                                    sx: {
                                      fontSize: '13px',
                                      fontWeight: 700,
                                      textAlign: 'center',
                                      backgroundColor: '#FFFFFF',
                                      '& input': { textAlign: 'center', py: 0.5, px: 0.5 },
                                    },
                                  },
                                }}
                                sx={{ width: '70px' }}
                              />
                            ) : (
                              row.pktUnit
                            )}
                          </TableCell>

                          <TableCell
                            align="center"
                            sx={{
                              borderBottom: '1px solid #E2E8F0',
                              borderRight: '1px solid #E2E8F0',
                              fontWeight: 700,
                              fontSize: '13px',
                              color: isEditing ? '#0B4DB7' : '#0F172A',
                              py: isEditing ? 0.8 : 1.2,
                            }}
                          >
                            ₹{parseFloat(liveAmount || '0').toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </TableCell>

                          <TableCell align="center" sx={{ borderBottom: '1px solid #E2E8F0', py: isEditing ? 0.8 : 1.2 }}>
                            {isEditing ? (
                              <Box sx={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 0.6 }}>
                                <Tooltip title="Save (Enter)" arrow>
                                  <IconButton
                                    size="small"
                                    onClick={() => handleSaveEditRow(row.id)}
                                    sx={{
                                      backgroundColor: '#16A34A',
                                      color: '#FFFFFF',
                                      borderRadius: '5px',
                                      width: '26px',
                                      height: '26px',
                                      p: 0,
                                      '&:hover': { backgroundColor: '#15803D' },
                                    }}
                                  >
                                    <CheckRoundedIcon sx={{ fontSize: 16 }} />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="Cancel (Esc)" arrow>
                                  <IconButton
                                    size="small"
                                    onClick={handleCancelEditRow}
                                    sx={{
                                      backgroundColor: '#F1F5F9',
                                      color: '#64748B',
                                      borderRadius: '5px',
                                      width: '26px',
                                      height: '26px',
                                      p: 0,
                                      '&:hover': { backgroundColor: '#E2E8F0', color: '#0F172A' },
                                    }}
                                  >
                                    <CloseRoundedIcon sx={{ fontSize: 16 }} />
                                  </IconButton>
                                </Tooltip>
                              </Box>
                            ) : (
                              <Box sx={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 0.6 }}>
                                <Tooltip title="Edit Product Item (Cases, Rate, Pkt/Unit)" arrow>
                                  <IconButton
                                    size="small"
                                    onClick={() => handleStartEditRow(row)}
                                    sx={{
                                      backgroundColor: '#EFF6FF',
                                      color: '#0B4DB7',
                                      borderRadius: '5px',
                                      width: '26px',
                                      height: '26px',
                                      p: 0,
                                      '&:hover': { backgroundColor: '#DBEAFE' },
                                    }}
                                  >
                                    <ModeEditOutlineRoundedIcon sx={{ fontSize: 15 }} />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="Delete Item" arrow>
                                  <IconButton
                                    size="small"
                                    onClick={() => setProductRows((prev) => prev.filter((p) => p.id !== row.id))}
                                    sx={{
                                      backgroundColor: '#FEF2F2',
                                      color: '#DC2626',
                                      borderRadius: '5px',
                                      width: '26px',
                                      height: '26px',
                                      p: 0,
                                      '&:hover': { backgroundColor: '#FEE2E2' },
                                    }}
                                  >
                                    <DeleteOutlineRoundedIcon sx={{ fontSize: 15 }} />
                                  </IconButton>
                                </Tooltip>
                              </Box>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <>
                      <TableRow sx={{ height: '65px' }}>
                        <TableCell sx={{ borderBottom: '1px solid #E2E8F0', borderRight: '1px solid #E2E8F0' }} />
                        <TableCell sx={{ borderBottom: '1px solid #E2E8F0', borderRight: '1px solid #E2E8F0' }} />
                        <TableCell sx={{ borderBottom: '1px solid #E2E8F0', borderRight: '1px solid #E2E8F0' }} />
                        <TableCell sx={{ borderBottom: '1px solid #E2E8F0', borderRight: '1px solid #E2E8F0' }} />
                        <TableCell sx={{ borderBottom: '1px solid #E2E8F0', borderRight: '1px solid #E2E8F0' }} />
                        <TableCell sx={{ borderBottom: '1px solid #E2E8F0', borderRight: '1px solid #E2E8F0' }} />
                        <TableCell sx={{ borderBottom: '1px solid #E2E8F0' }} />
                      </TableRow>
                    </>
                  )}
                </TableBody>
              </Table>
            </TableContainer>

            {/* Bottom Summary Footer: Left Pills + Right Totals & Charges Box */}
            <Box
              sx={{
                p: 2.2,
                display: 'flex',
                flexDirection: { xs: 'column', md: 'row' },
                justifyContent: 'space-between',
                alignItems: { xs: 'stretch', md: 'flex-start' },
                gap: 2,
              }}
            >
              {/* Left Summary Pills */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, flexWrap: 'wrap' }}>
                <Chip
                  label={`Total Items: ${productRows.length}`}
                  sx={{
                    height: '30px',
                    fontSize: '12px',
                    fontWeight: 700,
                    color: '#334155',
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #CBD5E1',
                    borderRadius: '16px',
                  }}
                />
                <Chip
                  label={`Total Cases: ${caseCount || '0'} Cases`}
                  sx={{
                    height: '30px',
                    fontSize: '12px',
                    fontWeight: 700,
                    color: '#0B4DB7',
                    backgroundColor: '#EFF6FF',
                    border: '1px solid #BFDBFE',
                    borderRadius: '16px',
                  }}
                />
              </Box>

              {/* Right Totals & Charges Card */}
              <Paper
                elevation={0}
                sx={{
                  width: { xs: '100%', md: '370px' },
                  p: 2,
                  borderRadius: '10px',
                  border: '1px solid #E2E8F0',
                  backgroundColor: '#FFFFFF',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1.3,
                }}
              >
                {/* Subtotal */}
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Typography sx={{ fontSize: '13.5px', fontWeight: 700, color: '#0F172A' }}>
                    Subtotal:
                  </Typography>
                  <Typography sx={{ fontSize: '14px', fontWeight: 800, color: '#0F172A' }}>
                    ₹{subtotalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Typography>
                </Box>

                {/* Discount (% or ₹) */}
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: '125px 1fr auto',
                    alignItems: 'center',
                    gap: 1.2,
                  }}
                >
                  <Typography sx={{ fontSize: '12.5px', fontWeight: 600, color: '#475569' }}>
                    Discount (% or ₹):
                  </Typography>
                  <TextField
                    size="small"
                    placeholder="e.g. 5% or 500"
                    value={discount}
                    onChange={(e) => setDiscount(e.target.value)}
                    slotProps={{
                      input: {
                        sx: {
                          height: '32px',
                          fontSize: '12.5px',
                          fontWeight: 500,
                          borderRadius: '6px',
                          backgroundColor: '#FFFFFF',
                        },
                      },
                    }}
                  />
                  <Typography
                    sx={{
                      fontSize: '13px',
                      fontWeight: 700,
                      color: '#EF4444',
                      minWidth: '64px',
                      textAlign: 'right',
                    }}
                  >
                    ₹{discountVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Typography>
                </Box>

                {/* Packing (% or ₹) */}
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: '125px 1fr auto',
                    alignItems: 'center',
                    gap: 1.2,
                  }}
                >
                  <Typography sx={{ fontSize: '12.5px', fontWeight: 600, color: '#475569' }}>
                    Packing (% or ₹):
                  </Typography>
                  <TextField
                    size="small"
                    placeholder="e.g. 2% or 200"
                    value={packing}
                    onChange={(e) => setPacking(e.target.value)}
                    slotProps={{
                      input: {
                        sx: {
                          height: '32px',
                          fontSize: '12.5px',
                          fontWeight: 500,
                          borderRadius: '6px',
                          backgroundColor: '#FFFFFF',
                        },
                      },
                    }}
                  />
                  <Typography
                    sx={{
                      fontSize: '13px',
                      fontWeight: 700,
                      color: '#2563EB',
                      minWidth: '64px',
                      textAlign: 'right',
                    }}
                  >
                    ₹{packingVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Typography>
                </Box>

                {/* Tax */}
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: '125px 1fr auto',
                    alignItems: 'center',
                    gap: 1.2,
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.7 }}>
                    <Typography sx={{ fontSize: '12.5px', fontWeight: 600, color: '#475569' }}>
                      Tax:
                    </Typography>
                    <Typography sx={{ fontSize: '12px', fontWeight: 700, color: '#16A34A' }}>
                      {taxBreakdown.num > 0
                        ? taxBreakdown.isPercent
                          ? `${taxBreakdown.cleanNum}%`
                          : `₹${taxBreakdown.num.toLocaleString('en-IN')}`
                        : '18%'}
                    </Typography>
                  </Box>
                  <TextField
                    size="small"
                    placeholder="e.g. 18%"
                    value={tax}
                    onChange={(e) => setTax(e.target.value)}
                    slotProps={{
                      input: {
                        sx: {
                          height: '32px',
                          fontSize: '12.5px',
                          fontWeight: 500,
                          borderRadius: '6px',
                          backgroundColor: '#FFFFFF',
                        },
                      },
                    }}
                  />
                  <Typography
                    sx={{
                      fontSize: '13px',
                      fontWeight: 700,
                      color: '#16A34A',
                      minWidth: '64px',
                      textAlign: 'right',
                    }}
                  >
                    ₹{taxVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Typography>
                </Box>

                {/* Net Total */}
                <Box
                  sx={{
                    mt: 0.3,
                    pt: 1.2,
                    borderTop: '1px solid #EEF2F6',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <Typography sx={{ fontSize: '15px', fontWeight: 800, color: '#0F172A' }}>
                    Net Total:
                  </Typography>
                  <Typography sx={{ fontSize: '18px', fontWeight: 800, color: '#0B4DB7' }}>
                    ₹{Number(finalTotalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Typography>
                </Box>

                {/* Submit Button */}
                <Button
                  variant="contained"
                  disableElevation
                  fullWidth
                  onClick={handleCreateParticular}
                  disabled={createLoading}
                  sx={{
                    mt: 0.4,
                    background: 'linear-gradient(90deg, #0B4DB7 0%, #0EA5E9 100%)',
                    color: '#FFFFFF',
                    height: '40px',
                    fontSize: '13.5px',
                    fontWeight: 700,
                    textTransform: 'none',
                    borderRadius: '6px',
                    '&:hover': {
                      background: 'linear-gradient(90deg, #083B8D 0%, #0284C7 100%)',
                    },
                  }}
                >
                  {createLoading ? 'Submitting...' : 'Submit'}
                </Button>
              </Paper>
            </Box>
          </Paper>
        </Box>
      )}

      {/* View 3: Account Details View */}
      {activeSubTab === 'Account Details' && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {/* Top Metric Cards */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
              gap: 2,
            }}
          >
            <Paper
              elevation={0}
              sx={{
                p: 2.2,
                borderRadius: '10px',
                border: '1px solid #E2E8F0',
                backgroundColor: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                gap: 2,
              }}
            >
              <Box
                sx={{
                  width: 44,
                  height: 44,
                  borderRadius: '10px',
                  backgroundColor: '#FEF2F2',
                  color: '#DC2626',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <ReceiptLongRoundedIcon sx={{ fontSize: 24 }} />
              </Box>
              <Box>
                <Typography sx={{ fontSize: '12px', fontWeight: 600, color: '#64748B' }}>
                  Total Purchases (Debit)
                </Typography>
                <Typography sx={{ fontSize: '18px', fontWeight: 800, color: '#DC2626' }}>
                  ₹{overallTotals.totalDebit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </Typography>
              </Box>
            </Paper>

            <Paper
              elevation={0}
              sx={{
                p: 2.2,
                borderRadius: '10px',
                border: '1px solid #E2E8F0',
                backgroundColor: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                gap: 2,
              }}
            >
              <Box
                sx={{
                  width: 44,
                  height: 44,
                  borderRadius: '10px',
                  backgroundColor: '#F0FDF4',
                  color: '#16A34A',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <AccountBalanceWalletRoundedIcon sx={{ fontSize: 24 }} />
              </Box>
              <Box>
                <Typography sx={{ fontSize: '12px', fontWeight: 600, color: '#64748B' }}>
                  Total Paid / Credits
                </Typography>
                <Typography sx={{ fontSize: '18px', fontWeight: 800, color: '#16A34A' }}>
                  ₹{overallTotals.totalCredit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </Typography>
              </Box>
            </Paper>

            <Paper
              elevation={0}
              sx={{
                p: 2.2,
                borderRadius: '10px',
                border: '1px solid #E2E8F0',
                backgroundColor: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                gap: 2,
              }}
            >
              <Box
                sx={{
                  width: 44,
                  height: 44,
                  borderRadius: '10px',
                  backgroundColor: overallTotals.netBalance < 0 ? '#FEF2F2' : '#F0FDF4',
                  color: overallTotals.netBalance < 0 ? '#DC2626' : '#16A34A',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <AccountBalanceWalletRoundedIcon sx={{ fontSize: 24 }} />
              </Box>
              <Box>
                <Typography sx={{ fontSize: '12px', fontWeight: 600, color: '#64748B' }}>
                  Net Outstanding Balance
                </Typography>
                <Typography
                  sx={{
                    fontSize: '18px',
                    fontWeight: 800,
                    color: overallTotals.netBalance < 0 ? '#DC2626' : '#16A34A',
                  }}
                >
                  ₹{overallTotals.netBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </Typography>
              </Box>
            </Paper>
          </Box>

          {/* Account Details Table */}
          <Paper
            elevation={0}
            sx={{
              width: '100%',
              backgroundColor: '#FFFFFF',
              borderRadius: '10px',
              border: '1px solid #E2E8F0',
              overflow: 'hidden',
            }}
          >
            <Box
              sx={{
                backgroundColor: '#0B4DB7',
                px: { xs: 2, sm: 3 },
                py: 1.5,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 1.5,
                minHeight: '52px',
              }}
            >
              <Typography
                sx={{
                  color: '#FFFFFF',
                  fontSize: '15.5px',
                  fontWeight: 700,
                  letterSpacing: '-0.01em',
                }}
              >
                Account Details {filterCustomer && filterCustomer !== 'ALL' ? `- ${filterCustomer}` : (currentCustomerName ? `- ${currentCustomerName}` : '(All Customers)')}
              </Typography>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                <Autocomplete
                  size="small"
                  openOnFocus
                  autoHighlight
                  options={[{ id: 'ALL', name: 'All Customers' }, ...customerOptions]}
                  getOptionLabel={(option) => (typeof option === 'string' ? option : option.name || '')}
                  isOptionEqualToValue={(option, val) => option.name === val.name}
                  value={
                    filterCustomer && filterCustomer !== 'ALL'
                      ? customerOptions.find((c) => c.name === filterCustomer) || { id: filterCustomer, name: filterCustomer }
                      : (currentCustomerName && currentCustomerName !== 'ALL' ? customerOptions.find((c) => c.name === currentCustomerName) || { id: 'ALL', name: 'All Customers' } : { id: 'ALL', name: 'All Customers' })
                  }
                  inputValue={accountCustomerInput}
                  onInputChange={(_, newInputValue, reason) => {
                    if (reason === 'input') {
                      setAccountCustomerInput(newInputValue);
                    } else if (reason === 'reset') {
                      const curName = filterCustomer && filterCustomer !== 'ALL'
                        ? filterCustomer
                        : (currentCustomerName && currentCustomerName !== 'ALL' ? currentCustomerName : 'All Customers');
                      setAccountCustomerInput(newInputValue || curName);
                    } else if (reason === 'clear') {
                      setAccountCustomerInput('');
                    }
                  }}
                  filterOptions={(options, state) => {
                    if (!state.inputValue || state.inputValue === 'All Customers') {
                      return options;
                    }
                    const query = state.inputValue.toLowerCase().trim();
                    return options.filter((o) => {
                      const name = typeof o === 'string' ? o : o.name;
                      return name && name.toLowerCase().includes(query);
                    });
                  }}
                  onChange={(_, val) => {
                    const selectedName = val ? (val.id === 'ALL' ? 'ALL' : val.name) : 'ALL';
                    setFilterCustomer(selectedName);
                    if (val && val.id !== 'ALL') {
                      setCurrentCustomerName(val.name);
                      setSelectedCustomerId(val.id);
                      localStorage.setItem('simba_active_customer', val.name);
                    }
                    fetchAccounts(selectedName);
                  }}
                  sx={{ width: 220 }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      placeholder="Filter Customer..."
                      onClick={() => {
                        if (accountCustomerInput === 'All Customers') {
                          setAccountCustomerInput('');
                        }
                      }}
                      onFocus={(e) => {
                        if (accountCustomerInput === 'All Customers') {
                          setAccountCustomerInput('');
                        } else {
                          (e.target as HTMLInputElement)?.select?.();
                        }
                      }}
                      sx={{
                        backgroundColor: '#FFFFFF',
                        borderRadius: '6px',
                        '& .MuiOutlinedInput-root': {
                          height: '34px',
                          borderRadius: '6px',
                          fontSize: '12.5px',
                          fontWeight: 600,
                          py: 0,
                        },
                      }}
                    />
                  )}
                />
                <Button
                  variant="contained"
                  disableElevation
                  onClick={handleShareLedgerWhatsApp}
                  startIcon={<WhatsAppIcon sx={{ fontSize: '18px !important', color: '#FFFFFF' }} />}
                  sx={{
                    backgroundColor: '#25D366',
                    color: '#FFFFFF',
                    fontSize: '13px',
                    fontWeight: 700,
                    textTransform: 'none',
                    px: 2,
                    py: 0.7,
                    borderRadius: '6px',
                    lineHeight: 1.2,
                    '&:hover': {
                      backgroundColor: '#1EBE5D',
                    },
                  }}
                >
                  Share on WhatsApp
                </Button>
                <Button
                  variant="contained"
                  disableElevation
                  onClick={() => setOpenAccountDateModal(true)}
                  startIcon={<PrintOutlinedIcon sx={{ fontSize: '18px !important', color: '#0F172A' }} />}
                  sx={{
                    backgroundColor: '#FFFFFF',
                    color: '#0F172A',
                    fontSize: '13px',
                    fontWeight: 700,
                    textTransform: 'none',
                    px: 2.2,
                    py: 0.7,
                    borderRadius: '6px',
                    lineHeight: 1.2,
                    '&:hover': {
                      backgroundColor: '#F8FAFC',
                    },
                  }}
                >
                  Click to Print
                </Button>
              </Box>
            </Box>

            <TableContainer>
              <Table sx={{ width: '100%' }} aria-label="account details table">
                <TableHead>
                  <TableRow sx={{ backgroundColor: '#F8FAFC' }}>
                    <TableCell sx={{ py: 1.5, px: { xs: 2, sm: 3 }, fontSize: '11.5px', fontWeight: 700, color: '#1E293B', width: '60px' }}>
                      SL.NO
                    </TableCell>
                    <TableCell sx={{ py: 1.5, px: { xs: 1.5, sm: 2.5 }, fontSize: '11.5px', fontWeight: 700, color: '#1E293B', width: '110px' }}>
                      DATE
                    </TableCell>
                    <TableCell sx={{ py: 1.5, px: { xs: 1.5, sm: 2.5 }, fontSize: '11.5px', fontWeight: 700, color: '#1E293B', width: '140px' }}>
                      CUSTOMER
                    </TableCell>
                    <TableCell sx={{ py: 1.5, px: { xs: 2, sm: 2.5 }, fontSize: '11.5px', fontWeight: 700, color: '#1E293B' }}>
                      COMPANY NAME
                    </TableCell>
                    <TableCell align="center" sx={{ py: 1.5, px: { xs: 1.5, sm: 2 }, fontSize: '11.5px', fontWeight: 700, color: '#1E293B', width: '130px' }}>
                      PAYMENT METHOD
                    </TableCell>
                    <TableCell align="right" sx={{ py: 1.5, px: { xs: 1.5, sm: 2.5 }, fontSize: '11.5px', fontWeight: 700, color: '#1E293B', width: '110px' }}>
                      DEBIT
                    </TableCell>
                    <TableCell align="right" sx={{ py: 1.5, px: { xs: 1.5, sm: 2.5 }, fontSize: '11.5px', fontWeight: 700, color: '#1E293B', width: '110px' }}>
                      CREDIT
                    </TableCell>
                    <TableCell align="right" sx={{ py: 1.5, px: { xs: 1.5, sm: 2.5 }, fontSize: '11.5px', fontWeight: 700, color: '#1E293B', width: '120px' }}>
                      BALANCE
                    </TableCell>
                    <TableCell align="center" sx={{ py: 1.5, px: { xs: 2, sm: 3 }, fontSize: '11.5px', fontWeight: 700, color: '#1E293B', width: '70px' }}>
                      DELETE
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {accountLoading ? (
                    <TableRow>
                      <TableCell colSpan={9} align="center" sx={{ py: 6 }}>
                        <CircularProgress size={32} sx={{ color: '#0B4DB7' }} />
                      </TableCell>
                    </TableRow>
                  ) : sortedAccountDetails.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} align="center" sx={{ py: 6, color: '#64748B' }}>
                        No account details found {filterCustomer && filterCustomer !== 'ALL' ? `for ${filterCustomer}` : ''}.
                      </TableCell>
                    </TableRow>
                  ) : (
                    sortedAccountDetails.map((row: any, index: number) => {
                      const isLast = index === sortedAccountDetails.length - 1;
                      const rowId = row._id || row.id || '';
                      const isCreditEntry =
                        row.type !== 'BILL' ||
                        (parseFloat(String(row.credit || '0').replace(/,/g, '')) || 0) > 0;
                      const paymentLabel =
                        isCreditEntry && row.paymentMode && String(row.paymentMode).trim()
                          ? String(row.paymentMode).trim()
                          : '-';
                      return (
                        <TableRow
                          key={rowId || index}
                          sx={{
                            '&:hover': {
                              backgroundColor: '#F8FAFC',
                            },
                          }}
                        >
                          <TableCell sx={{ py: 1.6, px: { xs: 2, sm: 3 }, fontSize: '13.5px', fontWeight: 600, color: '#1E293B', borderBottom: isLast ? 'none' : '1px solid #EEF2F6' }}>
                            {index + 1}
                          </TableCell>
                          <TableCell sx={{ py: 1.6, px: { xs: 1.5, sm: 2.5 }, fontSize: '13.5px', fontWeight: 500, color: '#475569', borderBottom: isLast ? 'none' : '1px solid #EEF2F6' }}>
                            {row.date}
                          </TableCell>
                          <TableCell sx={{ py: 1.6, px: { xs: 1.5, sm: 2.5 }, fontSize: '13.5px', fontWeight: 700, color: '#0B4DB7', borderBottom: isLast ? 'none' : '1px solid #EEF2F6' }}>
                            {row.customerName}
                          </TableCell>
                          <TableCell sx={{ py: 1.6, px: { xs: 2, sm: 2.5 }, fontSize: '13.5px', fontWeight: 600, color: '#0F172A', borderBottom: isLast ? 'none' : '1px solid #EEF2F6' }}>
                            {row.companyName && row.companyName !== 'General' ? row.companyName : '-'}
                          </TableCell>
                          <TableCell align="center" sx={{ py: 1.6, px: { xs: 1.5, sm: 2 }, fontSize: '12.5px', fontWeight: 600, color: '#334155', borderBottom: isLast ? 'none' : '1px solid #EEF2F6' }}>
                            {paymentLabel !== '-' ? (
                              <Chip
                                label={paymentLabel}
                                size="small"
                                sx={{
                                  height: '22px',
                                  fontSize: '11.5px',
                                  fontWeight: 700,
                                  backgroundColor: '#EFF6FF',
                                  color: '#0B4DB7',
                                }}
                              />
                            ) : (
                              '-'
                            )}
                          </TableCell>
                          <TableCell align="right" sx={{ py: 1.6, px: { xs: 1.5, sm: 2.5 }, fontSize: '13.5px', fontWeight: 500, color: '#DC2626', borderBottom: isLast ? 'none' : '1px solid #EEF2F6' }}>
                            {row.debit}
                          </TableCell>
                          <TableCell align="right" sx={{ py: 1.6, px: { xs: 1.5, sm: 2.5 }, fontSize: '13.5px', fontWeight: 600, color: '#16A34A', borderBottom: isLast ? 'none' : '1px solid #EEF2F6' }}>
                            {row.credit}
                          </TableCell>
                          <TableCell
                            align="right"
                            sx={{
                              py: 1.6,
                              px: { xs: 1.5, sm: 2.5 },
                              fontSize: '13.5px',
                              fontWeight: 700,
                              color: String(row.balance).startsWith('-') ? '#DC2626' : '#16A34A',
                              borderBottom: isLast ? 'none' : '1px solid #EEF2F6',
                            }}
                          >
                            {row.balance}
                          </TableCell>
                          <TableCell align="center" sx={{ py: 1.6, px: { xs: 2, sm: 3 }, borderBottom: isLast ? 'none' : '1px solid #EEF2F6' }}>
                            <Tooltip title="Delete Record" arrow>
                              <IconButton
                                size="small"
                                onClick={() => handleDeleteAccountEntry(rowId)}
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
        </Box>
      )}

      {/* View 4: Particular Details View */}
      {activeSubTab === 'Particular Details' && (
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
          <Box
            sx={{
              backgroundColor: '#0B4DB7',
              px: { xs: 2, sm: 3 },
              py: 1.5,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 1.5,
              minHeight: '52px',
            }}
          >
            <Typography
              sx={{
                color: '#FFFFFF',
                fontSize: '16px',
                fontWeight: 700,
                letterSpacing: '-0.01em',
              }}
            >
              Particular Details {filterCustomer && filterCustomer !== 'ALL' ? `- ${filterCustomer}` : (currentCustomerName ? `- ${currentCustomerName}` : '(All Bills)')}
            </Typography>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
              <Autocomplete
                size="small"
                openOnFocus
                autoHighlight
                options={[{ id: 'ALL', name: 'All Customers' }, ...customerOptions]}
                getOptionLabel={(option) => (typeof option === 'string' ? option : option.name || '')}
                isOptionEqualToValue={(option, val) => option.name === val.name}
                value={
                  filterCustomer && filterCustomer !== 'ALL'
                    ? customerOptions.find((c) => c.name === filterCustomer) || { id: filterCustomer, name: filterCustomer }
                    : (currentCustomerName && currentCustomerName !== 'ALL' ? customerOptions.find((c) => c.name === currentCustomerName) || { id: 'ALL', name: 'All Customers' } : { id: 'ALL', name: 'All Customers' })
                }
                inputValue={particularCustomerInput}
                onInputChange={(_, newInputValue, reason) => {
                  if (reason === 'input') {
                    setParticularCustomerInput(newInputValue);
                  } else if (reason === 'reset') {
                    const curName = filterCustomer && filterCustomer !== 'ALL'
                      ? filterCustomer
                      : (currentCustomerName && currentCustomerName !== 'ALL' ? currentCustomerName : 'All Customers');
                    setParticularCustomerInput(newInputValue || curName);
                  } else if (reason === 'clear') {
                    setParticularCustomerInput('');
                  }
                }}
                filterOptions={(options, state) => {
                  if (!state.inputValue || state.inputValue === 'All Customers') {
                    return options;
                  }
                  const query = state.inputValue.toLowerCase().trim();
                  return options.filter((o) => {
                    const name = typeof o === 'string' ? o : o.name;
                    return name && name.toLowerCase().includes(query);
                  });
                }}
                onChange={(_, val) => {
                  const selectedName = val ? (val.id === 'ALL' ? 'ALL' : val.name) : 'ALL';
                  setFilterCustomer(selectedName);
                  if (val && val.id !== 'ALL') {
                    setCurrentCustomerName(val.name);
                    setSelectedCustomerId(val.id);
                    localStorage.setItem('simba_active_customer', val.name);
                  }
                  fetchParticulars(selectedName);
                }}
                sx={{ width: 220 }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    placeholder="Filter Customer..."
                    onClick={() => {
                      if (particularCustomerInput === 'All Customers') {
                        setParticularCustomerInput('');
                      }
                    }}
                    onFocus={(e) => {
                      if (particularCustomerInput === 'All Customers') {
                        setParticularCustomerInput('');
                      } else {
                        (e.target as HTMLInputElement)?.select?.();
                      }
                    }}
                    sx={{
                      backgroundColor: '#FFFFFF',
                      borderRadius: '6px',
                      '& .MuiOutlinedInput-root': {
                        height: '34px',
                        borderRadius: '6px',
                        fontSize: '12.5px',
                        fontWeight: 600,
                        py: 0,
                      },
                    }}
                  />
                )}
              />
              <Chip
                label={`${sortedParticularDetails.length} Bills`}
                size="small"
                sx={{
                  backgroundColor: 'rgba(255,255,255,0.2)',
                  color: '#FFFFFF',
                  fontWeight: 700,
                  fontSize: '12px',
                }}
              />
              <Button
                variant="contained"
                disableElevation
                onClick={handleShareParticularsListWhatsApp}
                startIcon={<WhatsAppIcon sx={{ fontSize: '18px !important', color: '#FFFFFF' }} />}
                sx={{
                  backgroundColor: '#25D366',
                  color: '#FFFFFF',
                  fontSize: '13px',
                  fontWeight: 700,
                  textTransform: 'none',
                  px: 2,
                  py: 0.6,
                  borderRadius: '6px',
                  '&:hover': {
                    backgroundColor: '#1EBE5D',
                  },
                }}
              >
                Share on WhatsApp
              </Button>
              <Button
                variant="contained"
                disableElevation
                onClick={() => setOpenParticularDateModal(true)}
                startIcon={<PrintOutlinedIcon sx={{ fontSize: '18px !important', color: '#0F172A' }} />}
                sx={{
                  backgroundColor: '#FFFFFF',
                  color: '#0F172A',
                  fontSize: '13px',
                  fontWeight: 700,
                  textTransform: 'none',
                  px: 2,
                  py: 0.6,
                  borderRadius: '6px',
                  '&:hover': {
                    backgroundColor: '#F8FAFC',
                  },
                }}
              >
                Print Bills List
              </Button>
            </Box>
          </Box>

          <TableContainer>
            <Table sx={{ width: '100%', borderCollapse: 'collapse' }} aria-label="particular details table">
              <TableHead>
                <TableRow sx={{ backgroundColor: '#F8FAFC' }}>
                  <TableCell align="center" sx={{ py: 1.4, px: 1.5, fontSize: '11.5px', fontWeight: 700, color: '#1E293B', letterSpacing: '0.04em', borderBottom: '1px solid #E2E8F0', borderRight: '1px solid #E2E8F0', width: '80px' }}>
                    BILL.NO
                  </TableCell>
                  <TableCell align="center" sx={{ py: 1.4, px: 1.5, fontSize: '11.5px', fontWeight: 700, color: '#1E293B', letterSpacing: '0.04em', borderBottom: '1px solid #E2E8F0', borderRight: '1px solid #E2E8F0', width: '130px' }}>
                    CUSTOMER
                  </TableCell>
                  <TableCell align="center" sx={{ py: 1.4, px: 1.5, fontSize: '11.5px', fontWeight: 700, color: '#1E293B', letterSpacing: '0.04em', borderBottom: '1px solid #E2E8F0', borderRight: '1px solid #E2E8F0', width: '140px' }}>
                    COMPANY NAME
                  </TableCell>
                  <TableCell align="center" sx={{ py: 1.4, px: 1.5, fontSize: '11.5px', fontWeight: 700, color: '#1E293B', letterSpacing: '0.04em', borderBottom: '1px solid #E2E8F0', borderRight: '1px solid #E2E8F0', width: '95px' }}>
                    DATE
                  </TableCell>
                  <TableCell align="right" sx={{ py: 1.4, px: 1.5, fontSize: '11.5px', fontWeight: 700, color: '#1E293B', letterSpacing: '0.04em', borderBottom: '1px solid #E2E8F0', borderRight: '1px solid #E2E8F0', width: '100px' }}>
                    SUBTOTAL
                  </TableCell>
                  <TableCell align="center" sx={{ py: 1.4, px: 1, fontSize: '11.5px', fontWeight: 700, color: '#1E293B', letterSpacing: '0.04em', borderBottom: '1px solid #E2E8F0', borderRight: '1px solid #E2E8F0', width: '80px' }}>
                    DISCOUNT
                  </TableCell>
                  <TableCell align="center" sx={{ py: 1.4, px: 1, fontSize: '11.5px', fontWeight: 700, color: '#1E293B', letterSpacing: '0.04em', borderBottom: '1px solid #E2E8F0', borderRight: '1px solid #E2E8F0', width: '80px' }}>
                    PACKING
                  </TableCell>
                  <TableCell align="center" sx={{ py: 1.4, px: 1, fontSize: '11.5px', fontWeight: 700, color: '#1E293B', letterSpacing: '0.04em', borderBottom: '1px solid #E2E8F0', borderRight: '1px solid #E2E8F0', width: '75px' }}>
                    TAX
                  </TableCell>
                  <TableCell align="right" sx={{ py: 1.4, px: 1.5, fontSize: '11.5px', fontWeight: 700, color: '#1E293B', letterSpacing: '0.04em', borderBottom: '1px solid #E2E8F0', borderRight: '1px solid #E2E8F0', width: '110px' }}>
                    NET TOTAL
                  </TableCell>
                  <TableCell align="center" sx={{ py: 1.4, px: 1.5, fontSize: '11.5px', fontWeight: 700, color: '#1E293B', letterSpacing: '0.04em', borderBottom: '1px solid #E2E8F0', borderRight: '1px solid #E2E8F0', width: '120px' }}>
                    TRANSPORT
                  </TableCell>
                  <TableCell align="center" sx={{ py: 1.4, px: 1.5, fontSize: '11.5px', fontWeight: 700, color: '#1E293B', letterSpacing: '0.04em', borderBottom: '1px solid #E2E8F0', width: '175px' }}>
                    ACTION
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {particularLoading ? (
                  <TableRow>
                    <TableCell colSpan={11} align="center" sx={{ py: 6 }}>
                      <CircularProgress size={32} sx={{ color: '#0B4DB7' }} />
                    </TableCell>
                  </TableRow>
                ) : sortedParticularDetails.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} align="center" sx={{ py: 6, color: '#64748B' }}>
                      No particular bills found {filterCustomer !== 'ALL' ? `for ${filterCustomer}` : ''}.
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedParticularDetails.map((row, index) => {
                    const isLast = index === sortedParticularDetails.length - 1;
                    const rowId = row._id || row.id || '';
                    const subtotalNum = parseFloat(String(row.amount || row.total || '0').replace(/,/g, '')) || 0;
                    const totalNum = parseFloat(String(row.total || row.amount || '0').replace(/,/g, '')) || 0;
                    const discStr = formatChargeDisplay(row.discount);
                    const packStr = formatChargeDisplay(row.packing);
                    const taxStr = formatChargeDisplay(row.tax);
                    const hasPdf = Boolean(row.pdfData && row.pdfData.trim() !== '');
                    const isUploading = uploadingBillId === rowId;

                    return (
                      <TableRow
                        key={rowId || index}
                        sx={{
                          '&:hover': {
                            backgroundColor: '#F8FAFC',
                          },
                        }}
                      >
                        <TableCell align="center" sx={{ py: 1.4, px: 1.5, fontSize: '13px', fontWeight: 700, color: '#0F172A', borderBottom: isLast ? 'none' : '1px solid #EEF2F6', borderRight: '1px solid #EEF2F6' }}>
                          {row.billNo}
                        </TableCell>
                        <TableCell align="center" sx={{ py: 1.4, px: 1.5, fontSize: '13px', fontWeight: 700, color: '#0B4DB7', borderBottom: isLast ? 'none' : '1px solid #EEF2F6', borderRight: '1px solid #EEF2F6' }}>
                          {row.customerName}
                        </TableCell>
                        <TableCell align="center" sx={{ py: 1.4, px: 1.5, fontSize: '13px', fontWeight: 600, color: '#0F172A', borderBottom: isLast ? 'none' : '1px solid #EEF2F6', borderRight: '1px solid #EEF2F6' }}>
                          {row.companyName && row.companyName !== 'General' ? row.companyName : '-'}
                        </TableCell>
                        <TableCell align="center" sx={{ py: 1.4, px: 1.5, fontSize: '12.5px', fontWeight: 500, color: '#475569', borderBottom: isLast ? 'none' : '1px solid #EEF2F6', borderRight: '1px solid #EEF2F6' }}>
                          {row.date}
                        </TableCell>
                        <TableCell align="right" sx={{ py: 1.4, px: 1.5, fontSize: '13px', fontWeight: 600, color: '#475569', borderBottom: isLast ? 'none' : '1px solid #EEF2F6', borderRight: '1px solid #EEF2F6' }}>
                          ₹{subtotalNum.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell align="center" sx={{ py: 1.4, px: 1, fontSize: '12.5px', fontWeight: 600, color: discStr !== '-' ? '#DC2626' : '#94A3B8', borderBottom: isLast ? 'none' : '1px solid #EEF2F6', borderRight: '1px solid #EEF2F6' }}>
                          {discStr}
                        </TableCell>
                        <TableCell align="center" sx={{ py: 1.4, px: 1, fontSize: '12.5px', fontWeight: 600, color: packStr !== '-' ? '#0F172A' : '#94A3B8', borderBottom: isLast ? 'none' : '1px solid #EEF2F6', borderRight: '1px solid #EEF2F6' }}>
                          {packStr}
                        </TableCell>
                        <TableCell align="center" sx={{ py: 1.4, px: 1, fontSize: '12.5px', fontWeight: 600, color: taxStr !== '-' ? '#0F172A' : '#94A3B8', borderBottom: isLast ? 'none' : '1px solid #EEF2F6', borderRight: '1px solid #EEF2F6' }}>
                          {taxStr}
                        </TableCell>
                        <TableCell align="right" sx={{ py: 1.4, px: 1.5, fontSize: '13.5px', fontWeight: 800, color: '#0F172A', borderBottom: isLast ? 'none' : '1px solid #EEF2F6', borderRight: '1px solid #EEF2F6' }}>
                          ₹{totalNum.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell align="center" sx={{ py: 1.4, px: 1.5, fontSize: '12.5px', fontWeight: 500, color: '#334155', borderBottom: isLast ? 'none' : '1px solid #EEF2F6', borderRight: '1px solid #EEF2F6' }}>
                          {row.transport || row.transportName || '-'}
                        </TableCell>
                        <TableCell align="center" sx={{ py: 1.4, px: 1.5, borderBottom: isLast ? 'none' : '1px solid #EEF2F6' }}>
                          <Box sx={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 0.6 }}>
                            <Tooltip title="Share on WhatsApp" arrow>
                              <IconButton
                                size="small"
                                onClick={() => handleShareBillWhatsApp(row)}
                                sx={{
                                  backgroundColor: '#25D366',
                                  color: '#FFFFFF',
                                  borderRadius: '4px',
                                  width: '24px',
                                  height: '22px',
                                  p: 0,
                                  '&:hover': { backgroundColor: '#1EBE5D' },
                                }}
                              >
                                <WhatsAppIcon sx={{ fontSize: 14 }} />
                              </IconButton>
                            </Tooltip>

                            <Tooltip title="View" arrow>
                              <IconButton
                                size="small"
                                onClick={() => handleOpenBillPrint(row, false)}
                                sx={{
                                  backgroundColor: '#0B4DB7',
                                  color: '#FFFFFF',
                                  borderRadius: '4px',
                                  width: '24px',
                                  height: '22px',
                                  p: 0,
                                  '&:hover': { backgroundColor: '#083B8D' },
                                }}
                              >
                                <VisibilityRoundedIcon sx={{ fontSize: 14 }} />
                              </IconButton>
                            </Tooltip>

                            <Tooltip title="Print" arrow>
                              <IconButton
                                size="small"
                                onClick={() => handleOpenBillPrint(row, true)}
                                sx={{
                                  backgroundColor: '#334155',
                                  color: '#FFFFFF',
                                  borderRadius: '4px',
                                  width: '24px',
                                  height: '22px',
                                  p: 0,
                                  '&:hover': { backgroundColor: '#1E293B' },
                                }}
                              >
                                <PrintOutlinedIcon sx={{ fontSize: 14 }} />
                              </IconButton>
                            </Tooltip>

                            {/* Edit Particular Bill Button */}
                            <Tooltip title="Edit Bill Details" arrow>
                              <IconButton
                                size="small"
                                onClick={() => handleOpenEditParticular(row)}
                                sx={{
                                  backgroundColor: '#0284C7',
                                  color: '#FFFFFF',
                                  borderRadius: '4px',
                                  width: '24px',
                                  height: '22px',
                                  p: 0,
                                  '&:hover': { backgroundColor: '#0369A1' },
                                }}
                              >
                                <ModeEditOutlineRoundedIcon sx={{ fontSize: 14 }} />
                              </IconButton>
                            </Tooltip>

                            {/* PDF Upload / View Button (Under 1 MB) */}
                            <Tooltip
                              title={
                                hasPdf
                                  ? `View PDF (${row.pdfName || 'Attached Document'})`
                                  : 'Upload PDF (Under 1 MB)'
                              }
                              arrow
                            >
                              <IconButton
                                size="small"
                                onClick={() => (hasPdf ? handleOpenPdfPreview(row) : handleTriggerPdfUpload(rowId))}
                                disabled={isUploading}
                                sx={{
                                  backgroundColor: hasPdf ? '#16A34A' : '#6366F1',
                                  color: '#FFFFFF',
                                  borderRadius: '4px',
                                  width: '24px',
                                  height: '22px',
                                  p: 0,
                                  '&:hover': { backgroundColor: hasPdf ? '#15803D' : '#4F46E5' },
                                  '&.Mui-disabled': { backgroundColor: '#CBD5E1', color: '#FFFFFF' },
                                }}
                              >
                                {isUploading ? (
                                  <CircularProgress size={12} sx={{ color: '#FFFFFF' }} />
                                ) : hasPdf ? (
                                  <PictureAsPdfRoundedIcon sx={{ fontSize: 14 }} />
                                ) : (
                                  <UploadFileRoundedIcon sx={{ fontSize: 14 }} />
                                )}
                              </IconButton>
                            </Tooltip>

                            <Tooltip title="Delete" arrow>
                              <IconButton
                                size="small"
                                onClick={() => handleDeleteParticular(rowId)}
                                sx={{
                                  backgroundColor: '#DC2626',
                                  color: '#FFFFFF',
                                  borderRadius: '4px',
                                  width: '24px',
                                  height: '22px',
                                  p: 0,
                                  '&:hover': { backgroundColor: '#B91C1C' },
                                }}
                              >
                                <DeleteOutlineRoundedIcon sx={{ fontSize: 14 }} />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {/* View 5: Add Credit View */}
      {activeSubTab === 'Add Credit' && (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            width: '100%',
            py: { xs: 2, sm: 4, md: 5 },
          }}
        >
          <Paper
            elevation={0}
            sx={{
              width: '100%',
              maxWidth: { xs: '100%', sm: '680px', md: '780px', lg: '840px' },
              backgroundColor: '#FFFFFF',
              borderRadius: '8px',
              border: '1px solid #E2E8F0',
              boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
              overflow: 'hidden',
            }}
          >
            <Box
              sx={{
                backgroundColor: '#0B4DB7',
                px: { xs: 2.5, sm: 3.5 },
                py: 2,
                minHeight: '52px',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <Typography
                sx={{
                  color: '#FFFFFF',
                  fontSize: '16px',
                  fontWeight: 700,
                  letterSpacing: '-0.01em',
                }}
              >
                Add Credit - {currentCustomerName || 'Customer'}
              </Typography>
            </Box>

            <Box
              sx={{
                p: { xs: 3, sm: 5, md: 6 },
                pb: { xs: 4, sm: 6, md: 7 },
                display: 'flex',
                flexDirection: 'column',
                gap: 3,
              }}
            >
              {/* Customer Name */}
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: { xs: 'column', sm: 'row' },
                  alignItems: { xs: 'flex-start', sm: 'center' },
                  gap: { xs: 1, sm: 3.5 },
                }}
              >
                <Typography
                  sx={{
                    fontSize: '14px',
                    fontWeight: 600,
                    color: '#0F172A',
                    minWidth: '150px',
                    textAlign: { sm: 'right' },
                  }}
                >
                  Customer Name
                </Typography>
                <Autocomplete
                  fullWidth
                  size="small"
                  autoHighlight
                  options={customerOptions}
                  getOptionLabel={(option) => (typeof option === 'string' ? option : option.name || '')}
                  isOptionEqualToValue={(option, val) => option.id === val.id || option.name === val.name}
                  value={customerOptions.find((c) => c.name === (addCreditCustomerName || currentCustomerName)) || null}
                  onChange={(_, val) => setAddCreditCustomerName(val ? val.name : '')}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      placeholder="Search Customer..."
                      sx={{
                        backgroundColor: '#FFFFFF',
                        borderRadius: '6px',
                        '& .MuiOutlinedInput-root': {
                          height: '42px',
                          borderRadius: '6px',
                          fontSize: '13.5px',
                          fontWeight: 600,
                          color: '#0F172A',
                          '& fieldset': {
                            borderColor: '#CBD5E1',
                          },
                          '&:hover fieldset': {
                            borderColor: '#94A3B8',
                          },
                          '&.Mui-focused fieldset': {
                            borderColor: '#0B4DB7',
                            borderWidth: '1.5px',
                          },
                        },
                      }}
                    />
                  )}
                />
              </Box>

              {/* Credit Amount */}
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: { xs: 'column', sm: 'row' },
                  alignItems: { xs: 'flex-start', sm: 'center' },
                  gap: { xs: 1, sm: 3.5 },
                }}
              >
                <Typography
                  sx={{
                    fontSize: '14px',
                    fontWeight: 600,
                    color: '#0F172A',
                    minWidth: '150px',
                    textAlign: { sm: 'right' },
                  }}
                >
                  Credit Amount
                </Typography>
                <TextField
                  fullWidth
                  size="small"
                  type="number"
                  placeholder="e.g. 1000000"
                  value={creditAmount}
                  onChange={(e) => setCreditAmount(e.target.value)}
                  slotProps={{
                    input: {
                      sx: {
                        fontSize: '13.5px',
                        fontWeight: 600,
                        height: '42px',
                        backgroundColor: '#FFFFFF',
                        borderRadius: '6px',
                        '& .MuiOutlinedInput-notchedOutline': {
                          borderColor: '#CBD5E1',
                        },
                        '&:hover .MuiOutlinedInput-notchedOutline': {
                          borderColor: '#94A3B8',
                        },
                      },
                    },
                  }}
                />
              </Box>

              {/* Payment Method */}
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: { xs: 'column', sm: 'row' },
                  alignItems: { xs: 'flex-start', sm: 'center' },
                  gap: { xs: 1, sm: 3.5 },
                }}
              >
                <Typography
                  sx={{
                    fontSize: '14px',
                    fontWeight: 600,
                    color: '#0F172A',
                    minWidth: '150px',
                    textAlign: { sm: 'right' },
                  }}
                >
                  Payment Method
                </Typography>
                <Autocomplete
                  fullWidth
                  freeSolo
                  openOnFocus
                  disableClearable
                  size="small"
                  autoHighlight
                  options={['Cash', 'Bank', 'UPI', 'Bank Transfer', 'Cheque', 'NEFT / RTGS']}
                  value={creditPaymentMode}
                  inputValue={creditPaymentMode}
                  filterOptions={(opts, state) => {
                    const q = state.inputValue.trim().toLowerCase();
                    if (!q || opts.some((o) => o.toLowerCase() === q)) return opts;
                    return opts.filter((o) => o.toLowerCase().includes(q));
                  }}
                  onChange={(_, val) => setCreditPaymentMode(typeof val === 'string' ? val : 'Bank')}
                  onInputChange={(_, newInputValue, reason) => {
                    if (reason === 'input') {
                      setCreditPaymentMode(newInputValue);
                    }
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      placeholder="Select or type payment method (e.g. Cash, UPI, Bank)"
                      sx={{
                        backgroundColor: '#FFFFFF',
                        borderRadius: '6px',
                        '& .MuiOutlinedInput-root': {
                          height: '42px',
                          borderRadius: '6px',
                          fontSize: '13.5px',
                          fontWeight: 600,
                          color: '#0F172A',
                          '& fieldset': {
                            borderColor: '#CBD5E1',
                          },
                          '&:hover fieldset': {
                            borderColor: '#94A3B8',
                          },
                          '&.Mui-focused fieldset': {
                            borderColor: '#0B4DB7',
                            borderWidth: '1.5px',
                          },
                        },
                      }}
                    />
                  )}
                />
              </Box>

              {/* Date */}
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: { xs: 'column', sm: 'row' },
                  alignItems: { xs: 'flex-start', sm: 'center' },
                  gap: { xs: 1, sm: 3.5 },
                }}
              >
                <Typography
                  sx={{
                    fontSize: '14px',
                    fontWeight: 600,
                    color: '#0F172A',
                    minWidth: '150px',
                    textAlign: { sm: 'right' },
                  }}
                >
                  Date
                </Typography>
                <DatePickerField
                  value={creditDate}
                  onChange={setCreditDate}
                  placeholder="dd-mm-yyyy"
                  iconSize={18}
                  inputSx={{
                    fontSize: '13.5px',
                    height: '42px',
                  }}
                />
              </Box>

              {/* Notes */}
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: { xs: 'column', sm: 'row' },
                  alignItems: { xs: 'flex-start', sm: 'center' },
                  gap: { xs: 1, sm: 3.5 },
                }}
              >
                <Typography
                  sx={{
                    fontSize: '14px',
                    fontWeight: 600,
                    color: '#0F172A',
                    minWidth: '150px',
                    textAlign: { sm: 'right' },
                  }}
                >
                  Notes
                </Typography>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="Notes / Remarks"
                  value={creditNotes}
                  onChange={(e) => setCreditNotes(e.target.value)}
                  slotProps={{
                    input: {
                      sx: {
                        fontSize: '13.5px',
                        height: '42px',
                        backgroundColor: '#FFFFFF',
                        borderRadius: '6px',
                      },
                    },
                  }}
                />
              </Box>

              {/* Action Button */}
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'flex-start',
                  pl: { xs: 0, sm: '178px' },
                  mt: 1,
                }}
              >
                <Button
                  variant="contained"
                  disableElevation
                  onClick={handleAddCreditSubmit}
                  disabled={creditLoading}
                  sx={{
                    backgroundColor: '#0B4DB7',
                    color: '#FFFFFF',
                    height: '42px',
                    fontSize: '14px',
                    fontWeight: 700,
                    textTransform: 'none',
                    borderRadius: '6px',
                    px: 3.5,
                    '&:hover': {
                      backgroundColor: '#083B8D',
                    },
                  }}
                >
                  {creditLoading ? 'Saving...' : 'Click to create'}
                </Button>
              </Box>
            </Box>
          </Paper>
        </Box>
      )}
      {/* Hidden File Input for PDF Upload (Under 1 MB) */}
      <input
        type="file"
        ref={fileInputRef}
        accept="application/pdf"
        style={{ display: 'none' }}
        onChange={handlePdfFileChange}
      />

      {/* PDF Document Preview & Management Modal */}
      <Dialog
        open={Boolean(pdfPreviewModal?.open)}
        onClose={() => setPdfPreviewModal(null)}
        maxWidth="md"
        fullWidth
        slotProps={{
          paper: {
            sx: {
              borderRadius: '12px',
              overflow: 'hidden',
              height: '80vh',
              display: 'flex',
              flexDirection: 'column',
            },
          },
        }}
      >
        <DialogTitle
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#0B4DB7',
            color: '#FFFFFF',
            py: 1.5,
            px: 2.5,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <PictureAsPdfRoundedIcon sx={{ fontSize: 22, color: '#FFFFFF' }} />
            <Typography sx={{ fontSize: '15px', fontWeight: 700, color: '#FFFFFF' }}>
              {pdfPreviewModal?.name || 'Attached PDF Document'}
            </Typography>
            {pdfPreviewModal?.billNo && (
              <Chip
                label={`Bill #${pdfPreviewModal.billNo}`}
                size="small"
                sx={{
                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                  color: '#FFFFFF',
                  fontWeight: 600,
                  fontSize: '11px',
                  height: '20px',
                }}
              />
            )}
          </Box>
          <IconButton
            size="small"
            onClick={() => setPdfPreviewModal(null)}
            sx={{ color: '#FFFFFF', '&:hover': { backgroundColor: 'rgba(255,255,255,0.1)' } }}
          >
            <CloseRoundedIcon sx={{ fontSize: 20 }} />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ p: 0, flex: 1, backgroundColor: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {pdfPreviewModal?.url ? (
            pdfPreviewModal.url.startsWith('data:image') || pdfPreviewModal.url.match(/\.(jpeg|jpg|png|webp|gif)$/i) || !pdfPreviewModal.url.includes('application/pdf') ? (
              <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', overflow: 'auto' }}>
                <img
                  src={pdfPreviewModal.url}
                  alt={pdfPreviewModal.name || 'Document'}
                  style={{
                    maxWidth: '100%',
                    maxHeight: '100%',
                    objectFit: 'contain',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    borderRadius: '6px',
                  }}
                />
              </Box>
            ) : (
              <iframe
                src={pdfPreviewModal.url}
                title="PDF Preview"
                style={{
                  width: '100%',
                  height: '100%',
                  border: 'none',
                  display: 'block',
                }}
              />
            )
          ) : (
            <Box
              sx={{
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#64748B',
              }}
            >
              <Typography>No document available</Typography>
            </Box>
          )}
        </DialogContent>

        <DialogActions
          sx={{
            px: 2.5,
            py: 1.5,
            backgroundColor: '#FFFFFF',
            borderTop: '1px solid #E2E8F0',
            justifyContent: 'space-between',
          }}
        >
          <Button
            variant="outlined"
            color="error"
            size="small"
            startIcon={<DeleteOutlineRoundedIcon sx={{ fontSize: 16 }} />}
            onClick={() => pdfPreviewModal?.id && handleDeleteAttachedPdf(pdfPreviewModal.id)}
            sx={{
              textTransform: 'none',
              fontWeight: 600,
              fontSize: '12.5px',
              borderRadius: '6px',
            }}
          >
            Delete Document
          </Button>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, flexWrap: 'wrap' }}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<UploadFileRoundedIcon sx={{ fontSize: 16 }} />}
              onClick={() => pdfPreviewModal?.id && handleTriggerPdfUpload(pdfPreviewModal.id)}
              sx={{
                textTransform: 'none',
                fontWeight: 600,
                fontSize: '12.5px',
                borderRadius: '6px',
              }}
            >
              Change / Re-upload
            </Button>

            <Button
              variant="outlined"
              size="small"
              startIcon={<OpenInNewRoundedIcon sx={{ fontSize: 16 }} />}
              component="a"
              href={pdfPreviewModal?.url}
              target="_blank"
              rel="noopener noreferrer"
              sx={{
                textTransform: 'none',
                fontWeight: 600,
                fontSize: '12.5px',
                borderRadius: '6px',
                color: '#475569',
                borderColor: '#CBD5E1',
              }}
            >
              Open in New Tab
            </Button>

            <Button
              variant="contained"
              disableElevation
              size="small"
              startIcon={<DownloadRoundedIcon sx={{ fontSize: 16 }} />}
              component="a"
              href={pdfPreviewModal?.url}
              download={pdfPreviewModal?.name || 'bill-receipt'}
              target="_blank"
              rel="noopener noreferrer"
              sx={{
                backgroundColor: '#0B4DB7',
                color: '#FFFFFF',
                textTransform: 'none',
                fontWeight: 700,
                fontSize: '12.5px',
                borderRadius: '6px',
                '&:hover': { backgroundColor: '#083B8D' },
              }}
            >
              Download
            </Button>
          </Box>
        </DialogActions>
      </Dialog>

      {/* Bill Print & Preview Modal */}
      <BillPrintModal
        open={printModalOpen}
        onClose={() => setPrintModalOpen(false)}
        bill={selectedBillForPrint}
      />

      {/* Toast Notification for PDF Uploads */}
      <Snackbar
        open={pdfToast.open}
        autoHideDuration={4000}
        onClose={() => setPdfToast((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setPdfToast((prev) => ({ ...prev, open: false }))}
          severity={pdfToast.severity}
          variant="filled"
          sx={{ width: '100%', borderRadius: '8px', fontWeight: 600, fontSize: '13px' }}
        >
          {pdfToast.message}
        </Alert>
      </Snackbar>

      {/* Account Statement Date Range Print Modal */}
      <DateRangePrintModal
        open={openAccountDateModal}
        onClose={() => setOpenAccountDateModal(false)}
        title={`Print Account Statement - ${filterCustomer || currentCustomerName || 'All Customers'}`}
        subtitle="Select transaction date range to filter ledger entries for A4 print."
        items={sortedAccountDetails}
        getDateFromItem={(a) => a.date || ''}
        onConfirmPrint={(itemsToPrint, rangeText) => {
          printLedgerStatementDirectly(
            filterCustomer || currentCustomerName || 'All Customers',
            itemsToPrint,
            rangeText
          );
        }}
      />

      {/* Particulars Bills Date Range Print Modal */}
      <DateRangePrintModal
        open={openParticularDateModal}
        onClose={() => setOpenParticularDateModal(false)}
        title="Print Particulars Bills Master Report"
        subtitle="Select bill date range to filter bills for A4 print."
        items={sortedParticularDetails}
        getDateFromItem={(p) => p.date || ''}
        onConfirmPrint={(itemsToPrint, rangeText) => {
          printParticularsListDirectly(itemsToPrint, rangeText);
        }}
      />

      {/* Edit Particular Bill Dialog */}
      <Dialog
        open={openEditParticularModal}
        onClose={() => setOpenEditParticularModal(false)}
        maxWidth="md"
        fullWidth
        slotProps={{
          paper: {
            sx: {
              borderRadius: '12px',
              p: 1,
            },
          },
        }}
      >
        <DialogTitle
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            pb: 1,
            borderBottom: '1px solid #EEF2F6',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ModeEditOutlineRoundedIcon sx={{ color: '#0B4DB7', fontSize: 24 }} />
            <Typography sx={{ fontSize: '18px', fontWeight: 800, color: '#0F172A' }}>
              Edit Bill #{editBillForm.billNo} {editBillForm.customerName ? `- ${editBillForm.customerName}` : ''}
            </Typography>
          </Box>
          <IconButton size="small" onClick={() => setOpenEditParticularModal(false)} sx={{ color: '#64748B' }}>
            <CloseRoundedIcon sx={{ fontSize: 20 }} />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ pt: 2.5 }}>
          {/* Bill Info Grid */}
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1.2fr 1.2fr 1fr' }, gap: 2, mb: 2.5 }}>
            <Box>
              <Typography sx={{ fontSize: '12.5px', fontWeight: 600, color: '#475569', mb: 0.5 }}>
                Bill No *
              </Typography>
              <TextField
                fullWidth
                size="small"
                value={editBillForm.billNo}
                onChange={(e) => setEditBillForm((prev) => ({ ...prev, billNo: e.target.value }))}
                slotProps={{
                  input: { sx: { fontSize: '13px', fontWeight: 700, borderRadius: '6px' } },
                }}
              />
            </Box>

            <Box>
              <Typography sx={{ fontSize: '12.5px', fontWeight: 600, color: '#475569', mb: 0.5 }}>
                Customer Name *
              </Typography>
              <Autocomplete
                freeSolo
                options={customerOptions.map((c) => c.name)}
                value={editBillForm.customerName}
                onInputChange={(_e, newVal) => setEditBillForm((prev) => ({ ...prev, customerName: newVal }))}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    size="small"
                    placeholder="Customer Name"
                  />
                )}
              />
            </Box>

            <Box>
              <Typography sx={{ fontSize: '12.5px', fontWeight: 600, color: '#475569', mb: 0.5 }}>
                Company Name
              </Typography>
              <Autocomplete
                freeSolo
                options={companyOptions.map((c) => c.name)}
                value={editBillForm.companyName}
                onInputChange={(_e, newVal) => setEditBillForm((prev) => ({ ...prev, companyName: newVal }))}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    size="small"
                    placeholder="Company Name"
                  />
                )}
              />
            </Box>

            <Box>
              <Typography sx={{ fontSize: '12.5px', fontWeight: 600, color: '#475569', mb: 0.5 }}>
                Date (DD-MM-YYYY)
              </Typography>
              <DatePickerField
                value={editBillForm.date}
                onChange={(val) => setEditBillForm((prev) => ({ ...prev, date: val }))}
                placeholder="DD-MM-YYYY"
                iconSize={16}
                inputSx={{ fontSize: '13px', fontWeight: 600 }}
              />
            </Box>

            <Box>
              <Typography sx={{ fontSize: '12.5px', fontWeight: 600, color: '#475569', mb: 0.5 }}>
                Transport Name
              </Typography>
              <TextField
                fullWidth
                size="small"
                value={editBillForm.transport}
                onChange={(e) => setEditBillForm((prev) => ({ ...prev, transport: e.target.value }))}
                slotProps={{
                  input: { sx: { fontSize: '13px', fontWeight: 500, borderRadius: '6px' } },
                }}
              />
            </Box>

            <Box>
              <Typography sx={{ fontSize: '12.5px', fontWeight: 600, color: '#475569', mb: 0.5 }}>
                No. of Cases
              </Typography>
              <TextField
                fullWidth
                size="small"
                value={editBillForm.caseCount}
                onChange={(e) => setEditBillForm((prev) => ({ ...prev, caseCount: e.target.value }))}
                slotProps={{
                  input: { sx: { fontSize: '13px', fontWeight: 500, borderRadius: '6px' } },
                }}
              />
            </Box>

            <Box>
              <Typography sx={{ fontSize: '12.5px', fontWeight: 600, color: '#475569', mb: 0.5 }}>
                Discount (% or ₹)
              </Typography>
              <TextField
                fullWidth
                size="small"
                value={editBillForm.discount}
                onChange={(e) => setEditBillForm((prev) => ({ ...prev, discount: e.target.value }))}
                slotProps={{
                  input: { sx: { fontSize: '13px', fontWeight: 500, borderRadius: '6px' } },
                }}
              />
            </Box>

            <Box>
              <Typography sx={{ fontSize: '12.5px', fontWeight: 600, color: '#475569', mb: 0.5 }}>
                Packing (% or ₹)
              </Typography>
              <TextField
                fullWidth
                size="small"
                value={editBillForm.packing}
                onChange={(e) => setEditBillForm((prev) => ({ ...prev, packing: e.target.value }))}
                slotProps={{
                  input: { sx: { fontSize: '13px', fontWeight: 500, borderRadius: '6px' } },
                }}
              />
            </Box>

            <Box>
              <Typography sx={{ fontSize: '12.5px', fontWeight: 600, color: '#475569', mb: 0.5 }}>
                Tax (% or ₹)
              </Typography>
              <TextField
                fullWidth
                size="small"
                placeholder="e.g. 18% or 500"
                value={editBillForm.tax}
                onChange={(e) => setEditBillForm((prev) => ({ ...prev, tax: e.target.value }))}
                slotProps={{
                  input: { sx: { fontSize: '13px', fontWeight: 500, borderRadius: '6px' } },
                }}
              />
            </Box>
          </Box>

          {/* Product Items Header */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5, mt: 1 }}>
            <Typography sx={{ fontSize: '14.5px', fontWeight: 800, color: '#0F172A' }}>
              Product Items ({editBillForm.products.length})
            </Typography>
            <Button
              variant="outlined"
              size="small"
              onClick={handleAddEditProductRow}
              startIcon={<AddRoundedIcon sx={{ fontSize: 16 }} />}
              sx={{
                fontSize: '12px',
                fontWeight: 700,
                textTransform: 'none',
                borderRadius: '6px',
              }}
            >
              Add Item
            </Button>
          </Box>

          {/* Product Items Table */}
          <TableContainer sx={{ border: '1px solid #E2E8F0', borderRadius: '8px', mb: 2 }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ backgroundColor: '#F8FAFC' }}>
                  <TableCell sx={{ fontSize: '11px', fontWeight: 700, width: '40px' }}>#</TableCell>
                  <TableCell sx={{ fontSize: '11px', fontWeight: 700 }}>Particular / Item</TableCell>
                  <TableCell sx={{ fontSize: '11px', fontWeight: 700, width: '125px' }}>Measurement</TableCell>
                  <TableCell sx={{ fontSize: '11px', fontWeight: 700, width: '80px' }}>Qty</TableCell>
                  <TableCell sx={{ fontSize: '11px', fontWeight: 700, width: '90px' }}>Rate (₹)</TableCell>
                  <TableCell sx={{ fontSize: '11px', fontWeight: 700, width: '85px' }}>Unit</TableCell>
                  <TableCell align="right" sx={{ fontSize: '11px', fontWeight: 700, width: '110px' }}>Amount (₹)</TableCell>
                  <TableCell align="center" sx={{ fontSize: '11px', fontWeight: 700, width: '50px' }}>Del</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {editBillForm.products.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center" sx={{ py: 3, color: '#64748B', fontSize: '12.5px' }}>
                      No items. Click "+ Add Item" above to add products.
                    </TableCell>
                  </TableRow>
                ) : (
                  editBillForm.products.map((prod, idx) => (
                    <TableRow key={prod.id || idx}>
                      <TableCell sx={{ fontSize: '12px', fontWeight: 600 }}>{idx + 1}</TableCell>
                      <TableCell>
                        <TextField
                          fullWidth
                          size="small"
                          placeholder="Item Name"
                          value={prod.particular}
                          onChange={(e) => handleUpdateEditProductRow(idx, 'particular', e.target.value)}
                          slotProps={{
                            input: { sx: { fontSize: '12.5px', fontWeight: 600, height: '32px' } },
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <MeasurementInput
                          value={prod.measurement || ''}
                          onChange={(val) => handleUpdateEditProductRow(idx, 'measurement', val)}
                          options={measurementOptions}
                          placeholder="e.g. drum"
                          height="32px"
                          borderRadius="4px"
                          fontSize="12.5px"
                          sx={{ width: '115px' }}
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          fullWidth
                          size="small"
                          placeholder="Qty"
                          value={prod.quantity}
                          onChange={(e) => handleUpdateEditProductRow(idx, 'quantity', e.target.value)}
                          slotProps={{
                            input: { sx: { fontSize: '12.5px', height: '32px' } },
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          fullWidth
                          size="small"
                          placeholder="Rate"
                          value={prod.rate}
                          onChange={(e) => handleUpdateEditProductRow(idx, 'rate', e.target.value)}
                          slotProps={{
                            input: { sx: { fontSize: '12.5px', height: '32px' } },
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          fullWidth
                          size="small"
                          placeholder="Pkt/Bag"
                          value={prod.pktUnit}
                          onChange={(e) => handleUpdateEditProductRow(idx, 'pktUnit', e.target.value)}
                          slotProps={{
                            input: { sx: { fontSize: '12.5px', height: '32px' } },
                          }}
                        />
                      </TableCell>
                      <TableCell align="right" sx={{ fontSize: '12.5px', fontWeight: 700, color: '#0F172A' }}>
                        ₹{parseFloat(prod.amount || '0').toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell align="center">
                        <IconButton
                          size="small"
                          onClick={() => handleDeleteEditProductRow(idx)}
                          sx={{ color: '#DC2626', p: 0.4 }}
                        >
                          <DeleteOutlineRoundedIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>

          {/* Live Summary Calculation Banner */}
          <Box
            sx={{
              p: 2,
              borderRadius: '8px',
              backgroundColor: '#F8FAFC',
              border: '1px solid #E2E8F0',
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 2,
            }}
          >
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', fontSize: '12.5px' }}>
              <div>
                <span style={{ color: '#64748B' }}>Subtotal: </span>
                <strong style={{ color: '#0F172A' }}>₹ {editSubtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
              </div>
              {editDiscountVal > 0 && (
                <div>
                  <span style={{ color: '#DC2626' }}>Discount: </span>
                  <strong style={{ color: '#DC2626' }}>- ₹ {editDiscountVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                </div>
              )}
              {editPackingVal > 0 && (
                <div>
                  <span style={{ color: '#64748B' }}>Packing: </span>
                  <strong>+ ₹ {editPackingVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                </div>
              )}
              {editTaxVal > 0 && (
                <div>
                  <span style={{ color: '#64748B' }}>Tax: </span>
                  <strong>+ ₹ {editTaxVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                </div>
              )}
            </Box>

            <Box sx={{ textAlign: 'right' }}>
              <Typography sx={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
                Updated Net Total
              </Typography>
              <Typography sx={{ fontSize: '18px', fontWeight: 900, color: '#0B4DB7' }}>
                ₹ {parseFloat(editFinalTotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </Typography>
            </Box>
          </Box>
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2, pt: 1 }}>
          <Button onClick={() => setOpenEditParticularModal(false)} sx={{ color: '#64748B', fontWeight: 600, textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disableElevation
            onClick={handleSaveEditParticular}
            disabled={editBillLoading}
            sx={{
              backgroundColor: '#0B4DB7',
              color: '#FFFFFF',
              fontWeight: 700,
              textTransform: 'none',
              px: 3,
              borderRadius: '6px',
              '&:hover': { backgroundColor: '#083B8D' },
            }}
          >
            {editBillLoading ? 'Saving...' : 'Save Bill Changes'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Hidden File Input for Transport / Godown Receipt Upload */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*,application/pdf"
        style={{ display: 'none' }}
        onChange={handlePdfFileChange}
      />
    </Box>
  );
};

