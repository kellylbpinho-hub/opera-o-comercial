import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Pencil, MessageCircle, Phone, Instagram, MapPin, ExternalLink } from "lucide-react";
import {
  Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter, DrawerClose,
} from "@/components/ui/drawer";
import {
  buildWhatsappLink,
  getWhatsappMessage,
  PROFILE_LABELS,
  getClientProfile,
  formatTag,
} from "@/lib/whatsapp-messages";

interface ContactCardProps {
  contact: any;
  categoryLabel?: string;
  selected?: boolean;
  onToggleSelect?: () => void;
  onEdit?: () => void;
  trailingActions?: React.ReactNode;
}

const STATUS_LABELS: Record<string, string> = {
  NAO_CONTATADO: "Não contatado",
  CONTATADO: "Contatado",
  RESPONDEU: "Respondeu",
  QUALIFICADO: "Qualificado",
  SEM_INTERESSE: "Sem interesse",
};

export default function ContactCard({
  contact: c,
  categoryLabel,
  selected,
  onToggleSelect,
  onEdit,
  trailingActions,
}: ContactCardProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  const phone = c.phone_normalized || c.phone_raw;
  const profile = getClientProfile(c);
  const message = getWhatsappMessage(c);
  const waLink = phone ? buildWhatsappLink(phone, message) : null;
  const telLink = phone ? `tel:${String(phone).replace(/\D/g, "")}` : null;
  const igLink = c.instagram
    ? c.instagram.startsWith("http")
      ? c.instagram
      : `https://instagram.com/${c.instagram.replace(/^@/, "")}`
    : null;

  const tags: string[] = Array.isArray(c.industry_tags) ? c.industry_tags : [];

  const handleWhatsAppClick = () => {
    if (!waLink) return;
    if (!message?.trim()) {
      window.open(waLink, "_blank", "noopener,noreferrer");
      return;
    }
    setDrawerOpen(true);
  };

  return (
    <>
      <Card className={`shadow-sm transition-colors ${selected ? "border-primary bg-primary/5" : ""}`}>
        <CardContent className="p-3 space-y-2.5">
          {/* Header */}
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
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 -mr-1 -mt-1" onClick={onEdit} title="Editar">
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>

          {/* Badges */}
          <div className="flex flex-wrap gap-1.5 items-center text-xs">
            {c.city_name && (
              <span className="inline-flex items-center gap-1 text-muted-foreground">
                <MapPin className="h-3 w-3" />{c.city_name}
              </span>
            )}
            {categoryLabel && <Badge variant="outline" className="text-[10px] py-0 px-1.5">{categoryLabel}</Badge>}
            {c.status && <Badge variant="secondary" className="text-[10px] py-0 px-1.5">{STATUS_LABELS[c.status] ?? c.status}</Badge>}
          </div>

          {/* Tags */}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {tags.slice(0, 4).map((t: string) => (
                <Badge key={t} variant="secondary" className="text-[10px] py-0 px-1.5">{formatTag(t)}</Badge>
              ))}
              {tags.length > 4 && <Badge variant="outline" className="text-[10px] py-0 px-1.5">+{tags.length - 4}</Badge>}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            {waLink ? (
              <Button
                variant="default"
                size="sm"
                className="flex-1 h-10 bg-accent hover:bg-accent/90 text-accent-foreground"
                onClick={handleWhatsAppClick}
              >
                <MessageCircle className="h-4 w-4 mr-1.5" />WhatsApp
              </Button>
            ) : (
              <Button variant="outline" size="sm" className="flex-1 h-10" disabled>
                <MessageCircle className="h-4 w-4 mr-1.5" />Sem telefone
              </Button>
            )}
            {telLink && (
              <Button asChild variant="outline" size="sm" className="h-10 px-3" title="Ligar">
                <a href={telLink}><Phone className="h-4 w-4" /></a>
              </Button>
            )}
            {igLink && (
              <Button asChild variant="outline" size="sm" className="h-10 px-3" title="Instagram">
                <a href={igLink} target="_blank" rel="noopener noreferrer"><Instagram className="h-4 w-4" /></a>
              </Button>
            )}
            {trailingActions}
          </div>
        </CardContent>
      </Card>

      {/* WhatsApp preview drawer */}
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent>
          <DrawerHeader className="text-left">
            <DrawerTitle className="text-base">Mensagem WhatsApp</DrawerTitle>
          </DrawerHeader>

          <div className="px-4 space-y-3 pb-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm">{c.company_name}</span>
              <Badge variant="secondary" className="text-[10px] py-0 px-1.5">
                {profile}
              </Badge>
              <Badge variant="outline" className="text-[10px] py-0 px-1.5">
                {PROFILE_LABELS[profile]}
              </Badge>
            </div>

            <div className="rounded-lg border bg-muted/40 p-3 max-h-52 overflow-y-auto">
              <p className="text-sm whitespace-pre-line text-foreground">{message}</p>
            </div>
          </div>

          <DrawerFooter className="flex-row gap-2">
            <DrawerClose asChild>
              <Button variant="outline" className="flex-1">Cancelar</Button>
            </DrawerClose>
            <Button asChild className="flex-1">
              <a href={waLink!} target="_blank" rel="noopener noreferrer" onClick={() => setDrawerOpen(false)}>
                <ExternalLink className="h-4 w-4 mr-1.5" />Enviar no WhatsApp
              </a>
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </>
  );
}
