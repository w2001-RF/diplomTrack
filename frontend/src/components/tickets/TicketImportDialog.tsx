import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, FileSpreadsheet, Loader2, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useTicketsQuery } from '@/hooks/api/useTicketsQuery';

interface TicketImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ParsedTicket {
  student: {
    first_name: string;
    last_name: string;
    email: string;
    num_apogee: string;
    academic_year: string;
    formation_id: number;
  };
  initial_milestone_code: string;
  documents: Array<{
    document_type: string;
    is_validated: boolean;
    validation_comment?: string;
  }>;
}

export function TicketImportDialog({ isOpen, onClose }: TicketImportDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedTicket[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const { importTickets, isImporting } = useTicketsQuery();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setIsProcessing(true);
    setImportResult(null);

    try {
      const data = await selectedFile.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      // Transform Excel data to API format
      const tickets: ParsedTicket[] = jsonData.map((row: any) => ({
        student: {
          first_name: row['Prénom'] || row['first_name'] || '',
          last_name: row['Nom'] || row['last_name'] || '',
          email: row['Email'] || row['email'] || '',
          num_apogee: String(row['Num Apogee'] || row['num_apogee'] || ''),
          academic_year: row['Année Académique'] || row['academic_year'] || '',
          formation_id: parseInt(row['Formation ID'] || row['formation_id'] || '1')
        },
        initial_milestone_code: row['Milestone'] || row['initial_milestone_code'] || 'CREATED',
        documents: parseDocuments(row)
      }));

      setParsedData(tickets);
    } catch (error) {
      console.error('Error parsing file:', error);
      alert('Erreur lors de la lecture du fichier');
    } finally {
      setIsProcessing(false);
    }
  };

  const parseDocuments = (row: any) => {
    const docs = [];
    const docTypes = ['CNI', 'RELEVE_NOTES', 'DIPLOME_BAC', 'PHOTO', 'ACTE_NAISSANCE'];
    
    for (const docType of docTypes) {
      const validated = row[`${docType}_validé`] || row[`${docType}_validated`];
      const comment = row[`${docType}_commentaire`] || row[`${docType}_comment`];
      
      if (validated !== undefined) {
        docs.push({
          document_type: docType,
          is_validated: validated === 'Oui' || validated === true || validated === 1,
          validation_comment: comment || undefined
        });
      }
    }
    
    return docs;
  };

  const handleImport = async () => {
    if (parsedData.length === 0) return;

    const result = await importTickets({ tickets: parsedData });
    setImportResult(result);
  };

  const handleClose = () => {
    setFile(null);
    setParsedData([]);
    setImportResult(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Importer des tickets depuis Excel</DialogTitle>
          <DialogDescription>
            Téléchargez un fichier Excel contenant les informations des tickets à importer
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4">
          {/* File Upload */}
          {!parsedData.length && !importResult && (
            <div className="space-y-4">
              <div className="border-2 border-dashed rounded-lg p-8 text-center">
                <FileSpreadsheet className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <Label htmlFor="file-upload" className="cursor-pointer">
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Cliquez pour sélectionner un fichier</p>
                    <p className="text-xs text-muted-foreground">Excel (.xlsx, .xls)</p>
                  </div>
                  <Input
                    id="file-upload"
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </Label>
              </div>

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Format attendu:</strong> Prénom, Nom, Email, Num Apogee, Année Académique, Formation ID, Milestone, 
                  CNI_validé, CNI_commentaire, RELEVE_NOTES_validé, RELEVE_NOTES_commentaire, etc.
                </AlertDescription>
              </Alert>
            </div>
          )}

          {/* Processing */}
          {isProcessing && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-3">Traitement du fichier...</span>
            </div>
          )}

          {/* Preview */}
          {parsedData.length > 0 && !importResult && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Aperçu des données ({parsedData.length} tickets)</h3>
                <Badge variant="secondary">{file?.name}</Badge>
              </div>

              <div className="border rounded-lg max-h-96 overflow-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted sticky top-0">
                    <tr>
                      <th className="p-2 text-left">Étudiant</th>
                      <th className="p-2 text-left">Email</th>
                      <th className="p-2 text-left">Apogee</th>
                      <th className="p-2 text-left">Milestone</th>
                      <th className="p-2 text-left">Documents</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {parsedData.slice(0, 10).map((ticket, idx) => (
                      <tr key={idx} className="hover:bg-muted/50">
                        <td className="p-2">
                          {ticket.student.first_name} {ticket.student.last_name}
                        </td>
                        <td className="p-2 text-xs">{ticket.student.email}</td>
                        <td className="p-2">{ticket.student.num_apogee}</td>
                        <td className="p-2">
                          <Badge variant="outline" className="text-xs">
                            {ticket.initial_milestone_code}
                          </Badge>
                        </td>
                        <td className="p-2">
                          <div className="flex gap-1">
                            {ticket.documents.map((doc, i) => (
                              <Badge
                                key={i}
                                variant={doc.is_validated ? 'default' : 'secondary'}
                                className="text-xs"
                              >
                                {doc.document_type}
                              </Badge>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {parsedData.length > 10 && (
                  <div className="p-2 text-center text-xs text-muted-foreground bg-muted">
                    ... et {parsedData.length - 10} autres tickets
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Import Result */}
          {importResult && (
            <div className="space-y-4">
              <Alert className={importResult.success ? 'border-green-500' : 'border-yellow-500'}>
                {importResult.success ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-yellow-500" />
                )}
                <AlertDescription>
                  <div className="space-y-1">
                    <p className="font-semibold">
                      {importResult.imported} ticket(s) importé(s) avec succès
                    </p>
                    {importResult.failed > 0 && (
                      <p className="text-sm text-muted-foreground">
                        {importResult.failed} échec(s)
                      </p>
                    )}
                  </div>
                </AlertDescription>
              </Alert>

              {importResult.results && (
                <div className="border rounded-lg max-h-64 overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted sticky top-0">
                      <tr>
                        <th className="p-2 text-left">Statut</th>
                        <th className="p-2 text-left">Email</th>
                        <th className="p-2 text-left">Référence</th>
                        <th className="p-2 text-left">Message</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {importResult.results.map((result: any, idx: number) => (
                        <tr key={idx}>
                          <td className="p-2">
                            {result.success ? (
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                            ) : (
                              <XCircle className="h-4 w-4 text-red-500" />
                            )}
                          </td>
                          <td className="p-2 text-xs">{result.student_email}</td>
                          <td className="p-2">{result.reference || '-'}</td>
                          <td className="p-2 text-xs text-muted-foreground">
                            {result.error || 'Importé'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            {importResult ? 'Fermer' : 'Annuler'}
          </Button>
          {parsedData.length > 0 && !importResult && (
            <Button onClick={handleImport} disabled={isImporting}>
              {isImporting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importation...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Importer {parsedData.length} ticket(s)
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}