import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Trash2, UserPlus, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Whitelist } from "@shared/schema";

interface WhitelistWithRole extends Whitelist {
  role?: string | null;
}

export default function AdminPage() {
  const [newEmail, setNewEmail] = useState("");
  const { toast } = useToast();

  const { data: whitelistEntries, isLoading } = useQuery<WhitelistWithRole[]>({
    queryKey: ['/api/admin/whitelist'],
  });

  const addMutation = useMutation({
    mutationFn: async (email: string) => {
      return apiRequest('/api/admin/whitelist', 'POST', { email });
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

  const removeMutation = useMutation({
    mutationFn: async (email: string) => {
      return apiRequest(`/api/admin/whitelist/${encodeURIComponent(email)}`, 'DELETE');
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
    addMutation.mutate(newEmail.trim());
  };

  const handleRemoveEmail = (email: string) => {
    if (confirm(`Are you sure you want to remove ${email} from the whitelist?`)) {
      removeMutation.mutate(email);
    }
  };

  return (
    <div className="container mx-auto p-4 space-y-6">
      <div className="flex items-center space-x-3">
        <Shield className="h-8 w-8 text-[var(--ecs-primary)]" />
        <div>
          <h1 className="text-3xl font-bold text-[var(--ecs-dark)]">Admin Dashboard</h1>
          <p className="text-muted-foreground">Manage user access and permissions</p>
        </div>
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
              disabled={addMutation.isPending}
              data-testid="button-add-email"
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Add Email
            </Button>
          </form>

          {isLoading ? (
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
                        {entry.role === 'admin' ? (
                          <Badge variant="default" className="bg-[var(--ecs-primary)]">
                            <Shield className="h-3 w-3 mr-1" />
                            Admin
                          </Badge>
                        ) : entry.role === 'user' ? (
                          <Badge variant="secondary">User</Badge>
                        ) : (
                          <Badge variant="outline">Not Signed In</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {entry.createdAt ? new Date(entry.createdAt).toLocaleDateString() : 'N/A'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveEmail(entry.email)}
                          disabled={removeMutation.isPending}
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
    </div>
  );
}
