'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BriefcaseBusiness, Building2, CalendarClock, LogOut, Radar, Settings, Signal, Sparkles, Upload } from 'lucide-react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { getInitials } from '@/lib/utils';
import { signOutAction } from '@/server/actions';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: Sparkles },
  { href: '/companies', label: 'Companies', icon: Building2 },
  { href: '/jobs', label: 'Jobs', icon: BriefcaseBusiness },
  { href: '/applications', label: 'Applications', icon: Radar },
  { href: '/follow-ups', label: 'Follow-ups', icon: CalendarClock },
  { href: '/signals', label: 'Signals', icon: Signal },
  { href: '/import', label: 'Import', icon: Upload },
];

interface NavBarProps {
  name: string | null | undefined;
  email: string | null | undefined;
  image: string | null | undefined;
}

/**
 * Global navigation bar. The user's avatar (their photo, or initials in a
 * circle) sits on the left and opens a dropdown with a Settings link and a
 * Sign out button.
 */
export function NavBar({ name, email, image }: NavBarProps) {
  const initials = getInitials(name ?? email);
  const pathname = usePathname();

  return (
    <header className="border-b">
      <div className="container flex min-h-16 flex-wrap items-center gap-3 py-3">
        <Link href="/dashboard" className="mr-2 flex items-center gap-2 font-semibold">
          <span className="bg-primary text-primary-foreground flex h-9 w-9 items-center justify-center rounded-md">N</span>
          <span>NextRole</span>
        </Link>
        <nav className="flex flex-1 flex-wrap items-center gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors ${
                  active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Open account menu"
              className="focus-visible:ring-ring rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
            >
              <span className="bg-primary/15 text-primary relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-full text-sm font-semibold">
                {image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={image}
                    alt={name ?? email ?? 'User avatar'}
                    className="absolute inset-0 h-full w-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <span>{initials}</span>
                )}
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel className="truncate">{email}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/settings" className="w-full cursor-pointer">
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <form action={signOutAction}>
              <DropdownMenuItem asChild>
                <button type="submit" className="w-full cursor-pointer text-left">
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </button>
              </DropdownMenuItem>
            </form>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
