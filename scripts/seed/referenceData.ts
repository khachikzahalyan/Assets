// scripts/seed/referenceData.ts
// Pure reference data for the AMS seeder. NO Firebase imports.
// Shapes mirror the production domain types (timestamps added by the writer).
import { deriveCategoryFlags } from '../../src/domain/asset/categoryCapabilities'

export interface StatusSeed {
  id: string; name: string; color: string; isFinal: boolean; isSystem: boolean; sortOrder: number
}
export interface BranchSeed {
  id: string; name: string; type: 'branch' | 'warehouse'; city: string | null; address: string | null
}
export interface DepartmentSeed { id: string; name: string }
export interface CategorySeed {
  id: string; name: string; group: 'devices' | 'network' | 'furniture'; prefix: string;
  hasSpecs: boolean; hasOemLicense: boolean; requiresSerial: boolean; hasTypeField: boolean;
  lucideIcon: string
}

export const STATUS_SEED: StatusSeed[] = [
  { id: 'st_warehouse', name: 'На складе', color: 'gray',   isFinal: false, isSystem: true, sortOrder: 0 },
  { id: 'st_assigned',  name: 'Выдано',    color: 'green',  isFinal: false, isSystem: true, sortOrder: 1 },
  { id: 'st_repair',    name: 'В ремонте', color: 'orange', isFinal: false, isSystem: true, sortOrder: 2 },
  { id: 'st_disposed',  name: 'Списано',   color: 'red',    isFinal: true,  isSystem: true, sortOrder: 3 },
]

export const BRANCH_SEED: BranchSeed[] = [
  { id: 'br_main',      name: 'Головной офис',   type: 'warehouse', city: null, address: null },
  { id: 'br_yerevan_2', name: 'Филиал Ереван-2', type: 'branch',    city: null, address: null },
  { id: 'br_yerevan_3', name: 'Филиал Ереван-3', type: 'branch',    city: null, address: null },
  { id: 'br_gyumri',    name: 'Филиал Гюмри',    type: 'branch',    city: null, address: null },
  { id: 'br_vanadzor',  name: 'Филиал Ванадзор', type: 'branch',    city: null, address: null },
]

export const DEPARTMENT_SEED: DepartmentSeed[] = [
  { id: 'dep_it',      name: 'ИТ'       },
  { id: 'dep_hr',      name: 'HR'       },
  { id: 'dep_sales',   name: 'Продажи'  },
  { id: 'dep_finance', name: 'Финансы'  },
  { id: 'dep_legal',   name: 'Юристы'   },
  { id: 'dep_ops',     name: 'Операции' },
]

// --- Curated core category set (default). Explicit, hand-assigned unique prefixes.
// Prefixes here MUST match the inventory-code prefixes used elsewhere (LAP/MON/DSK/PHN/SRV).
// NOTE: ids/names/icons/hasSpecs are taken verbatim from the canonical mock-data.js
// CATEGORIES taxonomy. Names here are UNIQUE by construction (the full 131-entry set
// has duplicate names — see ALL_CATEGORY_SOURCE — which would violate the app's
// isNameTaken rule on seed; that is why the curated core set is the default).
// DSK is assigned to cat_computer (matches the mock DSK/xxxxx inventory codes);
// the furniture desk (cat_desk) uses DSKF to avoid a prefix collision.
// Helper: build a CategorySeed row from name/group/prefix/lucideIcon, deriving all
// four capability flags from the domain taxonomy (single source of truth).
function makeCatSeed(
  id: string, name: string, group: 'devices' | 'network' | 'furniture',
  prefix: string, lucideIcon: string,
): CategorySeed {
  const flags = deriveCategoryFlags(id, group)
  return { id, name, group, prefix, lucideIcon, ...flags }
}

