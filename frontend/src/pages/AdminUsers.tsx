//react
import { useState } from 'react';
import { toast } from 'sonner';
import { Search, Shield, User, Users, Loader2, Plus, Upload, Trash2 } from 'lucide-react';

//components
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { BulkAgentPasswordsDialog, type CreatedAgentCredential } from "@/components/admin/BulkAgentPasswordsDialog";

//api
import { api } from '@/lib/api';
import type { AppRole, ProfileRow as Profile, UserRoleRow } from '@/lib/api/models';

//hooks
import { useAllProfilesQuery } from '@/hooks/api/useProfilesQuery';
import { useUserRolesQuery } from '@/hooks/api/useUserRolesQuery';
import { useDeleteUserMutation } from '@/hooks/api/useDeleteUserMutation';
import { useBulkCreateAgentsMutation } from '@/hooks/api/useBulkCreateAgentsMutation';
import { UserRole } from '@/constants/roles';

interface UserWithRole extends Profile {
  role: AppRole;
  role_id: string;
}

const roleLabels: Record<AppRole, string> = {
  [UserRole.STUDENT]: 'Étudiant',
  [UserRole.AGENT]: 'Agent BFC',
  [UserRole.ADMIN]: 'Administrateur'
};

const roleColors: Record<AppRole, string> = {
  [UserRole.STUDENT]: 'bg-secondary text-secondary-foreground',
  [UserRole.AGENT]: 'bg-primary text-primary-foreground',
  [UserRole.ADMIN]: 'bg-[hsl(var(--status-validated))] text-primary-foreground'
};

const roleIcons: Record<AppRole, React.ReactNode> = {
  [UserRole.STUDENT]: <User className="h-4 w-4" />,
  [UserRole.AGENT]: <Users className="h-4 w-4" />,
  [UserRole.ADMIN]: <Shield className="h-4 w-4" />
};

