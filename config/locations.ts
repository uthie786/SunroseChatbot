// Branch addresses, phone numbers and map links.
// The bot adds these to the end of every handover message, so customers can visit or call.
// To change a number or address, edit it here (and in knowledge/shared.md so the AI quotes the same).

import type { BranchKey } from './branches';
import type { Category } from '@/lib/types';

export const LOCATION_KEYS = ['overport', 'springfield', 'johannesburg', 'pretoria', 'online'] as const;
export type LocationKey = (typeof LOCATION_KEYS)[number];

type Location = { title: string; lines: string[] };

const HOURS = 'Mon to Fri 8am to 5pm, Sat 8am to 2:30pm';

export const LOCATIONS: Record<LocationKey, Location> = {
  overport: {
    title: 'Sunrose Durban, Overport (commercial equipment)',
    lines: [
      '280 Felix Dlamini Rd, Overport, Durban',
      'Call 072 558 4250 or 061 719 1000',
      'Map: https://www.google.com/maps/search/?api=1&query=Sunrose+Online%2C+280+Felix+Dlamini+Rd%2C+Durban+4067',
    ],
  },
  springfield: {
    title: 'Sunrose Wholesalers, Springfield, Durban (hardware, building and decor)',
    lines: [
      '9 Maplefield Place, Springfield, Durban',
      'Call 073 451 6568 or 072 916 1786',
      'Map: https://www.google.com/maps/search/?api=1&query=Sunrose+Wholesalers%2C+9+Maplefield+Pl%2C+Durban+4051',
    ],
  },
  johannesburg: {
    title: 'Sunrose Johannesburg',
    lines: [
      '19 Modulus Road, Unit 7 Modulus, Ormonde, Johannesburg South',
      'Call 081 891 1862 or 064 387 2944',
      'Map: https://www.google.com/maps/search/?api=1&query=Sunrose+Online+Johannesburg%2C+19+Modulus+Road%2C+Johannesburg+2091',
    ],
  },
  pretoria: {
    title: 'Sunrose Pretoria',
    lines: [
      '96 Fascia Rd, Silvertondale, Pretoria',
      'Call 060 144 6390 or 075 191 4299',
      'Map: https://www.google.com/maps/search/?api=1&query=Sunrose+Online+PTA%2C+96+Fascia+Rd%2C+Tshwane+0184',
    ],
  },
  online: {
    title: 'Sunrose Online orders (we deliver nationwide)',
    lines: ['Call or WhatsApp 067 090 4774', 'Order online: sunrose.co.za'],
  },
};

// If the AI didn't choose, show the branch this chat belongs to.
export function defaultLocations(branch: BranchKey, category?: Category): LocationKey[] {
  if (branch === 'johannesburg') return ['johannesburg'];
  if (branch === 'pretoria') return ['pretoria'];
  if (category === 'hardware' || category === 'maestro') return ['springfield'];
  return ['overport'];
}

export function visitText(keys: LocationKey[], isOpen: boolean): string {
  const unique = [...new Set(keys)].slice(0, 2);
  const showHours = !isOpen && !unique.every((k) => k === 'online');
  const blocks = unique.map((k) => [`*${LOCATIONS[k].title}*`, ...LOCATIONS[k].lines].join('\n'));
  return [
    'Prefer to visit or call?',
    ...blocks,
    showHours ? `Trading hours: ${HOURS}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');
}
