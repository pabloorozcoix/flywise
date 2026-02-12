"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plane } from "lucide-react";
import type { NavbarProps, NavLink } from "./types";

const navLinks: NavLink[] = [
  { label: "Dashboard", href: "/" },
  { label: "History", href: "/history" },
  { label: "Nodes", href: "#" },
  { label: "Settings", href: "/settings" },
];

export function Navbar({ className }: NavbarProps) {
  const pathname = usePathname();

  return (
    <nav
      className={`sticky top-0 z-50 w-full border-b border-white/10 bg-black/90 backdrop-blur-md ${className ?? ""}`}
    >
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo + Subtitle */}
        <Link href="/" className="flex items-center gap-2.5">
          <Plane className="size-5 text-violet-400" />
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-bold tracking-tight text-white">
              AeroAgent AI
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
              Swarm Control Center
            </span>
          </div>
        </Link>

        {/* Center nav links */}
        <ul className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            return (
              <li key={link.label}>
                <Link
                  href={link.href}
                  className={`text-sm font-medium transition-colors hover:text-white ${
                    isActive ? "text-white" : "text-zinc-400"
                  }`}
                >
                  {link.label}
                </Link>
              </li>
            );
          })}
        </ul>

        {/* Right section — LIVE indicator */}
        <div className="flex items-center">
          <div className="flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
            </span>
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
              Live
            </span>
          </div>
        </div>
      </div>
    </nav>
  );
}
