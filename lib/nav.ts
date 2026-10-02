import type { PricingAccessLevel } from '@/lib/pricing/access';

export interface NavAccess {
  isAdmin: boolean;
  inventory: boolean;
  dwh: boolean;
  geo: boolean;
  pricing: PricingAccessLevel;
}

export interface NavLink {
  href: string;
  label: string;
  description: string;
}

export interface NavSection {
  title: string;
  links: NavLink[];
}

interface NavSectionDef extends NavSection {
  visible: (access: NavAccess) => boolean;
}

// Single source of truth for the sidebar and the /inicio welcome page.
// Visibility only decides what is *shown* — every target page and API route
// still enforces its own gate.
const NAV_SECTIONS: NavSectionDef[] = [
  {
    title: 'Reportes',
    visible: () => true,
    links: [
      { href: '/reports/ventas', label: 'Ventas', description: 'Exporta el reporte de ventas a CSV o Excel.' },
      { href: '/reports/compras', label: 'Compras', description: 'Exporta el reporte de compras a CSV o Excel.' },
    ],
  },
  {
    title: 'Herramientas',
    visible: () => true,
    links: [
      { href: '/firmas', label: 'Firma Corporativa', description: 'Genera tu firma de correo corporativa.' },
      { href: '/qr', label: 'Códigos QR', description: 'Crea códigos QR.' },
    ],
  },
  {
    title: 'Analítica',
    visible: a => a.dwh,
    links: [
      { href: '/analitica', label: 'Panel Analítico', description: 'Ventas, devoluciones y cobranza.' },
    ],
  },
  {
    title: 'Geografía',
    visible: a => a.geo,
    links: [
      { href: '/mapa', label: 'Mapa de Clientes', description: 'Clientes, rutas y zonas de venta en el mapa.' },
    ],
  },
  {
    title: 'Inventario',
    visible: a => a.inventory,
    links: [
      { href: '/inventario/dashboard', label: 'Panel', description: 'Estado del stock y alertas.' },
      { href: '/inventario/articulos', label: 'Artículos', description: 'Consulta y edita artículos.' },
      { href: '/inventario/ajustes', label: 'Ajustes', description: 'Registra y consulta ajustes de inventario.' },
    ],
  },
  {
    title: 'Precios',
    visible: a => a.pricing !== 'none',
    links: [
      { href: '/pricing', label: 'Listas de Precio', description: 'Consulta las listas de precio.' },
    ],
  },
  {
    title: 'Admin',
    visible: a => a.isAdmin,
    links: [
      { href: '/admin/users', label: 'Usuarios', description: 'Gestiona usuarios y permisos por módulo.' },
      { href: '/admin/config-inventario', label: 'Config. Inventario', description: 'Ajustes del módulo de inventario.' },
      { href: '/admin/config-cobranza', label: 'Config. Cobranza', description: 'Umbrales de cobranza.' },
    ],
  },
];

export function visibleNavSections(access: NavAccess): NavSection[] {
  return NAV_SECTIONS.filter(s => s.visible(access)).map(({ title, links }) => ({ title, links }));
}
