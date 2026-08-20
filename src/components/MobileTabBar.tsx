import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, ShoppingCart, Wrench, Boxes, Menu } from "lucide-react";
import { useSidebar } from "@/components/ui/sidebar";

type Tab = { to: string; label: string; icon: React.ComponentType<{ className?: string }> };

export function MobileTabBar({
  podeLoja,
  podeOficina,
}: {
  podeLoja: boolean;
  podeOficina: boolean;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { toggleSidebar } = useSidebar();

  const tabs: Tab[] = [{ to: "/dashboard", label: "Painel", icon: LayoutDashboard }];
  if (podeLoja) tabs.push({ to: "/vendas", label: "Venda", icon: ShoppingCart });
  if (podeOficina) tabs.push({ to: "/oficina/nova", label: "Nova OS", icon: Wrench });
  if (podeLoja) tabs.push({ to: "/stock", label: "Stocks", icon: Boxes });

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background/95 backdrop-blur"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="grid" style={{ gridTemplateColumns: `repeat(${tabs.length + 1}, minmax(0,1fr))` }}>
        {tabs.map((t) => {
          const active = pathname === t.to || pathname.startsWith(t.to + "/");
          return (
            <li key={t.to}>
              <Link
                to={t.to}
                className={`flex h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <t.icon className="h-5 w-5" />
                {t.label}
              </Link>
            </li>
          );
        })}
        <li>
          <button
            type="button"
            onClick={toggleSidebar}
            className="flex h-14 w-full flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-muted-foreground"
          >
            <Menu className="h-5 w-5" />
            <span>Menu</span>
          </button>
        </li>
      </ul>
    </nav>
  );
}
