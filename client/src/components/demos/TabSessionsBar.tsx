import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@/components/ui/context-menu";
import { Plus, X, Pin } from "lucide-react";

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

export interface TabSession {
  id: string;
  name: string;
  filters: FilterState;
  isPinned: boolean;
  lastAccessed: string;
}

interface TabSessionsBarProps {
  activeTabId: string;
  onTabChange: (tabId: string) => void;
  onTabsUpdate: (tabs: TabSession[]) => void;
  currentFilters: FilterState;
}

const STORAGE_KEY = 'demo-tab-sessions';
const ACTIVE_TAB_KEY = 'demo-active-tab-id';

// Default filters
const getDefaultFilters = (): FilterState => ({
  shop: 'all',
  status: [],
  search: '',
  dateFrom: '',
  dateTo: '',
  sortBy: 'initiatedAt',
  sortOrder: 'desc',
  pageSize: 25,
});

// Generate default tabs
const getDefaultTabs = (): TabSession[] => {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  return [
    {
      id: 'morning',
      name: 'Morning',
      filters: {
        ...getDefaultFilters(),
        status: ['picked_up', 'picked_up_from_shop'],
      },
      isPinned: false,
      lastAccessed: new Date().toISOString(),
    },
    {
      id: 'open-items',
      name: 'Open Items',
      filters: {
        ...getDefaultFilters(),
        status: ['at_shop', 'in_service'],
      },
      isPinned: false,
      lastAccessed: new Date().toISOString(),
    },
    {
      id: 'weekly',
      name: 'Weekly',
      filters: {
        ...getDefaultFilters(),
        dateFrom: sevenDaysAgo.toISOString().split('T')[0],
      },
      isPinned: false,
      lastAccessed: new Date().toISOString(),
    },
  ];
};

export default function TabSessionsBar({ activeTabId, onTabChange, onTabsUpdate, currentFilters }: TabSessionsBarProps) {
  const [tabs, setTabs] = useState<TabSession[]>([]);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renamingTabId, setRenamingTabId] = useState<string | null>(null);
  const [newTabName, setNewTabName] = useState('');

  // Initialize tabs from localStorage or defaults
  useEffect(() => {
    const storedTabs = localStorage.getItem(STORAGE_KEY);
    if (storedTabs) {
      try {
        const parsedTabs = JSON.parse(storedTabs);
        setTabs(parsedTabs);
      } catch (e) {
        console.error('Failed to parse stored tabs:', e);
        setTabs(getDefaultTabs());
      }
    } else {
      setTabs(getDefaultTabs());
    }
  }, []);

  // Save tabs to localStorage whenever they change
  useEffect(() => {
    if (tabs.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tabs));
      onTabsUpdate(tabs);
    }
  }, [tabs, onTabsUpdate]);

  // Save active tab ID
  useEffect(() => {
    if (activeTabId) {
      localStorage.setItem(ACTIVE_TAB_KEY, activeTabId);
    }
  }, [activeTabId]);

  const handleTabClick = (tabId: string) => {
    // Update last accessed time
    setTabs(prev => prev.map(tab =>
      tab.id === tabId
        ? { ...tab, lastAccessed: new Date().toISOString() }
        : tab
    ));
    onTabChange(tabId);
  };

  const handleNewTab = () => {
    const newTab: TabSession = {
      id: `tab-${Date.now()}`,
      name: 'New Tab',
      filters: getDefaultFilters(),
      isPinned: false,
      lastAccessed: new Date().toISOString(),
    };
    setTabs(prev => [...prev, newTab]);
    onTabChange(newTab.id);
  };

  const handleCloseTab = (tabId: string, e: React.MouseEvent) => {
    e.stopPropagation();

    // Prevent closing if it's the only tab
    if (tabs.length === 1) return;

    const tabIndex = tabs.findIndex(t => t.id === tabId);
    const newTabs = tabs.filter(t => t.id !== tabId);
    setTabs(newTabs);

    // If closing the active tab, switch to another tab
    if (tabId === activeTabId) {
      const newActiveIndex = Math.min(tabIndex, newTabs.length - 1);
      onTabChange(newTabs[newActiveIndex].id);
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
      setTabs(prev => prev.map(tab =>
        tab.id === renamingTabId
          ? { ...tab, name: newTabName.trim() }
          : tab
      ));
    }
    setRenameDialogOpen(false);
    setRenamingTabId(null);
    setNewTabName('');
  };

  const handleTogglePin = (tabId: string) => {
    setTabs(prev => prev.map(tab =>
      tab.id === tabId
        ? { ...tab, isPinned: !tab.isPinned }
        : tab
    ));
  };

  // Update current tab's filters
  useEffect(() => {
    if (activeTabId && currentFilters) {
      setTabs(prev => prev.map(tab =>
        tab.id === activeTabId
          ? { ...tab, filters: currentFilters }
          : tab
      ));
    }
  }, [activeTabId, currentFilters]);

  // Sort tabs: pinned first, then by last accessed
  const sortedTabs = [...tabs].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return new Date(b.lastAccessed).getTime() - new Date(a.lastAccessed).getTime();
  });

  return (
    <>
      <div className="flex items-center gap-2 border-b bg-gray-50 px-2 py-1 overflow-x-auto">
        {sortedTabs.map((tab) => (
          <ContextMenu key={tab.id}>
            <ContextMenuTrigger>
              <button
                onClick={() => handleTabClick(tab.id)}
                className={`
                  flex items-center gap-2 px-3 py-1.5 rounded-t-md text-sm transition-colors
                  ${activeTabId === tab.id
                    ? 'bg-white border-t border-l border-r border-gray-300 font-medium'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }
                `}
              >
                {tab.isPinned && (
                  <Pin className="h-3 w-3 text-[var(--ecs-primary)]" />
                )}
                <span>{tab.name}</span>
                {tabs.length > 1 && (
                  <button
                    onClick={(e) => handleCloseTab(tab.id, e)}
                    className="hover:bg-gray-300 rounded p-0.5 ml-1"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </button>
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
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Tab</DialogTitle>
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
            <Button onClick={handleRenameConfirm}>
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
