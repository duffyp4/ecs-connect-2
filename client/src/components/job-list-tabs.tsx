import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@/components/ui/context-menu";
import { Plus, X, Pin } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";

export interface FilterState {
  shop: string;
  status: string[];
  search: string;
  dateFrom: string;
  dateTo: string;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  pageSize: number;
}

export interface JobListTab {
  id: string;
  userId: string;
  name: string;
  filters: FilterState;
  isPinned: number;
  position: number;
  createdAt: string;
  updatedAt: string;
}

interface JobListTabsProps {
  currentFilters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
}

const getDefaultFilters = (): FilterState => ({
  shop: '',
  status: [],
  search: '',
  dateFrom: '',
  dateTo: '',
  sortBy: 'initiatedAt',
  sortOrder: 'desc',
  pageSize: 25,
});

const getDefaultTabs = (): { name: string; filters: FilterState; isPinned: boolean; position: number }[] => {
  return [
    {
      name: 'All Jobs',
      filters: getDefaultFilters(),
      isPinned: false,
      position: 0,
    },
    {
      name: 'In Progress',
      filters: {
        ...getDefaultFilters(),
        status: ['at_shop', 'in_service'],
      },
      isPinned: false,
      position: 1,
    },
    {
      name: 'Ready',
      filters: {
        ...getDefaultFilters(),
        status: ['service_complete', 'ready_for_pickup'],
      },
      isPinned: false,
      position: 2,
    },
  ];
};