export const CORE_CATEGORY_SEED: CategorySeed[] = [
  // devices
  makeCatSeed('cat_laptop',   'Ноутбук',    'devices',   'LAP',  'laptop'     ),
  makeCatSeed('cat_computer', 'Компьютер',  'devices',   'DSK',  'monitor'    ),
  makeCatSeed('cat_monitor',  'Монитор',    'devices',   'MON',  'monitor'    ),
  makeCatSeed('cat_phone',    'Смартфон',   'devices',   'PHN',  'smartphone' ),
  makeCatSeed('cat_tablet',   'Планшет',    'devices',   'TAB',  'tablet'     ),
  makeCatSeed('cat_printer',  'Принтер',    'devices',   'PRN',  'printer'    ),
  makeCatSeed('cat_keyboard', 'Клавиатура', 'devices',   'KBD',  'keyboard'   ),
  makeCatSeed('cat_mouse',    'Мышь',       'devices',   'MSE',  'mouse'      ),
  makeCatSeed('cat_headset',  'Гарнитура',  'devices',   'HST',  'headphones' ),
  makeCatSeed('cat_dock',     'Dok-станция','devices',   'DCK',  'plug'       ),
  makeCatSeed('cat_webcam',   'Веб-камера', 'devices',   'WBC',  'camera'     ),
  makeCatSeed('cat_projector','Проектор',   'devices',   'PRJ',  'projector'  ),
  // network
  makeCatSeed('cat_server',   'Сервер',         'network', 'SRV', 'server'         ),
  makeCatSeed('cat_router',   'Маршрутизатор',  'network', 'RTR', 'router'         ),
  makeCatSeed('cat_switch',   'Коммутатор',     'network', 'SWT', 'network'        ),
  makeCatSeed('cat_firewall', 'Файрвол',        'network', 'FWL', 'shield'         ),
  makeCatSeed('cat_ap',       'Точка доступа',  'network', 'WAP', 'wifi'           ),
  makeCatSeed('cat_nas',      'NAS',            'network', 'NAS', 'hard-drive'     ),
  makeCatSeed('cat_ups',      'ИБП',            'network', 'UPS', 'battery-charging'),
  // furniture
  makeCatSeed('cat_desk',     'Стол офисный',     'furniture', 'DSKF', 'table-2'  ),
  makeCatSeed('cat_chair',    'Стул',             'furniture', 'CHR',  'armchair' ),
  makeCatSeed('cat_cabinet',  'Шкаф',             'furniture', 'CAB',  'archive'  ),
  makeCatSeed('cat_sofa',     'Диван',            'furniture', 'SOF',  'sofa'     ),
  makeCatSeed('cat_meet_tbl', 'Стол переговоров', 'furniture', 'MTG',  'square'   ),
  makeCatSeed('cat_safe',     'Сейф',             'furniture', 'SAF',  'shield'   ),
]

