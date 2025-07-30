import { Link, useLocation } from "wouter";
import { Bolt, Plus, BarChart3, List, FileText, User, Settings, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [location] = useLocation();

  const navigationItems = [
    { href: "/", label: "New Job", icon: Plus },
    { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
    { href: "/jobs", label: "Job List", icon: List },
    { href: "/reports", label: "Reports", icon: FileText },
  ];

  return (
    <div className="min-h-screen bg-[var(--ecs-light)]">
      {/* Navigation */}
      <nav className="bg-white border-b border-[var(--border)] px-4">
        <div className="flex h-14 items-center justify-between">
          <div className="flex items-center space-x-2">
            <Bolt className="h-6 w-6 text-[var(--ecs-primary)]" />
            <span className="font-semibold text-[var(--ecs-primary)] text-lg">
              ECS Tracking System
            </span>
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center space-x-2">
                <User className="h-4 w-4" />
                <span>CSR User</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </nav>

      <div className="flex">
        {/* Sidebar */}
        <aside className="w-64 sidebar p-4">
          <nav className="space-y-1">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              const isActive = location === item.href;
              
              return (
                <Link key={item.href} href={item.href}>
                  <div className={`nav-link flex items-center space-x-2 ${isActive ? 'active' : ''}`}>
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </div>
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
