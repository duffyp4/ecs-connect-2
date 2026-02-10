import { Link, useLocation } from "wouter";
import { Bolt, Plus, BarChart3, List, Package, FileText, User, LogOut, Menu, X, Code, Settings, Shield, Wrench, Truck, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { useDevMode } from "@/contexts/DevModeContext";
import { useDevPersona } from "@/contexts/DevPersonaContext";
import { Switch } from "@/components/ui/switch";
import { SignOutButton } from "@clerk/clerk-react";
import { useQuery } from "@tanstack/react-query";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const SHOW_DEV_TOOLS = import.meta.env.VITE_SHOW_DEV_TOOLS === "true";

interface LayoutProps {
  children: React.ReactNode;
}

interface WhitelistEntry {
  email: string;
  role: string;
  homeShop: string | null;
}

export default function Layout({ children }: LayoutProps) {
  const [location] = useLocation();
  const { user, whitelistRole } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { isDevMode, toggleDevMode } = useDevMode();
  const { personaEmail, setPersonaEmail, clearPersona } = useDevPersona();

  // Fetch persona list when dev tools are shown
  const { data: personas } = useQuery<WhitelistEntry[]>({
    queryKey: ["/api/dev/personas"],
    enabled: SHOW_DEV_TOOLS,
  });

  const handleLogout = () => {
    window.location.href = "/api/logout";
  };

  const getUserDisplayName = () => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    if (user?.firstName) {
      return user.firstName;
    }
    if (user?.email) {
      return user.email.split('@')[0];
    }
    return "User";
  };

  const getNavigationItems = () => {
    switch (whitelistRole) {
      case "technician":
        return [
          { href: "/tech", label: "My Jobs", icon: Wrench },
        ];
      case "driver":
        return [
          { href: "/driver", label: "My Routes", icon: Truck },
        ];
      default:
        // CSR and admin see full navigation
        return [
          { href: "/", label: "New Job", icon: Plus },
          { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
          { href: "/jobs", label: "Job List", icon: List },
          { href: "/parts", label: "Parts List", icon: Package },
        ];
    }
  };

  // Group personas by role for the dropdown
  const groupedPersonas = personas?.reduce<Record<string, WhitelistEntry[]>>((acc, entry) => {
    const role = entry.role || "unknown";
    if (!acc[role]) acc[role] = [];
    acc[role].push(entry);
    return acc;
  }, {}) ?? {};

  const roleOrder = ["admin", "csr", "technician", "driver"];
  const roleLabels: Record<string, string> = { admin: "Admin", csr: "CSR", technician: "Technician", driver: "Driver" };
  const sortedRoles = Object.keys(groupedPersonas).sort(
    (a, b) => (roleOrder.indexOf(a) === -1 ? 99 : roleOrder.indexOf(a)) - (roleOrder.indexOf(b) === -1 ? 99 : roleOrder.indexOf(b))
  );

  const navigationItems = getNavigationItems();

  return (
    <div className="min-h-screen bg-[var(--ecs-light)]">
      {/* Dev Mode top banner — thin stripe + label, distinct from pill badges */}
      {isDevMode && (
        <div className="bg-amber-500 text-white text-[11px] font-semibold tracking-wide text-center py-0.5 select-none">
          DEV MODE {personaEmail ? `— ${personaEmail}` : ""}
        </div>
      )}

      {/* Navigation */}
      <nav className="bg-white border-b border-[var(--border)] px-4">
        <div className="flex h-14 items-center justify-between">
          <div className="flex items-center space-x-2">
            {/* Mobile menu button */}
            <Button
              variant="ghost"
              size="sm"
              className="lg:hidden p-2"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              data-testid="button-mobile-menu"
            >
              {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
            <Bolt className="h-5 w-5 lg:h-6 lg:w-6 text-[var(--ecs-primary)]" />
            <span className="font-semibold text-[var(--ecs-primary)] text-sm sm:text-base lg:text-lg">
              ECS Connect
            </span>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center space-x-2" data-testid="button-user-menu">
                {user?.profileImageUrl ? (
                  <img
                    src={user.profileImageUrl}
                    alt="Profile"
                    className="h-6 w-6 rounded-full object-cover"
                  />
                ) : (
                  <User className="h-4 w-4" />
                )}
                <span className="hidden sm:inline">{getUserDisplayName()}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {user?.email && (
                <>
                  <div className="px-2 py-1.5 text-sm text-muted-foreground">
                    {user.email}
                  </div>
                  {whitelistRole && (
                    <div className="px-2 py-0.5 text-xs text-muted-foreground capitalize">
                      Role: {whitelistRole}
                    </div>
                  )}
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem asChild>
                <Link href="/settings" data-testid="link-settings">
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </Link>
              </DropdownMenuItem>
              {user?.role === 'admin' && (
                <DropdownMenuItem asChild>
                  <Link href="/admin" data-testid="link-admin">
                    <Shield className="mr-2 h-4 w-4" />
                    Admin Dashboard
                  </Link>
                </DropdownMenuItem>
              )}
              {CLERK_PUBLISHABLE_KEY ? (
                <SignOutButton>
                  <DropdownMenuItem data-testid="button-logout">
                    <LogOut className="mr-2 h-4 w-4" />
                    Logout
                  </DropdownMenuItem>
                </SignOutButton>
              ) : (
                <DropdownMenuItem
                  onClick={handleLogout}
                  data-testid="button-logout"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </nav>

      <div className="flex relative">
        {/* Mobile Menu Overlay */}
        {isMobileMenuOpen && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
            data-testid="mobile-menu-overlay"
          />
        )}

        {/* Sidebar */}
        <aside className={`
          fixed lg:static lg:translate-x-0 top-14 left-0 z-50
          w-64 h-[calc(100vh-3.5rem)] lg:h-auto
          sidebar p-4 transition-transform duration-200 ease-in-out
          flex flex-col
          ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}>
          <nav className="space-y-1">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              const isActive = location === item.href;

              return (
                <Link key={item.href} href={item.href}>
                  <div
                    className={`nav-link flex items-center space-x-2 ${isActive ? 'active' : ''}`}
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </div>
                </Link>
              );
            })}
          </nav>

          {/* Dev Tools Section - Only visible when VITE_SHOW_DEV_TOOLS=true */}
          {SHOW_DEV_TOOLS && (
            <div className="mt-auto pt-4 border-t border-border space-y-3">
              {/* Dev Mode Toggle */}
              <div className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                <div className="flex items-center space-x-2">
                  <Code className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground">Dev Mode</span>
                </div>
                <Switch
                  checked={isDevMode}
                  onCheckedChange={toggleDevMode}
                  data-testid="toggle-dev-mode"
                />
              </div>
              {isDevMode && (
                <p className="text-xs text-muted-foreground px-2">
                  All action buttons visible for preview
                </p>
              )}

              {/* Persona Switcher — only when dev mode is on */}
              {isDevMode && <div className="p-2 rounded-md bg-muted/50">
                <div className="flex items-center space-x-2 mb-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground">Switch Persona</span>
                </div>
                <Select
                  value={personaEmail ?? "__none__"}
                  onValueChange={(value) => {
                    if (value === "__none__") {
                      clearPersona();
                    } else {
                      setPersonaEmail(value);
                    }
                  }}
                >
                  <SelectTrigger className="h-8 text-xs" data-testid="persona-switcher">
                    <SelectValue placeholder="Default (real user)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">
                      <span className="text-muted-foreground">Default (real user)</span>
                    </SelectItem>
                    {sortedRoles.map((role) => (
                      <SelectGroup key={role}>
                        <SelectLabel className="text-xs">{roleLabels[role] || role}</SelectLabel>
                        {groupedPersonas[role].map((entry) => (
                          <SelectItem key={entry.email} value={entry.email}>
                            <span className="truncate">
                              {entry.email.split("@")[0]}
                              {entry.homeShop && (
                                <span className="text-muted-foreground ml-1">— {entry.homeShop}</span>
                              )}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
              </div>}
            </div>
          )}
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-3 sm:p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
