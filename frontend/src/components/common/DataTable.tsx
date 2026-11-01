import { useState, useMemo, ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Search, Plus, X, Loader2, CheckSquare, Square, FileSpreadsheet, Trash2 } from 'lucide-react';

/** Value at a dotted path, e.g. valueAt(ticket, 'student.last_name') */
function valueAt(item: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>(
    (value, key) => (value == null ? undefined : (value as Record<string, unknown>)[key]),
    item
  );
}

export interface DataTableColumn<T> {
  key: string;
  label: string;
  render?: (item: T) => ReactNode;
  sortable?: boolean;
}

export interface DataTableFilter {
  key: string;
  label: string;
  type: 'select' | 'text';
  options?: Array<{ value: string; label: string }>;
  placeholder?: string;
}

export interface DataTableAction<T> {
  label: string;
  icon?: ReactNode;
  variant?: 'default' | 'destructive' | 'outline' | 'ghost';
  onClick: (item: T) => void;
  show?: (item: T) => boolean;
}

export interface DataTableConfig<T> {
  // Data
  data: T[];
  loading?: boolean;
  
  // Identification
  getItemId: (item: T) => number | string;
  
  // Colonnes
  columns: DataTableColumn<T>[];
  
  // Recherche
  searchPlaceholder?: string;
  /** Field names, or dotted paths into nested objects ('student.last_name') */
  searchKeys: (keyof T | `${string}.${string}`)[];
  
  // Filtres
  filters?: DataTableFilter[];
  onFilterChange?: (filters: Record<string, string>) => void;
  
  // Actions
  onItemClick?: (item: T) => void;
  rowActions?: DataTableAction<T>[];
  bulkActions?: {
    delete?: {
      enabled: boolean;
      onDelete: (ids: (number | string)[]) => Promise<void>;
      isDeleting?: boolean;
    };
  };
  
  // CRUD
  onCreate?: {
    enabled: boolean;
    buttonLabel: string;
    dialogTitle: string;
    dialogDescription?: string;
    form: (onSubmit: () => void, isSubmitting: boolean) => ReactNode;
  };
  
  onEdit?: {
    enabled: boolean;
    dialogTitle: string;
    dialogDescription?: string;
    form: (item: T, onSubmit: () => void, isSubmitting: boolean) => ReactNode;
  };
  
  onImport?: {
    enabled: boolean;
    buttonLabel: string;
    component: ReactNode;
  };
  
  // Pagination
  pagination?: {
    enabled: boolean;
    defaultPageSize?: number;
    pageSizeOptions?: number[];
  };
  
  // Customization
  emptyState?: {
    icon?: ReactNode;
    message: string;
  };
  
  className?: string;

  customHeaderActions?: ReactNode;
}

