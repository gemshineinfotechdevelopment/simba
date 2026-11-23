import { useState, type FC, type MouseEvent } from 'react';
import { Box, Typography, Menu, MenuItem, ListItemIcon, Divider } from '@mui/material';
import PersonOutlineRoundedIcon from '@mui/icons-material/PersonOutlineRounded';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import AdminPanelSettingsRoundedIcon from '@mui/icons-material/AdminPanelSettingsRounded';

export type NavTab = 'Customers' | 'Company' | 'Product' | 'Particulars' | 'All Customers' | 'Performa' | 'All Performa';

interface NavbarProps {
  activeTab?: NavTab;
  onSelectTab?: (tab: NavTab) => void;
  onNavigateCustomers?: () => void;
  onLogout?: () => void;
}

export const Navbar: FC<NavbarProps> = ({
  activeTab = 'Customers',
  onSelectTab,
  onNavigateCustomers,
  onLogout,
}) => {
  const tabs: NavTab[] = ['Customers', 'Company', 'Product', 'Particulars', 'All Customers', 'Performa', 'All Performa'];
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const handleTabClick = (tab: NavTab) => {
    if (onSelectTab) {
      onSelectTab(tab);
    } else if (tab === 'Customers' && onNavigateCustomers) {
      onNavigateCustomers();
    }
  };

  const handleProfileClick = (event: MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleCloseMenu = () => {
    setAnchorEl(null);
  };

  const handleLogoutClick = () => {
    handleCloseMenu();
    if (onLogout) onLogout();
  };

  return (
    <Box
      component="header"
      sx={{
        width: '100%',
        backgroundColor: '#FFFFFF',
        borderBottom: '1px solid #EEF2F6',
        px: { xs: 2.5, md: 4.5 },
        height: '64px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 1100,
        boxSizing: 'border-box',
      }}
    >
      {/* Left Logo Section */}
      <Box
        onClick={() => handleTabClick('Customers')}
        sx={{ display: 'flex', alignItems: 'center', gap: 1.5, cursor: 'pointer' }}
      >
        {/* Stylized S Logo Badge */}
        <Box
          sx={{
            width: 32,
            height: 32,
            borderRadius: '8px',
            border: '1px solid #E2E8F0',
            backgroundColor: '#0B4DB7',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
            overflow: 'hidden',
          }}
        >
          <Typography
            sx={{
              fontWeight: 900,
              fontSize: '18px',
              color: '#FFFFFF',
              lineHeight: 1,
            }}
          >
            S
          </Typography>
        </Box>

        <Typography
          variant="h6"
          sx={{
            fontWeight: 700,
            fontSize: '18px',
            color: '#0F172A',
            letterSpacing: '-0.01em',
          }}
        >
          Simba
        </Typography>
      </Box>

      {/* Center Navigation Links */}
      <Box
        component="nav"
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: { xs: 3, md: 4.5 },
          height: '100%',
        }}
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab;
          return (
            <Box
              key={tab}
              onClick={() => handleTabClick(tab)}
              sx={{
                position: 'relative',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                cursor: 'pointer',
                transition: 'color 0.15s ease',
              }}
            >
              <Typography
                sx={{
                  fontWeight: isActive ? 600 : 500,
                  fontSize: '14.5px',
                  color: isActive ? '#0B4DB7' : '#475569',
                  letterSpacing: '-0.01em',
                  px: 0.5,
                  transition: 'color 0.15s ease',
                  '&:hover': {
                    color: '#0B4DB7',
                  },
                }}
              >
                {tab}
              </Typography>

              {/* Active indicator underline bar */}
              {isActive && (
                <Box
                  sx={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: '3px',
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

      {/* Right Action Icons (Profile / Logout) */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Box
          onClick={handleProfileClick}
          sx={{
            width: 34,
            height: 34,
            borderRadius: '50%',
            backgroundColor: '#0B4DB7',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            boxShadow: '0 1px 3px rgba(11, 77, 183, 0.25)',
            '&:hover': {
              backgroundColor: '#083B8D',
              transform: 'scale(1.05)',
            },
          }}
        >
          <PersonOutlineRoundedIcon sx={{ fontSize: 20, color: '#FFFFFF' }} />
        </Box>

        {/* Profile / Logout Menu */}
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleCloseMenu}
          transformOrigin={{ horizontal: 'right', vertical: 'top' }}
          anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
          slotProps={{
            paper: {
              sx: {
                borderRadius: '10px',
                minWidth: '160px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                border: '1px solid #E2E8F0',
                mt: 1,
              },
            },
          }}
        >
          <MenuItem disabled sx={{ opacity: '1 !important', py: 1 }}>
            <ListItemIcon>
              <AdminPanelSettingsRoundedIcon sx={{ fontSize: 18, color: '#0B4DB7' }} />
            </ListItemIcon>
            <Box>
              <Typography sx={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>
                Administrator
              </Typography>
              <Typography sx={{ fontSize: '11px', color: '#64748B' }}>
                Logged In
              </Typography>
            </Box>
          </MenuItem>
          <Divider sx={{ my: 0.5 }} />
          <MenuItem onClick={handleLogoutClick} sx={{ color: '#DC2626', py: 1 }}>
            <ListItemIcon>
              <LogoutRoundedIcon sx={{ fontSize: 18, color: '#DC2626' }} />
            </ListItemIcon>
            <Typography sx={{ fontSize: '13px', fontWeight: 600 }}>
              Logout
            </Typography>
          </MenuItem>
        </Menu>
      </Box>
    </Box>
  );
};
