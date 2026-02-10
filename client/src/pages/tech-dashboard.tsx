import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Wrench, Clock, CheckCircle2, FileText } from "lucide-react";

interface FormSubmission {
  id: string;
  jobId: string;
  formType: string;
  status: string;
  prefilledData: Record<string, unknown> | null;
  dispatchedAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

function statusBadge(status: string) {
  switch (status) {
    case "dispatched":
      return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300">New</Badge>;
    case "in_progress":
      return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300">In Progress</Badge>;
    case "completed":
      return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">Completed</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function TechDashboard() {
  const { user } = useAuth();

  const { data: submissions, isLoading } = useQuery<FormSubmission[]>({
    queryKey: [`/api/form-submissions/assigned/${user?.email}`],
    enabled: !!user?.email,
  });

  // Only show emissions forms for technicians
  const techForms = submissions?.filter((s) => s.formType === "emissions");
  const pending = techForms?.filter((s) => s.status !== "completed") ?? [];
  const completed = techForms?.filter((s) => s.status === "completed") ?? [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold">My Jobs</h1>
        <p className="text-sm text-muted-foreground">
          Emissions service forms assigned to you
        </p>
      </div>

      {pending.length === 0 && completed.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Wrench className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium">No forms assigned yet</p>
            <p className="text-sm mt-1">New jobs will appear here when dispatched to you.</p>
          </CardContent>
        </Card>
      )}

      {pending.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Active ({pending.length})
          </h2>
          <div className="grid grid-cols-1 gap-3">
            {pending.map((sub) => {
              const prefill = sub.prefilledData ?? {};
              return (
                <Card key={sub.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">Job {sub.jobId}</CardTitle>
                      {statusBadge(sub.status)}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">Customer</span>
                        <p className="font-medium">{(prefill.customerName as string) || "—"}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Shop</span>
                        <p className="font-medium">{(prefill.shopName as string) || "—"}</p>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Dispatched {formatDate(sub.dispatchedAt)}
                    </div>
                    <Link href={`/emissions-form/${sub.id}`}>
                      <Button className="w-full mt-2" size="sm">
                        <FileText className="h-4 w-4 mr-2" />
                        {sub.status === "dispatched" ? "Start Form" : "Continue Form"}
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {completed.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5" />
            Completed ({completed.length})
          </h2>
          <div className="grid grid-cols-1 gap-3">
            {completed.map((sub) => {
              const prefill = sub.prefilledData ?? {};
              return (
                <Card key={sub.id} className="opacity-75">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">Job {sub.jobId}</CardTitle>
                      {statusBadge(sub.status)}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">Customer</span>
                        <p className="font-medium">{(prefill.customerName as string) || "—"}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Completed</span>
                        <p className="font-medium">{sub.completedAt ? formatDate(sub.completedAt) : "—"}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
