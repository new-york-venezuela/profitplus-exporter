// Safe-to-edit saArticulo fields for the inventory quick-edit module.
// Verified against a live trigger/schema audit — TrigEstado_saArticulo
// only reacts to `anulado` changes, so direct UPDATEs of these
// descriptive/threshold fields are safe. See
// erp-knowledge-base/docs/tables/saArticulo.md.
export const EDITABLE_ITEM_FIELDS = [
  'art_des', 'ref', 'modelo', 'comentario',
  'campo1', 'campo2', 'campo3', 'campo4', 'campo5', 'campo6', 'campo7', 'campo8',
  'stock_min', 'stock_max', 'stock_pedido',
] as const;

export type EditableItemField = typeof EDITABLE_ITEM_FIELDS[number];

const NUMERIC_FIELDS = new Set(['stock_min', 'stock_max', 'stock_pedido']);

export function isEditableItemField(field: string): field is EditableItemField {
  return (EDITABLE_ITEM_FIELDS as readonly string[]).includes(field);
}

export function isNumericItemField(field: EditableItemField): boolean {
  return NUMERIC_FIELDS.has(field);
}
