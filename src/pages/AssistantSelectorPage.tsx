import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useIndustry } from "@/contexts/IndustryContext";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building2, Paintbrush, Car } from "lucide-react";

export default function AssistantSelectorPage() {
  const { industryId, industryKey, setIndustry, setMode } = useIndustry();
  const navigate = useNavigate();

  const { data: industries } = useQuery({
    queryKey: ["industries"],
    queryFn: async () => {
      const { data } = await supabase.from("industries").select("*").eq("is_active", true);
      return data ?? [];
    },
  });

  const { data: modes } = useQuery({
    queryKey: ["industry-modes", industryId],
    queryFn: async () => {
      if (!industryId) return [];
      const { data } = await supabase.from("industry_modes").select("*").eq("industry_id", industryId).eq("is_active", true);
      return data ?? [];
    },
    enabled: !!industryId && industryKey === "IMPRIMAX",
  });

  const showModeSelector = industryKey === "IMPRIMAX" && modes && modes.length > 0;

  const handleSelectMode = (modeId: string, modeName: string) => {
    setMode(modeId, modeName);
    navigate("/");
  };

  const handleSelectIndustry = (id: string, key: string, name: string) => {
    setIndustry(id, key, name);
    if (key !== "IMPRIMAX") {
      navigate("/");
    }
  };

  const iconMap: Record<string, typeof Building2> = {
    KAPAZI: Building2,
    FORTE: Building2,
    IMPRIMAX: Building2,
  };

  const modeIconMap: Record<string, typeof Paintbrush> = {
    DECOR: Paintbrush,
    AUTOMOTIVO: Car,
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-2xl font-bold tracking-tight">Selecionar Assistente</h1>

      {!showModeSelector ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {industries?.map((ind) => {
            const Icon = iconMap[ind.key] ?? Building2;
            const active = industryId === ind.id;
            return (
              <Card
                key={ind.id}
                className={`cursor-pointer transition-all hover:shadow-md ${active ? "ring-2 ring-primary shadow-md" : "shadow-sm"}`}
                onClick={() => handleSelectIndustry(ind.id, ind.key, ind.name)}
              >
                <CardHeader className="text-center pb-2">
                  <Icon className="h-8 w-8 mx-auto text-primary" />
                  <CardTitle className="text-lg">{ind.name}</CardTitle>
                </CardHeader>
                <CardContent className="text-center">
                  <p className="text-xs text-muted-foreground">
                    {ind.territory_type === "METRO_ONLY" ? "Apenas Região Metropolitana (8 cidades)" : "Todas as 16 cidades"}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-muted-foreground">Selecione o modo do Imprimax:</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {modes?.map((mode) => {
              const Icon = modeIconMap[mode.key] ?? Paintbrush;
              return (
                <Card
                  key={mode.id}
                  className="cursor-pointer transition-all hover:shadow-md shadow-sm"
                  onClick={() => handleSelectMode(mode.id, mode.name)}
                >
                  <CardHeader className="text-center pb-2">
                    <Icon className="h-8 w-8 mx-auto text-primary" />
                    <CardTitle className="text-lg">{mode.name}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-center">
                    <Button variant="outline" size="sm">Selecionar</Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
