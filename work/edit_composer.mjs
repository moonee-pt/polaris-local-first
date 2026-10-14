import { readFileSync, writeFileSync } from 'node:fs';
const file = 'src/ui/worlds/group/GroupComposer.tsx';
const CR = '\r\n';
let text = readFileSync(file, 'utf8');
function edit(find, replace, expect = 1) {
  const parts = text.split(find);
  const n = parts.length - 1;
  if (n !== expect) throw new Error('expected ' + expect + ' got ' + n + ' :: ' + find.slice(0, 60));
  text = parts.join(replace);
}
edit(
  "import { useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react';",
  "import { useEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react';"
);
edit(
  "  const fileInputRef = useRef<HTMLInputElement | null>(null);",
  "  const fileInputRef = useRef<HTMLInputElement | null>(null);" + CR + "  const resizeFrameRef = useRef<number | null>(null);"
);
const effect = [
  '  useEffect(() => {',
  '    const node = textareaRef.current;',
  '    if (!node) return;',
  '    if (resizeFrameRef.current !== null) cancelAnimationFrame(resizeFrameRef.current);',
  '    resizeFrameRef.current = requestAnimationFrame(() => {',
  '      resizeFrameRef.current = null;',
  "      node.style.height = 'auto';",
  '      node.style.height = `${Math.min(node.scrollHeight, 104)}px`;',
  '    });',
  '    return () => {',
  '      if (resizeFrameRef.current === null) return;',
  '      cancelAnimationFrame(resizeFrameRef.current);',
  '      resizeFrameRef.current = null;',
  '    };',
  '  }, [draft, group?.id]);',
  ''
].join(CR);
edit(
  '  }, [controller.memberPersonas, mentionQuery]);' + CR,
  '  }, [controller.memberPersonas, mentionQuery]);' + CR + CR + effect
);
const resizeFn = [
  '  const resizeTextarea = () => {',
  '    const node = textareaRef.current;',
  '    if (!node) return;',
  "    node.style.height = 'auto';",
  '    node.style.height = `${Math.min(node.scrollHeight, 104)}px`;',
  '  };',
  '',
  ''
].join(CR);
edit(resizeFn, '');
edit(
  '              controller.updateDraft(event.target.value);' + CR + '              resizeTextarea();',
  '              controller.updateDraft(event.target.value);'
);
writeFileSync(file, text);
console.log('OK composer');
