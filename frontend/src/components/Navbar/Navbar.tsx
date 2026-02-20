"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plane } from "lucide-react";
import type { NavbarProps, NavLink } from "./types";

const navLinks: NavLink[] = [
  { label: "Dashboard", href: "/" },
  { label: "History", href: "/history" },
  { label: "Settings", href: "/settings" },
];

export function Navbar({ className }: NavbarProps) {
  const pathname = usePathname();

  return (
    <header
      className={`sticky top-0 z-50 w-full glass-panel border-b border-white/10 ${className ?? ""}`}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        {/* Logo — plane icon + wordmark (match design) */}
        <Link
          href="/"
          className="flex items-center gap-2 transition-opacity hover:opacity-90"
        >
          <div className="flex items-center justify-center">
            <Plane className="size-6 text-brand-purple" />
          </div>
          <span className="text-lg font-extrabold tracking-tight text-white">
            Fly<span className="gradient-text">Wise</span>
          </span>
        </Link>

        {/* Center nav links */}
        <nav className="hidden items-center gap-10 md:flex">
          {navLinks.map((link) => {
            const isActive =
              pathname === link.href ||
              (link.href !== "/" && pathname.startsWith(link.href));
            return (
              <Link
                key={link.label}
                href={link.href}
                className={`text-sm font-semibold transition-colors hover:text-white ${
                  isActive ? "text-slate-300" : "text-slate-400"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Right section — LIVE indicator */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 rounded-full border border-green-500/30 bg-green-500/10 px-3 py-1.5">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-green-500" />
            </span>
            <span className="text-[10px] font-black uppercase tracking-wider text-green-400">
              Live
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
