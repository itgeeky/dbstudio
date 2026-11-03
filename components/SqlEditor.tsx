"use client";

import {
  autocompletion,
  closeBrackets,
  closeBracketsKeymap,
  completeFromList,
  completionKeymap,
  ifNotIn,
  type Completion,
} from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { PostgreSQL, schemaCompletionSource, type SQLNamespace } from "@codemirror/lang-sql";
import { HighlightStyle, LanguageSupport, bracketMatching, syntaxHighlighting } from "@codemirror/language";
import { Compartment, EditorState } from "@codemirror/state";
import { EditorView, drawSelection, keymap, tooltips } from "@codemirror/view";
import { tags } from "@lezer/highlight";
import { useEffect, useRef } from "react";
import type { TableInfo } from "@/lib/types";

const QUERY_KEYWORDS = [
  "select",
  "from",
  "where",
  "join",
  "left",
  "right",
  "inner",
  "full",
  "outer",
  "cross",
  "on",
  "using",
  "and",
  "or",
  "not",
  "in",
  "is",
  "null",
  "like",
  "ilike",
  "between",
  "exists",
  "group",
  "by",
  "order",
  "asc",
  "desc",
  "limit",
  "offset",
  "as",
  "distinct",
  "having",
  "union",
  "all",
  "with",
  "case",
  "when",
  "then",
  "else",
  "end",
  "true",
  "false",
];

const keywordSource = ifNotIn(
  ["QuotedIdentifier", "String", "LineComment", "BlockComment", "."],
  completeFromList(QUERY_KEYWORDS.map((label) => ({ label, type: "keyword", boost: -1 })))
);

const sqlHighlight = HighlightStyle.define([
  { tag: tags.keyword, color: "#7dd3fc" },
  { tag: tags.typeName, color: "#c4b5fd" },
  { tag: tags.string, color: "#86efac" },
  { tag: tags.number, color: "#fcd34d" },
  { tag: tags.bool, color: "#fcd34d" },
  { tag: tags.null, color: "#94a3b8" },
  { tag: tags.comment, color: "#64748b", fontStyle: "italic" },
  { tag: tags.operator, color: "#cbd5e1" },
]);

const editorTheme = EditorView.theme(
  {
    "&": {
      height: "100%",
      fontSize: "0.875rem",
      backgroundColor: "transparent",
      color: "#e2e8f0",
    },
    "&.cm-focused": { outline: "none" },
    ".cm-scroller": {
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
      lineHeight: "1.45",
    },
    ".cm-content": { padding: "0.75rem", caretColor: "#e2e8f0" },
    ".cm-line": { padding: 0 },
    ".cm-cursor, .cm-dropCursor": { borderLeftColor: "#e2e8f0" },
    ".cm-tooltip": {
      backgroundColor: "#0f172a",
      color: "#e2e8f0",
      border: "1px solid #334155",
      borderRadius: "0.5rem",
      boxShadow: "0 12px 32px rgba(0, 0, 0, 0.35)",
      zIndex: "50",
    },
    ".cm-tooltip-autocomplete": {
      "& > ul": {
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
        fontSize: "12px",
        maxHeight: "16rem",
      },
      "& > ul > li": { padding: "4px 8px" },
      "& > ul > li[aria-selected]": { backgroundColor: "#0ea5e9", color: "#020617" },
    },
    ".cm-completionIcon": { display: "none" },
    ".cm-completionDetail": {
      marginLeft: "0.75rem",
      color: "#94a3b8",
      fontStyle: "normal",
    },
    ".cm-tooltip-autocomplete > ul > li[aria-selected] .cm-completionDetail": {
      color: "#082f49",
    },
  },
  { dark: true }
);

function quoteIdent(name: string) {
  return /^[a-z_][a-z0-9_]*$/.test(name) ? name : `"${name.replace(/"/g, '""')}"`;
}

function kindLabel(kind: TableInfo["kind"]) {
  if (kind === "view") return "view";
  if (kind === "matview") return "matview";
  return "tabla";
}

