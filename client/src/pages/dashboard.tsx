import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart3, Activity, CheckCircle, Clock, AlertTriangle } from "lucide-react";
import JobStatusBadge from "@/components/job-status-badge";

export default function Dashboard() {
  const { data: metrics, isLoading: metricsLoading } = useQuery<{
    activeJobs: number;
    completedToday: number;
    averageTurnaround: number;
    overdueJobs: number;
  }>({
    queryKey: ["/api/metrics"],
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  const { data: recentJobs = [], isLoading: jobsLoading } = useQuery<any[]>({
    queryKey: ["/api/jobs", { limit: 10 }],
  });

  if (metricsLoading || jobsLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-2">
          <BarChart3 className="h-6 w-6" />
          <h1 className="text-2xl font-bold">Dashboard Overview</h1>
        </div>
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const formatTurnaroundTime = (minutes: number | null): string => {
    if (!minutes) return "N/A";
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-[var(--ecs-dark)] flex items-center">
          <BarChart3 className="mr-2 h-5 w-5 sm:h-6 sm:w-6" />
          <span className="hidden sm:inline">Dashboard Overview</span>
          <span className="sm:hidden">Dashboard</span>
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground">Monitor job performance and turnaround times</p>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
        <Card className="metric-card">
          <CardContent className="p-3 sm:p-6 text-center">
            <div className="flex items-center justify-center mb-2">
              <Activity className="h-6 w-6 sm:h-8 sm:w-8 text-[var(--ecs-primary)]" />
            </div>
            <div className="metric-number text-[var(--ecs-primary)]">
              {metrics?.activeJobs || 0}
            </div>
            <div className="text-muted-foreground text-xs sm:text-sm">Active Jobs</div>
          </CardContent>
        </Card>

        <Card className="metric-card">
          <CardContent className="p-3 sm:p-6 text-center">
            <div className="flex items-center justify-center mb-2">
              <CheckCircle className="h-6 w-6 sm:h-8 sm:w-8 text-[var(--ecs-success)]" />
            </div>
            <div className="metric-number text-[var(--ecs-success)]">
              {metrics?.completedToday || 0}
            </div>
            <div className="text-muted-foreground text-xs sm:text-sm">Completed Today</div>
          </CardContent>
        </Card>

        <Card className="metric-card">
          <CardContent className="p-3 sm:p-6 text-center">
            <div className="flex items-center justify-center mb-2">
              <Clock className="h-6 w-6 sm:h-8 sm:w-8 text-[var(--ecs-warning)]" />
            </div>
            <div className="metric-number text-[var(--ecs-warning)]">
              {formatTurnaroundTime(metrics?.averageTurnaround || 0)}
            </div>
            <div className="text-muted-foreground text-xs sm:text-sm">Avg Turnaround</div>
          </CardContent>
        </Card>

        <Card className="metric-card">
          <CardContent className="p-3 sm:p-6 text-center">
            <div className="flex items-center justify-center mb-2">
              <AlertTriangle className="h-6 w-6 sm:h-8 sm:w-8 text-[var(--ecs-danger)]" />
            </div>
            <div className="metric-number text-[var(--ecs-danger)]">
              {metrics?.overdueJobs || 0}
            </div>
            <div className="text-muted-foreground text-xs sm:text-sm">Overdue Jobs</div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Jobs */}
      <Card>
        <CardHeader className="card-header">
          <CardTitle className="text-white">Recent Jobs</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-[var(--ecs-light)]">
                  <th className="text-left p-4 font-semibold text-[var(--ecs-dark)]">Job ID</th>
                  <th className="text-left p-4 font-semibold text-[var(--ecs-dark)]">Customer</th>
                  <th className="text-left p-4 font-semibold text-[var(--ecs-dark)]">Technician</th>
                  <th className="text-left p-4 font-semibold text-[var(--ecs-dark)]">Status</th>
                  <th className="text-left p-4 font-semibold text-[var(--ecs-dark)]">Initiated</th>
                  <th className="text-left p-4 font-semibold text-[var(--ecs-dark)]">Completed</th>
                  <th className="text-left p-4 font-semibold text-[var(--ecs-dark)]">Turnaround</th>
                </tr>
              </thead>
              <tbody>
                {recentJobs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center p-8 text-muted-foreground">
                      No jobs found. Create your first job to get started.
                    </td>
                  </tr>
                ) : (
                  recentJobs.map((job: any) => (
                    <tr key={job.id} className="border-b hover:bg-gray-50">
                      <td className="p-4">
                        <span className="job-id">{job.jobId}</span>
                      </td>
                      <td className="p-4">{job.storeName}</td>
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
                        {job.completedAt 
                          ? new Date(job.completedAt).toLocaleString()
                          : job.status === 'completed' 
                          ? 'N/A'
                          : '---'}
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
