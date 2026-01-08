import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Star, Edit2, Trash2, Save, ChevronDown } from "lucide-react";

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

export interface SavedView {
  id: string;
  name: string;
  filters: FilterState;
  isDefault: boolean;
}

interface SavedViewsManagerProps {
  currentFilters: FilterState;
  onApplyView: (filters: FilterState) => void;
}

const STORAGE_KEY = 'demo-saved-views';

// Default preset views
const getDefaultPresets = (): SavedView[] => {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  return [
    {
      id: 'morning-check',
      name: 'Morning Check',
      filters: {
        shop: 'all',
        status: ['picked_up', 'picked_up_from_shop'],
        search: '',
        dateFrom: '',
        dateTo: '',
        sortBy: 'initiatedAt',
        sortOrder: 'desc',
        pageSize: 25
      },
      isDefault: false
    },
    {
      id: 'open-items',
      name: 'Open Items',
      filters: {
        shop: 'all',
        status: ['at_shop', 'in_service'],
        search: '',
        dateFrom: '',
        dateTo: '',
        sortBy: 'initiatedAt',
        sortOrder: 'asc',
        pageSize: 25
      },
      isDefault: false
    },
    {
      id: 'weekly-review',
      name: 'Weekly Review',
      filters: {
        shop: 'all',
        status: [],
        search: '',
        dateFrom: sevenDaysAgo.toISOString().split('T')[0],
        dateTo: '',
        sortBy: 'initiatedAt',
        sortOrder: 'desc',
        pageSize: 25
      },
      isDefault: false
    },
    {
      id: 'end-of-day-cleanup',
      name: 'End of Day Cleanup',
      filters: {
        shop: 'all',
        status: ['service_complete', 'ready_for_pickup'],
        search: '',
        dateFrom: '',
        dateTo: '',
        sortBy: 'initiatedAt',
        sortOrder: 'asc',
        pageSize: 25
      },
      isDefault: false
    }
  ];
};

export default function SavedViewsManager({ currentFilters, onApplyView }: SavedViewsManagerProps) {
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [newViewName, setNewViewName] = useState('');
  const [editingView, setEditingView] = useState<SavedView | null>(null);
  const [deletingView, setDeletingView] = useState<SavedView | null>(null);

  // Load saved views from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setSavedViews(JSON.parse(stored));
      } catch (e) {
        // If parsing fails, initialize with defaults
        setSavedViews(getDefaultPresets());
      }
    } else {
      // Initialize with default presets
      setSavedViews(getDefaultPresets());
    }
  }, []);

  // Save to localStorage whenever views change
  useEffect(() => {
    if (savedViews.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(savedViews));
    }
  }, [savedViews]);

  const handleApplyView = (view: SavedView) => {
    onApplyView(view.filters);
    setPopoverOpen(false);
  };

  const handleSetDefault = (viewId: string) => {
    setSavedViews(views =>
      views.map(v => ({
        ...v,
        isDefault: v.id === viewId
      }))
    );
  };

  const handleSaveNewView = () => {
    if (!newViewName.trim()) return;

    const newView: SavedView = {
      id: `view-${Date.now()}`,
      name: newViewName,
      filters: currentFilters,
      isDefault: false
    };

    setSavedViews([...savedViews, newView]);
    setNewViewName('');
    setSaveDialogOpen(false);
  };

  const handleEditView = () => {
    if (!editingView || !editingView.name.trim()) return;

    setSavedViews(views =>
      views.map(v =>
        v.id === editingView.id ? editingView : v
      )
    );
    setEditingView(null);
    setEditDialogOpen(false);
  };

  const handleDeleteView = () => {
    if (!deletingView) return;

    setSavedViews(views => views.filter(v => v.id !== deletingView.id));
    setDeletingView(null);
    setDeleteDialogOpen(false);
  };

  const openEditDialog = (view: SavedView) => {
    setEditingView({ ...view });
    setEditDialogOpen(true);
    setPopoverOpen(false);
  };

  const openDeleteDialog = (view: SavedView) => {
    setDeletingView(view);
    setDeleteDialogOpen(true);
    setPopoverOpen(false);
  };

  return (
    <>
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" className="gap-2">
            <Save className="h-4 w-4" />
            Saved Views
            <ChevronDown className="h-4 w-4 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="start">
          <div className="p-3 border-b">
            <h4 className="font-semibold text-sm">Saved Filter Views</h4>
          </div>
          <ScrollArea className="max-h-96">
            <div className="p-2">
              {savedViews.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No saved views yet
                </p>
              ) : (
                savedViews.map((view) => (
                  <div
                    key={view.id}
                    className="flex items-center gap-2 p-2 rounded hover:bg-accent group"
                  >
                    <button
                      onClick={() => handleSetDefault(view.id)}
                      className="shrink-0"
                      title={view.isDefault ? "Default view" : "Set as default"}
                    >
                      <Star
                        className={`h-4 w-4 ${
                          view.isDefault
                            ? 'fill-yellow-400 text-yellow-400'
                            : 'text-gray-400 hover:text-yellow-400'
                        }`}
                      />
                    </button>
                    <button
                      onClick={() => handleApplyView(view)}
                      className="flex-1 text-left text-sm font-medium"
                    >
                      {view.name}
                    </button>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => openEditDialog(view)}
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                        onClick={() => openDeleteDialog(view)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
          <div className="p-2 border-t">
            <Button
              className="w-full gap-2"
              onClick={() => {
                setSaveDialogOpen(true);
                setPopoverOpen(false);
              }}
            >
              <Save className="h-4 w-4" />
              Save Current Filters As...
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      {/* Save New View Dialog */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Current Filters</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <label className="text-sm font-medium mb-2 block">View Name</label>
            <Input
              value={newViewName}
              onChange={(e) => setNewViewName(e.target.value)}
              placeholder="e.g., My Custom View"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSaveNewView();
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveNewView} disabled={!newViewName.trim()}>
              Save View
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit View Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename View</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <label className="text-sm font-medium mb-2 block">View Name</label>
            <Input
              value={editingView?.name || ''}
              onChange={(e) =>
                setEditingView(prev =>
                  prev ? { ...prev, name: e.target.value } : null
                )
              }
              placeholder="e.g., My Custom View"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleEditView();
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditView} disabled={!editingView?.name.trim()}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete View</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-4">
            Are you sure you want to delete "{deletingView?.name}"? This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteView}>
              Delete View
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
