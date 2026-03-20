import type { Address } from '@/context/AddressContext';

const TAG_LABELS: Record<Address['tag'], string> = {
  home: 'Home',
  work: 'Work',
  other: 'Other',
};

/**
 * Category shown in the home header: **Home / Work / Other** from `tag`
 * (not the saved `name` like "Testing").
 */
export function getAddressTitleLabel(address: Address): string {
  return TAG_LABELS[address.tag] ?? 'Address';
}
