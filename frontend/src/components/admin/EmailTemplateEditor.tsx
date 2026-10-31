import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Eye, Code, Save, X } from 'lucide-react';

interface EmailTemplateEditorProps {
  isOpen: boolean;
  onClose: () => void;
  templateKey: string;
  templateTitle: string;
  subjectValue: string;
  bodyValue: string;
  onSave: (subject: string, body: string) => void;
  variables: string[];
}

export function EmailTemplateEditor({
  isOpen,
  onClose,
  templateKey,
  templateTitle,
  subjectValue,
  bodyValue,
  onSave,
  variables
}: EmailTemplateEditorProps) {
  const [subject, setSubject] = useState(subjectValue);
  const [body, setBody] = useState(bodyValue);
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit');

  const handleSave = () => {
    onSave(subject, body);
    onClose();
  };

  const handleClose = () => {
    setSubject(subjectValue);
    setBody(bodyValue);
    onClose();
  };

  // Générer un aperçu avec des valeurs d'exemple
  const getPreviewHtml = () => {
    let preview = body;
    const exampleValues: Record<string, string> = {
      student_name: 'Ahmed BENALI',
      ticket_reference: 'DIPL-2024-001',
      ticket_id: '123',
      reason: 'Documents manquants: CNI, Relevé de notes',
      agent_name: 'Mohammed TAZI',
      count: '5',
      tickets_rows: '<tr><td>DIPL-2024-001</td><td>Ahmed BENALI</td><td>3 jours</td><td>15/01/2024</td></tr>',
      admin_name: 'Administrateur',
      report_date: new Date().toLocaleDateString('fr-FR'),
      total_delayed: '10',
      agents_with_delays: '3',
      agents_summary_rows: '<tr><td>Mohammed TAZI</td><td>agent@uit.ac.ma</td><td>5</td></tr>',
      current_year: new Date().getFullYear().toString(),
      frontend_url: window.location.origin
    };

    Object.entries(exampleValues).forEach(([key, value]) => {
      preview = preview.replace(new RegExp(`{${key}}`, 'g'), value);
    });

    return preview;
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-xl">{templateTitle}</DialogTitle>
          <DialogDescription>
            Personnalisez le sujet et le contenu HTML de l'email
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4">
          {/* Subject */}
          <div className="space-y-2">
            <Label htmlFor="subject">Sujet de l'email</Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Entrez le sujet de l'email"
            />
          </div>

          {/* Variables disponibles */}
          <div className="bg-muted p-3 rounded-md">
            <p className="text-sm font-medium mb-2">Variables disponibles:</p>
            <div className="flex flex-wrap gap-2">
              {variables.map((variable) => (
                <code
                  key={variable}
                  className="text-xs bg-background px-2 py-1 rounded border cursor-pointer hover:bg-accent"
                  onClick={() => {
                    const textarea = document.getElementById('template-body') as HTMLTextAreaElement;
                    if (textarea) {
                      const start = textarea.selectionStart;
                      const end = textarea.selectionEnd;
                      const newValue = body.substring(0, start) + `{${variable}}` + body.substring(end);
                      setBody(newValue);
                      setTimeout(() => {
                        textarea.focus();
                        textarea.setSelectionRange(start + variable.length + 2, start + variable.length + 2);
                      }, 0);
                    }
                  }}
                >
                  {`{${variable}}`}
                </code>
              ))}
            </div>
          </div>

          {/* Tabs: Edit / Preview */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'edit' | 'preview')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="edit" className="flex items-center gap-2">
                <Code className="h-4 w-4" />
                Éditer HTML
              </TabsTrigger>
              <TabsTrigger value="preview" className="flex items-center gap-2">
                <Eye className="h-4 w-4" />
                Aperçu
              </TabsTrigger>
            </TabsList>

            <TabsContent value="edit" className="mt-4">
              <div className="space-y-2">
                <Label htmlFor="template-body">Contenu HTML</Label>
                <Textarea
                  id="template-body"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={20}
                  className="font-mono text-sm"
                  placeholder="Entrez le code HTML du template"
                />
              </div>
            </TabsContent>

            <TabsContent value="preview" className="mt-4">
              <div className="border rounded-md p-4 bg-white">
                <div className="mb-4 pb-4 border-b">
                  <p className="text-sm text-muted-foreground mb-1">Sujet:</p>
                  <p className="font-medium">{subject}</p>
                </div>
                <div
                  className="prose max-w-none"
                  dangerouslySetInnerHTML={{ __html: getPreviewHtml() }}
                />
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            <X className="mr-2 h-4 w-4" />
            Annuler
          </Button>
          <Button onClick={handleSave}>
            <Save className="mr-2 h-4 w-4" />
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
