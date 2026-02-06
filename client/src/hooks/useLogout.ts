import { useCallback } from "react";

/**
 * Returns a logout function for dev mode (no Clerk).
 * When Clerk is configured, the Layout component uses Clerk's
 * SignOutButton directly instead of this hook.
 */
export function useLogout() {
  return useCallback(() => {
    window.location.href = "/api/logout";
  }, []);
}
