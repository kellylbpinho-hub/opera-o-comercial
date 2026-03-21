import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { IndustryProvider } from "@/contexts/IndustryContext";
import AppLayout from "@/components/AppLayout";
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
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoutes() {
  const { session, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Carregando...</div>;
  if (!session) return <LoginPage />;

  return (
    <IndustryProvider>
      <AppLayout>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/assistente" element={<AssistantSelectorPage />} />
          <Route path="/cidades" element={<CitiesBacklogPage />} />
          <Route path="/ativos" element={<ContactsListPage category="ATIVO" title="Ativos" source="BASE_ATIVOS" />} />
          <Route path="/inativos" element={<ContactsListPage category="INATIVO" title="Inativos" source="BASE_INATIVOS" />} />
          <Route path="/leads" element={<LeadsPage />} />
          <Route path="/templates" element={<TemplatesPage />} />
          <Route path="/lote" element={<DailyBatchPage />} />
          <Route path="/interacoes" element={<InteractionsPage />} />
          <Route path="/importacoes" element={<ImportsPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AppLayout>
    </IndustryProvider>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/*" element={<ProtectedRoutes />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
