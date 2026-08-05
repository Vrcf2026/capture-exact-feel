import { createFileRoute, useRouter, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { login, whoAmI } from "@/lib/auth.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/login")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Entrar — VRCF" },
      { name: "description", content: "Autenticação da aplicação VRCF (loja e oficina)." },
    ],
  }),
  beforeLoad: async () => {
    const u = await whoAmI();
    if (u) throw redirect({ to: "/dashboard" });
  },
  component: LoginPage,
});

function LoginPage() {
  const doLogin = useServerFn(login);
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [password, setPassword] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErro(null);
    try {
      const r = await doLogin({ data: { nome, password } });
      if (!r.ok) setErro(r.error);
      else await router.navigate({ to: "/dashboard" });
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao entrar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <img src="/vrcf-logo.png" alt="VRCF Informática & Segurança" className="mx-auto mb-4 h-auto w-full max-w-72 object-contain" />
          <h1 className="sr-only">VRCF</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gestão de loja e oficina
          </p>
        </div>
        <form
          onSubmit={onSubmit}
          className="rounded-lg border border-border bg-card p-6 space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="nome">Nome de utilizador</Label>
            <Input
              id="nome"
              autoFocus
              autoComplete="username"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {erro && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {erro}
            </div>
          )}
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "A entrar…" : "Entrar"}
          </Button>
        </form>
      </div>
    </div>
  );
}
