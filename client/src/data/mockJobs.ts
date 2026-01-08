// Mock job data for filter demo pages
// Includes varied statuses, dates, shops, and customers

export interface MockJob {
  id: string;
  shipTo: string;
  customerName: string;
  state: string;
  initiatedAt: string;
  completedAt: string | null;
  orderNumber: string;
  shopName: string;
}

// Helper to generate dates relative to today
const getDate = (daysAgo: number, hoursAgo: number = 0): string => {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  date.setHours(date.getHours() - hoursAgo);
  return date.toISOString();
};

export const mockJobs: MockJob[] = [
  // Recent jobs - today and yesterday
  {
    id: "ECS-20260108-001",
    shipTo: "123 Main St, Nashville",
    customerName: "ABC Corp",
    state: "at_shop",
    initiatedAt: getDate(0, 2),
    completedAt: null,
    orderNumber: "ORD-1001",
    shopName: "Nashville"
  },
  {
    id: "ECS-20260108-002",
    shipTo: "456 Oak Ave, Memphis",
    customerName: "XYZ Inc",
    state: "in_service",
    initiatedAt: getDate(0, 4),
    completedAt: null,
    orderNumber: "ORD-1002",
    shopName: "Memphis"
  },
  {
    id: "ECS-20260108-003",
    shipTo: "789 Pine Rd, Knoxville",
    customerName: "Test Company",
    state: "service_complete",
    initiatedAt: getDate(0, 6),
    completedAt: getDate(0, 1),
    orderNumber: "ORD-1003",
    shopName: "Knoxville"
  },
  {
    id: "ECS-20260108-004",
    shipTo: "321 Elm St, Nashville",
    customerName: "Acme Industries",
    state: "picked_up",
    initiatedAt: getDate(0, 8),
    completedAt: null,
    orderNumber: "ORD-1004",
    shopName: "Nashville"
  },
  {
    id: "ECS-20260108-005",
    shipTo: "654 Maple Dr, Memphis",
    customerName: "Global Tech",
    state: "queued_for_pickup",
    initiatedAt: getDate(0, 10),
    completedAt: null,
    orderNumber: "ORD-1005",
    shopName: "Memphis"
  },
  {
    id: "ECS-20260107-001",
    shipTo: "987 Cedar Ln, Knoxville",
    customerName: "Smith Bros",
    state: "shipment_inbound",
    initiatedAt: getDate(1, 2),
    completedAt: null,
    orderNumber: "ORD-1006",
    shopName: "Knoxville"
  },
  {
    id: "ECS-20260107-002",
    shipTo: "147 Birch Way, Nashville",
    customerName: "Johnson LLC",
    state: "ready_for_pickup",
    initiatedAt: getDate(1, 5),
    completedAt: getDate(1, 1),
    orderNumber: "ORD-1007",
    shopName: "Nashville"
  },
  {
    id: "ECS-20260107-003",
    shipTo: "258 Spruce Ct, Memphis",
    customerName: "Wilson Enterprises",
    state: "picked_up_from_shop",
    initiatedAt: getDate(1, 8),
    completedAt: null,
    orderNumber: "ORD-1008",
    shopName: "Memphis"
  },
  {
    id: "ECS-20260107-004",
    shipTo: "369 Willow Blvd, Knoxville",
    customerName: "Davis Group",
    state: "queued_for_delivery",
    initiatedAt: getDate(1, 12),
    completedAt: null,
    orderNumber: "ORD-1009",
    shopName: "Knoxville"
  },
  {
    id: "ECS-20260107-005",
    shipTo: "741 Ash Pkwy, Nashville",
    customerName: "Miller Co",
    state: "delivered",
    initiatedAt: getDate(1, 15),
    completedAt: getDate(1, 2),
    orderNumber: "ORD-1010",
    shopName: "Nashville"
  },

  // Last week jobs
  {
    id: "ECS-20260105-001",
    shipTo: "852 Poplar St, Memphis",
    customerName: "Taylor Manufacturing",
    state: "outbound_shipment",
    initiatedAt: getDate(3, 0),
    completedAt: null,
    orderNumber: "ORD-1011",
    shopName: "Memphis"
  },
  {
    id: "ECS-20260105-002",
    shipTo: "963 Walnut Ave, Knoxville",
    customerName: "Anderson Inc",
    state: "delivered",
    initiatedAt: getDate(3, 6),
    completedAt: getDate(3, 2),
    orderNumber: "ORD-1012",
    shopName: "Knoxville"
  },
  {
    id: "ECS-20260104-001",
    shipTo: "159 Cherry Dr, Nashville",
    customerName: "Thomas Partners",
    state: "at_shop",
    initiatedAt: getDate(4, 0),
    completedAt: null,
    orderNumber: "ORD-1013",
    shopName: "Nashville"
  },
  {
    id: "ECS-20260104-002",
    shipTo: "357 Hickory Rd, Memphis",
    customerName: "Moore Solutions",
    state: "in_service",
    initiatedAt: getDate(4, 8),
    completedAt: null,
    orderNumber: "ORD-1014",
    shopName: "Memphis"
  },
  {
    id: "ECS-20260103-001",
    shipTo: "486 Dogwood Ln, Knoxville",
    customerName: "White Industries",
    state: "service_complete",
    initiatedAt: getDate(5, 0),
    completedAt: getDate(4, 20),
    orderNumber: "ORD-1015",
    shopName: "Knoxville"
  },
  {
    id: "ECS-20260103-002",
    shipTo: "624 Magnolia Ct, Nashville",
    customerName: "Harris Group",
    state: "ready_for_pickup",
    initiatedAt: getDate(5, 6),
    completedAt: getDate(5, 2),
    orderNumber: "ORD-1016",
    shopName: "Nashville"
  },
  {
    id: "ECS-20260102-001",
    shipTo: "735 Sycamore Way, Memphis",
    customerName: "Martin Tech",
    state: "picked_up_from_shop",
    initiatedAt: getDate(6, 0),
    completedAt: null,
    orderNumber: "ORD-1017",
    shopName: "Memphis"
  },
  {
    id: "ECS-20260102-002",
    shipTo: "846 Redwood Blvd, Knoxville",
    customerName: "Thompson Co",
    state: "delivered",
    initiatedAt: getDate(6, 10),
    completedAt: getDate(6, 4),
    orderNumber: "ORD-1018",
    shopName: "Knoxville"
  },
  {
    id: "ECS-20260101-001",
    shipTo: "957 Cypress Pkwy, Nashville",
    customerName: "Garcia Enterprises",
    state: "delivered",
    initiatedAt: getDate(7, 0),
    completedAt: getDate(6, 18),
    orderNumber: "ORD-1019",
    shopName: "Nashville"
  },
  {
    id: "ECS-20260101-002",
    shipTo: "168 Beech St, Memphis",
    customerName: "Martinez LLC",
    state: "outbound_shipment",
    initiatedAt: getDate(7, 8),
    completedAt: null,
    orderNumber: "ORD-1020",
    shopName: "Memphis"
  },

  // Older jobs - 2-3 weeks ago
  {
    id: "ECS-20251228-001",
    shipTo: "279 Juniper Ave, Knoxville",
    customerName: "Robinson Industries",
    state: "delivered",
    initiatedAt: getDate(11, 0),
    completedAt: getDate(10, 12),
    orderNumber: "ORD-1021",
    shopName: "Knoxville"
  },
  {
    id: "ECS-20251227-001",
    shipTo: "381 Fir Dr, Nashville",
    customerName: "Clark Manufacturing",
    state: "delivered",
    initiatedAt: getDate(12, 0),
    completedAt: getDate(11, 20),
    orderNumber: "ORD-1022",
    shopName: "Nashville"
  },
  {
    id: "ECS-20251226-001",
    shipTo: "492 Hemlock Rd, Memphis",
    customerName: "Rodriguez Group",
    state: "at_shop",
    initiatedAt: getDate(13, 0),
    completedAt: null,
    orderNumber: "ORD-1023",
    shopName: "Memphis"
  },
  {
    id: "ECS-20251225-001",
    shipTo: "513 Sequoia Ln, Knoxville",
    customerName: "Lewis Partners",
    state: "in_service",
    initiatedAt: getDate(14, 0),
    completedAt: null,
    orderNumber: "ORD-1024",
    shopName: "Knoxville"
  },
  {
    id: "ECS-20251224-001",
    shipTo: "624 Cottonwood Ct, Nashville",
    customerName: "Lee Solutions",
    state: "service_complete",
    initiatedAt: getDate(15, 0),
    completedAt: getDate(14, 18),
    orderNumber: "ORD-1025",
    shopName: "Nashville"
  },
  {
    id: "ECS-20251223-001",
    shipTo: "735 Palm Way, Memphis",
    customerName: "Walker Tech",
    state: "picked_up",
    initiatedAt: getDate(16, 0),
    completedAt: null,
    orderNumber: "ORD-1026",
    shopName: "Memphis"
  },
  {
    id: "ECS-20251222-001",
    shipTo: "846 Bamboo Blvd, Knoxville",
    customerName: "Hall Industries",
    state: "queued_for_pickup",
    initiatedAt: getDate(17, 0),
    completedAt: null,
    orderNumber: "ORD-1027",
    shopName: "Knoxville"
  },
  {
    id: "ECS-20251221-001",
    shipTo: "957 Laurel Pkwy, Nashville",
    customerName: "Allen Enterprises",
    state: "shipment_inbound",
    initiatedAt: getDate(18, 0),
    completedAt: null,
    orderNumber: "ORD-1028",
    shopName: "Nashville"
  },
  {
    id: "ECS-20251220-001",
    shipTo: "168 Ironwood St, Memphis",
    customerName: "Young Group",
    state: "ready_for_pickup",
    initiatedAt: getDate(19, 0),
    completedAt: getDate(18, 16),
    orderNumber: "ORD-1029",
    shopName: "Memphis"
  },
  {
    id: "ECS-20251219-001",
    shipTo: "279 Mahogany Ave, Knoxville",
    customerName: "King Manufacturing",
    state: "delivered",
    initiatedAt: getDate(20, 0),
    completedAt: getDate(19, 14),
    orderNumber: "ORD-1030",
    shopName: "Knoxville"
  },

  // Month old jobs
  {
    id: "ECS-20251215-001",
    shipTo: "381 Rosewood Dr, Nashville",
    customerName: "Wright Co",
    state: "delivered",
    initiatedAt: getDate(24, 0),
    completedAt: getDate(23, 10),
    orderNumber: "ORD-1031",
    shopName: "Nashville"
  },
  {
    id: "ECS-20251214-001",
    shipTo: "492 Ebony Rd, Memphis",
    customerName: "Lopez Partners",
    state: "delivered",
    initiatedAt: getDate(25, 0),
    completedAt: getDate(24, 8),
    orderNumber: "ORD-1032",
    shopName: "Memphis"
  },
  {
    id: "ECS-20251213-001",
    shipTo: "513 Teak Ln, Knoxville",
    customerName: "Hill Solutions",
    state: "delivered",
    initiatedAt: getDate(26, 0),
    completedAt: getDate(25, 12),
    orderNumber: "ORD-1033",
    shopName: "Knoxville"
  },
  {
    id: "ECS-20251212-001",
    shipTo: "624 Sandalwood Ct, Nashville",
    customerName: "Scott Tech",
    state: "at_shop",
    initiatedAt: getDate(27, 0),
    completedAt: null,
    orderNumber: "ORD-1034",
    shopName: "Nashville"
  },
  {
    id: "ECS-20251211-001",
    shipTo: "735 Pinewood Way, Memphis",
    customerName: "Green Industries",
    state: "in_service",
    initiatedAt: getDate(28, 0),
    completedAt: null,
    orderNumber: "ORD-1035",
    shopName: "Memphis"
  },
  {
    id: "ECS-20251210-001",
    shipTo: "846 Cedarwood Blvd, Knoxville",
    customerName: "Adams Enterprises",
    state: "service_complete",
    initiatedAt: getDate(29, 0),
    completedAt: getDate(28, 16),
    orderNumber: "ORD-1036",
    shopName: "Knoxville"
  },
  {
    id: "ECS-20251209-001",
    shipTo: "957 Maplewood Pkwy, Nashville",
    customerName: "Baker Group",
    state: "picked_up",
    initiatedAt: getDate(30, 0),
    completedAt: null,
    orderNumber: "ORD-1037",
    shopName: "Nashville"
  },
  {
    id: "ECS-20251208-001",
    shipTo: "168 Elmwood St, Memphis",
    customerName: "Nelson Manufacturing",
    state: "delivered",
    initiatedAt: getDate(31, 0),
    completedAt: getDate(30, 12),
    orderNumber: "ORD-1038",
    shopName: "Memphis"
  },

  // Additional varied examples
  {
    id: "ECS-20251207-001",
    shipTo: "279 Oakwood Ave, Knoxville",
    customerName: "Carter Co",
    state: "queued_for_delivery",
    initiatedAt: getDate(32, 0),
    completedAt: null,
    orderNumber: "ORD-1039",
    shopName: "Knoxville"
  },
  {
    id: "ECS-20251206-001",
    shipTo: "381 Birchwood Dr, Nashville",
    customerName: "Mitchell Partners",
    state: "outbound_shipment",
    initiatedAt: getDate(33, 0),
    completedAt: null,
    orderNumber: "ORD-1040",
    shopName: "Nashville"
  },
  {
    id: "ECS-20251205-001",
    shipTo: "492 Ashwood Rd, Memphis",
    customerName: "Perez Solutions",
    state: "delivered",
    initiatedAt: getDate(34, 0),
    completedAt: getDate(33, 10),
    orderNumber: "ORD-1041",
    shopName: "Memphis"
  },
  {
    id: "ECS-20251204-001",
    shipTo: "513 Firwood Ln, Knoxville",
    customerName: "Roberts Tech",
    state: "picked_up_from_shop",
    initiatedAt: getDate(35, 0),
    completedAt: null,
    orderNumber: "ORD-1042",
    shopName: "Knoxville"
  },
  {
    id: "ECS-20251203-001",
    shipTo: "624 Sprucewood Ct, Nashville",
    customerName: "Turner Industries",
    state: "at_shop",
    initiatedAt: getDate(36, 0),
    completedAt: null,
    orderNumber: "ORD-1043",
    shopName: "Nashville"
  },
  {
    id: "ECS-20251202-001",
    shipTo: "735 Willowwood Way, Memphis",
    customerName: "Phillips Enterprises",
    state: "in_service",
    initiatedAt: getDate(37, 0),
    completedAt: null,
    orderNumber: "ORD-1044",
    shopName: "Memphis"
  },
  {
    id: "ECS-20251201-001",
    shipTo: "846 Redwood Blvd, Knoxville",
    customerName: "Campbell Group",
    state: "service_complete",
    initiatedAt: getDate(38, 0),
    completedAt: getDate(37, 14),
    orderNumber: "ORD-1045",
    shopName: "Knoxville"
  },
  {
    id: "ECS-20251130-001",
    shipTo: "957 Cypress Pkwy, Nashville",
    customerName: "Parker Manufacturing",
    state: "ready_for_pickup",
    initiatedAt: getDate(39, 0),
    completedAt: getDate(38, 16),
    orderNumber: "ORD-1046",
    shopName: "Nashville"
  },
  {
    id: "ECS-20251129-001",
    shipTo: "168 Juniper St, Memphis",
    customerName: "Evans Co",
    state: "delivered",
    initiatedAt: getDate(40, 0),
    completedAt: getDate(39, 12),
    orderNumber: "ORD-1047",
    shopName: "Memphis"
  },
  {
    id: "ECS-20251128-001",
    shipTo: "279 Sequoia Ave, Knoxville",
    customerName: "Edwards Partners",
    state: "shipment_inbound",
    initiatedAt: getDate(41, 0),
    completedAt: null,
    orderNumber: "ORD-1048",
    shopName: "Knoxville"
  },
  {
    id: "ECS-20251127-001",
    shipTo: "381 Cottonwood Dr, Nashville",
    customerName: "Collins Solutions",
    state: "delivered",
    initiatedAt: getDate(42, 0),
    completedAt: getDate(41, 8),
    orderNumber: "ORD-1049",
    shopName: "Nashville"
  },
  {
    id: "ECS-20251126-001",
    shipTo: "492 Palm Rd, Memphis",
    customerName: "Stewart Tech",
    state: "queued_for_pickup",
    initiatedAt: getDate(43, 0),
    completedAt: null,
    orderNumber: "ORD-1050",
    shopName: "Memphis"
  }
];

