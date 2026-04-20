import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { IndustryProvider } from "@/contexts/IndustryContext";
import { useIsMobile } from "@/hooks/use-mobile";
import AppLayout from "@/components/AppLayout";
import ErrorBoundary from "@/components/ErrorBoundary";
import RealtimeNotifications from "@/components/RealtimeNotifications";
import LoginPage from "@/pages/LoginPage";
import DashboardPage from "@/pages/DashboardPage";
import AssistantSelectorPage from "@/pages/AssistantSelectorPage";
import CitiesBacklogPage from "@/pages/CitiesBacklogPage";
import ContactsListPage from "@/pages/ContactsListPage";
import LeadsPage from "@/pages/LeadsPage";
import TemplatesPage from "@/pages/TemplatesPage";
import DailyBatchPage from "@/pages/DailyBatchPage";
import InteractionsPage from "@/pages/InteractionsPage";
import ImportsPage from "@/pages/ImportsPage";
import SearchLeadsPage from "@/pages/SearchLeadsPage";
import ResetPasswordPage from "@/pages/ResetPasswordPage";
import TodayPage from "@/pages/TodayPage";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

function MobileRedirect() {
  const isMobile = useIsMobile();
  return isMobile ? <Navigate to="/today" replace /> : <DashboardPage />;
}

function ProtectedRoutes() {
  const { session, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Carregando...</div>;
  if (!session) return <LoginPage />;

  return (
    <IndustryProvider>
      <RealtimeNotifications />
      <AppLayout>
        <Routes>
          <Route path="/" element={<MobileRedirect />} />
          <Route path="/today" element={<TodayPage />} />
          <Route path="/assistente" element={<AssistantSelectorPage />} />
          <Route path="/cidades" element={<CitiesBacklogPage />} />
          <Route path="/ativos" element={<ContactsListPage category="ATIVO" title="Ativos" source="BASE_ATIVOS" />} />
          <Route path="/inativos" element={<ContactsListPage category="INATIVO" title="Inativos" source="BASE_INATIVOS" />} />
          <Route path="/leads" element={<LeadsPage />} />
          <Route path="/templates" element={<TemplatesPage />} />
          <Route path="/lote" element={<DailyBatchPage />} />
          <Route path="/interacoes" element={<InteractionsPage />} />
          <Route path="/importacoes" element={<ImportsPage />} />
          <Route path="/prospeccao" element={<SearchLeadsPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AppLayout>
    </IndustryProvider>
  );
}

const App = () => (
  <ErrorBoundary>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Sonner />
          <BrowserRouter>
            <AuthProvider>
              <Routes>
                <Route path="/reset-password" element={<ResetPasswordPage />} />
                <Route path="/*" element={<ProtectedRoutes />} />
              </Routes>
            </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  </ErrorBoundary>
);

export default App;