export function DataTable<T>({
  data,
  loading = false,
  getItemId,
  columns,
  searchPlaceholder = 'Rechercher...',
  searchKeys,
  filters = [],
  onFilterChange,
  onItemClick,
  rowActions = [],
  bulkActions,
  onCreate,
  onEdit,
  onImport,
  pagination = { enabled: true, defaultPageSize: 10, pageSizeOptions: [5, 10, 20, 50, 100] },
  emptyState,
  className = '',
  customHeaderActions
}: DataTableConfig<T>) {
  // States
  const [searchQuery, setSearchQuery] = useState('');
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [selectedItems, setSelectedItems] = useState<Set<number | string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(pagination.defaultPageSize || 10);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<T | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Filtered data
  const filteredData = useMemo(() => {
    return data.filter(item => {
        // Search filter
        const q = searchQuery.toLowerCase();
        const matchesSearch = searchKeys.some(key => {
        const value = valueAt(item, String(key));
        return String(value ?? '').toLowerCase().includes(q);
        });

        // Custom filters avec logique spéciale
        const matchesFilters = Object.entries(filterValues).every(([key, value]) => {
        if (!value || value === 'ALL') return true;
        
        // Logique spéciale pour formationType
        if (key === 'formationType') {
            return valueAt(item, 'formation.formation_type.code') === value;
        }
        
        // Logique spéciale pour professorId
        if (key === 'professorId') {
            return String(valueAt(item, 'formation.professor_responsible.id')) === value;
        }
        
        // Filtrage standard
        return String(valueAt(item, key)) === value;
        });

        return matchesSearch && matchesFilters;
    });
    }, [data, searchQuery, filterValues, searchKeys]);

  // Pagination
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = pagination.enabled 
    ? filteredData.slice(indexOfFirstItem, indexOfLastItem)
    : filteredData;
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);

  // Selection handlers
  const toggleSelectItem = (id: number | string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedItems(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedItems.size === currentItems.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(currentItems.map(item => getItemId(item))));
    }
  };

  // Delete handler
  const handleDelete = async () => {
    if (!bulkActions?.delete) return;
    
    try {
      await bulkActions.delete.onDelete(Array.from(selectedItems));
      setSelectedItems(new Set());
      setDeleteDialogOpen(false);
    } catch (error) {
      console.error('Delete error:', error);
    }
  };

  // Edit handler
  const handleEditClick = (item: T) => {
    if (!onEdit) return;
    setEditingItem(item);
    setEditDialogOpen(true);
  };

  // Filter change handler
  const handleFilterChange = (key: string, value: string) => {
    const newFilters = { ...filterValues, [key]: value };
    setFilterValues(newFilters);
    setCurrentPage(1);
    onFilterChange?.(newFilters);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
          <Input 
            placeholder={searchPlaceholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
          {searchQuery && (
            <Button 
              variant="ghost" 
              size="icon" 
              className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
              onClick={() => setSearchQuery('')}
            >
              <X size={16} />
            </Button>
          )}
        </div>
        
        {/* Actions */}
        <div className="flex gap-2">
          {customHeaderActions ? (
            // ✅ Si customHeaderActions est fourni, l'utiliser
            <>
              {/* Bouton de suppression en masse (toujours affiché si activé) */}
              {bulkActions?.delete?.enabled && selectedItems.size > 0 && (
                <Button 
                  variant="destructive" 
                  onClick={() => setDeleteDialogOpen(true)}
                  disabled={bulkActions.delete.isDeleting}
                >
                  {bulkActions.delete.isDeleting ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Trash2 size={16} className="mr-2" />
                  )}
                  Supprimer ({selectedItems.size})
                </Button>
              )}
              
              {/* Actions personnalisées */}
              {customHeaderActions}
            </>
          ) : (
            // ✅ Sinon, utiliser les actions par défaut
            <>
              {/* Bulk delete */}
              {bulkActions?.delete?.enabled && selectedItems.size > 0 && (
                <Button 
                  variant="destructive" 
                  onClick={() => setDeleteDialogOpen(true)}
                  disabled={bulkActions.delete.isDeleting}
                >
                  {bulkActions.delete.isDeleting ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Trash2 size={16} className="mr-2" />
                  )}
                  Supprimer ({selectedItems.size})
                </Button>
              )}

              {/* Create */}
              {onCreate?.enabled && (
                <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="default">
                      <Plus size={16} className="mr-2" />
                      {onCreate.buttonLabel}
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>{onCreate.dialogTitle}</DialogTitle>
                      {onCreate.dialogDescription && (
                        <DialogDescription>{onCreate.dialogDescription}</DialogDescription>
                      )}
                    </DialogHeader>
                    {onCreate.form(() => setCreateDialogOpen(false), false)}
                  </DialogContent>
                </Dialog>
              )}

              {/* Import */}
              {onImport?.enabled && onImport.component}
            </>
          )}
        </div>
      </div>

      {/* Filters */}
      {filters.length > 0 && (
        <Card className="mb-4">
          <CardContent className="p-4">
            <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-${Math.min(filters.length + 1, 6)} gap-4`}>
              {filters.map(filter => (
                <div key={filter.key} className="space-y-2">
                  <Label className="text-xs">{filter.label}</Label>
                  {filter.type === 'select' ? (
                    <Select
                      value={filterValues[filter.key] || 'ALL'}
                      onValueChange={(value) => handleFilterChange(filter.key, value)}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder={filter.placeholder || 'Tous'} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">Tous</SelectItem>
                        {filter.options?.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      value={filterValues[filter.key] || ''}
                      onChange={(e) => handleFilterChange(filter.key, e.target.value)}
                      placeholder={filter.placeholder}
                      className="h-9"
                    />
                  )}
                </div>
              ))}

              {/* Items per page */}
              {pagination.enabled && (
                <div className="space-y-2">
                  <Label className="text-xs">Par page</Label>
                  <Select
                    value={String(itemsPerPage)}
                    onValueChange={(value) => {
                      setItemsPerPage(Number(value));
                      setCurrentPage(1);
                    }}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {pagination.pageSizeOptions?.map(size => (
                        <SelectItem key={size} value={String(size)}>{size}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* Reset filters */}
            {Object.values(filterValues).some(v => v && v !== 'ALL') && (
              <div className="mt-3 flex justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setFilterValues({});
                    setCurrentPage(1);
                    onFilterChange?.({});
                  }}
                >
                  <X className="h-4 w-4 mr-2" />
                  Réinitialiser les filtres
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Results count */}
      <div className="flex items-center justify-between mb-4">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">
            {filteredData.length} résultat{filteredData.length > 1 ? 's' : ''}
            {selectedItems.size > 0 && ` • ${selectedItems.size} sélectionné(s)`}
          </p>
          {pagination.enabled && filteredData.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Affichage de {indexOfFirstItem + 1} à {Math.min(indexOfLastItem, filteredData.length)} sur {filteredData.length}
            </p>
          )}
        </div>
        
        {/* Select all */}
        {bulkActions?.delete?.enabled && currentItems.length > 0 && (
          <Button variant="ghost" size="sm" onClick={toggleSelectAll}>
            {selectedItems.size === currentItems.length ? (
              <>
                <CheckSquare className="h-4 w-4 mr-2" />
                Tout désélectionner
              </>
            ) : (
              <>
                <Square className="h-4 w-4 mr-2" />
                Tout sélectionner
              </>
            )}
          </Button>
        )}
      </div>

      {/* Data table */}
      <Card>
        <CardContent className="p-0">
          {currentItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              {emptyState?.icon}
              <p>{emptyState?.message || 'Aucun résultat'}</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {currentItems.map((item) => {
                const itemId = getItemId(item);
                return (
                  <div
                    key={String(itemId)}
                    className="flex items-center gap-4 p-4 hover:bg-muted/50 transition-colors"
                  >
                    {/* Checkbox */}
                    {bulkActions?.delete?.enabled && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSelectItem(itemId);
                        }}
                        className="flex-shrink-0"
                      >
                        {selectedItems.has(itemId) ? (
                          <CheckSquare className="h-5 w-5 text-primary" />
                        ) : (
                                                      <Square className="h-5 w-5 text-muted-foreground" />
                        )}
                      </button>
                    )}

                    {/* Content */}
                    <div 
                      className="flex-1 flex items-center justify-between cursor-pointer"
                      onClick={() => onItemClick ? onItemClick(item) : handleEditClick(item)}
                    >
                      <div className="flex-1 grid gap-4" style={{ gridTemplateColumns: `repeat(${columns.length}, 1fr)` }}>
                        {columns.map(col => (
                          <div key={col.key}>
                            {col.render ? col.render(item) : String(valueAt(item, col.key) ?? '')}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Row actions */}
                    {rowActions.length > 0 && (
                      <div className="flex gap-2">
                        {rowActions.map((action, idx) => {
                          if (action.show && !action.show(item)) return null;
                          return (
                            <Button
                              key={idx}
                              variant={action.variant || 'ghost'}
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                action.onClick(item);
                              }}
                            >
                              {action.icon}
                            </Button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {pagination.enabled && totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6">
          <p className="text-sm text-muted-foreground">
            Page {currentPage} sur {totalPages}
          </p>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
            >
              Premier
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              Précédent
            </Button>
            
            <div className="flex items-center gap-1">
              {(() => {
                const maxVisible = 5;
                let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
                let endPage = Math.min(totalPages, startPage + maxVisible - 1);
                
                if (endPage - startPage < maxVisible - 1) {
                  startPage = Math.max(1, endPage - maxVisible + 1);
                }
                
                const pages = [];
                for (let i = startPage; i <= endPage; i++) {
                  pages.push(i);
                }
                
                return pages.map(page => (
                  <Button
                    key={page}
                    variant={currentPage === page ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCurrentPage(page)}
                    className="w-10"
                  >
                    {page}
                  </Button>
                ));
              })()}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              Suivant
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
            >
              Dernier
            </Button>
          </div>
        </div>
      )}

      {/* Delete confirmation dialog */}
      {bulkActions?.delete?.enabled && (
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
              <AlertDialogDescription>
                Êtes-vous sûr de vouloir supprimer <strong>{selectedItems.size}</strong> élément(s) ?
                Cette action est irréversible.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setDeleteDialogOpen(false)}>
                Annuler
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {bulkActions.delete.isDeleting && (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                )}
                Supprimer
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* Edit dialog */}
      {onEdit?.enabled && editingItem && (
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{onEdit.dialogTitle}</DialogTitle>
              {onEdit.dialogDescription && (
                <DialogDescription>{onEdit.dialogDescription}</DialogDescription>
              )}
            </DialogHeader>
            {onEdit.form(editingItem, () => setEditDialogOpen(false), false)}
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
