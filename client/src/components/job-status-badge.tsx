import { Badge } from "@/components/ui/badge";

interface JobStatusBadgeProps {
  status: string;
}

export default function JobStatusBadge({ status }: JobStatusBadgeProps) {
  if (!status) {
    return <Badge className="bg-gray-100 text-gray-800">Unknown</Badge>;
  }

  const getStatusStyle = (status: string) => {
    switch (status.toLowerCase()) {
      case 'queued_for_pickup':
        return 'bg-blue-100 text-blue-800 hover:bg-blue-200';
      case 'picked_up':
        return 'bg-indigo-100 text-indigo-800 hover:bg-indigo-200';
      case 'at_shop':
        return 'bg-purple-100 text-purple-800 hover:bg-purple-200';
      case 'in_service':
        return 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200';
      case 'service_complete':
        return 'bg-lime-100 text-lime-800 hover:bg-lime-200';
      case 'ready_for_pickup':
      case 'delivered':
        return 'bg-green-100 text-green-800 hover:bg-green-200';
      case 'queued_for_delivery':
        return 'bg-cyan-100 text-cyan-800 hover:bg-cyan-200';
      case 'cancelled':
        return 'bg-red-100 text-red-800 hover:bg-red-200';
      default:
        return 'bg-gray-100 text-gray-800 hover:bg-gray-200';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status.toLowerCase()) {
      case 'queued_for_pickup':
        return 'Queued for Pickup';
      case 'picked_up':
        return 'Picked Up';
      case 'at_shop':
        return 'At Shop';
      case 'in_service':
        return 'In Service';
      case 'service_complete':
        return 'Service Complete';
      case 'ready_for_pickup':
        return 'Ready for Pickup';
      case 'queued_for_delivery':
        return 'Queued for Delivery';
      case 'delivered':
        return 'Delivered';
      case 'cancelled':
        return 'Cancelled';
      default:
        return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
  };

  return (
    <Badge className={`status-badge ${getStatusStyle(status)}`}>
      {getStatusLabel(status)}
    </Badge>
  );
}
