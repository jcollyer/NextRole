'use client';

import { useFormStatus } from 'react-dom';
import { Loader2, Radar } from 'lucide-react';

import { Button } from '@/components/ui/button';

export function ScanAllCompaniesButton({ disabled }: { disabled?: boolean }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" variant="outline" disabled={disabled || pending}>
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Radar className="h-4 w-4" />}
      {pending ? 'Scanning companies...' : 'Scan all companies'}
    </Button>
  );
}
