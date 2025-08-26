import { Link, useLocation } from "wouter";
import { Bolt, Plus, BarChart3, List, FileText, User, LogOut, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [location] = useLocation();
  const { logout, isLoggingOut } = useAuth();
  const { toast } = useToast();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navigationItems = [
    { href: "/", label: "New Job", icon: Plus },
    { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
    { href: "/jobs", label: "Job List", icon: List },
  ];

  return (
    <div className="min-h-screen bg-[var(--ecs-light)]">
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
              <span className="hidden sm:inline">CSR Check-in Portal</span>
              <span className="sm:hidden">CSR Portal</span>
            </span>
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center space-x-2">
                <User className="h-4 w-4" />
                <span className="hidden sm:inline">CSR User</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem 
                onClick={() => logout(undefined, {
                  onSuccess: () => {
                    toast({
                      title: "Logged out",
                      description: "You have been logged out successfully",
                    });
                  },
                })}
                disabled={isLoggingOut}
                data-testid="button-logout"
              >
                <LogOut className="mr-2 h-4 w-4" />
                {isLoggingOut ? "Logging out..." : "Logout"}
              </DropdownMenuItem>
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
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-3 sm:p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
