import fs from "node:fs";

function patch(file, edits) {
  let text = fs.readFileSync(file, "utf8");
  const eol = text.includes("\r\n") ? "\r\n" : "\n";
  for (const [from, to] of edits) {
    const src = from.split("\n").join(eol);
    const dst = to.split("\n").join(eol);
    const count = text.split(src).length - 1;
    if (count !== 1) throw new Error(`anchor ${count}x in ${file}: ${src.slice(0, 60)}`);
    text = text.replace(src, dst);
  }
  fs.writeFileSync(file, text, "utf8");
  console.log("patched", file);
}

patch("src/ui/worlds/chat/message/MessageActions.tsx", [
  [
    "import { getAssistantAmbiencePlan } from './messageSpeechText';",
    "import { getAssistantAmbiencePlan } from './messageSpeechText';\nimport { registerAmbienceStop, stopOtherAmbiences } from '../../../../app/audio/ambienceRegistry';"
  ],
  [
    "  const autoSpeakRef = useRef<(() => void) | null>(null);",
    "  const autoSpeakRef = useRef<(() => void) | null>(null);\n  /** Auto read-aloud keeps its ambience alive after the clip ends. */\n  const autoPlaybackRef = useRef(false);"
  ],
  [
    "  useEffect(() => () => {\n    stopSpeechPlayback();\n  }, []);",
    "  useEffect(() => registerAmbienceStop(stopAmbience), [stopAmbience]);\n\n  useEffect(() => () => {\n    stopSpeechPlayback();\n  }, []);"
  ],
  [
    "    setSpeaking(false);\n    setSpeechLoading(false);\n  }\n\n  function applyMessageAmbience(measuredSec?: number) {\n    const plan = getAssistantAmbiencePlan(messageContent);\n    if (!plan.cues.length) return;\n    scheduleAmbience(plan.cues, measuredSec ?? plan.estimatedSec);\n  }",
    "    setSpeaking(false);\n    setSpeechLoading(false);\n  }\n\n  /** A clip that ended on its own: auto read-aloud leaves the ambience running,\n   *  a manual tap still tears it down. */\n  function finishSpeechPlayback() {\n    if (autoPlaybackRef.current) {\n      setSpeaking(false);\n      return;\n    }\n    stopSpeechPlayback();\n  }\n\n  function applyMessageAmbience(measuredSec?: number) {\n    const plan = getAssistantAmbiencePlan(messageContent);\n    if (!plan.cues.length) return;\n    stopOtherAmbiences(stopAmbience);\n    scheduleAmbience(plan.cues, measuredSec ?? plan.estimatedSec);\n  }"
  ],
  [
    "    utterance.onend = () => setSpeaking(false);\n    utterance.onerror = () => setSpeaking(false);",
    "    utterance.onend = () => finishSpeechPlayback();\n    utterance.onerror = () => finishSpeechPlayback();"
  ],
  [
    "      onEnded: () => stopSpeechPlayback(),",
    "      onEnded: () => finishSpeechPlayback(),"
  ],
  [
    "  const beginSpeech = () => {\n    const text = speakableContent;\n    if (!text) return;\n    primeChatSpeechAudio();",
    "  const beginSpeech = (auto = false) => {\n    const text = speakableContent;\n    if (!text) return;\n    autoPlaybackRef.current = auto;\n    primeChatSpeechAudio();"
  ],
  [
    "  autoSpeakRef.current = beginSpeech;",
    "  autoSpeakRef.current = () => beginSpeech(true);"
  ]
]);

patch("src/ui/worlds/ChatWorld.tsx", [
  [
    "import { useVoiceCallSession } from '../../app/call/voiceCallSession';",
    "import { stopAllAmbiences } from '../../app/audio/ambienceRegistry';\nimport { useVoiceCallSession } from '../../app/call/voiceCallSession';"
  ],
  [
    "  useEffect(() => () => {\n    useVoiceCallSession.getState().close();\n    useReadingSession.getState().close();\n  }, []);",
    "  const conversationId = stablePayload.conversation?.id ?? null;\n\n  // 换会话或离开对话世界时，把还在延续的音效一起静音。\n  useEffect(() => stopAllAmbiences, [conversationId]);\n\n  useEffect(() => {\n    if (!shell.isActiveWorld) stopAllAmbiences();\n  }, [shell.isActiveWorld]);\n\n  useEffect(() => () => {\n    useVoiceCallSession.getState().close();\n    useReadingSession.getState().close();\n  }, []);"
  ]
]);

patch("src/ui/worlds/group/useGroupVoice.ts", [
  [
    "import { playChatSpeechBlob, primeChatSpeechAudio, stopChatSpeechAudio } from '../../../app/chat/chatSpeechAudio';",
    "import { playChatSpeechBlob, primeChatSpeechAudio, stopChatSpeechAudio } from '../../../app/chat/chatSpeechAudio';\nimport { registerAmbienceStop, stopAllAmbiences, stopOtherAmbiences } from '../../../app/audio/ambienceRegistry';"
  ],
  [
    "  useEffect(() => () => {\n    tokenRef.current += 1;",
    "  useEffect(() => registerAmbienceStop(ambience.stop), [ambience.stop]);\n\n  useEffect(() => () => {\n    tokenRef.current += 1;"
  ],
  [
    "    const plan = getAssistantAmbiencePlan(message?.content ?? '');\n    if (plan.cues.length) ambience.schedule(plan.cues, plan.estimatedSec);",
    "    const plan = getAssistantAmbiencePlan(message?.content ?? '');\n    if (plan.cues.length) {\n      stopOtherAmbiences(ambience.stop);\n      ambience.schedule(plan.cues, plan.estimatedSec);\n    }"
  ],
  [
    "        if (plan.cues.length) ambience.schedule(plan.cues, durationSec || plan.estimatedSec);",
    "        if (plan.cues.length) {\n          stopOtherAmbiences(ambience.stop);\n          ambience.schedule(plan.cues, durationSec || plan.estimatedSec);\n        }"
  ],
  [
    "    ambience.stop();\n    ambience.setDucked(false);\n  };\n  stopAllRef.current = stopAll;",
    "    stopAllAmbiences();\n    ambience.setDucked(false);\n  };\n  stopAllRef.current = stopAll;"
  ]
]);
