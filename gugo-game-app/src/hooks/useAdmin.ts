import { useMemo } from 'react';
import { useAuth } from './useAuth';
import { isAdmin, getAdminRole, hasAdminPermission, AdminPermission } from '@/lib/admin-config';

interface UseAdminReturn {
  isAdmin: boolean;
  adminRole: string | null;
  hasPermission: (permission: AdminPermission) => boolean;
  walletAddress: string | undefined;
}

export const useAdmin = (): UseAdminReturn => {
  const { user } = useAuth();
  
  const adminData = useMemo(() => {
    const walletAddress = user?.wallet_address;
    const isUserAdmin = isAdmin(walletAddress);
    const adminRole = getAdminRole(walletAddress);
    
    return {
      isAdmin: isUserAdmin,
      adminRole,
      hasPermission: (permission: AdminPermission) => 
        hasAdminPermission(walletAddress, permission),
      walletAddress
    };
  }, [user?.wallet_address]);

  return adminData;
};
