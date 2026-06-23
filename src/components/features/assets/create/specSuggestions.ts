/** CPU autocomplete suggestions for the SpecCombobox (ported from the prototype). */
export const CPU_SUGGESTIONS: string[] = [
  'Intel Core i3 7 Gen', 'Intel Core i3 8 Gen', 'Intel Core i3 9 Gen', 'Intel Core i3 10 Gen',
  'Intel Core i3 11 Gen', 'Intel Core i3 12 Gen', 'Intel Core i3 13 Gen',
  'Intel Core i5 7 Gen', 'Intel Core i5 8 Gen', 'Intel Core i5 9 Gen', 'Intel Core i5 10 Gen',
  'Intel Core i5 11 Gen', 'Intel Core i5 12 Gen', 'Intel Core i5 13 Gen',
  'Intel Core i7 7 Gen', 'Intel Core i7 8 Gen', 'Intel Core i7 9 Gen', 'Intel Core i7 10 Gen',
  'Intel Core i7 11 Gen', 'Intel Core i7 12 Gen', 'Intel Core i7 13 Gen',
  'Intel Core i9 8 Gen', 'Intel Core i9 9 Gen', 'Intel Core i9 10 Gen', 'Intel Core i9 11 Gen',
  'Intel Core i9 12 Gen', 'Intel Core i9 13 Gen',
  'AMD Ryzen 3 1000 Series', 'AMD Ryzen 3 2000 Series', 'AMD Ryzen 3 3000 Series',
  'AMD Ryzen 3 4000 Series', 'AMD Ryzen 3 5000 Series', 'AMD Ryzen 3 7000 Series',
  'AMD Ryzen 5 1000 Series', 'AMD Ryzen 5 2000 Series', 'AMD Ryzen 5 3000 Series',
  'AMD Ryzen 5 4000 Series', 'AMD Ryzen 5 5000 Series', 'AMD Ryzen 5 7000 Series', 'AMD Ryzen 5 8000 Series',
  'AMD Ryzen 7 1000 Series', 'AMD Ryzen 7 2000 Series', 'AMD Ryzen 7 3000 Series',
  'AMD Ryzen 7 4000 Series', 'AMD Ryzen 7 5000 Series', 'AMD Ryzen 7 7000 Series', 'AMD Ryzen 7 8000 Series',
  'AMD Ryzen 9 3000 Series', 'AMD Ryzen 9 5000 Series', 'AMD Ryzen 9 7000 Series', 'AMD Ryzen 9 8000 Series',
]

// SERVER_CATEGORY_IDS / LAPTOP_CATEGORY_IDS now live in the pure domain layer
// (src/domain/asset/categoryCapabilities.ts) so the capability taxonomy is
// self-contained. Re-exported here to keep existing import sites stable.
export { SERVER_CATEGORY_IDS, LAPTOP_CATEGORY_IDS } from '@/domain/asset'
