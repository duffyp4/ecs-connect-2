import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { BarChart3, Activity, CheckCircle, Clock } from "lucide-react";

export default function Dashboard() {
  const { data: metrics, isLoading: metricsLoading } = useQuery<{
    activeJobs: number;
    completedToday: number;
    averageTurnaround: number;
    averageTimeWithTech: number;
    overdueJobs: number;
  }>({
    queryKey: ["/api/metrics"],
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  if (metricsLoading) {
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
    if (!minutes || minutes === 0) return "N/A";
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0 && mins > 0) {
      return `${hours}h ${mins}m`;
    } else if (hours > 0) {
      return `${hours}h`;
    } else {
      return `${mins}m`;
    }
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
            <div className="text-muted-foreground text-xs sm:text-sm">Avg Full Turnaround</div>
          </CardContent>
        </Card>

        <Card className="metric-card">
          <CardContent className="p-3 sm:p-6 text-center">
            <div className="flex items-center justify-center mb-2">
              <Clock className="h-6 w-6 sm:h-8 sm:w-8 text-[var(--ecs-info)]" />
            </div>
            <div className="metric-number text-[var(--ecs-info)]">
              {formatTurnaroundTime(metrics?.averageTimeWithTech || 0)}
            </div>
            <div className="text-muted-foreground text-xs sm:text-sm">Avg Time with Tech</div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
