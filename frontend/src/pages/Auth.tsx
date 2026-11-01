import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArchWindow, BrandLockup, BrandMark, ZelligePanel } from '@/components/brand/Brand';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Loader2, GraduationCap, Lock, Mail, User, FileCheck2, BellRing, ShieldCheck, ArrowRight } from 'lucide-react';
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
    <div className="grid min-h-screen bg-background lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      {/* Brand panel */}
      <ZelligePanel className="hidden flex-col justify-between p-12 lg:flex xl:p-16">
        <BrandLockup inverted subtitle="ENSA · Université Ibn Tofaïl" />

        <div className="flex items-end gap-10">
          <div className="max-w-md animate-fade-in">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-white/50">Bureau de Formation Continue</p>
            <h2 className="font-display text-[2.75rem] font-semibold leading-[1.1] text-white">
              Le suivi de vos diplômes, en toute clarté.
            </h2>
            <p lang="ar" dir="rtl" className="mt-4 text-lg text-white/60">تتبّع شهاداتك بكل وضوح</p>
            <ul className="mt-10 space-y-4 text-[15px] text-white/80">
              {[
                { icon: <FileCheck2 className="h-4 w-4" />, text: 'Chaque pièce du dossier, validée et tracée' },
                { icon: <BellRing className="h-4 w-4" />, text: 'Une notification à chaque étape franchie' },
                { icon: <ShieldCheck className="h-4 w-4" />, text: 'Un accès réservé à votre rôle' },
              ].map((item) => (
                <li key={item.text} className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white">{item.icon}</span>
                  {item.text}
                </li>
              ))}
            </ul>
          </div>

          {/* Bab: an arch onto the zellige star */}
          <ArchWindow className="hidden h-72 w-48 shrink-0 bg-white/[0.06] ring-1 ring-inset ring-white/15 xl:block">
            <div className="bg-zellige absolute inset-0 opacity-25" />
            <div className="absolute inset-x-0 bottom-10 flex justify-center">
              <BrandMark inverted className="h-16 w-16 drop-shadow-xl" />
            </div>
          </ArchWindow>
        </div>

        <p className="text-xs text-white/40">© {new Date().getFullYear()} Université Ibn Tofaïl · Kénitra, Maroc</p>
      </ZelligePanel>

      {/* Form */}
      <div className="flex items-center justify-center px-6 py-12 sm:px-12">
        <div className="w-full max-w-sm animate-fade-in">
          <BrandLockup className="mb-10 lg:hidden" showArabic />

          <h1 className="text-[1.75rem] font-semibold tracking-tight text-foreground">
            {activeTab === 'login' ? 'Bon retour parmi nous' : 'Créer votre compte'}
          </h1>
          <p className="mt-2 text-[15px] text-muted-foreground">
            {activeTab === 'login'
              ? 'Connectez-vous pour suivre vos dossiers de diplôme.'
              : 'Inscrivez-vous avec l’adresse que vous avez donnée au bureau.'}
          </p>

          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'login' | 'signup')} className="mt-8">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login" className="text-sm">Connexion</TabsTrigger>
                <TabsTrigger value="signup" className="text-sm">Inscription</TabsTrigger>
              </TabsList>

            <div className="mt-6">
              {/* Login Tab */}
              <TabsContent value="login" className="mt-0">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email" className="text-foreground">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="login-email"
                        type="email"
                        placeholder="votre@email.com"
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        className="h-11 pl-10"
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
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="login-password"
                        type="password"
                        placeholder="••••••••"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        className="h-11 pl-10"
                        disabled={isSubmitting}
                      />
                    </div>
                    {loginErrors.password && (
                      <p className="text-sm text-destructive">{loginErrors.password}</p>
                    )}
                  </div>

                  <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Connexion...
                      </>
                    ) : (
                      <>
                        Se connecter
                        <ArrowRight className="h-4 w-4" />
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
                      <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="signup-fullname"
                        type="text"
                        placeholder="Prénom Nom"
                        value={signupFullName}
                        onChange={(e) => setSignupFullName(e.target.value)}
                        className="h-11 pl-10"
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
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="signup-email"
                        type="email"
                        placeholder="votre@email.com"
                        value={signupEmail}
                        onChange={(e) => setSignupEmail(e.target.value)}
                        className="h-11 pl-10"
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
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="signup-password"
                        type="password"
                        placeholder="••••••••"
                        value={signupPassword}
                        onChange={(e) => setSignupPassword(e.target.value)}
                        className="h-11 pl-10"
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
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="signup-confirm-password"
                        type="password"
                        placeholder="••••••••"
                        value={signupConfirmPassword}
                        onChange={(e) => setSignupConfirmPassword(e.target.value)}
                        className="h-11 pl-10"
                        disabled={isSubmitting}
                      />
                    </div>
                    {signupErrors.confirmPassword && (
                      <p className="text-sm text-destructive">{signupErrors.confirmPassword}</p>
                    )}
                  </div>

                  <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
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
            </div>
          </Tabs>

          <p className="mt-10 text-center text-xs text-muted-foreground">
            Bureau de Formation Continue — ENSA Kénitra
          </p>
        </div>
      </div>
    </div>
  );
};

export default Auth;
