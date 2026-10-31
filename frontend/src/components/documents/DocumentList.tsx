import { Document, DOCUMENT_TYPE_LABELS } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FileText, CheckCircle2, XCircle, Clock, Download, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DocumentListProps {
  documents: Document[];
  canValidate?: boolean;
  onValidate?: (docId: string) => void;
  onReject?: (docId: string) => void;
}

export function DocumentList({ documents, canValidate = false, onValidate, onReject }: DocumentListProps) {
  const getStatusIcon = (status: Document['status']) => {
    switch (status) {
      case 'VALIDATED':
        return <CheckCircle2 size={16} className="text-status-validated" />;
      case 'REJECTED':
        return <XCircle size={16} className="text-status-rejected" />;
      default:
        return <Clock size={16} className="text-status-pending" />;
    }
  };

  const getStatusBadge = (status: Document['status']) => {
    switch (status) {
      case 'VALIDATED':
        return <Badge variant="validated">Validé</Badge>;
      case 'REJECTED':
        return <Badge variant="rejected">Rejeté</Badge>;
      default:
        return <Badge variant="pending">En attente</Badge>;
    }
  };

  return (
    <div className="space-y-3">
      {documents.map((doc, index) => (
        <Card 
          key={doc.id} 
          className="p-4 animate-fade-in"
          style={{ animationDelay: `${index * 0.05}s` }}
        >
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className={cn(
                "flex items-center justify-center w-10 h-10 rounded-lg",
                doc.status === 'VALIDATED' && "bg-status-validated/10",
                doc.status === 'REJECTED' && "bg-status-rejected/10",
                doc.status === 'PENDING' && "bg-status-pending/10"
              )}>
                <FileText size={20} className={cn(
                  doc.status === 'VALIDATED' && "text-status-validated",
                  doc.status === 'REJECTED' && "text-status-rejected",
                  doc.status === 'PENDING' && "text-status-pending"
                )} />
              </div>
              
              <div className="min-w-0">
                <p className="font-medium text-foreground truncate">
                  {DOCUMENT_TYPE_LABELS[doc.type]}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {doc.fileName}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {getStatusBadge(doc.status)}
              
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Eye size={16} />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Download size={16} />
                </Button>
              </div>

              {canValidate && doc.status === 'PENDING' && (
                <div className="flex items-center gap-1 border-l border-border pl-3">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-status-validated hover:bg-status-validated/10"
                    onClick={() => onValidate?.(doc.id)}
                  >
                    <CheckCircle2 size={16} className="mr-1" />
                    Valider
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-status-rejected hover:bg-status-rejected/10"
                    onClick={() => onReject?.(doc.id)}
                  >
                    <XCircle size={16} className="mr-1" />
                    Rejeter
                  </Button>
                </div>
              )}
            </div>
          </div>

          {doc.status === 'VALIDATED' && doc.validatedBy && (
            <p className="text-xs text-muted-foreground mt-2 pl-13">
              Validé par {doc.validatedBy} le {new Date(doc.uploadedAt).toLocaleDateString('fr-FR')}
            </p>
          )}
        </Card>
      ))}
    </div>
  );
}
