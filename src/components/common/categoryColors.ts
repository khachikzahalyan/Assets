/**
 * Per-category icon-box palette for the assets table.
 * Ported verbatim from prototype/asset-list.html lines 883–975.
 * Keys are AMS category ids. bg = pastel background, icon = icon / border color.
 */
export const CATEGORY_COLOR: Record<string, { bg: string; icon: string }> = {
  // — Ноутбуки —
  cat_laptop:         { bg: '#E6F1FB', icon: '#185FA5' },
  cat_ultrabook:      { bg: '#E6F1FB', icon: '#185FA5' },
  cat_gaming_laptop:  { bg: '#E6F1FB', icon: '#185FA5' },
  cat_macbook_air:    { bg: '#E6F1FB', icon: '#185FA5' },
  cat_macbook_pro:    { bg: '#E6F1FB', icon: '#185FA5' },
  cat_thinkpad:       { bg: '#E6F1FB', icon: '#185FA5' },
  cat_chromebook:     { bg: '#E6F1FB', icon: '#185FA5' },

  // — Компьютеры (desktop / workstation / mini-PC / AIO) —
  cat_computer:       { bg: '#EAF3DE', icon: '#3B6D11' },
  cat_workstation:    { bg: '#EAF3DE', icon: '#3B6D11' },
  cat_mini_pc:        { bg: '#EAF3DE', icon: '#3B6D11' },
  cat_aio:            { bg: '#EAF3DE', icon: '#3B6D11' },
  cat_desktop:        { bg: '#EAF3DE', icon: '#3B6D11' },

  // — Смартфоны / телефоны —
  cat_phone:          { bg: '#EEEDFE', icon: '#534AB7' },
  cat_iphone:         { bg: '#EEEDFE', icon: '#534AB7' },
  cat_ip_phone:       { bg: '#EEEDFE', icon: '#534AB7' },
  cat_desk_phone:     { bg: '#EEEDFE', icon: '#534AB7' },

  // — Планшеты —
  cat_tablet:         { bg: '#CECBF6', icon: '#3C3489' },
  cat_ipad:           { bg: '#CECBF6', icon: '#3C3489' },

  // — Мониторы / дисплеи / ТВ —
  cat_monitor:        { bg: '#E1F5EE', icon: '#0F6E56' },
  cat_ext_display:    { bg: '#E1F5EE', icon: '#0F6E56' },
  cat_tv_panel:       { bg: '#E1F5EE', icon: '#0F6E56' },

  // — Принтеры / МФУ —
  cat_printer:        { bg: '#FAEEDA', icon: '#854F0B' },
  cat_mfp:            { bg: '#FAEEDA', icon: '#854F0B' },
  cat_label_printer:  { bg: '#FAEEDA', icon: '#854F0B' },
  cat_3d_printer:     { bg: '#FAEEDA', icon: '#854F0B' },
  cat_receipt_printer:{ bg: '#FAEEDA', icon: '#854F0B' },

  // — Серверы —
  cat_server:         { bg: '#FBEAF0', icon: '#993556' },
  cat_rack_server:    { bg: '#FBEAF0', icon: '#993556' },
  cat_blade_server:   { bg: '#FBEAF0', icon: '#993556' },
  cat_tower_server:   { bg: '#FBEAF0', icon: '#993556' },
  cat_mainframe:      { bg: '#FBEAF0', icon: '#993556' },

  // — Сетевое оборудование —
  cat_router:         { bg: '#FAECE7', icon: '#993C1D' },
  cat_switch:         { bg: '#FAECE7', icon: '#993C1D' },
  cat_firewall:       { bg: '#FAECE7', icon: '#993C1D' },
  cat_ap:             { bg: '#FAECE7', icon: '#993C1D' },
  cat_access_point:   { bg: '#FAECE7', icon: '#993C1D' },
  cat_modem:          { bg: '#FAECE7', icon: '#993C1D' },
  cat_modem_4g:       { bg: '#FAECE7', icon: '#993C1D' },
  cat_repeater:       { bg: '#FAECE7', icon: '#993C1D' },
  cat_patch_panel:    { bg: '#FAECE7', icon: '#993C1D' },
  cat_load_balancer:  { bg: '#FAECE7', icon: '#993C1D' },

  // — ИБП / питание —
  cat_ups:            { bg: '#FCEBEB', icon: '#A32D2D' },
  cat_pdu:            { bg: '#FCEBEB', icon: '#A32D2D' },
  cat_surge:          { bg: '#FCEBEB', icon: '#A32D2D' },
  cat_generator:      { bg: '#FCEBEB', icon: '#A32D2D' },

  // — Камеры —
  cat_webcam:         { bg: '#F4C0D1', icon: '#72243E' },
  cat_ip_camera:      { bg: '#F4C0D1', icon: '#72243E' },
  cat_camcorder:      { bg: '#F4C0D1', icon: '#72243E' },
  cat_dslr:           { bg: '#F4C0D1', icon: '#72243E' },

  // — Кресла / стулья —
  cat_chair:          { bg: '#FAC775', icon: '#633806' },
  cat_office_chair:   { bg: '#FAC775', icon: '#633806' },
  cat_exec_chair:     { bg: '#FAC775', icon: '#633806' },
  cat_mesh_chair:     { bg: '#FAC775', icon: '#633806' },
  cat_ergo_chair:     { bg: '#FAC775', icon: '#633806' },
  cat_visitor_chair:  { bg: '#FAC775', icon: '#633806' },
  cat_bar_stool:      { bg: '#FAC775', icon: '#633806' },
  cat_lounge_chair:   { bg: '#FAC775', icon: '#633806' },
  cat_armchair:       { bg: '#FAC775', icon: '#633806' },

  // — Столы —
  cat_desk:           { bg: '#D3D1C7', icon: '#444441' },
  cat_standing_desk:  { bg: '#D3D1C7', icon: '#444441' },
  cat_conf_table:     { bg: '#D3D1C7', icon: '#444441' },
  cat_meet_tbl:       { bg: '#D3D1C7', icon: '#444441' },
  cat_reception_desk: { bg: '#D3D1C7', icon: '#444441' },
  cat_l_desk:         { bg: '#D3D1C7', icon: '#444441' },
  cat_corner_desk:    { bg: '#D3D1C7', icon: '#444441' },
  cat_hot_desk:       { bg: '#D3D1C7', icon: '#444441' },
  cat_side_table:     { bg: '#D3D1C7', icon: '#444441' },
  cat_coffee_table:   { bg: '#D3D1C7', icon: '#444441' },
}

