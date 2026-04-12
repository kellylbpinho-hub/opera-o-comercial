import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";

type View = "login" | "signup" | "forgot";

export default function LoginPage() {
  const [view, setView] = useState<View>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (view === "forgot") {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) toast.error(error.message);
      else toast.success("E-mail de recuperação enviado! Verifique sua caixa de entrada.");
      setLoading(false);
      return;
    }

    if (view === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) toast.error(error.message);
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      });
      if (error) toast.error(error.message);
      else toast.success("Conta criada! Verifique seu e-mail.");
    }

    setLoading(false);
  };

  const title = view === "forgot" ? "Recuperar Senha" : "Esteira Comercial PA";
  const description = view === "forgot"
    ? "Informe seu e-mail para receber o link de recuperação"
    : view === "login"
    ? "Entre na sua conta"
    : "Criar nova conta";

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md animate-fade-in shadow-lg">
        <CardHeader className="text-center space-y-2">
          <CardTitle className="text-2xl font-bold tracking-tight">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {view === "signup" && (
              <div className="space-y-2">
                <Label htmlFor="fullName">Nome completo</Label>
                <Input id="fullName" value={fullName} onChange={e => setFullName(e.target.value)} required />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            {view !== "forgot" && (
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
              </div>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading
                ? "Carregando..."
                : view === "forgot"
                ? "Enviar link de recuperação"
                : view === "login"
                ? "Entrar"
                : "Cadastrar"}
            </Button>
          </form>
          <div className="mt-4 text-center space-y-2">
            {view === "login" && (
              <button
                type="button"
                onClick={() => setView("forgot")}
                className="block w-full text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                Esqueci minha senha
              </button>
            )}
            <button
              type="button"
              onClick={() => setView(view === "login" ? "signup" : "login")}
              className="block w-full text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              {view === "login"
                ? "Não tem conta? Cadastre-se"
                : view === "signup"
                ? "Já tem conta? Entre"
                : "Voltar para login"}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
