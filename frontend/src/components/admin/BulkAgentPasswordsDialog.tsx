import { useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Copy } from "lucide-react";

export type CreatedAgentCredential = {
  id: number | string;
  username: string;
  email: string;
  password: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  created: CreatedAgentCredential[];
};

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success("Copié !");
  } catch {
    toast.error("Impossible de copier. Autorisez l'accès au presse-papier.");
  }
}

export function BulkAgentPasswordsDialog({ open, onOpenChange, created }: Props) {
  const csvText = useMemo(() => {
    // Simple CSV export format
    const header = "username,email,password";
    const rows = created.map(a => `${a.username},${a.email},${a.password}`);
    return [header, ...rows].join("\n");
  }, [created]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Mots de passe temporaires (affichés une seule fois)</DialogTitle>
          <DialogDescription>
            Copiez et stockez ces informations en sécurité. Après fermeture, elles ne seront plus récupérables.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[420px] overflow-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Username</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Mot de passe</TableHead>
                <TableHead className="text-right">Copier</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {created.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-10">
                    Aucun compte créé.
                  </TableCell>
                </TableRow>
              ) : (
                created.map((a) => (
                  <TableRow key={String(a.id)}>
                    <TableCell className="font-medium">{a.username}</TableCell>
                    <TableCell>{a.email}</TableCell>
                    <TableCell className="font-mono">{a.password}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => copyToClipboard(a.password)}
                        title="Copier le mot de passe"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:justify-between">
          <Button variant="outline" onClick={() => copyToClipboard(csvText)}>
            <Copy className="mr-2 h-4 w-4" />
            Copier CSV (username,email,password)
          </Button>

          <Button onClick={() => onOpenChange(false)}>
            Fermer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
