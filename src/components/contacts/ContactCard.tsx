import { useEffect, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Pencil, MessageCircle, Phone, Instagram, MapPin, ExternalLink, Trash2, Copy, Check } from "lucide-react";
import { toast } from "sonner";
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
  onRemove?: () => void;
  trailingActions?: React.ReactNode;
}

const STATUS_LABELS: Record<string, string> = {
  NAO_CONTATADO: "Não contatado",
  CONTATADO: "Contatado",
  RESPONDEU: "Respondeu",
  QUALIFICADO: "Qualificado",
  SEM_INTERESSE: "Sem interesse",
};

const SWIPE_THRESHOLD = 80;
const SWIPE_ACTION_OFFSET = 96;

export default function ContactCard({
  contact: c,
  categoryLabel,
  selected,
  onToggleSelect,
  onEdit,
  onRemove,
  trailingActions,
}: ContactCardProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editableMessage, setEditableMessage] = useState("");
  const [offsetX, setOffsetX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);

  const phone = c.phone_normalized || c.phone_raw;
  const profile = getClientProfile(c);
  const message = getWhatsappMessage(c);
  const waLink = phone ? buildWhatsappLink(phone, message) : null;
  const editedWaLink = phone ? buildWhatsappLink(phone, editableMessage) : null;
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

  const resetSwipe = () => setOffsetX(0);

  useEffect(() => {
    if (offsetX === 0) return;

    const handlePointerOutside = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;

      if (target?.closest("[data-swipe-action='true']")) return;

      resetSwipe();
    };

    document.addEventListener("pointerdown", handlePointerOutside, true);

    return () => {
      document.removeEventListener("pointerdown", handlePointerOutside, true);
    };
  }, [offsetX]);

  useEffect(() => {
    if (!drawerOpen) return;
    setEditableMessage(message ?? "");
  }, [drawerOpen, message]);

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (touchStartX.current === null) return;

    const currentX = e.touches[0]?.clientX ?? touchStartX.current;
    const deltaX = currentX - touchStartX.current;

    if ((deltaX > 0 && !onEdit) || (deltaX < 0 && !onRemove)) return;

    const clamped = Math.max(-SWIPE_ACTION_OFFSET, Math.min(SWIPE_ACTION_OFFSET, deltaX));
    setOffsetX(clamped);
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    touchStartX.current = null;

    if (offsetX <= -SWIPE_THRESHOLD && onRemove) {
      setOffsetX(-SWIPE_ACTION_OFFSET);
      return;
    }

    if (offsetX >= SWIPE_THRESHOLD && onEdit) {
      setOffsetX(SWIPE_ACTION_OFFSET);
      return;
    }

    resetSwipe();
  };

  return (
    <>
      <div ref={cardRef} className={`relative overflow-hidden rounded-lg ${offsetX !== 0 ? "z-20" : ""}`}>
        {offsetX !== 0 && <div className="fixed inset-0 z-10 pointer-events-none" aria-hidden="true" />}

        {onRemove && (
          <div className="absolute inset-y-0 right-0 z-20 flex items-center pr-2" data-swipe-action="true">
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="h-[calc(100%-12px)] min-h-0 rounded-md px-4"
              onClick={() => {
                resetSwipe();
                onRemove();
              }}
            >
              <Trash2 className="h-4 w-4 mr-1.5" />
              Remover
            </Button>
          </div>
        )}

        {onEdit && (
          <div className="absolute inset-y-0 left-0 z-20 flex items-center pl-2" data-swipe-action="true">
            <Button
              type="button"
              size="sm"
              className="h-[calc(100%-12px)] min-h-0 rounded-md px-4"
              onClick={() => {
                resetSwipe();
                onEdit();
              }}
            >
              <Pencil className="h-4 w-4 mr-1.5" />
              Editar
            </Button>
          </div>
        )}

        <div
          className="transition-transform"
          style={{
            transform: `translateX(${offsetX}px)`,
            transitionDuration: isDragging ? "0ms" : "200ms",
          }}
          onClickCapture={(e) => {
            if (offsetX === 0) return;

            const target = e.target as HTMLElement;
            if (target.closest("[data-swipe-action='true']")) return;

            e.preventDefault();
            e.stopPropagation();
            resetSwipe();
          }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
        >
          <Card className={`shadow-sm transition-colors ${selected ? "border-primary bg-primary/5" : ""}`}>
            <CardContent className="p-3 space-y-2.5">
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

              <div className="flex flex-wrap gap-1.5 items-center text-xs">
                {c.city_name && (
                  <span className="inline-flex items-center gap-1 text-muted-foreground">
                    <MapPin className="h-3 w-3" />{c.city_name}
                  </span>
                )}
                {categoryLabel && <Badge variant="outline" className="text-[10px] py-0 px-1.5">{categoryLabel}</Badge>}
                {c.status && <Badge variant="secondary" className="text-[10px] py-0 px-1.5">{STATUS_LABELS[c.status] ?? c.status}</Badge>}
              </div>

              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {tags.slice(0, 4).map((t: string) => (
                    <Badge key={t} variant="secondary" className="text-[10px] py-0 px-1.5">{formatTag(t)}</Badge>
                  ))}
                  {tags.length > 4 && <Badge variant="outline" className="text-[10px] py-0 px-1.5">+{tags.length - 4}</Badge>}
                </div>
              )}

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
        </div>
      </div>

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

            <div className="space-y-2">
              <Textarea
                value={editableMessage}
                onChange={(event) => setEditableMessage(event.target.value)}
                className="min-h-40 resize-none"
              />
              <p className="text-xs text-muted-foreground text-right">{editableMessage.length} caracteres</p>
            </div>
          </div>

          <DrawerFooter className="flex-row gap-2">
            <DrawerClose asChild>
              <Button variant="outline" className="flex-1">Cancelar</Button>
            </DrawerClose>
            <Button asChild className="flex-1">
              <a href={editedWaLink ?? waLink!} target="_blank" rel="noopener noreferrer" onClick={() => setDrawerOpen(false)}>
                <ExternalLink className="h-4 w-4 mr-1.5" />Enviar no WhatsApp
              </a>
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </>
  );
}