// --- Full source taxonomy (id/name/group/hasSpecs/lucideIcon only — NO prefix).
// Transcribed verbatim from Warehouse/prototypes/_shared/mock-data.js CATEGORIES (131).
// Mapping: _d -> group 'devices', _n -> 'network', _f -> 'furniture'.
// hasSpecs = the 4th positional arg of _d/_n (true only for computer/laptop/server
// families); _f (furniture) entries are always hasSpecs:false.
//
// DUPLICATE-NAME REALITY (intentional in the mock, preserved here): several entries
// share a NAME even though ids are unique — e.g. 'Компьютер' (cat_computer AND
// cat_desktop), 'Точка доступа' (cat_ap) vs 'Точка доступа Wi-Fi' (cat_access_point),
// 'Кресло' (cat_armchair) vs the many 'Кресло ...' chair variants, 'Стол переговорный'
// vs 'Стол переговоров'. The production app enforces UNIQUE category names via
// isNameTaken, so seeding the FULL set with --all-categories will collide on these
// duplicate names. buildAllCategorySeed() guarantees unique PREFIXES (throws on
// collision) but does NOT deduplicate names — the duplicate names are surfaced by a
// builder test so the operator knows before running --all-categories. The curated
// CORE_CATEGORY_SEED has no duplicate names, which is why it is the default.
// ALL_CATEGORY_SOURCE carries only the hand-authored fields (id/name/group/hasSpecs/lucideIcon).
// The remaining three capability flags (hasOemLicense/requiresSerial/hasTypeField) are
// derived at build time in buildAllCategorySeed() via deriveCategoryFlags() to avoid
// hand-editing 131 rows.
export const ALL_CATEGORY_SOURCE: Pick<CategorySeed, 'id' | 'name' | 'group' | 'hasSpecs' | 'lucideIcon'>[] = [
  // === DEVICES — computers, laptops ===
  { id: 'cat_computer',       name: 'Компьютер',             group: 'devices', hasSpecs: true,  lucideIcon: 'monitor'        },
  { id: 'cat_workstation',    name: 'Рабочая станция',       group: 'devices', hasSpecs: true,  lucideIcon: 'monitor'        },
  { id: 'cat_mini_pc',        name: 'Мини-ПК',               group: 'devices', hasSpecs: true,  lucideIcon: 'box'            },
  { id: 'cat_aio',            name: 'Моноблок',              group: 'devices', hasSpecs: true,  lucideIcon: 'monitor'        },
  { id: 'cat_laptop',         name: 'Ноутбук',               group: 'devices', hasSpecs: true,  lucideIcon: 'laptop'         },
  { id: 'cat_ultrabook',      name: 'Ультрабук',             group: 'devices', hasSpecs: true,  lucideIcon: 'laptop'         },
  { id: 'cat_gaming_laptop',  name: 'Игровой ноутбук',       group: 'devices', hasSpecs: true,  lucideIcon: 'gamepad-2'      },
  { id: 'cat_macbook_air',    name: 'MacBook Air',           group: 'devices', hasSpecs: true,  lucideIcon: 'laptop'         },
  { id: 'cat_macbook_pro',    name: 'MacBook Pro',           group: 'devices', hasSpecs: true,  lucideIcon: 'laptop'         },
  { id: 'cat_thinkpad',       name: 'ThinkPad',              group: 'devices', hasSpecs: true,  lucideIcon: 'laptop'         },
  { id: 'cat_chromebook',     name: 'Chromebook',            group: 'devices', hasSpecs: true,  lucideIcon: 'laptop'         },
  { id: 'cat_desktop',        name: 'Компьютер',             group: 'devices', hasSpecs: true,  lucideIcon: 'pc-case'        },
  // External storage
  { id: 'cat_ext_hdd',        name: 'Внешний HDD',           group: 'devices', hasSpecs: false, lucideIcon: 'hard-drive'     },
  { id: 'cat_ext_ssd',        name: 'Внешний SSD',           group: 'devices', hasSpecs: false, lucideIcon: 'hard-drive'     },
  { id: 'cat_usb_flash',      name: 'USB-флешка',            group: 'devices', hasSpecs: false, lucideIcon: 'usb'            },
  { id: 'cat_sd_card',        name: 'SD-карта',              group: 'devices', hasSpecs: false, lucideIcon: 'memory-stick'   },
  // Display + AV
  { id: 'cat_monitor',        name: 'Монитор',               group: 'devices', hasSpecs: false, lucideIcon: 'monitor'        },
  { id: 'cat_ext_display',    name: 'Внешний дисплей',       group: 'devices', hasSpecs: false, lucideIcon: 'monitor-play'   },
  { id: 'cat_projector',      name: 'Проектор',              group: 'devices', hasSpecs: false, lucideIcon: 'projector'      },
  { id: 'cat_smart_board',    name: 'Интерактивная доска',   group: 'devices', hasSpecs: false, lucideIcon: 'presentation'   },
  { id: 'cat_video_wall',     name: 'Видеостена',            group: 'devices', hasSpecs: false, lucideIcon: 'monitor-play'   },
  { id: 'cat_webcam',         name: 'Веб-камера',            group: 'devices', hasSpecs: false, lucideIcon: 'camera'         },
  { id: 'cat_ip_camera',      name: 'IP-камера',             group: 'devices', hasSpecs: false, lucideIcon: 'video'          },
  { id: 'cat_camcorder',      name: 'Видеокамера',           group: 'devices', hasSpecs: false, lucideIcon: 'video'          },
  { id: 'cat_dslr',           name: 'Зеркальная камера',     group: 'devices', hasSpecs: false, lucideIcon: 'camera'         },
  { id: 'cat_vcs',            name: 'Система видеосвязи',     group: 'devices', hasSpecs: false, lucideIcon: 'video'          },
  { id: 'cat_tv_panel',       name: 'ТВ-панель',             group: 'devices', hasSpecs: false, lucideIcon: 'tv'             },
  // Print + Scan
  { id: 'cat_printer',        name: 'Принтер',               group: 'devices', hasSpecs: false, lucideIcon: 'printer'        },
  { id: 'cat_mfp',            name: 'МФУ',                   group: 'devices', hasSpecs: false, lucideIcon: 'printer'        },
  { id: 'cat_label_printer',  name: 'Принтер этикеток',      group: 'devices', hasSpecs: false, lucideIcon: 'printer'        },
  { id: 'cat_3d_printer',     name: '3D-принтер',            group: 'devices', hasSpecs: false, lucideIcon: 'printer'        },
  { id: 'cat_plotter',        name: 'Плоттер',               group: 'devices', hasSpecs: false, lucideIcon: 'pen-tool'       },
  { id: 'cat_scanner',        name: 'Сканер',                group: 'devices', hasSpecs: false, lucideIcon: 'scan'           },
  { id: 'cat_doc_scanner',    name: 'Сканер документов',     group: 'devices', hasSpecs: false, lucideIcon: 'scan-line'      },
  { id: 'cat_shredder',       name: 'Шредер',                group: 'devices', hasSpecs: false, lucideIcon: 'scissors'       },
  { id: 'cat_laminator',      name: 'Ламинатор',             group: 'devices', hasSpecs: false, lucideIcon: 'layers'         },
  { id: 'cat_binder',         name: 'Брошюратор',            group: 'devices', hasSpecs: false, lucideIcon: 'book'           },
  // Input
  { id: 'cat_keyboard',       name: 'Клавиатура',            group: 'devices', hasSpecs: false, lucideIcon: 'keyboard'       },
  { id: 'cat_mouse',          name: 'Мышь',                  group: 'devices', hasSpecs: false, lucideIcon: 'mouse'          },
  { id: 'cat_trackball',      name: 'Трекбол',               group: 'devices', hasSpecs: false, lucideIcon: 'mouse-pointer'  },
  { id: 'cat_graphic_tablet', name: 'Графический планшет',   group: 'devices', hasSpecs: false, lucideIcon: 'pen-tool'       },
  { id: 'cat_stylus',         name: 'Стилус',                group: 'devices', hasSpecs: false, lucideIcon: 'pen-line'       },
  // Audio
  { id: 'cat_headset',        name: 'Гарнитура',             group: 'devices', hasSpecs: false, lucideIcon: 'headphones'     },
  { id: 'cat_headphones',     name: 'Наушники',              group: 'devices', hasSpecs: false, lucideIcon: 'headphones'     },
  { id: 'cat_speakers',       name: 'Колонки',               group: 'devices', hasSpecs: false, lucideIcon: 'speaker'        },
  { id: 'cat_microphone',     name: 'Микрофон',              group: 'devices', hasSpecs: false, lucideIcon: 'mic'            },
  { id: 'cat_conf_phone',     name: 'Конференц-телефон',     group: 'devices', hasSpecs: false, lucideIcon: 'phone-call'     },
  { id: 'cat_audio_mixer',    name: 'Аудио-микшер',          group: 'devices', hasSpecs: false, lucideIcon: 'sliders'        },
  // Mobile + Telephony
  { id: 'cat_phone',          name: 'Смартфон',              group: 'devices', hasSpecs: false, lucideIcon: 'smartphone'     },
  { id: 'cat_iphone',         name: 'iPhone',                group: 'devices', hasSpecs: false, lucideIcon: 'smartphone'     },
  { id: 'cat_tablet',         name: 'Планшет',               group: 'devices', hasSpecs: false, lucideIcon: 'tablet'         },
  { id: 'cat_ipad',           name: 'iPad',                  group: 'devices', hasSpecs: false, lucideIcon: 'tablet'         },
  { id: 'cat_ip_phone',       name: 'IP-телефон',            group: 'devices', hasSpecs: false, lucideIcon: 'phone'          },
  { id: 'cat_desk_phone',     name: 'Стационарный телефон',  group: 'devices', hasSpecs: false, lucideIcon: 'phone'          },
  { id: 'cat_walkie_talkie',  name: 'Рация',                 group: 'devices', hasSpecs: false, lucideIcon: 'radio'          },
  // Docking + Accessories
  { id: 'cat_dock',           name: 'Док-станция',           group: 'devices', hasSpecs: false, lucideIcon: 'plug'           },
  { id: 'cat_kvm',            name: 'KVM-переключатель',     group: 'devices', hasSpecs: false, lucideIcon: 'arrow-left-right' },
  { id: 'cat_hub',            name: 'USB-хаб',               group: 'devices', hasSpecs: false, lucideIcon: 'usb'            },
  { id: 'cat_adapter',        name: 'Адаптер',               group: 'devices', hasSpecs: false, lucideIcon: 'plug'           },
  { id: 'cat_charger',        name: 'Зарядное устройство',   group: 'devices', hasSpecs: false, lucideIcon: 'battery-charging' },
  { id: 'cat_powerbank',      name: 'Внешний аккумулятор',   group: 'devices', hasSpecs: false, lucideIcon: 'battery'        },
  // POS / Specialized
  { id: 'cat_pos',            name: 'POS-терминал',          group: 'devices', hasSpecs: false, lucideIcon: 'credit-card'    },
  { id: 'cat_card_reader',    name: 'Картридер',             group: 'devices', hasSpecs: false, lucideIcon: 'credit-card'    },
  { id: 'cat_barcode',        name: 'Сканер штрих-кодов',    group: 'devices', hasSpecs: false, lucideIcon: 'scan-line'      },
  { id: 'cat_cash_drawer',    name: 'Денежный ящик',         group: 'devices', hasSpecs: false, lucideIcon: 'archive'        },
  { id: 'cat_receipt_printer',name: 'Чековый принтер',       group: 'devices', hasSpecs: false, lucideIcon: 'receipt'        },
  { id: 'cat_id_reader',      name: 'Считыватель ID-карт',   group: 'devices', hasSpecs: false, lucideIcon: 'square-user'    },
  { id: 'cat_fingerprint',    name: 'Биометрический сканер', group: 'devices', hasSpecs: false, lucideIcon: 'fingerprint'    },
  { id: 'cat_signature_pad',  name: 'Планшет для подписи',   group: 'devices', hasSpecs: false, lucideIcon: 'pen-line'       },

  // === NETWORK INFRASTRUCTURE ===
  // Servers
  { id: 'cat_server',         name: 'Сервер',                group: 'network', hasSpecs: true,  lucideIcon: 'server'         },
  { id: 'cat_rack_server',    name: 'Rack-сервер',           group: 'network', hasSpecs: true,  lucideIcon: 'server'         },
  { id: 'cat_blade_server',   name: 'Blade-сервер',          group: 'network', hasSpecs: true,  lucideIcon: 'server'         },
  { id: 'cat_tower_server',   name: 'Tower-сервер',          group: 'network', hasSpecs: true,  lucideIcon: 'server'         },
  { id: 'cat_mainframe',      name: 'Mainframe',             group: 'network', hasSpecs: true,  lucideIcon: 'server'         },
  // Network storage
  { id: 'cat_nas',            name: 'NAS',                   group: 'network', hasSpecs: false, lucideIcon: 'hard-drive'     },
  { id: 'cat_san',            name: 'SAN',                   group: 'network', hasSpecs: false, lucideIcon: 'database'       },
  { id: 'cat_tape_drive',     name: 'Стример',               group: 'network', hasSpecs: false, lucideIcon: 'hard-drive'     },
  // Networking gear
  { id: 'cat_router',         name: 'Маршрутизатор',         group: 'network', hasSpecs: false, lucideIcon: 'router'         },
  { id: 'cat_switch',         name: 'Коммутатор',            group: 'network', hasSpecs: false, lucideIcon: 'network'        },
  { id: 'cat_firewall',       name: 'Файрвол',               group: 'network', hasSpecs: false, lucideIcon: 'shield'         },
  { id: 'cat_ap',             name: 'Точка доступа',         group: 'network', hasSpecs: false, lucideIcon: 'wifi'           },
  { id: 'cat_access_point',   name: 'Точка доступа Wi-Fi',   group: 'network', hasSpecs: false, lucideIcon: 'wifi'           },
  { id: 'cat_modem',          name: 'Модем',                 group: 'network', hasSpecs: false, lucideIcon: 'router'         },
  { id: 'cat_modem_4g',       name: '4G/5G-модем',           group: 'network', hasSpecs: false, lucideIcon: 'wifi'           },
  { id: 'cat_repeater',       name: 'Усилитель Wi-Fi',       group: 'network', hasSpecs: false, lucideIcon: 'wifi'           },
  { id: 'cat_patch_panel',    name: 'Патч-панель',           group: 'network', hasSpecs: false, lucideIcon: 'cable'          },
  { id: 'cat_load_balancer',  name: 'Балансировщик нагрузки',group: 'network', hasSpecs: false, lucideIcon: 'network'        },
  // Power infrastructure
  { id: 'cat_ups',            name: 'ИБП',                   group: 'network', hasSpecs: false, lucideIcon: 'battery-charging' },
  { id: 'cat_pdu',            name: 'PDU',                   group: 'network', hasSpecs: false, lucideIcon: 'plug-zap'        },
  { id: 'cat_surge',          name: 'Сетевой фильтр',        group: 'network', hasSpecs: false, lucideIcon: 'zap'            },
  { id: 'cat_generator',      name: 'Генератор',             group: 'network', hasSpecs: false, lucideIcon: 'zap'            },

  // === FURNITURE ===
  { id: 'cat_desk',           name: 'Стол офисный',          group: 'furniture', hasSpecs: false, lucideIcon: 'table-2'              },
  { id: 'cat_standing_desk',  name: 'Стол стоячий',          group: 'furniture', hasSpecs: false, lucideIcon: 'table-2'              },
  { id: 'cat_conf_table',     name: 'Стол переговорный',     group: 'furniture', hasSpecs: false, lucideIcon: 'table-2'              },
  { id: 'cat_meet_tbl',       name: 'Стол переговоров',      group: 'furniture', hasSpecs: false, lucideIcon: 'square'               },
  { id: 'cat_reception_desk', name: 'Стол ресепшен',         group: 'furniture', hasSpecs: false, lucideIcon: 'table-2'              },
  { id: 'cat_l_desk',         name: 'Стол L-образный',       group: 'furniture', hasSpecs: false, lucideIcon: 'table-2'              },
  { id: 'cat_corner_desk',    name: 'Стол угловой',          group: 'furniture', hasSpecs: false, lucideIcon: 'table-2'              },
  { id: 'cat_hot_desk',       name: 'Hot-desk',              group: 'furniture', hasSpecs: false, lucideIcon: 'table-2'              },
  { id: 'cat_side_table',     name: 'Стол приставной',       group: 'furniture', hasSpecs: false, lucideIcon: 'table-2'              },
  { id: 'cat_coffee_table',   name: 'Столик кофейный',       group: 'furniture', hasSpecs: false, lucideIcon: 'table-2'              },
  { id: 'cat_chair',          name: 'Стул',                  group: 'furniture', hasSpecs: false, lucideIcon: 'armchair'             },
  { id: 'cat_office_chair',   name: 'Кресло офисное',        group: 'furniture', hasSpecs: false, lucideIcon: 'armchair'             },
  { id: 'cat_exec_chair',     name: 'Кресло руководителя',   group: 'furniture', hasSpecs: false, lucideIcon: 'armchair'             },
  { id: 'cat_mesh_chair',     name: 'Кресло-сетка',          group: 'furniture', hasSpecs: false, lucideIcon: 'armchair'             },
  { id: 'cat_ergo_chair',     name: 'Кресло эргономичное',   group: 'furniture', hasSpecs: false, lucideIcon: 'armchair'             },
  { id: 'cat_visitor_chair',  name: 'Стул посетителя',       group: 'furniture', hasSpecs: false, lucideIcon: 'armchair'             },
  { id: 'cat_bar_stool',      name: 'Барный стул',           group: 'furniture', hasSpecs: false, lucideIcon: 'armchair'             },
  { id: 'cat_lounge_chair',   name: 'Лаунж-кресло',          group: 'furniture', hasSpecs: false, lucideIcon: 'armchair'             },
  { id: 'cat_sofa',           name: 'Диван',                 group: 'furniture', hasSpecs: false, lucideIcon: 'sofa'                 },
  { id: 'cat_armchair',       name: 'Кресло',                group: 'furniture', hasSpecs: false, lucideIcon: 'armchair'             },
  { id: 'cat_bench',          name: 'Скамья',                group: 'furniture', hasSpecs: false, lucideIcon: 'rectangle-horizontal' },
  { id: 'cat_cabinet',        name: 'Шкаф',                  group: 'furniture', hasSpecs: false, lucideIcon: 'archive'              },
  { id: 'cat_file_cabinet',   name: 'Шкаф для документов',   group: 'furniture', hasSpecs: false, lucideIcon: 'archive'              },
  { id: 'cat_locker',         name: 'Локер',                 group: 'furniture', hasSpecs: false, lucideIcon: 'lock'                 },
  { id: 'cat_bookshelf',      name: 'Стеллаж',               group: 'furniture', hasSpecs: false, lucideIcon: 'library'              },
  { id: 'cat_drawer_unit',    name: 'Тумба с ящиками',       group: 'furniture', hasSpecs: false, lucideIcon: 'archive'              },
  { id: 'cat_pedestal',       name: 'Пьедестал',             group: 'furniture', hasSpecs: false, lucideIcon: 'archive'              },
  { id: 'cat_safe',           name: 'Сейф',                  group: 'furniture', hasSpecs: false, lucideIcon: 'shield'               },
  { id: 'cat_whiteboard',     name: 'Доска маркерная',       group: 'furniture', hasSpecs: false, lucideIcon: 'square-pen'           },
  { id: 'cat_corkboard',      name: 'Доска пробковая',       group: 'furniture', hasSpecs: false, lucideIcon: 'square'               },
  { id: 'cat_flipchart',      name: 'Флипчарт',              group: 'furniture', hasSpecs: false, lucideIcon: 'presentation'         },
  { id: 'cat_coatrack',       name: 'Вешалка',               group: 'furniture', hasSpecs: false, lucideIcon: 'shirt'                },
  { id: 'cat_umbrella_stand', name: 'Стойка для зонтов',     group: 'furniture', hasSpecs: false, lucideIcon: 'umbrella'             },
  { id: 'cat_plant_stand',    name: 'Подставка для цветов',  group: 'furniture', hasSpecs: false, lucideIcon: 'leaf'                 },
  { id: 'cat_trash_bin',      name: 'Корзина для мусора',    group: 'furniture', hasSpecs: false, lucideIcon: 'trash-2'              },
  { id: 'cat_paper_bin',      name: 'Корзина для бумаг',     group: 'furniture', hasSpecs: false, lucideIcon: 'trash-2'              },
  { id: 'cat_mirror',         name: 'Зеркало',               group: 'furniture', hasSpecs: false, lucideIcon: 'square'               },
  { id: 'cat_partition',      name: 'Перегородка',           group: 'furniture', hasSpecs: false, lucideIcon: 'columns-3'            },
  { id: 'cat_curtains',       name: 'Шторы',                 group: 'furniture', hasSpecs: false, lucideIcon: 'columns-2'            },
  { id: 'cat_carpet',         name: 'Ковёр',                 group: 'furniture', hasSpecs: false, lucideIcon: 'rectangle-horizontal' },
]

