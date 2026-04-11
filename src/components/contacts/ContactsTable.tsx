import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface Contact {
  id: string;
  company_name: string;
  contact_name: string | null;
  phone_raw: string | null;
  city_name: string | null;
  niche: string | null;
  status: string;
}

interface ContactsTableProps {
  contacts: Contact[];
  isLoading: boolean;
  search: string;
  onDelete: (id: string) => void;
}

function LoadingSkeleton() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <TableRow key={i}>
          {Array.from({ length: 7 }).map((_, j) => (
            <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

export default function ContactsTable({ contacts, isLoading, search, onDelete }: ContactsTableProps) {
  return (
    <div className="rounded-lg border bg-card shadow-sm overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-[140px]">Empresa</TableHead>
            <TableHead className="hidden sm:table-cell">Contato</TableHead>
            <TableHead>Telefone</TableHead>
            <TableHead className="hidden md:table-cell">Cidade</TableHead>
            <TableHead className="hidden lg:table-cell">Nicho</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-10"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading && <LoadingSkeleton />}
          {!isLoading && contacts.map(c => (
            <TableRow key={c.id}>
              <TableCell className="font-medium">{c.company_name}</TableCell>
              <TableCell className="hidden sm:table-cell">{c.contact_name || "—"}</TableCell>
              <TableCell>{c.phone_raw || "—"}</TableCell>
              <TableCell className="hidden md:table-cell">{c.city_name || "—"}</TableCell>
              <TableCell className="hidden lg:table-cell">{c.niche || "—"}</TableCell>
              <TableCell>{c.status}</TableCell>
              <TableCell>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Remover contato?</AlertDialogTitle>
                      <AlertDialogDescription>
                        O contato "{c.company_name}" será removido. Esta ação pode ser desfeita pelo administrador.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => onDelete(c.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                        Remover
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </TableCell>
            </TableRow>
          ))}
          {!isLoading && contacts.length === 0 && search && (
            <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhum contato encontrado para "{search}".</TableCell></TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
