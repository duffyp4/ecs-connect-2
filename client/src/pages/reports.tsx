import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { FileText, FileSpreadsheet, FileDown, Search } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function Reports() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dateRange, setDateRange] = useState<string>("month");
  const [technicianFilter, setTechnicianFilter] = useState<string>("all");
  const [customerFilter, setCustomerFilter] = useState<string>("all");

  const { data: jobs = [] } = useQuery<any[]>({
    queryKey: ["/api/jobs"],
  });

  const { data: technicians = [] } = useQuery<any[]>({
    queryKey: ["/api/technicians"],
  });

  const exportMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/jobs/export", {});
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Export Successful",
        description: `${data.success} jobs exported to Google Sheets successfully.`,
      });
    },
    onError: (error) => {
      toast({
        title: "Export Failed",
        description: "Failed to export jobs. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Calculate report metrics
  const calculateMetrics = () => {
    const completedJobs = jobs.filter((job: any) => job.currentState === 'delivered' && job.turnaroundTime);
    
    if (completedJobs.length === 0) {
      return {
        avgTurnaround: 0,
        medianTurnaround: 0,
        maxTurnaround: 0,
        slaCompliance: 0,
        totalJobs: jobs.length,
        completedJobs: 0,
      };
    }

    const turnaroundTimes = completedJobs.map((job: any) => job.turnaroundTime);
    turnaroundTimes.sort((a: number, b: number) => a - b);

    const avgMinutes = turnaroundTimes.reduce((sum: number, time: number) => sum + time, 0) / turnaroundTimes.length;
    const medianMinutes = turnaroundTimes[Math.floor(turnaroundTimes.length / 2)];
    const maxMinutes = Math.max(...turnaroundTimes);

    // SLA compliance (assuming 4 hours = 240 minutes)
    const slaJobs = completedJobs.filter((job: any) => job.turnaroundTime <= 240);
    const slaCompliance = (slaJobs.length / completedJobs.length) * 100;

    return {
      avgTurnaround: avgMinutes / 60, // Convert to hours
      medianTurnaround: medianMinutes / 60,
      maxTurnaround: maxMinutes / 60,
      slaCompliance,
      totalJobs: jobs.length,
      completedJobs: completedJobs.length,
    };
  };

  // Calculate technician performance
  const calculateTechnicianPerformance = () => {
    const techPerformance: { [key: string]: { jobs: number; avgTime: number; name: string } } = {};

    jobs.forEach((job: any) => {
      if (job.currentState === 'delivered' && job.turnaroundTime && job.shopHandoff) {
        const techEmail = job.shopHandoff;
        const tech = technicians.find((t: any) => t.email === techEmail);
        const techName = tech ? tech.name : techEmail.split('@')[0];

        if (!techPerformance[techEmail]) {
          techPerformance[techEmail] = { jobs: 0, avgTime: 0, name: techName };
        }

        techPerformance[techEmail].jobs += 1;
        techPerformance[techEmail].avgTime += job.turnaroundTime;
      }
    });

    // Calculate averages
    Object.keys(techPerformance).forEach(email => {
      techPerformance[email].avgTime = techPerformance[email].avgTime / techPerformance[email].jobs / 60; // Convert to hours
    });

    return Object.values(techPerformance);
  };

  const metrics = calculateMetrics();
  const techPerformance = calculateTechnicianPerformance();

  const handleExport = (type: 'sheets' | 'excel') => {
    if (type === 'sheets') {
      exportMutation.mutate();
    } else {
      // Placeholder for Excel export
      toast({
        title: "Feature Coming Soon",
        description: "Excel export functionality will be available in a future update.",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--ecs-dark)] flex items-center">
          <FileText className="mr-2 h-6 w-6" />
          Reports & Analytics
        </h1>
        <p className="text-muted-foreground">Performance metrics and turnaround time analysis</p>
      </div>

      {/* Report Controls */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card className="md:col-span-2">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Date Range</label>
                <Select value={dateRange} onValueChange={setDateRange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="today">Today</SelectItem>
                    <SelectItem value="week">This Week</SelectItem>
                    <SelectItem value="month">This Month</SelectItem>
                    <SelectItem value="quarter">This Quarter</SelectItem>
                    <SelectItem value="custom">Custom Range</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Technician</label>
                <Select value={technicianFilter} onValueChange={setTechnicianFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Technicians</SelectItem>
                    {technicians.map((tech: any) => (
                      <SelectItem key={tech.id} value={tech.email}>
                        {tech.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Customer</label>
                <Select value={customerFilter} onValueChange={setCustomerFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Customers</SelectItem>
                    <SelectItem value="walmart">Walmart</SelectItem>
                    <SelectItem value="target">Target</SelectItem>
                    <SelectItem value="homedepot">Home Depot</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex items-end">
                <Button className="w-full btn-primary flex items-center space-x-2">
                  <Search className="h-4 w-4" />
                  <span>Generate Report</span>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-center">Export Options</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button 
              variant="outline" 
              className="w-full flex items-center space-x-2"
              onClick={() => handleExport('sheets')}
              disabled={exportMutation.isPending}
            >
              <FileSpreadsheet className="h-4 w-4" />
              <span>Google Sheets</span>
            </Button>
            <Button 
              variant="outline" 
              className="w-full flex items-center space-x-2"
              onClick={() => handleExport('excel')}
            >
              <FileDown className="h-4 w-4" />
              <span>Excel Export</span>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Performance Summary */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="card-header">
            <CardTitle className="text-white">Turnaround Time Analysis</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-3 gap-4 text-center mb-6">
              <div>
                <div className="text-2xl font-bold text-[var(--ecs-success)]">
                  {metrics.avgTurnaround.toFixed(1)}h
                </div>
                <div className="text-sm text-muted-foreground">Average</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-[var(--ecs-primary)]">
                  {metrics.medianTurnaround.toFixed(1)}h
                </div>
                <div className="text-sm text-muted-foreground">Median</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-[var(--ecs-warning)]">
                  {metrics.maxTurnaround.toFixed(1)}h
                </div>
                <div className="text-sm text-muted-foreground">Longest</div>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>SLA Compliance (4 hours)</span>
                <span>{metrics.slaCompliance.toFixed(0)}%</span>
              </div>
              <Progress value={metrics.slaCompliance} className="h-2" />
              <div className="text-xs text-muted-foreground">
                {metrics.completedJobs} of {metrics.totalJobs} jobs completed within SLA
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="card-header">
            <CardTitle className="text-white">Technician Performance</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-4">
              {techPerformance.length === 0 ? (
                <div className="text-center text-muted-foreground py-4">
                  No completed jobs found for performance analysis.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2">Technician</th>
                        <th className="text-right py-2">Jobs</th>
                        <th className="text-right py-2">Avg Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {techPerformance.map((tech, index) => (
                        <tr key={index} className="border-b">
                          <td className="py-2">{tech.name}</td>
                          <td className="text-right py-2">{tech.jobs}</td>
                          <td className="text-right py-2">{tech.avgTime.toFixed(1)}h</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
