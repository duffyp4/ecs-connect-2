import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Dashboard from "@/pages/dashboard";
import JobList from "@/pages/job-list";
import JobDetail from "@/pages/job-detail";
import AdminPage from "@/pages/admin";
import Settings from "@/pages/settings";
import { Landing } from "@/pages/landing";
import { AccessDenied } from "@/pages/access-denied";
import Layout from "@/components/layout";
import { DevModeProvider } from "@/contexts/DevModeContext";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  // Show login page if not authenticated
  if (!isAuthenticated) {
    return (
      <Switch>
        <Route path="/access-denied" component={AccessDenied} />
        <Route component={Landing} />
      </Switch>
    );
  }

  // Show main app if authenticated
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/jobs" component={JobList} />
        <Route path="/jobs/:id" component={JobDetail} />
        <Route path="/admin" component={AdminPage} />
        <Route path="/settings" component={Settings} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <DevModeProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </DevModeProvider>
    </QueryClientProvider>
  );
}

export default App;
