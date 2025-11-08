import { useLocation } from "wouter";
import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, UserPlus, Trash2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Whitelist } from "@shared/schema";

interface WhitelistWithRole extends Whitelist {
  role?: string | null;
}

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
  const [newEmail, setNewEmail] = useState("");

  const { data: user, isLoading } = useQuery<any>({
    queryKey: ['/api/auth/user'],
  });

  const { data: whitelistEntries, isLoading: whitelistLoading } = useQuery<WhitelistWithRole[]>({
    queryKey: ['/api/admin/whitelist'],
    enabled: user?.role === 'admin',
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

  const addEmailMutation = useMutation({
    mutationFn: async (email: string) => {
      return apiRequest('POST', '/api/admin/whitelist', { email });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/whitelist'] });
      setNewEmail("");
      toast({
        title: "Email added",
        description: "The email has been added to the whitelist.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to add email",
        description: error.message || "An error occurred",
        variant: "destructive",
      });
    },
  });

  const removeEmailMutation = useMutation({
    mutationFn: async (email: string) => {
      return apiRequest('DELETE', `/api/admin/whitelist/${encodeURIComponent(email)}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/whitelist'] });
      toast({
        title: "Email removed",
        description: "The email has been removed from the whitelist.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to remove email",
        description: error.message || "An error occurred",
        variant: "destructive",
      });
    },
  });

  const handleAddEmail = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim()) return;
    addEmailMutation.mutate(newEmail.trim());
  };

  const handleRemoveEmail = (email: string) => {
    if (confirm(`Are you sure you want to remove ${email} from the whitelist?`)) {
      removeEmailMutation.mutate(email);
    }
  };

  const isAdmin = user?.role === 'admin';

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
          Manage your account preferences{isAdmin ? ' and administrative settings' : ''}
        </p>
      </div>

      <div className="space-y-6">
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

        {/* Admin Settings - Only visible to admins */}
        {isAdmin && (
          <>
            <Separator className="my-8" />
            
            <div className="mb-4">
              <h2 className="text-2xl font-bold text-[var(--ecs-primary)]">Admin Settings</h2>
              <p className="text-muted-foreground mt-1">
                Manage user access and permissions
              </p>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Email Whitelist</CardTitle>
                <CardDescription>
                  Only users with whitelisted email addresses can access the application
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <form onSubmit={handleAddEmail} className="flex gap-2">
                  <Input
                    type="email"
                    placeholder="Enter email address"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="flex-1"
                    data-testid="input-new-email"
                  />
                  <Button 
                    type="submit" 
                    disabled={addEmailMutation.isPending}
                    data-testid="button-add-email"
                  >
                    <UserPlus className="h-4 w-4 mr-2" />
                    Add Email
                  </Button>
                </form>

                {whitelistLoading ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Loading whitelist...
                  </div>
                ) : whitelistEntries && whitelistEntries.length > 0 ? (
                  <div className="border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Email Address</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead>Added</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {whitelistEntries.map((entry) => (
                          <TableRow key={entry.id} data-testid={`row-whitelist-${entry.email}`}>
                            <TableCell className="font-medium">{entry.email}</TableCell>
                            <TableCell>
                              {entry.role === 'admin' ? 'admin' : entry.role === 'user' ? 'user' : 'Not Signed In'}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {entry.createdAt ? new Date(entry.createdAt).toLocaleDateString() : 'N/A'}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveEmail(entry.email)}
                                disabled={removeEmailMutation.isPending}
                                data-testid={`button-remove-${entry.email}`}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-8 border rounded-lg bg-muted/50">
                    <UserPlus className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground">No whitelisted emails yet</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Add email addresses above to grant access
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
