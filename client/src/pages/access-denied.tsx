import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldX } from "lucide-react";

export function AccessDenied() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[var(--ecs-light)] to-white flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full space-y-6">
        <Card className="border-2 border-destructive">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <ShieldX className="h-16 w-16 text-destructive" />
            </div>
            <CardTitle className="text-2xl">Access Denied</CardTitle>
            <CardDescription>
              Your email is not authorized to access this application.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center space-y-4">
            <p className="text-sm text-muted-foreground text-center">
              Please contact your administrator to request access to ECS Connect.
            </p>
            <Button 
              variant="outline"
              onClick={() => window.location.href = "/"}
              className="w-full max-w-sm"
              data-testid="button-back-to-login"
            >
              Back to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
