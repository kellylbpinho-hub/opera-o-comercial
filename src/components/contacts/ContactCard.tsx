import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Pencil, MessageCircle, Phone, Instagram, MapPin } from "lucide-react";
import {
  buildWhatsappLink,
  getWhatsappMessage,
  PROFILE_LABELS,
  getClientProfile,
  formatTag,
} from "@/lib/whatsapp-messages";

interface ContactCardProps {
  contact: any;
  /** Categoria visível como badge (ATIVO, INATIVO, NOVO_MAPS, NOVO_MANUAL...) */
  categoryLabel?: string;
  /** Se passado, ativa modo seleção (checkbox visível). */
  selected?: boolean;
  onToggleSelect?: () => void;
  onEdit?: () => void;
  /** Slot opcional ao final do card (ex.: AlertDialog de remover). */
  trailingActions?: React.ReactNode;
}

const STATUS_LABELS: Record<string, string> = {
  NAO_CONTATADO: "Não contatado",
  CONTATADO: "Contatado",
  RESPONDEU: "Respondeu",
  QUALIFICADO: "Qualificado",
  SEM_INTERESSE: "Sem interesse",
};

/**
 * Card mobile-first para um contato/lead.
 * Em desktop a página continua usando a tabela; este card é renderizado só em telas < md.
 */
export default function ContactCard({
  contact: c,
  categoryLabel,
  selected,
  onToggleSelect,
  onEdit,
  trailingActions,
}: ContactCardProps) {
  const phone = c.phone_normalized || c.phone_raw;
  const waLink = phone ? buildWhatsappLink(phone, getWhatsappMessage(c)) : null;
  const telLink = phone ? `tel:${String(phone).replace(/\D/g, "")}` : null;
  const igLink = c.instagram
    ? c.instagram.startsWith("http")
      ? c.instagram
      : `https://instagram.com/${c.instagram.replace(/^@/, "")}`
    : null;

  const tags: string[] = Array.isArray(c.industry_tags) ? c.industry_tags : [];

  return (
    <Card className={`shadow-sm transition-colors ${selected ? "border-primary bg-primary/5" : ""}`}>
      <CardContent className="p-3 space-y-2.5">
        {/* Header: checkbox + nome + editar */}
        <div className="flex items-start gap-2">
          {onToggleSelect && (
            <div className="pt-0.5">
              <Checkbox checked={selected} onCheckedChange={onToggleSelect} />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm leading-tight truncate">{c.company_name}</p>
            {c.contact_name && (
              <p className="text-xs text-muted-foreground truncate mt-0.5">{c.contact_name}</p>
            )}
          </div>
          {onEdit && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 -mr-1 -mt-1"
              onClick={onEdit}
              title="Editar"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>

        {/* Cidade + categoria + status */}
        <div className="flex flex-wrap gap-1.5 items-center text-xs">
          {c.city_name && (
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <MapPin className="h-3 w-3" />
              {c.city_name}
            </span>
          )}
          {categoryLabel && (
            <Badge variant="outline" className="text-[10px] py-0 px-1.5">{categoryLabel}</Badge>
          )}
          {c.status && (
            <Badge variant="secondary" className="text-[10px] py-0 px-1.5">
              {STATUS_LABELS[c.status] ?? c.status}
            </Badge>
          )}
        </div>

        {/* Tags de indústria */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {tags.slice(0, 4).map((t: string) => (
              <Badge key={t} variant="secondary" className="text-[10px] py-0 px-1.5">
                {formatTag(t)}
              </Badge>
            ))}
            {tags.length > 4 && (
              <Badge variant="outline" className="text-[10px] py-0 px-1.5">
                +{tags.length - 4}
              </Badge>
            )}
          </div>
        )}

        {/* Botões grandes para o polegar */}
        <div className="flex gap-2 pt-1">
          {waLink ? (
            <Button asChild variant="default" size="sm" className="flex-1 h-10 bg-accent hover:bg-accent/90 text-accent-foreground">
              <a
                href={waLink}
                target="_blank"
                rel="noopener noreferrer"
                title={`WhatsApp · ${PROFILE_LABELS[getClientProfile(c)]}`}
              >
                <MessageCircle className="h-4 w-4 mr-1.5" />
                WhatsApp
              </a>
            </Button>
          ) : (
            <Button variant="outline" size="sm" className="flex-1 h-10" disabled>
              <MessageCircle className="h-4 w-4 mr-1.5" />
              Sem telefone
            </Button>
          )}
          {telLink && (
            <Button asChild variant="outline" size="sm" className="h-10 px-3" title="Ligar">
              <a href={telLink}>
                <Phone className="h-4 w-4" />
              </a>
            </Button>
          )}
          {igLink && (
            <Button asChild variant="outline" size="sm" className="h-10 px-3" title="Instagram">
              <a href={igLink} target="_blank" rel="noopener noreferrer">
                <Instagram className="h-4 w-4" />
              </a>
            </Button>
          )}
          {trailingActions}
        </div>
      </CardContent>
    </Card>
  );
}
