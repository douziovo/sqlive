import { describe, it, expect } from 'vitest';
import type { TableSchema, ForeignKeyInfo } from '@/model/DatabaseTypes';

// Test the helper logic extracted from useErDiagram without DOM dependencies.
// We inline the key pure functions: buildColumnMeta, determineCardinality,
// tablesToNodes, foreignKeysToEdges, and the FK-name truncation logic.

function buildColumnMeta(
  table: TableSchema,
  fkMap: Map<string, { toTable: string; toColumn: string }>,
) {
  return table.columns.map(col => {
    const rawType = (table.columnTypes[col] || '').toUpperCase();
    const isPK = rawType.includes('PRIMARY KEY');
    const fkInfo = fkMap.get(`${table.name}.${col}`);
    const isFK = !!fkInfo;
    const isUQ = rawType.includes('UNIQUE') && !isPK;
    return {
      name: col,
      type: rawType.split('|')[0].trim().toLowerCase(),
      isPrimaryKey: isPK,
      isForeignKey: isFK,
      isUnique: isUQ,
      ...(fkInfo ? { referencedTable: fkInfo.toTable, referencedColumn: fkInfo.toColumn } : {}),
    };
  });
}

function tablesToNodes(tables: TableSchema[], foreignKeys: ForeignKeyInfo[]) {
  const fkMap = new Map<string, { toTable: string; toColumn: string }>();
  for (const fk of foreignKeys) {
    fkMap.set(`${fk.fromTable}.${fk.fromColumn}`, { toTable: fk.toTable, toColumn: fk.toColumn });
  }
  return tables.map(table => ({
    id: `table-${table.name}`,
    type: 'table' as const,
    position: { x: 0, y: 0 },
    data: {
      tableName: table.name,
      columns: buildColumnMeta(table, fkMap),
      isFiltered: false,
      table,
    },
  }));
}

function determineCardinality(
  fromTable: TableSchema | undefined,
  toTable: TableSchema | undefined,
  fromColumn: string,
  toColumn: string,
): string {
  const fromColType = ((fromTable?.columnTypes[fromColumn] || '')).toUpperCase();
  const toColType = ((toTable?.columnTypes[toColumn] || '')).toUpperCase();
  const fromIsUnique = fromColType.includes('UNIQUE') || fromColType.includes('PRIMARY KEY');
  const toIsUnique = toColType.includes('UNIQUE') || toColType.includes('PRIMARY KEY');
  if (fromIsUnique && toIsUnique) return '一对一';
  if (fromIsUnique) return '一对多';
  return '多对一';
}

function foreignKeysToEdges(fks: ForeignKeyInfo[], tables: TableSchema[]) {
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
        type: 'smoothstep' as const,
        source: `table-${fk.fromTable}`,
        target: `table-${fk.toTable}`,
        label,
      };
    });
}

// ── Test Data ──

function makeUsersTable(): TableSchema {
  return {
    name: 'users',
    columns: ['id', 'name', 'dept_id'],
    columnTypes: { id: 'INTEGER | PRIMARY KEY', name: 'TEXT | NOT NULL', dept_id: 'INTEGER' },
    data: [],
  };
}

function makeDeptsTable(): TableSchema {
  return {
    name: 'departments',
    columns: ['id', 'name'],
    columnTypes: { id: 'INTEGER | PRIMARY KEY', name: 'TEXT | UNIQUE' },
    data: [],
  };
}

function makeOrdersTable(): TableSchema {
  return {
    name: 'orders',
    columns: ['id', 'user_id', 'total'],
    columnTypes: { id: 'INTEGER | PRIMARY KEY', user_id: 'INTEGER', total: 'REAL' },
    data: [],
  };
}

// ── Tests ──

describe('tablesToNodes', () => {
  it('maps one table to one node', () => {
    const nodes = tablesToNodes([makeUsersTable()], []);
    expect(nodes).toHaveLength(1);
    expect(nodes[0].id).toBe('table-users');
    expect(nodes[0].type).toBe('table');
    expect(nodes[0].data.tableName).toBe('users');
  });

  it('marks PRIMARY KEY column', () => {
    const nodes = tablesToNodes([makeUsersTable()], []);
    const cols = nodes[0].data.columns;
    const pkCol = cols.find(c => c.name === 'id');
    expect(pkCol!.isPrimaryKey).toBe(true);
    expect(pkCol!.isForeignKey).toBe(false);
  });

  it('marks FOREIGN KEY column with reference info', () => {
    const fks: ForeignKeyInfo[] = [
      { name: 'fk_dept', fromTable: 'users', fromColumn: 'dept_id', toTable: 'departments', toColumn: 'id' },
    ];
    const nodes = tablesToNodes([makeUsersTable(), makeDeptsTable()], fks);
    const cols = nodes[0].data.columns;
    const fkCol = cols.find(c => c.name === 'dept_id');
    expect(fkCol!.isForeignKey).toBe(true);
    expect(fkCol!.referencedTable).toBe('departments');
    expect(fkCol!.referencedColumn).toBe('id');
  });

  it('marks UNIQUE column (non-PK)', () => {
    const nodes = tablesToNodes([makeDeptsTable()], []);
    const cols = nodes[0].data.columns;
    const uqCol = cols.find(c => c.name === 'name');
    expect(uqCol!.isUnique).toBe(true);
    expect(uqCol!.isPrimaryKey).toBe(false);
  });

  it('does not mark PK as UNIQUE', () => {
    const nodes = tablesToNodes([makeUsersTable()], []);
    const cols = nodes[0].data.columns;
    const pkCol = cols.find(c => c.name === 'id');
    expect(pkCol!.isPrimaryKey).toBe(true);
    expect(pkCol!.isUnique).toBe(false);
  });
});

