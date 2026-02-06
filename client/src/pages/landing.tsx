import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SignIn } from "@clerk/clerk-react";

const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

export function Landing() {
  const handleLogin = () => {
    window.location.href = "/api/login";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[var(--ecs-light)] to-white flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl md:text-6xl font-bold text-[var(--ecs-dark)]">
            ECS Connect
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground">
            Job Tracking & Workflow Management for Emissions and Cooling Solutions
          </p>
        </div>

        {/* Login */}
        {CLERK_PUBLISHABLE_KEY ? (
          <div className="flex justify-center">
            <SignIn routing="hash" />
          </div>
        ) : (
          <Card className="border-2 border-[var(--ecs-primary)]">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">Welcome Back</CardTitle>
              <CardDescription>
                Sign in to access your dashboard and manage jobs
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center space-y-4">
              <Button
                onClick={handleLogin}
                size="lg"
                className="btn-primary w-full max-w-sm"
                data-testid="button-login"
              >
                Sign In (Dev Mode)
              </Button>
              <p className="text-sm text-muted-foreground text-center">
                Development mode - click to auto-login
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
