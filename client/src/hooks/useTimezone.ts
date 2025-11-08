import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";

export function useTimezone() {
  const { data: user } = useQuery<any>({
    queryKey: ['/api/auth/user'],
  });

  const timezone = user?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;

  const formatDateTime = (dateString: string | Date | null | undefined, formatStr: string = 'MMM d, yyyy h:mm a') => {
    if (!dateString) return 'N/A';
    
    try {
      const date = typeof dateString === 'string' ? parseISO(dateString) : dateString;
      return formatInTimeZone(date, timezone, formatStr);
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Invalid date';
    }
  };

  const formatDate = (dateString: string | Date | null | undefined) => {
    return formatDateTime(dateString, 'MMM d, yyyy');
  };

  const formatTime = (dateString: string | Date | null | undefined) => {
    return formatDateTime(dateString, 'h:mm a');
  };

  const formatDateTimeLong = (dateString: string | Date | null | undefined) => {
    return formatDateTime(dateString, 'MMMM d, yyyy h:mm:ss a');
  };

  return {
    timezone,
    formatDateTime,
    formatDate,
    formatTime,
    formatDateTimeLong,
  };
}
