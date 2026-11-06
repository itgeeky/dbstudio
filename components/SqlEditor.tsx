"use client";

import { useEffect, useRef, useCallback } from "react";
import { EditorView, keymap, placeholder } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { sql, PostgreSQL } from "@codemirror/lang-sql";
import { autocompletion, CompletionContext, type Completion } from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { oneDark } from "@codemirror/theme-one-dark";

type SchemaInfo = {
  tables: Array<{
    schema: string;
    name: string;
    columns: Array<{ name: string; dataType: string }>;
  }>;
};

type SqlEditorProps = {
  value: string;
  onChange: (value: string) => void;
  onExecute?: () => void;
  schema?: SchemaInfo | null;
  className?: string;
};

const baseTheme = EditorView.theme({
  "&": {
    height: "100%",
    fontSize: "13px",
  },
  ".cm-scroller": {
    overflow: "auto",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  },
  ".cm-content": {
    padding: "12px",
  },
  "&.cm-focused": {
    outline: "none",
  },
  ".cm-gutters": {
    display: "none",
  },
});

function buildCompletions(schema: SchemaInfo | null | undefined): Completion[] {
  const completions: Completion[] = [];

  const keywords = [
    "SELECT", "FROM", "WHERE", "AND", "OR", "NOT", "IN", "LIKE", "ILIKE",
    "ORDER BY", "GROUP BY", "HAVING", "LIMIT", "OFFSET", "AS", "ON",
    "JOIN", "LEFT JOIN", "RIGHT JOIN", "INNER JOIN", "FULL JOIN",
    "CROSS JOIN", "NATURAL JOIN", "UNION", "INTERSECT", "EXCEPT",
    "DISTINCT", "ALL", "NULL", "IS NULL", "IS NOT NULL", "BETWEEN",
    "EXISTS", "CASE", "WHEN", "THEN", "ELSE", "END", "CAST", "COALESCE",
    "NULLIF", "COUNT", "SUM", "AVG", "MIN", "MAX", "ARRAY_AGG", "STRING_AGG",
    "NOW", "CURRENT_DATE", "CURRENT_TIMESTAMP", "EXTRACT", "DATE_TRUNC",
    "TRUE", "FALSE", "ASC", "DESC", "NULLS FIRST", "NULLS LAST",
    "WITH", "RECURSIVE", "LATERAL", "FETCH", "FIRST", "ROWS", "ONLY",
  ];

  for (const kw of keywords) {
    completions.push({
      label: kw,
      type: "keyword",
      boost: -1,
    });
  }

  if (schema?.tables) {
    for (const table of schema.tables) {
      const fullName = table.schema === "public" ? table.name : `${table.schema}.${table.name}`;
      
      completions.push({
        label: fullName,
        type: "class",
        detail: "table",
        boost: 1,
      });

      if (table.schema !== "public") {
        completions.push({
          label: table.name,
          type: "class",
          detail: `${table.schema} table`,
          boost: 0,
        });
      }

      for (const col of table.columns) {
        completions.push({
          label: col.name,
          type: "property",
          detail: `${table.name}.${col.dataType}`,
          boost: 0,
        });

        completions.push({
          label: `${table.name}.${col.name}`,
          type: "property",
          detail: col.dataType,
          boost: -0.5,
        });
      }
    }
  }

  return completions;
}

function createCompletionSource(schema: SchemaInfo | null | undefined) {
  const completions = buildCompletions(schema);
  
  return (context: CompletionContext) => {
    const word = context.matchBefore(/[\w.]+/);
    if (!word && !context.explicit) return null;
    
    return {
      from: word?.from ?? context.pos,
      options: completions,
      validFor: /^[\w.]*$/,
    };
  };
}

export function SqlEditor({ value, onChange, onExecute, schema, className }: SqlEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const onExecuteRef = useRef(onExecute);

  onChangeRef.current = onChange;
  onExecuteRef.current = onExecute;

  const createState = useCallback((doc: string, schemaInfo: SchemaInfo | null | undefined) => {
    return EditorState.create({
      doc,
      extensions: [
        baseTheme,
        oneDark,
        history(),
        keymap.of([
          ...defaultKeymap,
          ...historyKeymap,
          {
            key: "Mod-Enter",
            run: () => {
              onExecuteRef.current?.();
              return true;
            },
          },
        ]),
        sql({ dialect: PostgreSQL }),
        autocompletion({
          override: [createCompletionSource(schemaInfo)],
          activateOnTyping: true,
          maxRenderedOptions: 30,
        }),
        placeholder("SELECT * FROM ..."),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChangeRef.current(update.state.doc.toString());
          }
        }),
      ],
    });
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    const view = new EditorView({
      state: createState(value, schema),
      parent: containerRef.current,
    });

    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    const currentDoc = view.state.doc.toString();
    if (currentDoc !== value) {
      view.dispatch({
        changes: { from: 0, to: currentDoc.length, insert: value },
      });
    }
  }, [value]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    const newState = createState(view.state.doc.toString(), schema);
    view.setState(newState);
  }, [schema, createState]);

  return (
    <div
      ref={containerRef}
      className={`overflow-hidden rounded-xl border border-slate-700 bg-slate-950 focus-within:border-sky-400 ${className ?? ""}`}
    />
  );
}
