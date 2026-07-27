import { createFileRoute, Outlet, redirect, Link, useRouter } from "@tanstack/react-router";
import { queryOptions, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { whoAmI, logout } from "@/lib/auth.functions";
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

  const podeLoja = me.acesso_loja || me.papel === "admin";
  const podeOficina = me.acesso_oficina || me.papel === "admin";
  const isAdmin = me.papel === "admin";

  return (
    <SidebarProvider>
      <Sidebar className="border-r">
        <SidebarHeader>
          <div className="flex items-center gap-2 px-2 py-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground font-bold">
              V
            </div>
            <div className="text-sm">
              <div className="font-semibold leading-tight">VRCF</div>
              <div className="text-xs text-muted-foreground">Loja &amp; Oficina</div>
            </div>
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
                  <NavItem to="/relatorios" icon={BarChart3} label="Relatórios" />
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
          <div className="text-sm text-muted-foreground">VRCF</div>
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
