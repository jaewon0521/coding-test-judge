"use client";

import CodeMirror from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";

type CodeEditorProps = {
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
};

export function CodeEditor({ value, onChange, readOnly = false }: CodeEditorProps) {
  return (
    <CodeMirror
      value={value}
      height="100%"
      theme="light"
      extensions={[javascript({ typescript: true })]}
      onChange={onChange}
      editable={!readOnly}
      basicSetup={{
        lineNumbers: true,
        foldGutter: false,
        highlightActiveLine: true,
      }}
      className="h-full overflow-hidden border border-stone-300 bg-white text-[13px]"
    />
  );
}
