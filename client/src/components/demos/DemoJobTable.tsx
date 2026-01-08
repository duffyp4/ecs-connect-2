import { MockJob } from "@/data/mockJobs";
import JobStatusBadge from "@/components/job-status-badge";
import { Card, CardContent } from "@/components/ui/card";

interface DemoJobTableProps {
  jobs: MockJob[];
}

export default function DemoJobTable({ jobs }: DemoJobTableProps) {
  return (
    <Card className="border border-gray-200 shadow-sm">
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left p-4 font-semibold text-[var(--ecs-dark)]">Ship To</th>
                <th className="text-left p-4 font-semibold text-[var(--ecs-dark)]">Customer Name</th>
                <th className="text-left p-4 font-semibold text-[var(--ecs-dark)]">Current Status</th>
                <th className="text-left p-4 font-semibold text-[var(--ecs-dark)]">Initiated</th>
                <th className="text-left p-4 font-semibold text-[var(--ecs-dark)]">Completed</th>
                <th className="text-left p-4 font-semibold text-[var(--ecs-dark)]">Order Number</th>
              </tr>
            </thead>
            <tbody>
              {jobs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center p-8 text-muted-foreground">
                    No jobs found. Try adjusting your filters.
                  </td>
                </tr>
              ) : (
                jobs.map((job) => (
                  <tr key={job.id} className="border-b hover:bg-gray-50">
                    <td className="p-4">
                      <span className="job-id" data-testid={`link-job-${job.id}`}>
                        {job.shipTo}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="font-medium">{job.customerName}</div>
                    </td>
                    <td className="p-4">
                      <JobStatusBadge status={job.state} />
                    </td>
                    <td className="p-4">
                      {new Date(job.initiatedAt).toLocaleString()}
                    </td>
                    <td className="p-4">
                      {job.completedAt ? new Date(job.completedAt).toLocaleString() : '-'}
                    </td>
                    <td className="p-4">
                      <div className="font-medium">{job.orderNumber}</div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
