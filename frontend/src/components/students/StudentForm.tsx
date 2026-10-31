import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { getAnneeUniversitaires } from '@/data/formations';
import { useFormationsQuery } from '@/hooks/api/useFormationsQuery';

type FormationTypeCode = 'LUS' | 'MUS' | '';

interface StudentFormProps {
  initialData?: {
    first_name: string;
    last_name: string;
    num_apogee: string;
    email: string;
    formation_id: string;
    academic_year: string;
  };
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
  isSubmitting: boolean;
  submitLabel?: string;
}

export function StudentForm({ 
  initialData, 
  onSubmit, 
  onCancel, 
  isSubmitting,
  submitLabel = 'Enregistrer'
}: StudentFormProps) {
  const { formations, loading: formationsLoading } = useFormationsQuery();
  
  const [formData, setFormData] = useState(initialData || {
    first_name: '',
    last_name: '',
    num_apogee: '',
    email: '',
    formation_id: '',
    academic_year: ''
  });
  
  const [formationType, setFormationType] = useState<FormationTypeCode>('');

  useEffect(() => {
    if (initialData?.formation_id) {
      const formation = formations.find(f => String(f.id) === String(initialData.formation_id));
      if (formation?.formation_type?.code) {
        setFormationType(formation?.formation_type?.code);
      }
    }
  }, [initialData, formations]);

  const filteredFormations = formationType
    ? formations.filter(f => f.formation_type?.code === formationType)
    : formations;

  const handleSubmit = async () => {
    await onSubmit(formData);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
      <div className="space-y-2">
        <Label htmlFor="first_name">Prénom *</Label>
        <Input
          id="first_name"
          value={formData.first_name}
          onChange={(e) => setFormData(prev => ({ ...prev, first_name: e.target.value }))}
          placeholder="Prénom"
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="last_name">Nom *</Label>
        <Input
          id="last_name"
          value={formData.last_name}
          onChange={(e) => setFormData(prev => ({ ...prev, last_name: e.target.value }))}
          placeholder="Nom"
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="num_apogee">Numéro d'apogée</Label>
        <Input
          id="num_apogee"
          value={formData.num_apogee}
          onChange={(e) => setFormData(prev => ({ ...prev, num_apogee: e.target.value }))}
          placeholder="Numéro d'apogée (optionnel)"
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          value={formData.email}
          onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
          placeholder="email@uit.ac.ma (optionnel)"
        />
      </div>
      
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Type de formation *</Label>
          <Select
            value={formationType}
            onValueChange={(value: 'LUS' | 'MUS') => {
              setFormationType(value);
              setFormData(prev => ({ ...prev, formation_id: '' }));
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Choisir LUS ou MUS" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="LUS">LUS</SelectItem>
              <SelectItem value="MUS">MUS</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Formation *</Label>
          <Select
            value={formData.formation_id}
            onValueChange={(value) => setFormData(prev => ({ ...prev, formation_id: value }))}
            disabled={!formationType || formationsLoading}
          >
            <SelectTrigger>
              <SelectValue
                placeholder={
                  formationsLoading
                    ? "Chargement..."
                    : !formationType
                      ? "Choisir d'abord le type"
                      : "Sélectionner la formation"
                }
              />
            </SelectTrigger>
            <SelectContent>
              {filteredFormations.length === 0 ? (
                <div className="px-3 py-2 text-sm text-muted-foreground">
                  Aucune formation pour ce type
                </div>
              ) : (
                filteredFormations.map((formation) => (
                  <SelectItem key={String(formation.id)} value={String(formation.id)}>
                    {formation.formation_name}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Année universitaire *</Label>
        <Select
          value={formData.academic_year}
          onValueChange={(value) => setFormData(prev => ({ ...prev, academic_year: value }))}
        >
          <SelectTrigger>
            <SelectValue placeholder="Sélectionner" />
          </SelectTrigger>
          <SelectContent>
            {getAnneeUniversitaires().map((a) => (
              <SelectItem key={a} value={a}>{a}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      <div className="md:col-span-2 pt-4 flex gap-2">
        <Button 
          variant="outline" 
          onClick={onCancel} 
          className="flex-1"
          disabled={isSubmitting}
        >
          Annuler
        </Button>
        <Button 
          onClick={handleSubmit} 
          disabled={isSubmitting} 
          className="flex-1"
        >
          {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}