describe('determineCardinality', () => {
  it('returns 一对一 when both sides are unique', () => {
    const result = determineCardinality(
      makeUsersTable(), makeDeptsTable(), 'id', 'id',
    );
    // users.id is PK, depts.id is PK → 一对一
    expect(result).toBe('一对一');
  });

  it('returns 一对多 when from side is unique', () => {
    const result = determineCardinality(
      makeDeptsTable(), makeUsersTable(), 'id', 'dept_id',
    );
    // depts.id is PK, users.dept_id is not → 一对多
    expect(result).toBe('一对多');
  });

  it('returns 多对一 as default', () => {
    const result = determineCardinality(
      makeOrdersTable(), makeUsersTable(), 'user_id', 'id',
    );
    // orders.user_id is not PK/UNIQUE → 多对一 (default)
    expect(result).toBe('多对一');
  });
});

describe('foreignKeysToEdges', () => {
  it('creates one edge per foreign key', () => {
    const fks: ForeignKeyInfo[] = [
      { name: 'fk_dept', fromTable: 'users', fromColumn: 'dept_id', toTable: 'departments', toColumn: 'id' },
    ];
    const edges = foreignKeysToEdges(fks, [makeUsersTable(), makeDeptsTable()]);
    expect(edges).toHaveLength(1);
    expect(edges[0].source).toBe('table-users');
    expect(edges[0].target).toBe('table-departments');
    expect(edges[0].type).toBe('smoothstep');
  });

  it('includes FK name in label when present', () => {
    const fks: ForeignKeyInfo[] = [
      { name: 'fk_dept', fromTable: 'users', fromColumn: 'dept_id', toTable: 'departments', toColumn: 'id' },
    ];
    const edges = foreignKeysToEdges(fks, [makeUsersTable(), makeDeptsTable()]);
    expect(edges[0].label).toBe('fk_dept: 多对一');
  });

  it('uses cardinality-only label when FK has no name', () => {
    const fks: ForeignKeyInfo[] = [
      { name: '', fromTable: 'orders', fromColumn: 'user_id', toTable: 'users', toColumn: 'id' },
    ];
    const edges = foreignKeysToEdges(fks, [makeOrdersTable(), makeUsersTable()]);
    expect(edges[0].label).toBe('多对一');
  });

  it('shows full FK name without truncation', () => {
    const fks: ForeignKeyInfo[] = [
      { name: 'fk_orders_user_id_ref_users_id', fromTable: 'orders', fromColumn: 'user_id', toTable: 'users', toColumn: 'id' },
    ];
    const edges = foreignKeysToEdges(fks, [makeOrdersTable(), makeUsersTable()]);
    expect(edges[0].label).toBe('fk_orders_user_id_ref_users_id: 多对一');
  });

  it('filters out FK when target table is not in the schema', () => {
    const fks: ForeignKeyInfo[] = [
      { name: 'fk_orphan', fromTable: 'users', fromColumn: 'dept_id', toTable: 'nonexistent', toColumn: 'id' },
    ];
    const edges = foreignKeysToEdges(fks, [makeUsersTable()]);
    expect(edges).toHaveLength(0);
  });

  it('filters out FK when source table is not in the schema', () => {
    const fks: ForeignKeyInfo[] = [
      { name: 'fk_orphan', fromTable: 'ghost', fromColumn: 'x', toTable: 'users', toColumn: 'id' },
    ];
    const edges = foreignKeysToEdges(fks, [makeUsersTable()]);
    expect(edges).toHaveLength(0);
  });

  it('returns empty array for empty inputs', () => {
    const edges = foreignKeysToEdges([], []);
    expect(edges).toHaveLength(0);
  });
});

describe('search filtering', () => {
  it('marks node as filtered when neither table name nor columns match', () => {
    const nodes = tablesToNodes([makeUsersTable(), makeDeptsTable()], []);
    const q = 'xyz';
    const results = nodes.map(n => ({
      ...n,
      data: {
        ...n.data,
        isFiltered: !n.data.tableName.toLowerCase().includes(q)
          && !n.data.columns.some(c => c.name.toLowerCase().includes(q)),
      },
    }));

    expect(results[0].data.isFiltered).toBe(true);  // users: no match
    expect(results[1].data.isFiltered).toBe(true);  // departments: no match
  });

  it('does not filter node when any column name matches search', () => {
    const nodes = tablesToNodes([makeUsersTable(), makeDeptsTable()], []);
    const q = 'dept_id';
    const results = nodes.map(n => ({
      ...n,
      data: {
        ...n.data,
        isFiltered: !n.data.tableName.toLowerCase().includes(q)
          && !n.data.columns.some(c => c.name.toLowerCase().includes(q)),
      },
    }));

    // users: table name 'users' doesn't match 'dept_id', but column 'dept_id' does
    expect(results[0].data.isFiltered).toBe(false);
    // departments: neither table name nor columns match 'dept_id'
    expect(results[1].data.isFiltered).toBe(true);
  });
});
