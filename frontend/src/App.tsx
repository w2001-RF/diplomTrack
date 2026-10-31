import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/AuthProvider";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { RootRedirect } from "@/components/RootRedirect";
import { UserRole } from "@/constants/roles";
import AdminDashboard from "./pages/AdminDashboard";
import AgentTickets from "./pages/AgentTickets";
import AgentStudents from "./pages/AgentStudents";
import AgentNotifications from "./pages/AgentNotifications";
import Profile from "./pages/Profile";
import CreateTicket from "./pages/CreateTicket";
import CreateAdvancedTicket from "./pages/CreateAdvancedTicket";
import TicketDetail from "./pages/TicketDetail";
import MyDossier from "./pages/MyDossier";
import AdminUsers from "./pages/AdminUsers";
import AdminSettings from "./pages/AdminSettings";
import Notifications from "./pages/Notifications";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import AgentDashboard from "./pages/AgentDashboard";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/" element={<RootRedirect />} />
            <Route path="/admin" element={
              <ProtectedRoute allowedRoles={[UserRole.ADMIN]}>
                <AdminDashboard />
              </ProtectedRoute>
            } />
            <Route path="/agent" element={
              <ProtectedRoute allowedRoles={[UserRole.AGENT]}>
                <AgentDashboard />
              </ProtectedRoute>
            } />
            <Route path="/dossiers" element={
              <ProtectedRoute allowedRoles={[UserRole.AGENT, UserRole.ADMIN]}>
                <AgentTickets />
              </ProtectedRoute>
            } />
            <Route path="/dossiers/create" element={
              <ProtectedRoute allowedRoles={[UserRole.AGENT]}>
                <CreateTicket />
              </ProtectedRoute>
            } />
            <Route path="/dossiers/create-advanced" element={
              <ProtectedRoute allowedRoles={[UserRole.AGENT]}>
                <CreateAdvancedTicket />
              </ProtectedRoute>
            } />
            <Route path="/students" element={
              <ProtectedRoute allowedRoles={[UserRole.AGENT, UserRole.ADMIN]}>
                <AgentStudents />
              </ProtectedRoute>
            } />
            <Route path="/agent-notifications" element={
              <ProtectedRoute allowedRoles={[UserRole.AGENT, UserRole.ADMIN]}>
                <AgentNotifications />
              </ProtectedRoute>
            } />
            <Route path="/profile" element={
              <ProtectedRoute allowedRoles={[UserRole.AGENT, UserRole.ADMIN, UserRole.STUDENT]}>
                <Profile />
              </ProtectedRoute>
            } />
            <Route path="/my-dossier" element={
              <ProtectedRoute allowedRoles={[UserRole.STUDENT]}>
                <MyDossier />
              </ProtectedRoute>
            } />
            <Route path="/dossier/:id" element={
              <ProtectedRoute>
                <TicketDetail />
              </ProtectedRoute>
            } />
            <Route path="/users" element={
              <ProtectedRoute allowedRoles={[UserRole.ADMIN]}>
                <AdminUsers />
              </ProtectedRoute>
            } />
            <Route path="/settings" element={
              <ProtectedRoute allowedRoles={[UserRole.ADMIN]}>
                <AdminSettings />
              </ProtectedRoute>
            } />
            <Route path="/notifications" element={
              <ProtectedRoute allowedRoles={[UserRole.STUDENT]}>
                <Notifications />
              </ProtectedRoute>
            } />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
