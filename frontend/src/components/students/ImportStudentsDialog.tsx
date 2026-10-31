import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Upload, FileSpreadsheet, Loader2, AlertCircle } from 'lucide-react';
import * as XLSX from 'xlsx';
import { getAnneeUniversitaires } from '@/data/formations';
import { useFormationsQuery } from '@/hooks/api/useFormationsQuery';

interface PreviewStudent {
  first_name: string;
  last_name: string;
  academic_year: string;
  formation_type: 'LUS' | 'MUS';
  formation_name: string;
  professeur_responsable?: string;
  email?: string;
  num_apogee?: number;
}

interface ImportStudentsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (students: any[]) => Promise<void>;
  isImporting: boolean;
}

export function ImportStudentsDialog({ open, onOpenChange, onImport, isImporting }: ImportStudentsDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<PreviewStudent[]>([]);
  const [academicYear, setAcademicYear] = useState('');
  const [formationType, setFormationType] = useState<'LUS' | 'MUS' | ''>('');
  const [formationName, setFormationName] = useState('');
  const [professeur, setProfesseur] = useState('');
  const [isFilenameParsed, setIsFilenameParsed] = useState(false);
  
  const { formations } = useFormationsQuery();

  const uniqueProfesseurs = useMemo(() => {
        const profMap = new Map();
  
        formations.forEach(f => {
            if (f.professor_responsible?.id) {
            profMap.set(f.professor_responsible.id, f.professor_responsible);
            }
        });
        
        // ✅ Convertir en array et trier
        return Array.from(profMap.values()).sort((a, b) => 
            a.last_name.localeCompare(b.last_name)
        );
    }, [formations]);

  const parseFileName = (fileName: string) => {
    const parts = fileName.replace('.xlsx', '').replace('.xls', '').split('_');
    
    if (parts.length >= 3) {
      const professeurName = parts[0]; // ✅ Premier élément = professeur
      const type = parts[1] as 'LUS' | 'MUS'; // ✅ Deuxième élément = type
      const year = parts[2]; // ✅ Troisième élément = année
      
      setProfesseur(professeurName);
      setFormationType(type);
      setAcademicYear(year);
      setIsFilenameParsed(true);
      
      // ✅ Trouver automatiquement la formation si possible
      const matchingFormation = formations.find(
        f => f.formation_type?.code === type && (f.professor_responsible?.last_name.toLowerCase() === professeurName.toLowerCase() || f.professor_responsible?.first_name.toLowerCase() === professeurName.toLowerCase())
      );
      
      if (matchingFormation) {
        setFormationName(matchingFormation.formation_name);
        setProfesseur(matchingFormation.professor_responsible?.last_name)
      } else {
        setIsFilenameParsed(false);
      }
    } else {
        setIsFilenameParsed(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    parseFileName(selectedFile.name);

    try {
      const data = await selectedFile.arrayBuffer();
      const workbook = XLSX.read(data);
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
     const jsonData = XLSX.utils.sheet_to_json<{ 
        Nom: string; 
        Prénom: string; 
        Email?: string; 
        'Num Apogee'?: number | string;
      }>(firstSheet);

      if (jsonData.length === 0) {
        toast.error('Le fichier Excel est vide');
        return;
      }

      setTimeout(() => {
        const preview: PreviewStudent[] = jsonData.map(row => ({
          first_name: row['Prénom']?.toString().trim() || '',
          last_name: row['Nom']?.toString().trim() || '',
          academic_year: academicYear,
          formation_type: formationType as 'LUS' | 'MUS',
          formation_name: formationName,
          professeur_responsable: professeur,
          email: row['Email']?.toString().trim() || undefined,
          num_apogee: row['Num Apogee'] ? Number(row['Num Apogee']) : undefined
        }));

        setPreviewData(preview);
        toast.success(`${preview.length} étudiants détectés`);
      }, 100);

    } catch (error) {
      toast.error('Erreur lors de la lecture du fichier');
      console.error(error);
    }
  };

  const handleImport = async () => {
    if (!academicYear || !formationType || !formationName) {
      toast.error('Veuillez remplir tous les champs obligatoires');
      return;
    }

    const formation = formations.find(
      f => f.formation_name === formationName && f.formation_type?.code === formationType
    );

    if (!formation) {
      toast.error('Formation introuvable');
      return;
    }

    const studentsToImport = previewData.map(student => ({
      first_name: student.first_name,
      last_name: student.last_name,
      academic_year: academicYear,
      formation_type: formationType,
      formation_name: formationName,
      email: student.email || null,
      num_apogee: student.num_apogee || null
    }));

    await onImport(studentsToImport);
    
    // Reset
    setFile(null);
    setPreviewData([]);
    setAcademicYear('');
    setFormationType('');
    setFormationName('');
    setProfesseur('');
  };

  const filteredFormations = formationType
    ? formations.filter(f => f.formation_type?.code === formationType)
    : formations;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importer des étudiants depuis Excel</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* File upload */}
          <div className="space-y-2">
            <Label htmlFor="excel-file">Fichier Excel</Label>
            <Input
              id="excel-file"
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              disabled={isImporting}
            />
            <p className="text-xs text-muted-foreground">
              Format attendu: colonnes "Nom" et "Prénom" (Email et Num Apogee optionnels)
            </p>
          </div>

          {/* Metadata */}
          {!isFilenameParsed && (
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label>Professeur responsable *</Label>
                    <Select value={professeur} onValueChange={(value) => {
                        setProfesseur(value); // ✅ value = "firstName lastName"
      
                        // ✅ Trouver le professeur par nom complet
                        const selectedProf = uniqueProfesseurs.find(
                            p => `${p.first_name} ${p.last_name}` === value
                        );
                        
                        // ✅ Auto-sélectionner la formation du professeur si type défini
                        if (formationType && selectedProf) {
                            const matchingFormation = formations.find(
                            f => f.professor_responsible?.id === selectedProf.id && 
                                f.formation_type?.code === formationType
                            );
                            if (matchingFormation) {
                                setFormationName(matchingFormation.formation_name);
                                setFormationType(matchingFormation.formation_type?.code)
                            }
                        }
                    }}>
                        <SelectTrigger>
                            <SelectValue placeholder="Sélectionner" />
                        </SelectTrigger>
                        <SelectContent>
                            {uniqueProfesseurs.map(p => {
                                const fullName = `${p.first_name} ${p.last_name}`;
                                return (
                                <SelectItem 
                                    key={`prof-${p.id}`}
                                    value={fullName}
                                >
                                    {fullName}
                                </SelectItem>
                                );
                            })}
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-2">
                    <Label>Type de formation *</Label>
                    <Select value={formationType} onValueChange={(v: 'LUS' | 'MUS') => {
                        setFormationType(v);
                        setFormationName('');
                        if (professeur) {
                            const matchingFormation = formations.find(
                            f => f.professor_responsible.last_name === professeur && 
                                f.formation_type?.code === v
                            );
                            if (matchingFormation) {
                                setFormationName(matchingFormation.formation_name);
                            }
                        }
                    }}>
                        <SelectTrigger>
                        <SelectValue placeholder="LUS ou MUS" />
                        </SelectTrigger>
                        <SelectContent>
                        <SelectItem value="LUS">LUS</SelectItem>
                        <SelectItem value="MUS">MUS</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-2">
                    <Label>Année universitaire *</Label>
                    <Select value={academicYear} onValueChange={setAcademicYear}>
                        <SelectTrigger>
                        <SelectValue placeholder="Sélectionner" />
                        </SelectTrigger>
                        <SelectContent>
                        {getAnneeUniversitaires().map(year => (
                            <SelectItem key={year} value={year}>{year}</SelectItem>
                        ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-2">
                    <Label>Formation *</Label>
                    <Select 
                        value={formationName} 
                        onValueChange={(value) => {
                        setFormationName(value);
                        
                        // ✅ Auto-sélectionner le professeur de cette formation
                        const selectedFormation = formations.find(
                            f => f.formation_name === value
                        );
                        if (selectedFormation?.professor_responsible.last_name) {
                            setProfesseur(selectedFormation.professor_responsible.last_name);
                        }
                        
                        // ✅ Auto-sélectionner le type si pas encore défini
                        if (!formationType && selectedFormation?.formation_type?.code) {
                            setFormationType(selectedFormation.formation_type.code as 'LUS' | 'MUS');
                        }
                        }}
                        disabled={!formationType}
                    >
                        <SelectTrigger>
                        <SelectValue placeholder={
                            !formationType 
                            ? "Sélectionner d'abord le type" 
                            : "Sélectionner"
                        } />
                        </SelectTrigger>
                        <SelectContent>
                            {filteredFormations.length > 0 ? (
                                filteredFormations.map(f => (
                                <SelectItem key={f.id} value={f.formation_name}>
                                    {f.formation_name}
                                </SelectItem>
                                ))
                            ) : (
                                <div className="px-2 py-1.5 text-sm text-muted-foreground">
                                Aucune formation pour ce type
                                </div>
                            )}
                        </SelectContent>
                    </Select>
                </div>
            </div>
          )}

           {/* ✅ Afficher les valeurs parsées si succès */}
           {isFilenameParsed && (
            <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                <p className="text-sm font-medium">Informations détectées depuis le fichier:</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-muted-foreground">Professeur:</span> <strong>{professeur}</strong></div>
                <div><span className="text-muted-foreground">Type:</span> <strong>{formationType}</strong></div>
                <div><span className="text-muted-foreground">Année:</span> <strong>{academicYear}</strong></div>
                <div><span className="text-muted-foreground">Formation:</span> <strong>{formationName || 'À sélectionner'}</strong></div>
                </div>
            </div>
            )}

          {/* Preview table */}
          {previewData.length > 0 && (
            <div className="border rounded-lg">
              <div className="p-4 bg-muted/50 border-b">
                <h3 className="font-medium">Prévisualisation ({previewData.length} étudiants)</h3>
              </div>
              <div className="max-h-96 overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nom</TableHead>
                      <TableHead>Prénom</TableHead>
                      <TableHead>Année</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Formation</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Num Apogée</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewData.slice(0, 50).map((student, idx) => (
                      <TableRow key={idx}>
                        <TableCell>{student.last_name}</TableCell>
                        <TableCell>{student.first_name}</TableCell>
                        <TableCell>{academicYear}</TableCell>
                        <TableCell>{formationType}</TableCell>
                        <TableCell>{formationName}</TableCell>
                        <TableCell className="text-muted-foreground">{student.email || '-'}</TableCell>
                        <TableCell className="text-muted-foreground">{student.num_apogee || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {previewData.length > 50 && (
                <div className="p-2 text-xs text-center text-muted-foreground border-t">
                  ... et {previewData.length - 50} autres étudiants
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isImporting}>
              Annuler
            </Button>
            <Button 
              onClick={handleImport} 
              disabled={previewData.length === 0 || isImporting}
            >
              {isImporting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Importer {previewData.length} étudiants
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