export default function JobListTabs({ currentFilters, onFiltersChange }: JobListTabsProps) {
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renamingTabId, setRenamingTabId] = useState<string | null>(null);
  const [newTabName, setNewTabName] = useState('');
  const [isInitialized, setIsInitialized] = useState(false);

  const { data: tabs = [], isLoading } = useQuery<JobListTab[]>({
    queryKey: ['/api/user/tabs'],
  });

  const createTabMutation = useMutation({
    mutationFn: async (tab: { name: string; filters: FilterState; isPinned?: boolean; position?: number }) => {
      return apiRequest('POST', '/api/user/tabs', tab);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user/tabs'] });
    },
  });

  const updateTabMutation = useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; name?: string; filters?: FilterState; isPinned?: boolean }) => {
      return apiRequest('PATCH', `/api/user/tabs/${id}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user/tabs'] });
    },
  });

  const deleteTabMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest('DELETE', `/api/user/tabs/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user/tabs'] });
    },
  });

  // Create default tabs if user has none
  useEffect(() => {
    if (!isLoading && tabs.length === 0 && !isInitialized) {
      setIsInitialized(true);
      const defaultTabs = getDefaultTabs();
      defaultTabs.forEach((tab) => {
        createTabMutation.mutate(tab);
      });
    }
  }, [isLoading, tabs.length, isInitialized]);

  // Set active tab on initial load
  useEffect(() => {
    console.log('[TabsEffect] Running - tabs.length:', tabs.length, 'activeTabId:', activeTabId);
    if (tabs.length > 0 && !activeTabId) {
      const savedTabId = sessionStorage.getItem('ecs-active-tab-id');
      const foundTab = savedTabId ? tabs.find(t => t.id === savedTabId) : null;
      console.log('[TabsEffect] EXECUTING BODY - will call onFiltersChange with:', foundTab?.filters || tabs[0]?.filters);
      if (foundTab) {
        setActiveTabId(foundTab.id);
        onFiltersChange(foundTab.filters);
      } else {
        setActiveTabId(tabs[0].id);
        onFiltersChange(tabs[0].filters);
      }
    } else {
      console.log('[TabsEffect] Skipped - guard failed');
    }
  }, [tabs, activeTabId, onFiltersChange]);

  // Save active tab to session storage
  useEffect(() => {
    if (activeTabId) {
      sessionStorage.setItem('ecs-active-tab-id', activeTabId);
    }
  }, [activeTabId]);

  // Auto-save filter changes to active tab (debounced)
  const saveFiltersToActiveTab = useCallback(() => {
    if (!activeTabId) return;
    const activeTab = tabs.find(t => t.id === activeTabId);
    if (!activeTab || activeTab.isPinned) return;
    
    const filtersChanged = JSON.stringify(activeTab.filters) !== JSON.stringify(currentFilters);
    if (filtersChanged) {
      updateTabMutation.mutate({ id: activeTabId, filters: currentFilters });
    }
  }, [activeTabId, tabs, currentFilters, updateTabMutation]);

  useEffect(() => {
    const timeout = setTimeout(saveFiltersToActiveTab, 1500);
    return () => clearTimeout(timeout);
  }, [currentFilters, saveFiltersToActiveTab]);

  const handleTabClick = (tabId: string) => {
    const tab = tabs.find(t => t.id === tabId);
    if (tab) {
      setActiveTabId(tabId);
      onFiltersChange(tab.filters);
    }
  };

  const handleNewTab = () => {
    createTabMutation.mutate({
      name: 'New Tab',
      filters: getDefaultFilters(),
      position: tabs.length,
    }, {
      onSuccess: (newTab: any) => {
        setActiveTabId(newTab.id);
        onFiltersChange(getDefaultFilters());
      },
    });
  };

  const handleCloseTab = (tabId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (tabs.length === 1) return;

    const tabIndex = tabs.findIndex(t => t.id === tabId);
    deleteTabMutation.mutate(tabId);

    if (tabId === activeTabId) {
      const remainingTabs = tabs.filter(t => t.id !== tabId);
      const newActiveIndex = Math.min(tabIndex, remainingTabs.length - 1);
      const newActiveTab = remainingTabs[newActiveIndex];
      if (newActiveTab) {
        setActiveTabId(newActiveTab.id);
        onFiltersChange(newActiveTab.filters);
      }
    }
  };

  const handleRename = (tabId: string) => {
    const tab = tabs.find(t => t.id === tabId);
    if (tab) {
      setRenamingTabId(tabId);
      setNewTabName(tab.name);
      setRenameDialogOpen(true);
    }
  };

  const handleRenameConfirm = () => {
    if (renamingTabId && newTabName.trim()) {
      updateTabMutation.mutate({ id: renamingTabId, name: newTabName.trim() });
    }
    setRenameDialogOpen(false);
    setRenamingTabId(null);
    setNewTabName('');
  };

  const handleTogglePin = (tabId: string) => {
    const tab = tabs.find(t => t.id === tabId);
    if (tab) {
      updateTabMutation.mutate({ id: tabId, isPinned: !tab.isPinned });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 border-b bg-gray-50 px-2 py-1">
        <div className="h-7 w-20 bg-gray-200 animate-pulse rounded" />
        <div className="h-7 w-20 bg-gray-200 animate-pulse rounded" />
        <div className="h-7 w-20 bg-gray-200 animate-pulse rounded" />
      </div>
    );
  }

  const sortedTabs = [...tabs].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return a.position - b.position;
  });

  return (
    <>
      <div className="flex items-center gap-2 border-b bg-gray-50 px-2 py-1 overflow-x-auto">
        {sortedTabs.map((tab) => (
          <ContextMenu key={tab.id}>
            <ContextMenuTrigger>
              <div
                onClick={() => handleTabClick(tab.id)}
                className={`
                  flex items-center gap-2 px-3 py-1.5 rounded-t-md text-sm transition-colors whitespace-nowrap cursor-pointer
                  ${activeTabId === tab.id
                    ? 'bg-white border-t border-l border-r border-gray-300 font-medium'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }
                `}
              >
                {tab.isPinned ? (
                  <Pin className="h-3 w-3 text-[var(--ecs-primary)]" />
                ) : null}
                <span>{tab.name}</span>
                {tabs.length > 1 && (
                  <span
                    role="button"
                    onClick={(e) => handleCloseTab(tab.id, e)}
                    className="hover:bg-gray-300 rounded p-0.5 ml-1"
                  >
                    <X className="h-3 w-3" />
                  </span>
                )}
              </div>
            </ContextMenuTrigger>
            <ContextMenuContent>
              <ContextMenuItem onClick={() => handleRename(tab.id)}>
                Rename
              </ContextMenuItem>
              <ContextMenuItem onClick={() => handleTogglePin(tab.id)}>
                {tab.isPinned ? 'Unpin' : 'Pin'}
              </ContextMenuItem>
              {tabs.length > 1 && (
                <ContextMenuItem onClick={(e) => handleCloseTab(tab.id, e as any)}>
                  Close
                </ContextMenuItem>
              )}
            </ContextMenuContent>
          </ContextMenu>
        ))}

        <Button
          variant="ghost"
          size="sm"
          onClick={handleNewTab}
          className="h-7 w-7 p-0"
          disabled={createTabMutation.isPending}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Tab</DialogTitle>
            <DialogDescription>Enter a new name for this tab.</DialogDescription>
          </DialogHeader>
          <Input
            value={newTabName}
            onChange={(e) => setNewTabName(e.target.value)}
            placeholder="Tab name"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleRenameConfirm();
              }
            }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleRenameConfirm} disabled={updateTabMutation.isPending}>
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
