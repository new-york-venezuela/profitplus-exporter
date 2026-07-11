'use client';

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { ColumnDef } from '@/lib/reports/registry';

export interface ColumnItem extends ColumnDef {
  visible: boolean;
}

interface ChipProps {
  column:   ColumnItem;
  onToggle: () => void;
}

function SortableChip({ column, onToggle }: ChipProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: column.key });

  const style = {
    transform:  CSS.Transform.toString(transform),
    transition,
    opacity:    isDragging ? 0.6 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm
                  select-none transition-colors cursor-default ${
                    column.visible
                      ? 'bg-blue-50 border-blue-300 text-blue-800'
                      : 'bg-gray-100 border-gray-300 text-gray-400'
                  }`}
    >
      {/* Drag handle */}
      <span
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 text-xs"
        aria-label="Arrastrar para reordenar"
      >
        ⠿
      </span>

      {/* Toggle (hidden for alwaysVisible columns) */}
      {!column.alwaysVisible && (
        <button
          onClick={onToggle}
          className="w-4 h-4 flex items-center justify-center rounded-sm
                     text-xs leading-none hover:opacity-75"
          aria-label={column.visible ? `Ocultar ${column.label}` : `Mostrar ${column.label}`}
        >
          {column.visible ? '✓' : '○'}
        </button>
      )}

      <span className={column.alwaysVisible ? 'font-medium' : ''}>{column.label}</span>
    </div>
  );
}

interface Props {
  columns:  ColumnItem[];
  onChange: (columns: ColumnItem[]) => void;
}

export function ColumnManager({ columns, onChange }: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIdx = columns.findIndex(c => c.key === active.id);
      const newIdx = columns.findIndex(c => c.key === over.id);
      onChange(arrayMove(columns, oldIdx, newIdx));
    }
  }

  function handleToggle(key: string) {
    onChange(columns.map(c => c.key === key ? { ...c, visible: !c.visible } : c));
  }

  return (
    <div>
      <p className="text-sm font-medium text-gray-600 mb-2">Columnas</p>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={columns.map(c => c.key)} strategy={horizontalListSortingStrategy}>
          <div className="flex flex-wrap gap-2">
            {columns.map(col => (
              <SortableChip
                key={col.key}
                column={col}
                onToggle={() => handleToggle(col.key)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