// --- Deterministic, collision-checked prefix generator for the full set.
// Strategy: derive a base from the id suffix (uppercased latin), then disambiguate
// with a numeric suffix on collision. THROWS if it cannot produce a unique <=6-char
// [A-Z0-9] prefix — a corrupt catalog must never be written.
// NOTE: this guarantees unique PREFIXES only. It does NOT deduplicate category NAMES;
// the full source has intentional duplicate names (see ALL_CATEGORY_SOURCE comment)
// which the production isNameTaken rule would reject on seed. Use the curated
// CORE_CATEGORY_SEED (the default) for a clean, conflict-free catalog.
export function buildAllCategorySeed(): CategorySeed[] {
  const used = new Set<string>()
  const base = (id: string): string => {
    const stem = id.replace(/^cat_/, '').replace(/[^a-z0-9]/gi, '')
    const up = stem.toUpperCase()
    return (up.slice(0, 3) || 'CAT')
  }
  return ALL_CATEGORY_SOURCE.map((c) => {
    let p = base(c.id)
    let n = 0
    while (used.has(p)) {
      n += 1
      p = (base(c.id).slice(0, 4) + String(n))
      if (p.length > 6) throw new Error(`Cannot generate unique prefix for ${c.id}`)
    }
    if (!/^[A-Z0-9]{2,6}$/.test(p)) throw new Error(`Invalid generated prefix "${p}" for ${c.id}`)
    used.add(p)
    const flags = deriveCategoryFlags(c.id, c.group)
    return { ...c, prefix: p, ...flags }
  })
}

