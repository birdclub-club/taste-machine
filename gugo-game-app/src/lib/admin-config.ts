// 🔐 Admin Configuration
// This file defines admin wallet addresses and permissions

// Admin wallet addresses (add your wallet address here)
export const ADMIN_WALLETS = [
  '0xd593c708833d606f28E81a147FD33edFeAdE0Aa9', // Your wallet address from console logs
  // Add more admin wallets here if needed
];

// Admin permission levels
export type AdminPermission = 
  | 'view_analytics'
  | 'manage_users' 
  | 'manage_nfts'
  | 'manage_votes'
  | 'manage_prizes'
  | 'system_settings'
  | 'super_admin';

// Admin roles and their permissions
export const ADMIN_ROLES = {
  super_admin: [
    'view_analytics',
    'manage_users',
    'manage_nfts', 
    'manage_votes',
    'manage_prizes',
    'system_settings',
    'super_admin'
  ] as AdminPermission[],
  moderator: [
    'view_analytics',
    'manage_users',
    'manage_votes'
  ] as AdminPermission[]
};

// Check if a wallet address is an admin
export const isAdmin = (walletAddress: string | undefined): boolean => {
  if (!walletAddress) return false;
  return ADMIN_WALLETS.includes(walletAddress.toLowerCase()) || 
         ADMIN_WALLETS.includes(walletAddress);
};

// Get admin role for a wallet address
export const getAdminRole = (walletAddress: string | undefined): keyof typeof ADMIN_ROLES | null => {
  if (!isAdmin(walletAddress)) return null;
  // For now, all admin wallets get super_admin role
  // You can extend this to have different roles for different wallets
  return 'super_admin';
};

// Check if admin has specific permission
export const hasAdminPermission = (
  walletAddress: string | undefined, 
  permission: AdminPermission
): boolean => {
  const role = getAdminRole(walletAddress);
  if (!role) return false;
  return ADMIN_ROLES[role].includes(permission);
};
