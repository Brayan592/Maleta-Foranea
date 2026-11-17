import {
  Briefcase,
  Building2,
  Footprints,
  Luggage,
  Package,
  Shirt,
  Sparkles,
  Trees,
  Watch,
} from 'lucide-react';
import type { Timestamp } from 'firebase/firestore';
import type { GarmentCategory, GarmentLocation, UserProfile } from '../types';

export function getLocationLabel(
  location: GarmentLocation,
  profile: UserProfile | null
): string {
  const city = profile?.cityLabel || 'La Ciudad';
  const ranch = profile?.ranchLabel || 'El Rancho';
  if (location === 'ciudad') return city;
  if (location === 'rancho') return ranch;
  return 'En Maleta';
}

export function getLocationTextClass(location: GarmentLocation): string {
  if (location === 'ciudad') return 'text-blue-700';
  if (location === 'rancho') return 'text-emerald-800';
  return 'text-amber-700';
}

export function LocationIcon({
  location,
  className = 'w-4 h-4',
}: {
  location: GarmentLocation;
  className?: string;
}) {
  if (location === 'ciudad') {
    return <Building2 className={`${className} text-blue-700 shrink-0`} />;
  }
  if (location === 'rancho') {
    return <Trees className={`${className} text-emerald-800 shrink-0`} />;
  }
  return <Luggage className={`${className} text-amber-700 shrink-0`} />;
}

export function CategoryIcon({
  category,
  className = 'w-4 h-4',
}: {
  category: GarmentCategory;
  className?: string;
}) {
  switch (category) {
    case 'playeras':
    case 'chamarras':
      return <Shirt className={className} />;
    case 'calzado':
      return <Footprints className={className} />;
    case 'formal':
      return <Briefcase className={className} />;
    case 'accesorios':
      return <Watch className={className} />;
    case 'interior':
      return <Sparkles className={className} />;
    default:
      return <Package className={className} />;
  }
}

export function timestampToDate(ts: unknown): Date | null {
  if (!ts) return null;
  if (
    typeof ts === 'object' &&
    ts !== null &&
    'toDate' in ts &&
    typeof (ts as { toDate: () => Date }).toDate === 'function'
  ) {
    return (ts as { toDate: () => Date }).toDate();
  }
  if (
    typeof ts === 'object' &&
    ts !== null &&
    '__ms' in ts &&
    typeof (ts as { __ms: number }).__ms === 'number'
  ) {
    return new Date((ts as { __ms: number }).__ms);
  }
  return null;
}

export function timestampToMillis(ts: Timestamp | null | undefined): number {
  if (!ts) return Date.now();
  const d = timestampToDate(ts);
  return d ? d.getTime() : Date.now();
}

export function formatShortDate(ts: Timestamp | null | undefined): string {
  if (!ts) return 'Pendiente de sincronizar';
  try {
    const date = timestampToDate(ts);
    if (!date) return 'Reciente';
    return new Intl.DateTimeFormat('es-MX', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  } catch {
    return 'Reciente';
  }
}
