import { createFileRoute, Outlet, redirect, Link, useRouter } from "@tanstack/react-router";
import { queryOptions, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { whoAmI, logout, changeOwnPassword } from "@/lib/auth.functions";
import { Button } from "@/components/ui/button";
import { GlobalSearch } from "@/components/GlobalSearch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Users,
  Wallet,
  Wrench,
  FileText,
  UserCog,
  Building2,
  BadgeEuro,
  ClipboardList,
  BarChart3,
  LogOut,
  Plus,
  ShieldCheck,
} from "lucide-react";

const meQuery = queryOptions({
  queryKey: ["me"],
  queryFn: () => whoAmI(),
  staleTime: 60_000,
});

export const Route = createFileRoute("/_app")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const u = await whoAmI();
    if (!u) {
      throw redirect({ to: "/login", search: { redirect: location.href } as never });
    }
    return { currentUser: u };
  },
  loader: ({ context }) => context.queryClient.ensureQueryData(meQuery),
  component: AppLayout,
});

function AppLayout() {
  const { data: me } = useQuery(meQuery);
  const router = useRouter();
  const qc = useQueryClient();
  const doLogout = useServerFn(logout);
  const logoutM = useMutation({
    mutationFn: () => doLogout(),
    onSuccess: async () => {
      await qc.cancelQueries();
      qc.clear();
      await router.navigate({ to: "/login", replace: true });
    },
  });

  if (!me) return null;
  if (me.deve_trocar_password) return <TrocarPasswordObrigatoria nome={me.nome} />;

  const podeLoja = me.acesso_loja || me.papel === "admin";
  const podeOficina = me.acesso_oficina || me.papel === "admin";
  const isAdmin = me.papel === "admin";

  return (
    <SidebarProvider>
      <Sidebar className="border-r">
        <SidebarHeader>
           <div className="px-2 py-2">
             <img src="/vrcf-logo.png" alt="VRCF Informática & Segurança" className="h-11 w-auto max-w-full object-contain object-left" />
           </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <NavItem to="/dashboard" icon={LayoutDashboard} label="Painel" />
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {podeLoja && (
            <SidebarGroup>
              <SidebarGroupLabel>Loja</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <NavItem to="/caixa" icon={Wallet} label="Caixa" />
                  <NavItem to="/vendas" icon={ShoppingCart} label="Nova venda" />
                  <NavItem to="/registos" icon={ClipboardList} label="Registos" />
                  <NavItem to="/conta-corrente" icon={BadgeEuro} label="Conta-corrente" />
                  <NavItem to="/catalogo" icon={Package} label="Catálogo" />
                  <NavItem to="/clientes" icon={Users} label="Clientes" />
                  {isAdmin && <NavItem to="/relatorios" icon={BarChart3} label="Relatórios" />}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )}

          {podeOficina && (
            <SidebarGroup>
              <SidebarGroupLabel>Oficina</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <NavItem to="/oficina" icon={Wrench} label="Ordens de serviço" />
                  <NavItem to="/oficina/nova" icon={Plus} label="Nova OS" />
                  <NavItem to="/oficina/relatorios" icon={BarChart3} label="Relatórios da oficina" />
                  {isAdmin && <NavItem to="/oficina/admin" icon={ShieldCheck} label="Admin da oficina" />}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )}

          {isAdmin && (
            <SidebarGroup>
              <SidebarGroupLabel>Sistema</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <NavItem to="/utilizadores" icon={UserCog} label="Utilizadores" />
                  <NavItem to="/vendedores" icon={FileText} label="Vendedores" />
                  <NavItem to="/empresa" icon={Building2} label="Empresa" />
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )}
        </SidebarContent>
        <SidebarFooter>
          <div className="flex items-center justify-between gap-2 px-2 py-2 text-sm">
            <div className="min-w-0">
              <div className="font-medium truncate">{me.nome}</div>
              <div className="text-xs text-muted-foreground capitalize">{me.papel}</div>
            </div>
            <button
              onClick={() => logoutM.mutate()}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-sidebar-accent"
              title="Sair"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </SidebarFooter>
      </Sidebar>
      <main className="flex-1 min-w-0 flex flex-col">
        <header className="border-b border-border h-12 flex items-center gap-2 px-3">
          <SidebarTrigger />
          <img src="/vrcf-logo.png" alt="VRCF" className="h-7 w-auto max-w-40 object-contain object-left" />
          <div className="ml-auto"><GlobalSearch /></div>
        </header>
        <div className="flex-1 min-w-0 overflow-auto">
          <div className="container-app py-6">
            <Outlet />
          </div>
        </div>
      </main>
    </SidebarProvider>
  );
}

function TrocarPasswordObrigatoria({ nome }: { nome: string }) {
  const qc = useQueryClient();
  const change = useServerFn(changeOwnPassword);
  const [atual, setAtual] = useState("");
  const [nova, setNova] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  const m = useMutation({
    mutationFn: () => change({ data: { atual, nova } }),
    onSuccess: (r) => {
      if (!r.ok) {
        setErro(r.error);
        return;
      }
      qc.invalidateQueries({ queryKey: ["me"] });
    },
  });

  const podeSubmeter = atual.length > 0 && nova.length >= 6 && nova === confirmar;

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Troca de password obrigatória</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Olá, {nome}. Por segurança, tens de definir uma nova password antes de continuar.
          </p>
          <div className="space-y-1.5">
            <Label>Password atual</Label>
            <Input type="password" value={atual} onChange={(e) => setAtual(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Nova password (mín. 6 caracteres)</Label>
            <Input type="password" value={nova} onChange={(e) => setNova(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Confirmar nova password</Label>
            <Input type="password" value={confirmar} onChange={(e) => setConfirmar(e.target.value)} />
          </div>
          {nova.length > 0 && confirmar.length > 0 && nova !== confirmar && (
            <p className="text-sm text-destructive">As passwords não coincidem.</p>
          )}
          {erro && <p className="text-sm text-destructive">{erro}</p>}
          <Button className="w-full" disabled={!podeSubmeter || m.isPending} onClick={() => m.mutate()}>
            {m.isPending ? "A guardar…" : "Guardar e continuar"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function NavItem({
  to,
  icon: Icon,
  label,
}: {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild>
        <Link
          to={to}
          activeProps={{ "data-active": true } as never}
          className="data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground"
        >
          <Icon className="h-4 w-4" />
          <span>{label}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
