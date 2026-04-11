import { ReactNode, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useIndustry } from "@/contexts/IndustryContext";
import {
  LayoutDashboard, Building2, MapPin, Users, UserMinus, UserPlus,
  MessageSquare, Package, CalendarCheck, FileText, LogOut, ChevronRight, Menu, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import OverdueFollowupsBanner from "@/components/OverdueFollowupsBanner";

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/assistente", label: "Assistente", icon: Building2 },
  { to: "/cidades", label: "Cidades", icon: MapPin },
  { to: "/ativos", label: "Ativos", icon: Users },
  { to: "/inativos", label: "Inativos", icon: UserMinus },
  { to: "/leads", label: "Leads Novos", icon: UserPlus },
  { to: "/templates", label: "Templates", icon: MessageSquare },
  { to: "/lote", label: "Lote do Dia", icon: Package },
  { to: "/interacoes", label: "Interações", icon: CalendarCheck },
  { to: "/importacoes", label: "Importações", icon: FileText },
  { to: "/prospeccao", label: "Prospecção Maps", icon: MapPin },
];

export default function AppLayout({ children }: { children: ReactNode }) {
  const { signOut } = useAuth();
  const { industryName, modeName, clearSelection } = useIndustry();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const sidebar = (
    <>
      <div className="p-4 border-b border-sidebar-border">
        <h1 className="font-bold text-base tracking-tight text-sidebar-primary-foreground">
          Esteira Comercial PA
        </h1>
        {industryName && (
          <button
            onClick={clearSelection}
            className="mt-1 text-xs text-sidebar-foreground/70 hover:text-sidebar-foreground flex items-center gap-1 transition-colors"
          >
            <ChevronRight className="h-3 w-3" />
            {industryName}{modeName ? ` · ${modeName}` : ""}
          </button>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
        {navItems.map(item => {
          const active = location.pathname === item.to;
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              }`}
            >
              <item.icon className="h-4 w-4 flex-shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-sidebar-border">
        <Button
          variant="ghost"
          size="sm"
          onClick={signOut}
          className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
        >
          <LogOut className="h-4 w-4 mr-2" />
          Sair
        </Button>
      </div>
    </>
  );

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-60 flex-shrink-0 bg-sidebar text-sidebar-foreground flex-col border-r border-sidebar-border">
        {sidebar}
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-60 bg-sidebar text-sidebar-foreground flex flex-col z-10">
            <div className="absolute right-2 top-2">
              <Button variant="ghost" size="sm" onClick={() => setMobileOpen(false)} className="text-sidebar-foreground">
                <X className="h-4 w-4" />
              </Button>
            </div>
            {sidebar}
          </aside>
        </div>
      )}

      {/* Main */}
      <main className="flex-1 overflow-y-auto">
        {/* Mobile header */}
        <div className="md:hidden flex items-center gap-3 px-4 py-3 border-b bg-background sticky top-0 z-10">
          <Button variant="ghost" size="sm" onClick={() => setMobileOpen(true)} className="p-1">
            <Menu className="h-5 w-5" />
          </Button>
          <span className="font-semibold text-sm truncate">Esteira Comercial PA</span>
        </div>
        <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-4">
          <OverdueFollowupsBanner />
          {children}
        </div>
      </main>
    </div>
  );
}
