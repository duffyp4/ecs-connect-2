import { useQuery } from "@tanstack/react-query";
import type { User } from "@shared/schema";
import { useDevPersona } from "@/contexts/DevPersonaContext";

// Extended user type that includes whitelist info from the auth endpoint
type AuthUser = User & {
  whitelistRole: string | null;
  homeShop: string | null;
  _persona?: boolean;
};

export function useAuth() {
  const { personaEmail } = useDevPersona();

  const queryKey: any[] = ["/api/auth/user"];
  if (personaEmail) {
    queryKey.push({ asEmail: personaEmail });
  }

  const { data: user, isLoading } = useQuery<AuthUser>({
    queryKey,
    retry: false,
  });

  // Check if user can filter by shop (CSR and Admin can, Driver and Technician cannot)
  const canFilterByShop = !user?.whitelistRole || ['csr', 'admin'].includes(user.whitelistRole);

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    whitelistRole: user?.whitelistRole ?? null,
    homeShop: user?.homeShop ?? null,
    canFilterByShop,
  };
}