function tableNode(table: TableInfo): SQLNamespace {
  return {
    self: {
      label: table.name,
      apply: quoteIdent(table.name),
      detail: `${table.schema} · ${kindLabel(table.kind)}`,
      type: "type",
      boost: 2,
    },
    children: table.columns.map((column) => ({
      label: column.name,
      apply: quoteIdent(column.name),
      detail: column.isPk ? `${column.dataType} · pk` : column.dataType,
      type: "property",
      boost: column.isPk ? 1 : 0,
    })),
  };
}

function sqlSupport(tables: TableInfo[]) {
  const schemas = new Map<string, { self: Completion; children: Record<string, SQLNamespace> }>();
  const byName = new Map<string, TableInfo[]>();

  for (const table of tables) {
    const group = byName.get(table.name);
    if (group) group.push(table);
    else byName.set(table.name, [table]);

    let schemaNode = schemas.get(table.schema);
    if (!schemaNode) {
      schemaNode = {
        self: {
          label: table.schema,
          apply: quoteIdent(table.schema),
          detail: "schema",
          type: "namespace",
          boost: 1,
        },
        children: {},
      };
      schemas.set(table.schema, schemaNode);
    }
    schemaNode.children[table.name] = tableNode(table);
  }

  const schema: Record<string, SQLNamespace> = {};
  for (const [name, node] of schemas) schema[name] = node;

  const duplicates: Completion[] = [];
  for (const group of byName.values()) {
    if (group.length === 1) {
      const table = group[0];
      if (!(table.name in schema)) schema[table.name] = tableNode(table);
      continue;
    }
    for (const table of group) {
      duplicates.push({
        label: `${table.schema}.${table.name}`,
        apply: `${quoteIdent(table.schema)}.${quoteIdent(table.name)}`,
        detail: kindLabel(table.kind),
        type: "type",
        boost: 2,
      });
    }
  }

  return new LanguageSupport(PostgreSQL.language, [
    PostgreSQL.language.data.of({
      autocomplete: schemaCompletionSource({
        dialect: PostgreSQL,
        schema,
        tables: duplicates,
      }),
    }),
    PostgreSQL.language.data.of({ autocomplete: keywordSource }),
  ]);
}

export function SqlEditor({
  value,
  tables,
  onChange,
}: {
  value: string;
  tables: TableInfo[];
  onChange: (value: string) => void;
}) {
  const parentRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const schemaCompartment = useRef(new Compartment());
  const onChangeRef = useRef(onChange);
  const valueRef = useRef(value);
  const tablesRef = useRef(tables);
  onChangeRef.current = onChange;
  tablesRef.current = tables;

  useEffect(() => {
    const parent = parentRef.current;
    if (!parent) return;
    const view = new EditorView({
      parent,
      state: EditorState.create({
        doc: valueRef.current,
        extensions: [
          history(),
          drawSelection(),
          bracketMatching(),
          closeBrackets(),
          autocompletion({ activateOnTyping: true, maxRenderedOptions: 80 }),
          keymap.of([
            ...completionKeymap,
            ...closeBracketsKeymap,
            ...defaultKeymap,
            ...historyKeymap,
            indentWithTab,
          ]),
          syntaxHighlighting(sqlHighlight),
          editorTheme,
          EditorView.lineWrapping,
          tooltips({ parent: document.body }),
          EditorView.contentAttributes.of({ "aria-label": "Consulta SQL" }),
          schemaCompartment.current.of(sqlSupport(tablesRef.current)),
          EditorView.updateListener.of((update) => {
            if (!update.docChanged) return;
            const next = update.state.doc.toString();
            if (next === valueRef.current) return;
            valueRef.current = next;
            onChangeRef.current(next);
          }),
        ],
      }),
    });
    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: schemaCompartment.current.reconfigure(sqlSupport(tables)),
    });
  }, [tables]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current === value) return;
    valueRef.current = value;
    view.dispatch({
      changes: { from: 0, to: current.length, insert: value },
      selection: { anchor: value.length },
    });
  }, [value]);

  return (
    <div
      ref={parentRef}
      className="h-40 overflow-hidden rounded-xl border border-slate-700 bg-slate-950 focus-within:border-sky-400"
    />
  );
}
