import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface AuthStatus {
  authenticated: boolean;
}

export function useAuth() {
  const queryClient = useQueryClient();
  
  const { data: authStatus, isLoading } = useQuery<AuthStatus>({
    queryKey: ["/api/auth/status"],
    retry: false,
  });

  const loginMutation = useMutation({
    mutationFn: async (password: string) => {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password }),
        credentials: "include",
      });
      
      if (!response.ok) {
        throw new Error(`Login failed: ${response.status}`);
      }
      
      return response.json();
    },
    onSuccess: () => {
      // Invalidate auth status to refetch
      queryClient.invalidateQueries({ queryKey: ["/api/auth/status"] });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/logout", {
        method: "POST",
        credentials: "include",
      });
      
      if (!response.ok) {
        throw new Error(`Logout failed: ${response.status}`);
      }
      
      return response.json();
    },
    onSuccess: () => {
      // Invalidate auth status to refetch
      queryClient.invalidateQueries({ queryKey: ["/api/auth/status"] });
    },
  });

  return {
    isAuthenticated: authStatus?.authenticated || false,
    isLoading,
    login: loginMutation.mutate,
    logout: logoutMutation.mutate,
    isLoggingIn: loginMutation.isPending,
    isLoggingOut: logoutMutation.isPending,
    loginError: loginMutation.error,
  };
}