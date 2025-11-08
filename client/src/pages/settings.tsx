import { useLocation } from "wouter";
import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

// Common US timezones
const TIMEZONES = [
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "America/Chicago", label: "Central Time (CT)" },
  { value: "America/Denver", label: "Mountain Time (MT)" },
  { value: "America/Phoenix", label: "Mountain Time - Arizona (MT)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { value: "America/Anchorage", label: "Alaska Time (AKT)" },
  { value: "Pacific/Honolulu", label: "Hawaii Time (HT)" },
];

export default function Settings() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [selectedTimezone, setSelectedTimezone] = useState<string>("");

  const { data: user, isLoading } = useQuery<any>({
    queryKey: ['/api/auth/user'],
  });

  // Set initial timezone from user data
  useEffect(() => {
    if (user?.timezone) {
      setSelectedTimezone(user.timezone);
    } else if (user && !user.timezone) {
      // Auto-detect browser timezone if user doesn't have one set
      const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      setSelectedTimezone(browserTimezone);
    }
  }, [user]);

  const updateTimezoneMutation = useMutation({
    mutationFn: async (timezone: string) => {
      const response = await apiRequest('PATCH', '/api/auth/user/timezone', { timezone });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      toast({
        title: "Success",
        description: "Your timezone preference has been saved.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update timezone",
        variant: "destructive",
      });
    },
  });

  const handleSaveTimezone = () => {
    if (selectedTimezone) {
      updateTimezoneMutation.mutate(selectedTimezone);
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      {/* Header */}
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => setLocation("/")}
          className="mb-4"
          data-testid="button-back"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <h1 className="text-3xl font-bold text-[var(--ecs-primary)]">Settings</h1>
        <p className="text-muted-foreground mt-2">
          Manage your account preferences
        </p>
      </div>

      {/* Timezone Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Display Timezone</CardTitle>
          <CardDescription>
            Choose the timezone for displaying dates and times throughout the application.
            All times will be converted from UTC to your selected timezone.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="timezone">Timezone</Label>
            <Select value={selectedTimezone} onValueChange={setSelectedTimezone}>
              <SelectTrigger id="timezone" data-testid="select-timezone">
                <SelectValue placeholder="Select a timezone" />
              </SelectTrigger>
              <SelectContent>
                {TIMEZONES.map((tz) => (
                  <SelectItem key={tz.value} value={tz.value}>
                    {tz.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Your browser detected timezone: {Intl.DateTimeFormat().resolvedOptions().timeZone}
            </p>
          </div>

          <Button
            onClick={handleSaveTimezone}
            disabled={!selectedTimezone || updateTimezoneMutation.isPending}
            data-testid="button-save-timezone"
          >
            {updateTimezoneMutation.isPending ? "Saving..." : "Save Timezone"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