// === Parts catalog (replaceable-component SKUs) ===========================
// Mirrors Warehouse/prototypes/_shared/mock-data.js SKUS_INITIAL (the canonical
// catalog the "Добавить запчасть" modal renders). Generated programmatically from
// the same variant arrays as the prototype so ids/labels match exactly.
//
// Catalog shape (53 SKUs):
//   · psu, cooler  — 1 SKU each, no variant, lowStockThreshold 5.
//   · ssd/hdd/nvme — 9 storage variants each (27), lowStockThreshold 3.
//   · ram          — 8 capacity variants × 3 DDR generations (24), lowStockThreshold 3.
//   · gpu          — NOT seeded; users create GPU SKUs dynamically via the UI.
//
// onHand/broken are DERIVED snapshots the app recomputes from part_movements on every
// load, so a 0 seed is safe. The doc carries ONLY the keys whitelisted by
// firestore.rules `match /parts/{id}` keys().hasOnly([...]); no seed-sentinel field is
// added (it would violate that rule's form). Idempotency is via the seeder's
// create-if-absent path (existing SKUs are skipped, preserving createdAt/createdBy).
export interface PartSeed {
  id: string
  name: string
  category: 'psu' | 'cooler' | 'ssd' | 'hdd' | 'nvme' | 'ram'
  variantId?: string
  variantLabel?: string
  ddr?: string
  unit: string
  onHand: number
  broken: number
  lowStockThreshold: number
}