// Helper function to filter mock jobs based on filter criteria
export const filterMockJobs = (
  jobs: MockJob[],
  filters: {
    shop?: string;
    status?: string[];
    search?: string;
    dateFrom?: string;
    dateTo?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }
): MockJob[] => {
  let filtered = [...jobs];

  // Filter by shop
  if (filters.shop && filters.shop !== 'all') {
    filtered = filtered.filter(job => job.shopName === filters.shop);
  }

  // Filter by status
  if (filters.status && filters.status.length > 0) {
    filtered = filtered.filter(job => filters.status!.includes(job.state));
  }

  // Filter by search (job ID or customer name)
  if (filters.search) {
    const searchLower = filters.search.toLowerCase();
    filtered = filtered.filter(job =>
      job.id.toLowerCase().includes(searchLower) ||
      job.customerName.toLowerCase().includes(searchLower)
    );
  }

  // Filter by date range
  if (filters.dateFrom) {
    const fromDate = new Date(filters.dateFrom);
    filtered = filtered.filter(job => new Date(job.initiatedAt) >= fromDate);
  }
  if (filters.dateTo) {
    const toDate = new Date(filters.dateTo);
    toDate.setHours(23, 59, 59, 999); // Include entire end date
    filtered = filtered.filter(job => new Date(job.initiatedAt) <= toDate);
  }

  // Sort
  const sortBy = filters.sortBy || 'initiatedAt';
  const sortOrder = filters.sortOrder || 'desc';

  filtered.sort((a, b) => {
    let aValue: any;
    let bValue: any;

    switch (sortBy) {
      case 'customerName':
        aValue = a.customerName;
        bValue = b.customerName;
        break;
      case 'state':
        aValue = a.state;
        bValue = b.state;
        break;
      case 'completedAt':
        aValue = a.completedAt || '';
        bValue = b.completedAt || '';
        break;
      case 'initiatedAt':
      default:
        aValue = a.initiatedAt;
        bValue = b.initiatedAt;
        break;
    }

    if (typeof aValue === 'string' && typeof bValue === 'string') {
      const comparison = aValue.localeCompare(bValue);
      return sortOrder === 'asc' ? comparison : -comparison;
    }

    return 0;
  });

  return filtered;
};
