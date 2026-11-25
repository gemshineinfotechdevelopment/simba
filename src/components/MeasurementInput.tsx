import { useMemo, useRef, useState, type FC, type KeyboardEvent } from 'react';
import { Autocomplete, Box, TextField, type SxProps, type Theme } from '@mui/material';
import { type MeasurementOption, getMatchingMeasurements } from '../utils/measurements';

interface MeasurementInputProps {
  value: string;
  onChange: (value: string) => void;
  options: MeasurementOption[];
  label?: string;
  placeholder?: string;
  height?: string;
  borderRadius?: string;
  fontSize?: string;
  sx?: SxProps<Theme>;
  onEnterWithClosedMenu?: () => void;
}

export const MeasurementInput: FC<MeasurementInputProps> = ({
  value,
  onChange,
  options,
  label,
  placeholder = 'Type or select unit (e.g. g, kg, drum, box)',
  height = '40px',
  borderRadius = '8px',
  fontSize = '13.5px',
  sx,
  onEnterWithClosedMenu,
}) => {
  const [open, setOpen] = useState(false);
  const [isFiltering, setIsFiltering] = useState(false);
  const highlightedRef = useRef<MeasurementOption | null>(null);
  const highlightReasonRef = useRef<string | null>(null);

  const matchingOptions = useMemo(
    () => getMatchingMeasurements(options, value),
    [options, value]
  );

  const visibleOptions = isFiltering ? matchingOptions : options;
  const isMenuOpen = open && visibleOptions.length > 0;

  const commitOption = (selected: MeasurementOption | string | null) => {
    if (typeof selected === 'string') {
      onChange(selected);
    } else if (selected) {
      onChange(selected.value);
    }
    highlightedRef.current = null;
    highlightReasonRef.current = null;
    setIsFiltering(false);
    setOpen(false);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Tab' && !e.shiftKey) {
      if (isMenuOpen && visibleOptions.length > 0) {
        const highlightedIsValid = Boolean(
          highlightedRef.current &&
            visibleOptions.some((opt) => opt.value === highlightedRef.current?.value)
        );
        if (isFiltering || (highlightReasonRef.current === 'keyboard' && highlightedIsValid)) {
          const target = highlightedIsValid ? highlightedRef.current : visibleOptions[0];
          if (target) {
            commitOption(target);
          }
        }
      }
      return;
    }

    if (e.key !== 'Enter') return;

    if (isMenuOpen && visibleOptions.length > 0) {
      const highlightedIsValid =
        highlightedRef.current &&
        visibleOptions.some((opt) => opt.value === highlightedRef.current?.value);
      const target = highlightedIsValid
        ? highlightedRef.current
        : isFiltering
          ? visibleOptions[0]
          : null;

      if (target) {
        e.preventDefault();
        e.stopPropagation();
        commitOption(target);
        return;
      }
    }

    if (value.trim() !== value) {
      onChange(value.trim());
    }
    highlightedRef.current = null;
    highlightReasonRef.current = null;
    setIsFiltering(false);
    setOpen(false);
    if (onEnterWithClosedMenu) {
      e.preventDefault();
      onEnterWithClosedMenu();
    } else {
      e.preventDefault();
    }
  };

  return (
    <Autocomplete<MeasurementOption, false, false, true>
      freeSolo
      openOnFocus
      clearOnBlur={false}
      autoHighlight={isFiltering}
      size="small"
      sx={{
        ...sx,
        '& .MuiAutocomplete-clearIndicator': { display: 'none' },
      }}
      options={options}
      open={isMenuOpen}
      onOpen={() => {
        highlightedRef.current = null;
        highlightReasonRef.current = null;
        setIsFiltering(false);
        setOpen(true);
      }}
      onClose={() => {
        highlightedRef.current = null;
        highlightReasonRef.current = null;
        setIsFiltering(false);
        setOpen(false);
      }}
      getOptionLabel={(option) => (typeof option === 'string' ? option : option.value)}
      filterOptions={(opts, state) =>
        isFiltering ? getMatchingMeasurements(opts, state.inputValue) : opts
      }
      value={null}
      inputValue={value}
      onHighlightChange={(_e, option, reason) => {
        highlightedRef.current = typeof option === 'string' ? null : option;
        highlightReasonRef.current = reason;
      }}
      onInputChange={(_e, newInputValue, reason) => {
        if (reason === 'input') {
          onChange(newInputValue);
          highlightedRef.current = null;
          highlightReasonRef.current = null;
          setIsFiltering(newInputValue.trim().length > 0);
          setOpen(true);
        }
      }}
      onChange={(_e, newValue) => {
        commitOption(newValue);
      }}
      renderOption={(props, option) => (
        <Box
          component="li"
          {...props}
          key={props.key || option.value}
          sx={{
            fontSize: '13px',
            fontWeight: 500,
            color: '#0F172A',
            py: 0.8,
          }}
        >
          {option.label}
        </Box>
      )}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          placeholder={placeholder}
          onKeyDown={handleKeyDown}
          sx={{
            backgroundColor: '#FFFFFF',
            borderRadius,
            '& .MuiOutlinedInput-root': {
              height,
              py: '0 !important',
              pr: '30px !important',
              fontSize,
              fontWeight: 500,
              color: '#0F172A',
              borderRadius,
              backgroundColor: '#FFFFFF',
              '& .MuiAutocomplete-input': {
                py: '0 !important',
              },
              '& .MuiAutocomplete-endAdornment': {
                right: '4px',
              },
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
  );
};