const STORAGE_VARIANTS: { id: string; label: string }[] = [
  { id: '64gb',  label: '64 ГБ'  },
  { id: '128gb', label: '128 ГБ' },
  { id: '256gb', label: '256 ГБ' },
  { id: '512gb', label: '512 ГБ' },
  { id: '1tb',   label: '1 ТБ'   },
  { id: '2tb',   label: '2 ТБ'   },
  { id: '3tb',   label: '3 ТБ'   },
  { id: '4tb',   label: '4 ТБ'   },
  { id: '5tb',   label: '5 ТБ'   },
]

const RAM_VARIANTS: { id: string; label: string }[] = [
  { id: '4gb',   label: '4 ГБ'   },
  { id: '8gb',   label: '8 ГБ'   },
  { id: '16gb',  label: '16 ГБ'  },
  { id: '20gb',  label: '20 ГБ'  },
  { id: '32gb',  label: '32 ГБ'  },
  { id: '40gb',  label: '40 ГБ'  },
  { id: '64gb',  label: '64 ГБ'  },
  { id: '128gb', label: '128 ГБ' },
]

const STORAGE_NAME: Record<'ssd' | 'hdd' | 'nvme', string> = {
  ssd:  'SSD',
  hdd:  'HDD',
  nvme: 'M.2 / NVMe',
}

