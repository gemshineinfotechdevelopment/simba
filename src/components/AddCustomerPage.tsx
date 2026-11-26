import { useState, type FC, type ChangeEvent } from 'react';
import {
  Autocomplete,
  Box,
  Typography,
  Button,
  InputBase,
  Paper,
  CircularProgress,
  TextField,
} from '@mui/material';
import AddCircleOutlineRoundedIcon from '@mui/icons-material/AddCircleOutlineRounded';
import { CustomersApi } from '../services/api';
import {
  INDIAN_STATES,
  TAX_PROOF_OPTIONS,
  getTaxProofMeta,
  resolveProofInputChange,
  type TaxProofType,
} from '../utils/customerProofs';

interface AddCustomerPageProps {
  onCancel?: () => void;
  onSubmitSuccess?: () => void;
}

const dropdownFieldSx = {
  '& .MuiOutlinedInput-root': {
    height: '42px',
    py: '0 !important',
    backgroundColor: '#F8FAFC',
    borderRadius: '8px',
    fontSize: '13.5px',
    fontWeight: 500,
    color: '#0F172A',
    transition: 'all 0.15s ease',
    '& .MuiAutocomplete-input': {
      py: '0 !important',
    },
    '& fieldset': {
      borderColor: '#E2E8F0',
    },
    '&:hover fieldset': {
      borderColor: '#CBD5E1',
    },
    '&.Mui-focused': {
      backgroundColor: '#FFFFFF',
      boxShadow: '0 0 0 3px rgba(11, 77, 183, 0.1)',
    },
    '&.Mui-focused fieldset': {
      borderColor: '#0B4DB7',
      borderWidth: '1px',
    },
  },
};

