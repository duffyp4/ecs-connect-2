import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, TrendingUp, Users } from "lucide-react";

export function Landing() {
  const handleLogin = () => {
    window.location.href = "/api/login";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[var(--ecs-light)] to-white flex flex-col items-center justify-center p-4">
      <div className="max-w-4xl w-full space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl md:text-6xl font-bold text-[var(--ecs-dark)]">
            ECS Connect
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground">
            Job Tracking & Workflow Management for Emissions and Cooling Solutions
          </p>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <FileText className="h-10 w-10 text-[var(--ecs-primary)] mb-2" />
              <CardTitle>Job Tracking</CardTitle>
              <CardDescription>
                Track jobs through pickup, shop check-in, service, and delivery with real-time updates
              </CardDescription>
            </CardHeader>
          </Card>
          
          <Card>
            <CardHeader>
              <TrendingUp className="h-10 w-10 text-[var(--ecs-primary)] mb-2" />
              <CardTitle>Analytics</CardTitle>
              <CardDescription>
                Monitor turnaround times and performance metrics for continuous improvement
              </CardDescription>
            </CardHeader>
          </Card>
          
          <Card>
            <CardHeader>
              <Users className="h-10 w-10 text-[var(--ecs-primary)] mb-2" />
              <CardTitle>Team Collaboration</CardTitle>
              <CardDescription>
                Seamless coordination between CSRs, drivers, and technicians
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        {/* Login Card */}
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
              Sign In
            </Button>
            <p className="text-sm text-muted-foreground text-center">
              Use your Google, GitHub, or email account to sign in
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}