/** Build the 53-SKU parts catalog (gpu intentionally excluded). */
export function buildPartSeed(): PartSeed[] {
  const rows: PartSeed[] = [
    { id: 'sku_psu',    name: 'Блок питания', category: 'psu',    unit: 'шт', onHand: 0, broken: 0, lowStockThreshold: 5 },
    { id: 'sku_cooler', name: 'Кулер',        category: 'cooler', unit: 'шт', onHand: 0, broken: 0, lowStockThreshold: 5 },
  ]
  for (const cat of ['ssd', 'hdd', 'nvme'] as const) {
    for (const v of STORAGE_VARIANTS) {
      rows.push({
        id: `sku_${cat}_${v.id}`,
        name: STORAGE_NAME[cat],
        category: cat,
        variantId: v.id,
        variantLabel: v.label,
        unit: 'шт', onHand: 0, broken: 0, lowStockThreshold: 3,
      })
    }
  }
  for (const ddr of ['DDR3', 'DDR4', 'DDR5'] as const) {
    for (const v of RAM_VARIANTS) {
      rows.push({
        id: `sku_ram_${v.id}_${ddr.toLowerCase()}`,
        name: 'ОЗУ',
        category: 'ram',
        variantId: v.id,
        variantLabel: v.label,
        ddr,
        unit: 'шт', onHand: 0, broken: 0, lowStockThreshold: 3,
      })
    }
  }
  return rows
}

export const PART_SEED: PartSeed[] = buildPartSeed()
