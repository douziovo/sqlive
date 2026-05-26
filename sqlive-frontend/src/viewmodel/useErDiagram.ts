import { ref, computed, watch, nextTick } from 'vue';
import { MarkerType } from '@vue-flow/core';
import { layoutNodes } from '../composables/useDagreLayout';
import type { Node, Edge } from '@vue-flow/core';
import { parsePrimaryType } from '../utils/sql';
import type { TableSchema, ForeignKeyInfo, ColumnMeta, ErTableNodeData } from '../model/DatabaseTypes';

export function useErDiagram(
  tablesSource: () => TableSchema[],
  foreignKeysSource: () => ForeignKeyInfo[],
) {
  const nodes = ref<Node<ErTableNodeData>[]>([]);
  const edges = ref<Edge[]>([]);
  const searchQuery = ref('');
  const showMinimap = ref(false);
  const showControls = ref(true);
  const containerRef = ref<HTMLElement | null>(null);

  function setContainerRef(el: HTMLElement | null) {
    containerRef.value = el;
  }

  function buildColumnMeta(table: TableSchema, fkMap: Map<string, { toTable: string; toColumn: string }>): ColumnMeta[] {
    return table.columns.map(col => {
      const rawType = (table.columnTypes[col] || '').toUpperCase();
      const isPK = rawType.includes('PRIMARY KEY');
      const fkInfo = fkMap.get(`${table.name}.${col}`);
      const isFK = !!fkInfo;
      const isUQ = rawType.includes('UNIQUE') && !isPK;
      return {
        name: col,
        type: parsePrimaryType(rawType).toLowerCase(),
        isPrimaryKey: isPK,
        isForeignKey: isFK,
        isUnique: isUQ,
        ...(fkInfo ? { referencedTable: fkInfo.toTable, referencedColumn: fkInfo.toColumn } : {}),
      };
    });
  }

  function tablesToNodes(tables: TableSchema[], foreignKeys: ForeignKeyInfo[]): Node<ErTableNodeData>[] {
    const fkMap = new Map<string, { toTable: string; toColumn: string }>();
    for (const fk of foreignKeys) {
      fkMap.set(`${fk.fromTable}.${fk.fromColumn}`, { toTable: fk.toTable, toColumn: fk.toColumn });
    }

    return tables.map(table => ({
      id: `table-${table.name}`,
      type: 'table',
      position: { x: 0, y: 0 },
      data: {
        tableName: table.name,
        columns: buildColumnMeta(table, fkMap),
        isFiltered: false,
        table,
      },
    }));
  }

  function determineCardinality(fromTable: TableSchema | undefined, toTable: TableSchema | undefined, fromColumn: string, toColumn: string): string {
    const fromColType = ((fromTable?.columnTypes[fromColumn] || '')).toUpperCase();
    const toColType = ((toTable?.columnTypes[toColumn] || '')).toUpperCase();
    const fromIsUnique = fromColType.includes('UNIQUE') || fromColType.includes('PRIMARY KEY');
    const toIsUnique = toColType.includes('UNIQUE') || toColType.includes('PRIMARY KEY');

    if (fromIsUnique && toIsUnique) return '一对一';
    if (fromIsUnique) return '一对多';
    return '多对一';
  }

  function foreignKeysToEdges(fks: ForeignKeyInfo[], tables: TableSchema[]): Edge[] {
    const tableNames = new Set(tables.map(t => t.name));

    return fks
      .filter(fk => tableNames.has(fk.fromTable) && tableNames.has(fk.toTable))
      .map((fk, index) => {
        const fromTable = tables.find(t => t.name === fk.fromTable);
        const toTable = tables.find(t => t.name === fk.toTable);
        const cardinality = determineCardinality(fromTable, toTable, fk.fromColumn, fk.toColumn);

        const label = fk.name
          ? `${fk.name}: ${cardinality}`
          : cardinality;

        return {
          id: `fk-${fk.name || index}`,
          type: 'smoothstep',
          source: `table-${fk.fromTable}`,
          target: `table-${fk.toTable}`,
          markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
          style: { stroke: '#94a3b8', strokeWidth: 1.5 },
          label,
          labelStyle: { fill: '#64748b', fontWeight: 600, fontSize: 11, whiteSpace: 'nowrap' },
          labelBgStyle: { fill: '#ffffff', fillOpacity: 1 },
          labelBgPadding: [4, 6] as [number, number],
          labelBgBorderRadius: 4,
        };
      });
  }


  function rebuild() {
    const tables = tablesSource();
    const fks = foreignKeysSource();
    nodes.value = tablesToNodes(tables, fks);
    edges.value = foreignKeysToEdges(fks, tables);
  }

  async function autoLayout() {
    await nextTick();
    nodes.value = layoutNodes(
      nodes.value as any,
      edges.value,
      containerRef.value,
    ) as Node<ErTableNodeData>[];
    await nextTick();
  }

  const filteredNodes = computed<any[]>(() => {
    if (!searchQuery.value) return nodes.value;
    const q = searchQuery.value.toLowerCase();
    return (nodes.value as any[]).map((n: any) => {
      const nodeData = n.data;
      const filtered = nodeData
        ? !nodeData.tableName.toLowerCase().includes(q)
          && !nodeData.columns.some((c: any) => c.name.toLowerCase().includes(q))
        : true;
      return {
        ...n,
        data: nodeData ? { ...nodeData, isFiltered: filtered } : n.data,
      };
    });
  });

  rebuild();

  watch([tablesSource, foreignKeysSource], () => {
    rebuild();
    void autoLayout();
  }, { deep: true });

  return {
    nodes,
    edges,
    searchQuery,
    showMinimap,
    showControls,
    filteredNodes,
    autoLayout,
    setContainerRef,
  };
}