/**
 * Fallback palette keyed by the category's lucide icon — covers categories the
 * owner creates dynamically in /categories (their Firestore ids are not in
 * CATEGORY_COLOR). The icon expresses the asset TYPE, and the type→color
 * decision is fixed (owner rule) — so any «Ноутбук»-style category with a
 * laptop icon gets the laptop blue regardless of its id.
 */
const ICON_COLOR: Record<string, { bg: string; icon: string }> = {
  // Ноутбуки
  laptop: { bg: '#E6F1FB', icon: '#185FA5' },
  'laptop-minimal': { bg: '#E6F1FB', icon: '#185FA5' },
  // Компьютеры
  computer: { bg: '#EAF3DE', icon: '#3B6D11' },
  'pc-case': { bg: '#EAF3DE', icon: '#3B6D11' },
  cpu: { bg: '#EAF3DE', icon: '#3B6D11' },
  // Смартфоны / телефоны
  smartphone: { bg: '#EEEDFE', icon: '#534AB7' },
  phone: { bg: '#EEEDFE', icon: '#534AB7' },
  'phone-call': { bg: '#EEEDFE', icon: '#534AB7' },
  // Планшеты
  tablet: { bg: '#CECBF6', icon: '#3C3489' },
  // Мониторы / дисплеи / ТВ
  monitor: { bg: '#E1F5EE', icon: '#0F6E56' },
  tv: { bg: '#E1F5EE', icon: '#0F6E56' },
  projector: { bg: '#E1F5EE', icon: '#0F6E56' },
  // Принтеры / МФУ
  printer: { bg: '#FAEEDA', icon: '#854F0B' },
  'printer-check': { bg: '#FAEEDA', icon: '#854F0B' },
  // Серверы
  server: { bg: '#FBEAF0', icon: '#993556' },
  'server-cog': { bg: '#FBEAF0', icon: '#993556' },
  database: { bg: '#FBEAF0', icon: '#993556' },
  // Сетевое оборудование
  router: { bg: '#FAECE7', icon: '#993C1D' },
  wifi: { bg: '#FAECE7', icon: '#993C1D' },
  network: { bg: '#FAECE7', icon: '#993C1D' },
  'ethernet-port': { bg: '#FAECE7', icon: '#993C1D' },
  cable: { bg: '#FAECE7', icon: '#993C1D' },
  // ИБП / питание
  'battery-charging': { bg: '#FCEBEB', icon: '#A32D2D' },
  plug: { bg: '#FCEBEB', icon: '#A32D2D' },
  'plug-zap': { bg: '#FCEBEB', icon: '#A32D2D' },
  zap: { bg: '#FCEBEB', icon: '#A32D2D' },
  // Камеры
  camera: { bg: '#F4C0D1', icon: '#72243E' },
  webcam: { bg: '#F4C0D1', icon: '#72243E' },
  video: { bg: '#F4C0D1', icon: '#72243E' },
  cctv: { bg: '#F4C0D1', icon: '#72243E' },
  // Мебель
  armchair: { bg: '#FAC775', icon: '#633806' },
  sofa: { bg: '#FAC775', icon: '#633806' },
  table: { bg: '#D3D1C7', icon: '#444441' },
  'table-2': { bg: '#D3D1C7', icon: '#444441' },
  'lamp-desk': { bg: '#D3D1C7', icon: '#444441' },
}

/**
 * Resolve the icon-box tint for a category: exact id first (seeded catalogs),
 * then the category's lucide icon (dynamic catalogs). Null → neutral tile.
 */
export function resolveCategoryColor(
  categoryId: string,
  lucideIcon?: string | null,
): { bg: string; icon: string } | null {
  return CATEGORY_COLOR[categoryId] ?? (lucideIcon ? ICON_COLOR[lucideIcon] ?? null : null)
}
