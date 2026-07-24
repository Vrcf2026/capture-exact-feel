import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { getCompany, updateCompany } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_app/empresa")({
  head: () => ({
    meta: [
      { title: "Empresa — VRCF" },
      { name: "description", content: "Dados da empresa usados em documentos." },
    ],
  }),
  component: EmpresaPage,
});

function EmpresaPage() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["company"], queryFn: () => getCompany() });
  const save = useServerFn(updateCompany);
  const m = useMutation({
    mutationFn: (v: NonNullable<NonNullable<Parameters<typeof updateCompany>[0]>["data"]>) => save({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["company"] }),
  });
  const [state, setState] = useState<null | {
    nome: string;
    morada: string;
    nif: string;
    contacto: string;
    email: string;
    logo_url: string;
  }>(null);

  const current = state ?? {
    nome: data?.nome ?? "",
    morada: data?.morada ?? "",
    nif: data?.nif ?? "",
    contacto: data?.contacto ?? "",
    email: data?.email ?? "",
    logo_url: data?.logo_url ?? "",
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dados da empresa</h1>
        <p className="text-sm text-muted-foreground">Usados nos documentos gerados.</p>
      </div>
      <form
        className="space-y-4 rounded-lg border border-border bg-card p-6"
        onSubmit={(e) => {
          e.preventDefault();
          m.mutate(current);
        }}
      >
        <Field label="Nome"><Input value={current.nome} onChange={(e) => setState({ ...current, nome: e.target.value })} /></Field>
        <Field label="Morada"><Textarea rows={2} value={current.morada} onChange={(e) => setState({ ...current, morada: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="NIF"><Input value={current.nif} onChange={(e) => setState({ ...current, nif: e.target.value })} /></Field>
          <Field label="Contacto"><Input value={current.contacto} onChange={(e) => setState({ ...current, contacto: e.target.value })} /></Field>
        </div>
        <Field label="Email"><Input value={current.email} onChange={(e) => setState({ ...current, email: e.target.value })} /></Field>
        <Field label="URL do logótipo"><Input value={current.logo_url} onChange={(e) => setState({ ...current, logo_url: e.target.value })} /></Field>
        {m.error && <div className="text-sm text-destructive">{(m.error as Error).message}</div>}
        {m.isSuccess && <div className="text-sm text-primary">Guardado.</div>}
        <Button type="submit" disabled={m.isPending}>{m.isPending ? "A guardar…" : "Guardar"}</Button>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
