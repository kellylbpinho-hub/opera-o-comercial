import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { INDUSTRY_CATALOG } from "@/lib/whatsapp-messages";
import { cn } from "@/lib/utils";

interface IndustryTagsSelectorProps {
  /** Tags selecionadas no formato "MARCA:Nicho" */
  value: string[];
  onChange: (tags: string[]) => void;
  label?: string;
  helperText?: string;
}

/**
 * Botões selecionáveis para indicar quais indústrias/nichos o representante atende
 * para um cliente específico. Multi-seleção, agrupado por marca.
 *
 * Ex.: cliente atende "KAPAZI:Home Center" e "IMPRIMAX:Decoração".
 */
export default function IndustryTagsSelector({
  value,
  onChange,
  label = "Indústrias que atendo",
  helperText = "Toque para marcar as marcas e nichos atendidos por este cliente.",
}: IndustryTagsSelectorProps) {
  const toggle = (tag: string) => {
    if (value.includes(tag)) onChange(value.filter(t => t !== tag));
    else onChange([...value, tag]);
  };

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-sm font-medium">{label}</Label>
        {helperText && <p className="text-xs text-muted-foreground mt-0.5">{helperText}</p>}
      </div>

      <div className="space-y-3 rounded-md border p-3 bg-muted/20">
        {INDUSTRY_CATALOG.map(industry => (
          <div key={industry.brand} className="space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              {industry.brandLabel}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {industry.niches.map(niche => {
                const tag = `${industry.brand}:${niche}`;
                const selected = value.includes(tag);
                return (
                  <button
                    type="button"
                    key={tag}
                    onClick={() => toggle(tag)}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
                      "hover:border-primary/60",
                      selected
                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                        : "bg-background text-foreground border-border"
                    )}
                  >
                    {niche}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {value.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {value.map(tag => {
            const [brand, niche] = tag.split(":");
            const ind = INDUSTRY_CATALOG.find(i => i.brand === brand);
            return (
              <Badge key={tag} variant="secondary" className="text-xs">
                {ind?.brandLabel ?? brand} · {niche}
              </Badge>
            );
          })}
        </div>
      )}
    </div>
  );
}