export const AddCustomerPage: FC<AddCustomerPageProps> = ({
  onCancel,
  onSubmitSuccess,
}) => {
  const [formData, setFormData] = useState<{
    fullName: string;
    mobileNumber: string;
    taxIdType: TaxProofType;
    gstin: string;
    state: string;
    billingAddress: string;
  }>({
    fullName: '',
    mobileNumber: '',
    taxIdType: 'GSTIN',
    gstin: '',
    state: '',
    billingAddress: '',
  });
  const [loading, setLoading] = useState(false);

  const activeProofMeta = getTaxProofMeta(formData.taxIdType);

  const handleChange = (field: 'fullName' | 'mobileNumber' | 'gstin' | 'billingAddress') => (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const rawValue = e.target.value;
    setFormData((prev) => {
      if (field === 'mobileNumber') {
        return { ...prev, mobileNumber: rawValue.replace(/\D/g, '').slice(0, 10) };
      }
      if (field === 'gstin') {
        const next = resolveProofInputChange(prev.taxIdType, rawValue, prev.state);
        return { ...prev, gstin: next.value, state: next.state };
      }
      return { ...prev, [field]: rawValue };
    });
  };

  const handleProofTypeChange = (nextType: TaxProofType) => {
    setFormData((prev) => ({
      ...prev,
      taxIdType: nextType,
      gstin: prev.taxIdType === nextType ? prev.gstin : '',
    }));
  };

  const handleSubmit = async () => {
    const mobileDigits = formData.mobileNumber.replace(/\D/g, '');
    if (!formData.fullName.trim() || !mobileDigits || !formData.billingAddress.trim()) {
      alert('Please fill in required fields (Full Name, Mobile Number, and Address)');
      return;
    }

    if (mobileDigits.length !== 10) {
      alert('Please enter a valid 10-digit mobile number');
      return;
    }

    try {
      setLoading(true);
      await CustomersApi.create({
        name: formData.fullName.trim(),
        mobile: mobileDigits,
        taxIdType: formData.taxIdType,
        gst: formData.gstin.trim() || 'N/A',
        state: formData.state.trim(),
        address: formData.billingAddress.trim(),
        avatarLetter: formData.fullName.trim().charAt(0).toUpperCase(),
        avatarBg: '#DBEAFE',
        avatarColor: '#0B4DB7',
      });
      if (onSubmitSuccess) {
        onSubmitSuccess();
      }
    } catch (err) {
      console.error('Failed to create customer:', err);
      alert(
        err instanceof Error && err.message
          ? err.message
          : 'Error creating customer. Please check your backend connection.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        width: '100%',
        px: { xs: 2, sm: 3, md: 4 },
        py: { xs: 2.5, md: 3 },
        boxSizing: 'border-box',
      }}
    >
      {/* Page Title & Subtitle */}
      <Box sx={{ mb: 3 }}>
        <Typography
          variant="h1"
          sx={{
            fontSize: '28px',
            fontWeight: 800,
            color: '#0F172A',
            letterSpacing: '-0.025em',
            lineHeight: 1.2,
            mb: 0.8,
          }}
        >
          Add New Customer
        </Typography>
        <Typography
          sx={{
            fontSize: '14px',
            color: '#64748B',
            fontWeight: 500,
            letterSpacing: '-0.01em',
          }}
        >
          Enter the details below to register a new client profile into the Simba platform.
        </Typography>
      </Box>

      {/* Main Form Card */}
      <Paper
        elevation={0}
        sx={{
          width: '100%',
          backgroundColor: '#FFFFFF',
          borderRadius: '12px',
          border: '1px solid #EEF2F6',
          boxShadow: '0 1px 3px 0 rgba(15, 23, 42, 0.03), 0 1px 2px -1px rgba(15, 23, 42, 0.03)',
          p: { xs: 2.5, sm: 3.5, md: 4 },
          boxSizing: 'border-box',
        }}
      >
        <Box component="form" noValidate autoComplete="off">
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
              gap: 2.5,
            }}
          >
            {/* Full Name Field */}
            <Box>
              <Typography
                sx={{
                  fontSize: '13px',
                  fontWeight: 700,
                  color: '#1E293B',
                  mb: 1,
                  letterSpacing: '-0.01em',
                }}
              >
                Full Name / Business Name *
              </Typography>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  backgroundColor: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  borderRadius: '8px',
                  px: 1.5,
                  height: '42px',
                  transition: 'all 0.15s ease',
                  '&:focus-within': {
                    borderColor: '#0B4DB7',
                    backgroundColor: '#FFFFFF',
                    boxShadow: '0 0 0 3px rgba(11, 77, 183, 0.1)',
                  },
                }}
              >
                <InputBase
                  fullWidth
                  placeholder="e.g. Acme Corporation"
                  value={formData.fullName}
                  onChange={handleChange('fullName')}
                  sx={{
                    fontSize: '13.5px',
                    fontWeight: 500,
                    color: '#0F172A',
                    '& input::placeholder': {
                      color: '#94A3B8',
                      opacity: 1,
                    },
                  }}
                />
              </Box>
            </Box>

            {/* Mobile Number Field */}
            <Box>
              <Typography
                sx={{
                  fontSize: '13px',
                  fontWeight: 700,
                  color: '#1E293B',
                  mb: 1,
                  letterSpacing: '-0.01em',
                }}
              >
                Mobile Number *
              </Typography>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  backgroundColor: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  borderRadius: '8px',
                  px: 1.5,
                  height: '42px',
                  transition: 'all 0.15s ease',
                  '&:focus-within': {
                    borderColor: '#0B4DB7',
                    backgroundColor: '#FFFFFF',
                    boxShadow: '0 0 0 3px rgba(11, 77, 183, 0.1)',
                  },
                }}
              >
                <InputBase
                  fullWidth
                  required
                  type="tel"
                  placeholder="Enter 10-digit mobile number"
                  value={formData.mobileNumber}
                  onChange={handleChange('mobileNumber')}
                  inputProps={{
                    maxLength: 10,
                    inputMode: 'numeric',
                    pattern: '[0-9]{10}',
                  }}
                  sx={{
                    fontSize: '13.5px',
                    fontWeight: 500,
                    color: '#0F172A',
                    '& input::placeholder': {
                      color: '#94A3B8',
                      opacity: 1,
                    },
                  }}
                />
              </Box>
            </Box>

            {/* Tax / ID Proof Type */}
            <Box>
              <Typography
                sx={{
                  fontSize: '13px',
                  fontWeight: 700,
                  color: '#1E293B',
                  mb: 1,
                  letterSpacing: '-0.01em',
                }}
              >
                Tax / ID Proof Type
              </Typography>
              <Autocomplete
                disableClearable
                openOnFocus
                size="small"
                options={TAX_PROOF_OPTIONS}
                getOptionLabel={(opt) => opt.menuLabel}
                isOptionEqualToValue={(a, b) => a.type === b.type}
                value={activeProofMeta}
                onChange={(_e, val) => {
                  if (val) handleProofTypeChange(val.type);
                }}
                sx={dropdownFieldSx}
                renderInput={(params) => <TextField {...params} />}
              />
            </Box>

            {/* Dynamic Tax / ID Proof Number */}
            <Box>
              <Typography
                sx={{
                  fontSize: '13px',
                  fontWeight: 700,
                  color: '#1E293B',
                  mb: 1,
                  letterSpacing: '-0.01em',
                }}
              >
                {activeProofMeta.inputLabel}
              </Typography>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  backgroundColor: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  borderRadius: '8px',
                  px: 1.5,
                  height: '42px',
                  transition: 'all 0.15s ease',
                  '&:focus-within': {
                    borderColor: '#0B4DB7',
                    backgroundColor: '#FFFFFF',
                    boxShadow: '0 0 0 3px rgba(11, 77, 183, 0.1)',
                  },
                }}
              >
                <InputBase
                  fullWidth
                  type={formData.taxIdType === 'AADHAAR' ? 'tel' : 'text'}
                  placeholder={activeProofMeta.placeholder}
                  value={formData.gstin}
                  onChange={handleChange('gstin')}
                  inputProps={{
                    maxLength: activeProofMeta.maxLength,
                    inputMode: formData.taxIdType === 'AADHAAR' ? 'numeric' : 'text',
                  }}
                  sx={{
                    fontSize: '13.5px',
                    fontWeight: 500,
                    color: '#0F172A',
                    '& input::placeholder': {
                      color: '#94A3B8',
                      opacity: 1,
                    },
                  }}
                />
              </Box>
            </Box>

            {/* State Field */}
            <Box>
              <Typography
                sx={{
                  fontSize: '13px',
                  fontWeight: 700,
                  color: '#1E293B',
                  mb: 1,
                  letterSpacing: '-0.01em',
                }}
              >
                State
              </Typography>
              <Autocomplete
                openOnFocus
                size="small"
                options={INDIAN_STATES}
                value={formData.state || null}
                onChange={(_e, val) => setFormData((prev) => ({ ...prev, state: val || '' }))}
                sx={dropdownFieldSx}
                renderInput={(params) => (
                  <TextField {...params} placeholder="Select or search state..." />
                )}
              />
            </Box>

            {/* Billing Address Field */}
            <Box>
              <Typography
                sx={{
                  fontSize: '13px',
                  fontWeight: 700,
                  color: '#1E293B',
                  mb: 1,
                  letterSpacing: '-0.01em',
                }}
              >
                Billing / Delivery Address *
              </Typography>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  backgroundColor: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  borderRadius: '8px',
                  px: 1.5,
                  height: '42px',
                  transition: 'all 0.15s ease',
                  '&:focus-within': {
                    borderColor: '#0B4DB7',
                    backgroundColor: '#FFFFFF',
                    boxShadow: '0 0 0 3px rgba(11, 77, 183, 0.1)',
                  },
                }}
              >
                <InputBase
                  fullWidth
                  placeholder="e.g. 123 Industrial Area, Phase 2"
                  value={formData.billingAddress}
                  onChange={handleChange('billingAddress')}
                  sx={{
                    fontSize: '13.5px',
                    fontWeight: 500,
                    color: '#0F172A',
                    '& input::placeholder': {
                      color: '#94A3B8',
                      opacity: 1,
                    },
                  }}
                />
              </Box>
            </Box>
          </Box>

          {/* Action Buttons */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: 1.5,
              mt: 4,
              pt: 3,
              borderTop: '1px solid #EEF2F6',
            }}
          >
            <Button
              variant="outlined"
              onClick={onCancel}
              disabled={loading}
              sx={{
                height: '40px',
                px: 2.5,
                borderRadius: '8px',
                fontSize: '13.5px',
                fontWeight: 600,
                color: '#64748B',
                borderColor: '#E2E8F0',
                textTransform: 'none',
                '&:hover': {
                  borderColor: '#CBD5E1',
                  backgroundColor: '#F8FAFC',
                },
              }}
            >
              Cancel
            </Button>

            <Button
              variant="contained"
              disableElevation
              onClick={handleSubmit}
              disabled={loading}
              startIcon={
                loading ? <CircularProgress size={16} color="inherit" /> : <AddCircleOutlineRoundedIcon sx={{ fontSize: 18 }} />
              }
              sx={{
                height: '40px',
                px: 3,
                borderRadius: '8px',
                fontSize: '13.5px',
                fontWeight: 700,
                backgroundColor: '#0B4DB7',
                color: '#FFFFFF',
                textTransform: 'none',
                '&:hover': {
                  backgroundColor: '#083B8D',
                },
              }}
            >
              {loading ? 'Creating...' : 'Register Customer'}
            </Button>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
};
