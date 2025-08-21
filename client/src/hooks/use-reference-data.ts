import { useQuery } from '@tanstack/react-query';

export function useShopUsers() {
  return useQuery({
    queryKey: ['reference', 'shop-users'],
    queryFn: async () => {
      const response = await fetch('/api/reference/shop-users');
      if (!response.ok) throw new Error('Failed to fetch shop users');
      return response.json() as Promise<string[]>;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useShopsForUser(userId: string | undefined) {
  return useQuery({
    queryKey: ['reference', 'shops', userId],
    queryFn: async () => {
      if (!userId) return [];
      const response = await fetch(`/api/reference/shops/${encodeURIComponent(userId)}`);
      if (!response.ok) throw new Error('Failed to fetch shops');
      return response.json() as Promise<string[]>;
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });
}

export function usePermissionForUser(userId: string | undefined) {
  return useQuery({
    queryKey: ['reference', 'permission', userId],
    queryFn: async () => {
      if (!userId) return { permission: '' };
      const response = await fetch(`/api/reference/permission/${encodeURIComponent(userId)}`);
      if (!response.ok) throw new Error('Failed to fetch permission');
      return response.json() as Promise<{ permission: string }>;
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCustomerNames() {
  return useQuery({
    queryKey: ['reference', 'customers'],
    queryFn: async () => {
      const response = await fetch('/api/reference/customers');
      if (!response.ok) throw new Error('Failed to fetch customers');
      return response.json() as Promise<string[]>;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useShipToForCustomer(customerName: string | undefined) {
  return useQuery({
    queryKey: ['reference', 'ship-to', customerName],
    queryFn: async () => {
      if (!customerName) return [];
      const response = await fetch(`/api/reference/ship-to/${encodeURIComponent(customerName)}`);
      if (!response.ok) throw new Error('Failed to fetch ship to options');
      return response.json() as Promise<string[]>;
    },
    enabled: !!customerName,
    staleTime: 5 * 60 * 1000,
  });
}

export function useShip2Ids(customerName: string | undefined, shipTo: string | undefined) {
  return useQuery({
    queryKey: ['reference', 'ship2-ids', customerName, shipTo],
    queryFn: async () => {
      if (!customerName || !shipTo) return [];
      const response = await fetch(`/api/reference/ship2-ids/${encodeURIComponent(customerName)}/${encodeURIComponent(shipTo)}`);
      if (!response.ok) throw new Error('Failed to fetch Ship2 IDs');
      return response.json() as Promise<string[]>;
    },
    enabled: !!(customerName && shipTo),
    staleTime: 5 * 60 * 1000,
  });
}

export function useTechComments() {
  return useQuery({
    queryKey: ['reference', 'tech-comments'],
    queryFn: async () => {
      const response = await fetch('/api/reference/tech-comments');
      if (!response.ok) throw new Error('Failed to fetch tech comments');
      return response.json() as Promise<string[]>;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useSendClampsGaskets() {
  return useQuery({
    queryKey: ['reference', 'send-clamps-gaskets'],
    queryFn: async () => {
      const response = await fetch('/api/reference/send-clamps-gaskets');
      if (!response.ok) throw new Error('Failed to fetch send clamps gaskets');
      return response.json() as Promise<string[]>;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function usePreferredProcesses() {
  return useQuery({
    queryKey: ['reference', 'preferred-processes'],
    queryFn: async () => {
      const response = await fetch('/api/reference/preferred-processes');
      if (!response.ok) throw new Error('Failed to fetch preferred processes');
      return response.json() as Promise<string[]>;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useCustomerInstructions(customerName: string | undefined) {
  return useQuery({
    queryKey: ['reference', 'customer-instructions', customerName],
    queryFn: async () => {
      if (!customerName) return { instructions: '' };
      const response = await fetch(`/api/reference/customer-instructions/${encodeURIComponent(customerName)}`);
      if (!response.ok) throw new Error('Failed to fetch customer instructions');
      return response.json() as Promise<{ instructions: string }>;
    },
    enabled: !!customerName,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCustomerNotes() {
  return useQuery({
    queryKey: ['reference', 'customer-notes'],
    queryFn: async () => {
      const response = await fetch('/api/reference/customer-notes');
      if (!response.ok) throw new Error('Failed to fetch customer notes');
      return response.json() as Promise<string[]>;
    },
    staleTime: 5 * 60 * 1000,
  });
}

// Get customer-specific reference data values (not dropdown options)
export function useCustomerSpecificData(customerName: string | undefined) {
  return useQuery({
    queryKey: ['reference', 'customer-specific', customerName],
    queryFn: async () => {
      if (!customerName) return null;
      const response = await fetch(`/api/reference/customer-specific/${encodeURIComponent(customerName)}`);
      if (!response.ok) throw new Error('Failed to fetch customer specific data');
      return response.json() as Promise<{
        preferredProcess: string;
        sendClampsGaskets: string;
        customerNotes: string;
        ship2Contact: string;
      }>;
    },
    enabled: !!customerName,
    staleTime: 5 * 60 * 1000,
  });
}

// Get all available shop names from reference data
export function useAllShops() {
  return useQuery({
    queryKey: ['reference', 'all-shops'],
    queryFn: async () => {
      const response = await fetch('/api/reference/all-shops');
      if (!response.ok) throw new Error('Failed to fetch all shops');
      return response.json() as Promise<string[]>;
    },
    staleTime: 5 * 60 * 1000,
  });
}