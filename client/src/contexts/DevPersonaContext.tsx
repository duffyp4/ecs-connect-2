import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";

interface DevPersonaContextType {
  personaEmail: string | null;
  setPersonaEmail: (email: string | null) => void;
  clearPersona: () => void;
}

const DevPersonaContext = createContext<DevPersonaContextType | undefined>(undefined);

export function DevPersonaProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [personaEmail, setPersonaEmailState] = useState<string | null>(() => {
    const stored = localStorage.getItem("ecs-dev-persona");
    return stored || null;
  });

  useEffect(() => {
    if (personaEmail) {
      localStorage.setItem("ecs-dev-persona", personaEmail);
    } else {
      localStorage.removeItem("ecs-dev-persona");
    }
  }, [personaEmail]);

  const setPersonaEmail = useCallback((email: string | null) => {
    setPersonaEmailState(email);
    // Invalidate the auth query so useAuth refetches with the new persona
    queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
  }, [queryClient]);

  const clearPersona = useCallback(() => {
    setPersonaEmail(null);
  }, [setPersonaEmail]);

  return (
    <DevPersonaContext.Provider value={{ personaEmail, setPersonaEmail, clearPersona }}>
      {children}
    </DevPersonaContext.Provider>
  );
}

export function useDevPersona() {
  const context = useContext(DevPersonaContext);
  if (context === undefined) {
    throw new Error("useDevPersona must be used within a DevPersonaProvider");
  }
  return context;
}
