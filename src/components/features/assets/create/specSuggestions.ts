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

/** Server CPU suggestions — shown in the Процессор combobox when the category is a
 *  server (isServer). Free-text is still allowed for anything not listed. */
export const SERVER_CPU_SUGGESTIONS: string[] = [
  // Intel Xeon Silver
  'Intel Xeon Silver 4108', 'Intel Xeon Silver 4110', 'Intel Xeon Silver 4112',
  'Intel Xeon Silver 4114', 'Intel Xeon Silver 4116', 'Intel Xeon Silver 4208',
  'Intel Xeon Silver 4210', 'Intel Xeon Silver 4210R', 'Intel Xeon Silver 4214',
  'Intel Xeon Silver 4214R', 'Intel Xeon Silver 4215', 'Intel Xeon Silver 4215R',
  'Intel Xeon Silver 4216', 'Intel Xeon Silver 4309Y', 'Intel Xeon Silver 4310',
  'Intel Xeon Silver 4310T', 'Intel Xeon Silver 4314', 'Intel Xeon Silver 4316',
  // Intel Xeon Gold
  'Intel Xeon Gold 5215', 'Intel Xeon Gold 5218', 'Intel Xeon Gold 5218R',
  'Intel Xeon Gold 5220', 'Intel Xeon Gold 5220R', 'Intel Xeon Gold 5222',
  'Intel Xeon Gold 6226R', 'Intel Xeon Gold 6230', 'Intel Xeon Gold 6230R',
  'Intel Xeon Gold 6240', 'Intel Xeon Gold 6240R', 'Intel Xeon Gold 6242',
  'Intel Xeon Gold 6242R', 'Intel Xeon Gold 6248', 'Intel Xeon Gold 6248R',
  'Intel Xeon Gold 6252', 'Intel Xeon Gold 6258R', 'Intel Xeon Gold 6326',
  'Intel Xeon Gold 6330', 'Intel Xeon Gold 6330N', 'Intel Xeon Gold 6334',
  'Intel Xeon Gold 6338', 'Intel Xeon Gold 6338N', 'Intel Xeon Gold 6342',
  'Intel Xeon Gold 6346', 'Intel Xeon Gold 6348', 'Intel Xeon Gold 6354',
  // Intel Xeon Platinum
  'Intel Xeon Platinum 8253', 'Intel Xeon Platinum 8260', 'Intel Xeon Platinum 8260M',
  'Intel Xeon Platinum 8260L', 'Intel Xeon Platinum 8268', 'Intel Xeon Platinum 8270',
  'Intel Xeon Platinum 8276', 'Intel Xeon Platinum 8280', 'Intel Xeon Platinum 8280M',
  'Intel Xeon Platinum 8280L', 'Intel Xeon Platinum 8352V', 'Intel Xeon Platinum 8352Y',
  'Intel Xeon Platinum 8352S', 'Intel Xeon Platinum 8358', 'Intel Xeon Platinum 8358P',
  'Intel Xeon Platinum 8360Y', 'Intel Xeon Platinum 8368', 'Intel Xeon Platinum 8368Q',
  'Intel Xeon Platinum 8380',
  // Intel Xeon E5 v3
  'Intel Xeon E5-2603 v3', 'Intel Xeon E5-2609 v3', 'Intel Xeon E5-2620 v3',
  'Intel Xeon E5-2630 v3', 'Intel Xeon E5-2630L v3', 'Intel Xeon E5-2640 v3',
  'Intel Xeon E5-2650 v3', 'Intel Xeon E5-2650L v3', 'Intel Xeon E5-2660 v3',
  'Intel Xeon E5-2670 v3', 'Intel Xeon E5-2680 v3', 'Intel Xeon E5-2690 v3',
  'Intel Xeon E5-2695 v3', 'Intel Xeon E5-2697 v3', 'Intel Xeon E5-2698 v3',
  'Intel Xeon E5-2699 v3',
  // Intel Xeon E5 v4
  'Intel Xeon E5-2603 v4', 'Intel Xeon E5-2609 v4', 'Intel Xeon E5-2620 v4',
  'Intel Xeon E5-2630 v4', 'Intel Xeon E5-2630L v4', 'Intel Xeon E5-2640 v4',
  'Intel Xeon E5-2650 v4', 'Intel Xeon E5-2660 v4', 'Intel Xeon E5-2680 v4',
  'Intel Xeon E5-2690 v4', 'Intel Xeon E5-2695 v4', 'Intel Xeon E5-2697 v4',
  'Intel Xeon E5-2697A v4', 'Intel Xeon E5-2698 v4', 'Intel Xeon E5-2699 v4',
  'Intel Xeon E5-2699A v4',
  // AMD EPYC 7001 (Naples)
  'AMD EPYC 7251', 'AMD EPYC 7301', 'AMD EPYC 7351', 'AMD EPYC 7351P',
  'AMD EPYC 7401', 'AMD EPYC 7401P', 'AMD EPYC 7451', 'AMD EPYC 7501',
  'AMD EPYC 7551', 'AMD EPYC 7551P', 'AMD EPYC 7601',
  // AMD EPYC 7002 (Rome)
  'AMD EPYC 7232P', 'AMD EPYC 7262', 'AMD EPYC 7272', 'AMD EPYC 7282',
  'AMD EPYC 7302', 'AMD EPYC 7302P', 'AMD EPYC 7402', 'AMD EPYC 7402P',
  'AMD EPYC 7502', 'AMD EPYC 7502P', 'AMD EPYC 7542', 'AMD EPYC 7642',
  'AMD EPYC 7702', 'AMD EPYC 7702P', 'AMD EPYC 7742',
  // AMD EPYC 7003 (Milan)
  'AMD EPYC 7313', 'AMD EPYC 7313P', 'AMD EPYC 7413', 'AMD EPYC 7443',
  'AMD EPYC 7443P', 'AMD EPYC 7513', 'AMD EPYC 7543', 'AMD EPYC 7543P',
  'AMD EPYC 7643', 'AMD EPYC 7663', 'AMD EPYC 7713', 'AMD EPYC 7713P',
  'AMD EPYC 7763', 'AMD EPYC 7773X',
  // AMD EPYC 9004 (Genoa)
  'AMD EPYC 9124', 'AMD EPYC 9224', 'AMD EPYC 9254', 'AMD EPYC 9334',
  'AMD EPYC 9354', 'AMD EPYC 9354P', 'AMD EPYC 9454', 'AMD EPYC 9454P',
  'AMD EPYC 9534', 'AMD EPYC 9554', 'AMD EPYC 9554P', 'AMD EPYC 9634',
  'AMD EPYC 9654', 'AMD EPYC 9654P', 'AMD EPYC 9754',
]

// SERVER_CATEGORY_IDS / LAPTOP_CATEGORY_IDS now live in the pure domain layer
// (src/domain/asset/categoryCapabilities.ts) so the capability taxonomy is
// self-contained. Re-exported here to keep existing import sites stable.
export { SERVER_CATEGORY_IDS, LAPTOP_CATEGORY_IDS } from '@/domain/asset'
