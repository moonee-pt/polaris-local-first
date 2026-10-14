import { readFileSync, writeFileSync } from 'node:fs';
const file = 'src/ui/worlds/group/GroupTimeline.tsx';
let text = readFileSync(file, 'utf8');
const CR = '\r\n';
function edit(find, replace) {
  const parts = text.split(find);
  if (parts.length - 1 !== 1) throw new Error('expected 1 match, got ' + (parts.length - 1) + ' :: ' + find.slice(0, 70));
  text = parts.join(replace);
}
edit(
  'export function GroupTimeline({ controller }: GroupTimelineProps) {',
  'export function GroupTimeline({ controller, voice }: GroupTimelineProps) {'
);
edit(
  '              controller={controller}' + CR + '              streaming={streaming}',
  '              controller={controller}' + CR + '              voice={voice}' + CR + '              streaming={streaming}'
);
const effect = [
  '  const voiceCandidates = useMemo(',
  '    () => timelineItems',
  "      .filter((item) => item.kind === 'member' && !item.streaming && Boolean(item.message.content.trim()))",
  '      .map((item) => ({',
  '        id: item.message.id,',
  '        content: item.message.content,',
  '        voiceCache: item.message.voiceCache ?? null',
  '      })),',
  '    [timelineItems]',
  '  );',
  "  const voiceCandidateKey = voiceCandidates.map((item) => item.id).join('|');",
  '  const seenAutoVoiceRef = useRef<{ groupId: string | null; ids: Set<string> }>({ groupId: null, ids: new Set() });',
  '  useEffect(() => {',
  '    if (!group) return;',
  '    const seen = seenAutoVoiceRef.current;',
  '    if (seen.groupId !== group.id) {',
  '      seenAutoVoiceRef.current = { groupId: group.id, ids: new Set(voiceCandidates.map((item) => item.id)) };',
  '      return;',
  '    }',
  '    const fresh = voiceCandidates.filter((item) => !seen.ids.has(item.id));',
  '    if (fresh.length === 0) return;',
  '    fresh.forEach((item) => seen.ids.add(item.id));',
  '    if (voice.enabled) fresh.forEach((item) => voice.enqueueAuto(item));',
  '  }, [group, voice, voiceCandidateKey]);'
].join(CR);
edit(
  '    return () => observer.disconnect();' + CR + '  }, [groupId, scrollToBottom]);',
  '    return () => observer.disconnect();' + CR + '  }, [groupId, scrollToBottom]);' + CR + CR + effect
);
writeFileSync(file, text);
console.log('OK GroupTimeline');
