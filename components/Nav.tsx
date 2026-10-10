"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/new", label: "New project" },
  { href: "/connections", label: "Connections" },
];

export default function Nav() {
  const path = usePathname();
  const active = (href: string) => (href === "/dashboard" ? path.startsWith("/dashboard") || path.startsWith("/projects") : path.startsWith(href));
  return (
    <nav className="nav" aria-label="Main">
      {LINKS.map((l) => (
        <Link key={l.href} href={l.href} aria-current={active(l.href) ? "page" : undefined}>
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
