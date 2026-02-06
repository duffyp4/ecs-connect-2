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
import PartsList from "@/pages/parts-list";
import JobDetail from "@/pages/job-detail";
import Settings from "@/pages/settings";
import AdminPage from "@/pages/admin";
import { Landing } from "@/pages/landing";
import { AccessDenied } from "@/pages/access-denied";
import Layout from "@/components/layout";
import { DevModeProvider } from "@/contexts/DevModeContext";
import { ClerkProvider, SignedIn, SignedOut } from "@clerk/clerk-react";

const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

function AuthenticatedApp() {
  const { isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <Layout>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/jobs" component={JobList} />
        <Route path="/parts" component={PartsList} />
        <Route path="/jobs/:id" component={JobDetail} />
        <Route path="/settings" component={Settings} />
        <Route path="/admin" component={AdminPage} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function Router() {
  // When Clerk is not configured (dev mode), bypass Clerk entirely
  if (!CLERK_PUBLISHABLE_KEY) {
    const { isAuthenticated, isLoading } = useAuth();

    if (isLoading) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      );
    }

    if (!isAuthenticated) {
      return (
        <Switch>
          <Route path="/access-denied" component={AccessDenied} />
          <Route component={Landing} />
        </Switch>
      );
    }

    return (
      <Layout>
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/dashboard" component={Dashboard} />
          <Route path="/jobs" component={JobList} />
          <Route path="/parts" component={PartsList} />
          <Route path="/jobs/:id" component={JobDetail} />
          <Route path="/settings" component={Settings} />
          <Route path="/admin" component={AdminPage} />
          <Route component={NotFound} />
        </Switch>
      </Layout>
    );
  }

  // With Clerk configured, use Clerk's SignedIn/SignedOut components
  return (
    <>
      <SignedOut>
        <Switch>
          <Route path="/access-denied" component={AccessDenied} />
          <Route component={Landing} />
        </Switch>
      </SignedOut>
      <SignedIn>
        <AuthenticatedApp />
      </SignedIn>
    </>
  );
}

function App() {
  const content = (
    <QueryClientProvider client={queryClient}>
      <DevModeProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </DevModeProvider>
    </QueryClientProvider>
  );

  // Wrap with ClerkProvider only if key is available
  if (CLERK_PUBLISHABLE_KEY) {
    return (
      <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY}>
        {content}
      </ClerkProvider>
    );
  }

  return content;
}

export default App;