export default function AdminUsers() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState<AppRole | 'all'>('all');
  const [selectedUser, setSelectedUser] = useState<UserWithRole | null>(null);
  const [newRole, setNewRole] = useState<AppRole>(UserRole.AGENT);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkEmails, setBulkEmails] = useState('');
  const [creatingBulk, setCreatingBulk] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [passwordsDialogOpen, setPasswordsDialogOpen] = useState(false);
  const [createdAgents, setCreatedAgents] = useState<CreatedAgentCredential[]>([]);

  const deleteUserMutation = useDeleteUserMutation();
  const bulkCreateAgentsMutation = useBulkCreateAgentsMutation();

  // Fetch all profiles and user roles
  const profilesQuery = useAllProfilesQuery();
  const rolesQuery = useUserRolesQuery();

  const refreshData = async () => {
    await Promise.all([
      profilesQuery.refetch(),
      rolesQuery.refetch()
    ]);
  };

  // Combine profiles and roles
  const users: UserWithRole[] = (profilesQuery.data || []).map(profile => {
    const userRole = (rolesQuery.roles || []).find(r => r.user_id === profile.user_id);
    return {
      ...profile,
      role: userRole?.role || UserRole.STUDENT,
      role_id: userRole?.id || ''
    };
  });

  const isLoading = profilesQuery.isLoading || rolesQuery.isLoading;

  const handleBulkCreateAgents = async () => {
    const emails = bulkEmails
      .split('\n')
      .map(e => e.trim())
      .filter(e => e && e.includes('@'));

    if (emails.length === 0) {
      toast.error('Veuillez entrer au moins un email valide');
      return;
    }

    setCreatingBulk(true);
    
    try {
      // Backend expects [{username,email}]
      const agents = emails.map(email => ({
        email,
        username: email.split('@')[0]
      }));

      const res = await bulkCreateAgentsMutation.mutateAsync({ agents });
      console.log('Bulk create agents response:', res);
      toast.success(`${res.count} agent(s) créé(s) avec succès`);
      
      // Save result in state and show dialog
      setCreatedAgents(res.created || []);
      setPasswordsDialogOpen(true);

      setBulkEmails('');
      setBulkDialogOpen(false);
      await refreshData();

    } catch (error: any) {
      console.error('Bulk create agents error:', error);
      toast.error(error.message || 'Erreur lors de la création');
    } finally {
      setCreatingBulk(false);
    }
  };

  const handleUpdateRole = async () => {
    if (!selectedUser) return;

    if (newRole !== UserRole.AGENT && selectedUser.role !== UserRole.AGENT) {
      toast.error('Vous ne pouvez promouvoir qu\'en rôle Agent');
      return;
    }

    setUpdatingUserId(selectedUser.user_id);
    try {
      const { error } = await api.data.update('admin/users', String(selectedUser.user_id), { role: newRole }, 'PUT');

      if (error) throw error;

      toast.success(`Rôle de ${selectedUser.full_name || selectedUser.email} mis à jour en ${roleLabels[newRole]}`);
      setDialogOpen(false);
      await refreshData();
    } catch (error: any) {
      console.error('Error updating role:', error);
      toast.error(error.message || 'Erreur lors de la mise à jour du rôle');
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleDeleteUser = async (user: UserWithRole) => {
    setDeletingUserId(user.user_id);
    try {
      await deleteUserMutation.mutateAsync(String(user.user_id));
      
      toast.success(`Utilisateur ${user.full_name || user.email} supprimé`);
      await refreshData();
    } catch (error: any) {
      console.error('Error deleting user:', error);
      toast.error(error.message || 'Erreur lors de la suppression');
    } finally {
      setDeletingUserId(null);
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = 
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (user.full_name?.toLowerCase() || '').includes(searchQuery.toLowerCase());
    
    const matchesRole = filterRole === 'all' || user.role === filterRole;
    
    return matchesSearch && matchesRole;
  });

  const roleStats = {
    student: users.filter(u => u.role === UserRole.STUDENT).length,
    agent: users.filter(u => u.role === UserRole.AGENT).length,
    admin: users.filter(u => u.role === UserRole.ADMIN).length
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }
  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Gestion des Agents</h1>
            <p className="text-muted-foreground mt-1">
              Créez et gérez les comptes agents en masse
            </p>
          </div>
          <Button onClick={() => setBulkDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Créer des agents
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Étudiants</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <User className="h-5 w-5 text-secondary" />
                <span className="text-2xl font-bold">{roleStats.student}</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Agents BFC</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                <span className="text-2xl font-bold">{roleStats.agent}</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Administrateurs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-[hsl(var(--status-validated))]" />
                <span className="text-2xl font-bold">{roleStats.admin}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher par nom ou email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={filterRole} onValueChange={(value: AppRole | 'all') => setFilterRole(value)}>
                <SelectTrigger className="w-full md:w-[200px]">
                  <SelectValue placeholder="Filtrer par rôle" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les rôles</SelectItem>
                  <SelectItem value={UserRole.AGENT}>Agents BFC</SelectItem>
                  <SelectItem value={UserRole.STUDENT}>Étudiants</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Users Table */}
        <Card>
          <CardHeader>
            <CardTitle>Liste des utilisateurs</CardTitle>
            <CardDescription>
              {filteredUsers.length} utilisateur(s) trouvé(s)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Utilisateur</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Rôle</TableHead>
                  <TableHead>Inscrit le</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      Aucun utilisateur trouvé
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
                            {roleIcons[user.role]}
                          </div>
                          <span className="font-medium">
                            {user.full_name || 'Sans nom'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {user.email}
                      </TableCell>
                      <TableCell>
                        <Badge className={roleColors[user.role]}>
                          {roleLabels[user.role]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(user.created_at).toLocaleDateString('fr-FR')}
                      </TableCell>
                      <TableCell className="text-right">
                        {user?.role !== UserRole.ADMIN && (
                          <div className="flex items-center justify-end gap-2">
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  className="text-[hsl(var(--status-rejected))] hover:bg-[hsl(var(--status-rejected))]/10"
                                >
                                  {deletingUserId === user.user_id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-4 w-4" />
                                  )}
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Supprimer cet utilisateur ?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Cette action supprimera le profil de {user.full_name || user.email}. L'utilisateur ne pourra plus se connecter.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                                  <AlertDialogAction 
                                    className="bg-[hsl(var(--status-rejected))] hover:bg-[hsl(var(--status-rejected))]/90"
                                    onClick={() => handleDeleteUser(user)}
                                  >
                                    Supprimer
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Role Update Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Modifier le rôle</DialogTitle>
              <DialogDescription>
                Changer le rôle de {selectedUser?.full_name || selectedUser?.email}
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Select value={newRole} onValueChange={(value: AppRole) => setNewRole(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UserRole.STUDENT}>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Étudiant
                    </div>
                  </SelectItem>
                  <SelectItem value={UserRole.AGENT}>
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Agent BFC
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Annuler
              </Button>
              <Button onClick={handleUpdateRole} disabled={updatingUserId === selectedUser?.user_id}>
                {updatingUserId === selectedUser?.user_id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Enregistrer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Bulk Create Agents Dialog */}
        <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Créer des agents en masse</DialogTitle>
              <DialogDescription>
                Entrez les adresses email des agents à créer, une par ligne. Un mot de passe temporaire sera généré pour chaque compte.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="emails">Adresses email (une par ligne)</Label>
                <Textarea
                  id="emails"
                  value={bulkEmails}
                  onChange={(e) => setBulkEmails(e.target.value)}
                  placeholder="agent1@ensa.ma&#10;agent2@ensa.ma&#10;agent3@ensa.ma"
                  rows={8}
                />
              </div>
              <div className="bg-muted/50 p-3 rounded-lg text-sm text-muted-foreground">
                <Upload className="h-4 w-4 inline mr-2" />
                Les agents recevront un email avec les instructions de connexion.
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setBulkDialogOpen(false)}>
                Annuler
              </Button>
              <Button onClick={handleBulkCreateAgents} disabled={creatingBulk}>
                {creatingBulk && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Créer les agents
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <BulkAgentPasswordsDialog
        open={passwordsDialogOpen}
        onOpenChange={setPasswordsDialogOpen}
        created={createdAgents}
      />
    </DashboardLayout>
  );
}
