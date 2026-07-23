/**
 * Excel importer barrel. The page lazy-imports this module (xlsx is a static import
 * of template.ts/parse.ts, so it lands in the lazy chunk — same pattern as exportXlsx).
 */
export * from './types'
export * from './template'
export * from './parse'
export * from './validate'
export * from './run'
