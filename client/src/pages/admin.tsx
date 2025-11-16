import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Trash2, UserPlus, Shield, Activity } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Whitelist } from "@shared/schema";

interface WhitelistWithRole extends Whitelist {
  role?: string | null;
}

interface GoCanvasMetrics {
  now: string;
  totalCalls: number;
  byStatus: Record<string, number>;
  rateLimitHits: number;
  lastRateLimitAt: string | null;
  lastRateLimitReset: string | null;
  lastRateLimitLimit: string | null;
  lastRateLimitRemaining: string | null;
}

interface WebhookMetrics {
  now: string;
  totalReceived: number;
  totalProcessed: number;
  duplicatesIgnored: number;
  ignoredForms: number;
  errors: number;
  byForm: Record<string, number>;
  averageProcessingTime: number;
  lastReceivedByForm: Record<string, string>;
}

export default function AdminPage() {
  const [newEmail, setNewEmail] = useState("");
  const { toast } = useToast();

  const { data: whitelistEntries, isLoading } = useQuery<WhitelistWithRole[]>({
    queryKey: ['/api/admin/whitelist'],
  });

  const addMutation = useMutation({
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

  const removeMutation = useMutation({
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
    addMutation.mutate(newEmail.trim());
  };

  const handleRemoveEmail = (email: string) => {
    if (confirm(`Are you sure you want to remove ${email} from the whitelist?`)) {
      removeMutation.mutate(email);
    }
  };

  const { data: metricsData, isLoading: metricsLoading } = useQuery<GoCanvasMetrics>({
    queryKey: ['/api/metrics/gocanvas'],
    refetchInterval: 60000, // Auto-refresh every 60 seconds
  });

  const { data: webhookMetricsData, isLoading: webhookMetricsLoading } = useQuery<WebhookMetrics>({
    queryKey: ['/api/metrics/webhooks'],
    refetchInterval: 10000, // Auto-refresh every 10 seconds
  });

  return (
    <div className="container mx-auto p-4 space-y-6">
      <div className="flex items-center space-x-3">
        <Shield className="h-8 w-8 text-[var(--ecs-primary)]" />
        <div>
          <h1 className="text-3xl font-bold text-[var(--ecs-dark)]">Admin Dashboard</h1>
          <p className="text-muted-foreground">Manage user access and permissions</p>
        </div>
      </div>

      <Tabs defaultValue="whitelist" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="whitelist" data-testid="tab-whitelist">
            <Shield className="h-4 w-4 mr-2" />
            Whitelist
          </TabsTrigger>
          <TabsTrigger value="integration-health" data-testid="tab-integration-health">
            <Activity className="h-4 w-4 mr-2" />
            GoCanvas API
          </TabsTrigger>
          <TabsTrigger value="push-notifications" data-testid="tab-push-notifications">
            <Activity className="h-4 w-4 mr-2" />
            Webhooks
          </TabsTrigger>
        </TabsList>

        <TabsContent value="whitelist">
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
        </TabsContent>

        <TabsContent value="integration-health">
          <Card>
            <CardHeader>
              <CardTitle>GoCanvas Integration Health</CardTitle>
              <CardDescription>
                Monitor GoCanvas API usage and rate limits (auto-refreshes every 60 seconds)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {metricsLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  Loading metrics...
                </div>
              ) : metricsData ? (
                <>
                  <div className="text-sm text-muted-foreground">
                    Server time: {new Date(metricsData.now).toLocaleString()}
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium">Summary</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Total API calls:</span>
                          <span className="font-semibold" data-testid="metric-total-calls">
                            {metricsData.totalCalls}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Rate limit hits (429):</span>
                          <span className={`font-semibold ${metricsData.rateLimitHits > 0 ? 'text-destructive' : ''}`} data-testid="metric-rate-limit-hits">
                            {metricsData.rateLimitHits}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Last rate limit at:</span>
                          <span className="font-mono text-sm" data-testid="metric-last-rate-limit-at">
                            {metricsData.lastRateLimitAt 
                              ? new Date(metricsData.lastRateLimitAt).toLocaleString() 
                              : 'N/A'}
                          </span>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium">Current Rate Limit Status</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Limit:</span>
                          <span className="font-mono text-sm" data-testid="metric-rate-limit-limit">
                            {metricsData.lastRateLimitLimit ?? 'N/A'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Remaining:</span>
                          <span className="font-mono text-sm" data-testid="metric-rate-limit-remaining">
                            {metricsData.lastRateLimitRemaining ?? 'N/A'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Reset:</span>
                          <span className="font-mono text-sm" data-testid="metric-rate-limit-reset">
                            {metricsData.lastRateLimitReset ?? 'N/A'}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium">Calls by Status Code</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {metricsData.byStatus && Object.keys(metricsData.byStatus).length > 0 ? (
                        <div className="space-y-2">
                          {Object.entries(metricsData.byStatus)
                            .sort(([a], [b]) => a.localeCompare(b))
                            .map(([status, count]) => (
                              <div key={status} className="flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                  <Badge 
                                    variant={
                                      status.startsWith('2') ? 'default' : 
                                      status.startsWith('4') ? 'destructive' : 
                                      status.startsWith('5') ? 'destructive' : 
                                      'secondary'
                                    }
                                    data-testid={`badge-status-${status}`}
                                  >
                                    {status}
                                  </Badge>
                                </div>
                                <span className="font-semibold" data-testid={`count-status-${status}`}>
                                  {count}
                                </span>
                              </div>
                            ))}
                        </div>
                      ) : (
                        <div className="text-center py-4 text-muted-foreground">
                          No API calls recorded yet
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Failed to load metrics
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="push-notifications">
          <Card>
            <CardHeader>
              <CardTitle>Webhook Health</CardTitle>
              <CardDescription>
                Monitor real-time GoCanvas webhook processing (auto-refreshes every 10 seconds)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {webhookMetricsLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  Loading metrics...
                </div>
              ) : webhookMetricsData ? (
                <>
                  <div className="text-sm text-muted-foreground">
                    Server time: {new Date(webhookMetricsData.now).toLocaleString()}
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium">Webhook Summary</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Total received:</span>
                          <span className="font-semibold" data-testid="metric-push-total-received">
                            {webhookMetricsData.totalReceived}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Successfully processed:</span>
                          <span className="font-semibold text-green-600" data-testid="metric-push-total-processed">
                            {webhookMetricsData.totalProcessed}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Duplicates ignored:</span>
                          <span className="font-semibold text-yellow-600" data-testid="metric-push-duplicates">
                            {webhookMetricsData.duplicatesIgnored}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Non-target forms ignored:</span>
                          <span className="font-semibold text-blue-600" data-testid="metric-push-ignored-forms">
                            {webhookMetricsData.ignoredForms || 0}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Errors:</span>
                          <span className={`font-semibold ${webhookMetricsData.errors > 0 ? 'text-destructive' : ''}`} data-testid="metric-push-errors">
                            {webhookMetricsData.errors}
                          </span>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium">Performance</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Avg processing time:</span>
                          <span className="font-mono text-sm font-semibold" data-testid="metric-push-avg-time">
                            {webhookMetricsData.averageProcessingTime}ms
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Success rate:</span>
                          <span className="font-semibold text-green-600" data-testid="metric-push-success-rate">
                            {webhookMetricsData.totalReceived > 0
                              ? `${Math.round((webhookMetricsData.totalProcessed / webhookMetricsData.totalReceived) * 100)}%`
                              : 'N/A'}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium">Notifications by Form</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {webhookMetricsData.byForm && Object.keys(webhookMetricsData.byForm).length > 0 ? (
                        <div className="space-y-3">
                          {Object.entries(webhookMetricsData.byForm).map(([formId, count]) => {
                            const formName = 
                              formId === '5640587' ? 'Pickup Log' :
                              formId === '5654184' ? 'Emissions Service Log' :
                              formId === '5657146' ? 'Delivery Log' :
                              `Form ${formId}`;
                            const lastReceived = webhookMetricsData.lastReceivedByForm[formId];
                            
                            return (
                              <div key={formId} className="border rounded-lg p-3">
                                <div className="flex justify-between items-start mb-1">
                                  <div>
                                    <div className="font-medium">{formName}</div>
                                    <div className="text-xs text-muted-foreground font-mono">ID: {formId}</div>
                                  </div>
                                  <Badge variant="secondary" data-testid={`badge-form-${formId}`}>
                                    {count} notifications
                                  </Badge>
                                </div>
                                {lastReceived && (
                                  <div className="text-xs text-muted-foreground mt-2">
                                    Last received: {new Date(lastReceived).toLocaleString()}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-center py-4 text-muted-foreground">
                          No webhooks received yet
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {webhookMetricsData.totalReceived === 0 && (
                    <Card className="border-yellow-500/50 bg-yellow-50 dark:bg-yellow-950/20">
                      <CardContent className="pt-6">
                        <div className="text-sm">
                          <p className="font-medium text-yellow-800 dark:text-yellow-200 mb-2">
                            ⚠️ No webhooks received yet
                          </p>
                          <p className="text-yellow-700 dark:text-yellow-300 text-xs">
                            To enable webhooks, configure the webhook URL in GoCanvas:
                          </p>
                          <code className="block mt-2 p-2 bg-white dark:bg-gray-900 rounded text-xs font-mono">
                            https://your-domain.replit.app/api/gocanvas/webhook
                          </code>
                          <p className="text-yellow-700 dark:text-yellow-300 text-xs mt-2">
                            Set this URL for each form (Pickup, Emissions, Delivery) in the GoCanvas UI under Form Settings → Submission Webhooks.
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Failed to load webhook metrics
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
