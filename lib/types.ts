export type ColumnInfo = {
  name: string;
  dataType: string;
  udtName: string;
  nullable: boolean;
  defaultValue: string | null;
  isPk: boolean;
  isUnique: boolean;
  isFk: boolean;
  comment: string | null;
};

export type ForeignKey = {
  name: string;
  fromSchema: string;
  fromTable: string;
  fromColumns: string[];
  toSchema: string;
  toTable: string;
  toColumns: string[];
};

export type IndexInfo = {
  name: string;
  unique: boolean;
  primary: boolean;
  columns: string[];
};

export type TableInfo = {
  schema: string;
  name: string;
  kind: "table" | "view" | "matview";
  comment: string | null;
  estimatedRows: number;
  columns: ColumnInfo[];
  foreignKeys: ForeignKey[];
  incomingFks: ForeignKey[];
  indexes: IndexInfo[];
  isJunction: boolean;
  junctionHint: string | null;
};

export type SchemaGraph = {
  schemas: string[];
  tables: TableInfo[];
  foreignKeys: ForeignKey[];
};
