import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { List, Download } from "lucide-react";
import JobStatusBadge from "@/components/job-status-badge";

export default function JobList() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [technicianFilter, setTechnicianFilter] = useState<string>("all");

  const { data: jobs = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/jobs", { status: statusFilter, technician: technicianFilter }],
    refetchInterval: 30000,
  });

  const { data: technicians = [] } = useQuery<any[]>({
    queryKey: ["/api/technicians"],
  });

  const formatTurnaroundTime = (minutes: number | null): string => {
    if (!minutes) return "N/A";
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const handleExport = async () => {
    try {
      const response = await fetch("/api/jobs/export", { method: "POST" });
      const result = await response.json();
      console.log("Export result:", result);
      // In a real implementation, this would trigger a file download
      alert(`Export completed: ${result.success} jobs exported successfully`);
    } catch (error) {
      console.error("Export failed:", error);
      alert("Export failed. Please try again.");
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-2">
          <List className="h-6 w-6" />
          <h1 className="text-2xl font-bold">All Jobs</h1>
        </div>
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[var(--ecs-dark)] flex items-center">
            <List className="mr-2 h-5 w-5 sm:h-6 sm:w-6" />
            <span className="hidden sm:inline">All Jobs</span>
            <span className="sm:hidden">Jobs</span>
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">Complete list of all service jobs</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="in-progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={technicianFilter} onValueChange={setTechnicianFilter}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Filter by technician" />
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
          
          <Button variant="outline" onClick={handleExport} className="flex items-center space-x-2">
            <Download className="h-4 w-4" />
            <span>Export</span>
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-[var(--ecs-light)]">
                  <th className="text-left p-4 font-semibold text-[var(--ecs-dark)]">Job ID</th>
                  <th className="text-left p-4 font-semibold text-[var(--ecs-dark)]">Customer/Store</th>
                  <th className="text-left p-4 font-semibold text-[var(--ecs-dark)]">Contact</th>
                  <th className="text-left p-4 font-semibold text-[var(--ecs-dark)]">Technician</th>
                  <th className="text-left p-4 font-semibold text-[var(--ecs-dark)]">Status</th>
                  <th className="text-left p-4 font-semibold text-[var(--ecs-dark)]">Initiated</th>
                  <th className="text-left p-4 font-semibold text-[var(--ecs-dark)]">Completed</th>
                  <th className="text-left p-4 font-semibold text-[var(--ecs-dark)]">Turnaround</th>
                </tr>
              </thead>
              <tbody>
                {jobs.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center p-8 text-muted-foreground">
                      No jobs found. Try adjusting your filters or create a new job.
                    </td>
                  </tr>
                ) : (
                  jobs.map((job: any) => (
                    <tr key={job.id} className="border-b hover:bg-gray-50">
                      <td className="p-4">
                        <span className="job-id">{job.jobId}</span>
                      </td>
                      <td className="p-4">
                        <div>
                          <div className="font-medium">{job.storeName}</div>
                          <div className="text-sm text-muted-foreground">{job.customerName}</div>
                        </div>
                      </td>
                      <td className="p-4">
                        <div>
                          <div>{job.contactName}</div>
                          <div className="text-sm text-muted-foreground">{job.contactNumber}</div>
                        </div>
                      </td>
                      <td className="p-4">
                        {job.shopHandoff ? job.shopHandoff.split('@')[0] : 'Unassigned'}
                      </td>
                      <td className="p-4">
                        <JobStatusBadge status={job.status} />
                      </td>
                      <td className="p-4">
                        {new Date(job.initiatedAt).toLocaleString()}
                      </td>
                      <td className="p-4">
                        {job.completedAt ? new Date(job.completedAt).toLocaleString() : '-'}
                      </td>
                      <td className="p-4">
                        {job.status === 'completed' && job.turnaroundTime
                          ? formatTurnaroundTime(job.turnaroundTime)
                          : job.status === 'pending' || job.status === 'in-progress'
                          ? `${Math.round((Date.now() - new Date(job.initiatedAt).getTime()) / (1000 * 60))}m elapsed`
                          : 'N/A'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
