import { Link, useLocation } from "react-router-dom";
import { Sun, Package, Users, MapPin, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  to: string;
  label: string;
  icon: React.ElementType;
}

// "Hoje" é a home mobile (substitui o Dashboard só no bottom nav).
// Em desktop o Dashboard segue acessível em "/" via sidebar.
const navItems: NavItem[] = [
  { to: "/today", label: "Hoje", icon: Sun },
  { to: "/lote", label: "Carteira", icon: Package },
  { to: "/leads", label: "Leads", icon: Users },
  { to: "/prospeccao", label: "Prospectar", icon: MapPin },
  { to: "/importacoes", label: "Importar", icon: FileText },
];

export default function MobileBottomNav() {
  const location = useLocation();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border safe-area-pb">
      <div className="flex items-center justify-around h-16">
        {navItems.map((item) => {
          const isActive = location.pathname === item.to;
          const Icon = item.icon;
          
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 px-3 py-2 min-w-[64px] rounded-lg transition-colors",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon
                className={cn(
                  "h-5 w-5 transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}
              />
              <span className={cn(
                "text-[10px] font-medium",
                isActive ? "text-primary" : "text-muted-foreground"
              )}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
