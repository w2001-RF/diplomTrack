import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Loader2, GraduationCap, Shield, Lock, Mail, User } from 'lucide-react';
import { z } from 'zod';

// Validation schemas
const emailSchema = z.string().email({ message: "Email invalide" }).max(255);
const passwordSchema = z.string().min(6, { message: "Le mot de passe doit contenir au moins 6 caractères" });
const fullNameSchema = z.string().min(2, { message: "Le nom doit contenir au moins 2 caractères" }).max(100);

const Auth = () => {
  const navigate = useNavigate();
  const { user, loading, signIn, signUp } = useAuth();
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'login' | 'signup'>('login');
  
  // Form states
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupFullName, setSignupFullName] = useState('');
  const [signupConfirmPassword, setSignupConfirmPassword] = useState('');
  
  // Error states
  const [loginErrors, setLoginErrors] = useState<{ email?: string; password?: string }>({});
  const [signupErrors, setSignupErrors] = useState<{ email?: string; password?: string; fullName?: string; confirmPassword?: string }>({});

  // Redirect if already logged in
  useEffect(() => {
    if (user && !loading) {
      navigate('/', { replace: true });
    }
  }, [user, loading, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginErrors({});

    // Validate
    const emailResult = emailSchema.safeParse(loginEmail);
    const passwordResult = passwordSchema.safeParse(loginPassword);

    if (!emailResult.success || !passwordResult.success) {
      setLoginErrors({
        email: emailResult.success ? undefined : emailResult.error.errors[0].message,
        password: passwordResult.success ? undefined : passwordResult.error.errors[0].message
      });
      return;
    }

    setIsSubmitting(true);

    const { error } = await signIn(loginEmail, loginPassword);

    if (error) {
      if (error.message.includes('Invalid login credentials')) {
        toast.error('Email ou mot de passe incorrect');
      } else if (error.message.includes('Email not confirmed')) {
        toast.error('Veuillez confirmer votre email avant de vous connecter');
      } else {
        toast.error(error.message);
      }
    } else {
      toast.success('Connexion réussie');
      navigate('/', { replace: true });
    }

    setIsSubmitting(false);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignupErrors({});

    // Validate
    const emailResult = emailSchema.safeParse(signupEmail);
    const passwordResult = passwordSchema.safeParse(signupPassword);
    const fullNameResult = fullNameSchema.safeParse(signupFullName);
    
    const errors: typeof signupErrors = {};
    
    if (!emailResult.success) errors.email = emailResult.error.errors[0].message;
    if (!passwordResult.success) errors.password = passwordResult.error.errors[0].message;
    if (!fullNameResult.success) errors.fullName = fullNameResult.error.errors[0].message;
    if (signupPassword !== signupConfirmPassword) errors.confirmPassword = 'Les mots de passe ne correspondent pas';

    if (Object.keys(errors).length > 0) {
      setSignupErrors(errors);
      return;
    }

    setIsSubmitting(true);

    const { error } = await signUp(signupEmail, signupPassword, signupFullName);

    if (error) {
      if (error.message.includes('User already registered')) {
        toast.error('Un compte existe déjà avec cet email');
      } else {
        toast.error(error.message);
      }
    } else {
      toast.success('Compte créé avec succès ! Vous pouvez maintenant vous connecter.');
      setActiveTab('login');
      setLoginEmail(signupEmail);
    }

    setIsSubmitting(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/30 to-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8 animate-fade-in">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="p-3 bg-primary/10 rounded-xl">
              <GraduationCap className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-3xl font-bold text-foreground tracking-tight">DiplomTrack</h1>
          </div>
          <p className="text-muted-foreground">
            Système de suivi des validations de diplômes
          </p>
        </div>

        {/* Auth Card */}
        <Card className="border-border/50 shadow-xl animate-fade-in" style={{ animationDelay: '0.1s' }}>
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'login' | 'signup')}>
            <CardHeader className="pb-4">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login" className="text-sm">Connexion</TabsTrigger>
                <TabsTrigger value="signup" className="text-sm">Inscription</TabsTrigger>
              </TabsList>
            </CardHeader>
            
            <CardContent>
              {/* Login Tab */}
              <TabsContent value="login" className="mt-0">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email" className="text-foreground">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="login-email"
                        type="email"
                        placeholder="votre@email.com"
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        className="pl-10"
                        disabled={isSubmitting}
                      />
                    </div>
                    {loginErrors.email && (
                      <p className="text-sm text-destructive">{loginErrors.email}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="login-password" className="text-foreground">Mot de passe</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="login-password"
                        type="password"
                        placeholder="••••••••"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        className="pl-10"
                        disabled={isSubmitting}
                      />
                    </div>
                    {loginErrors.password && (
                      <p className="text-sm text-destructive">{loginErrors.password}</p>
                    )}
                  </div>

                  <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Connexion...
                      </>
                    ) : (
                      <>
                        <Shield className="mr-2 h-4 w-4" />
                        Se connecter
                      </>
                    )}
                  </Button>
                </form>
              </TabsContent>

              {/* Signup Tab */}
              <TabsContent value="signup" className="mt-0">
                <form onSubmit={handleSignup} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-fullname" className="text-foreground">Nom complet</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="signup-fullname"
                        type="text"
                        placeholder="Prénom Nom"
                        value={signupFullName}
                        onChange={(e) => setSignupFullName(e.target.value)}
                        className="pl-10"
                        disabled={isSubmitting}
                      />
                    </div>
                    {signupErrors.fullName && (
                      <p className="text-sm text-destructive">{signupErrors.fullName}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-email" className="text-foreground">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="signup-email"
                        type="email"
                        placeholder="votre@email.com"
                        value={signupEmail}
                        onChange={(e) => setSignupEmail(e.target.value)}
                        className="pl-10"
                        disabled={isSubmitting}
                      />
                    </div>
                    {signupErrors.email && (
                      <p className="text-sm text-destructive">{signupErrors.email}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-password" className="text-foreground">Mot de passe</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="signup-password"
                        type="password"
                        placeholder="••••••••"
                        value={signupPassword}
                        onChange={(e) => setSignupPassword(e.target.value)}
                        className="pl-10"
                        disabled={isSubmitting}
                      />
                    </div>
                    {signupErrors.password && (
                      <p className="text-sm text-destructive">{signupErrors.password}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-confirm-password" className="text-foreground">Confirmer le mot de passe</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="signup-confirm-password"
                        type="password"
                        placeholder="••••••••"
                        value={signupConfirmPassword}
                        onChange={(e) => setSignupConfirmPassword(e.target.value)}
                        className="pl-10"
                        disabled={isSubmitting}
                      />
                    </div>
                    {signupErrors.confirmPassword && (
                      <p className="text-sm text-destructive">{signupErrors.confirmPassword}</p>
                    )}
                  </div>

                  <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Création du compte...
                      </>
                    ) : (
                      <>
                        <GraduationCap className="mr-2 h-4 w-4" />
                        Créer un compte
                      </>
                    )}
                  </Button>

                  <p className="text-xs text-muted-foreground text-center mt-4">
                    Par défaut, vous serez inscrit en tant qu'Étudiant. 
                    Un administrateur pourra modifier votre rôle.
                  </p>
                </form>
              </TabsContent>
            </CardContent>
          </Tabs>
        </Card>

        {/* Footer */}
        <p className="text-center text-sm text-muted-foreground mt-6 animate-fade-in" style={{ animationDelay: '0.2s' }}>
          Bureau de Formation Continue — ENSA Ibn Tofail
        </p>
      </div>
    </div>
  );
};

export default Auth;
