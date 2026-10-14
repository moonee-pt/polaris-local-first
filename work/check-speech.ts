import { buildAssistantSpeechText } from '../src/ui/worlds/chat/message/messageSpeechText';
const cases: Array<[string, string]> = [
  ['call 【】 format', '【你好呀。】（她笑了笑，[wetplap]）【今天怎么样？】'],
  ['plain + stage', '（她笑了笑）你来了，坐吧。'],
  ['quote fallback', '「我在。」（她轻轻笑）'],
  ['plain only', '很普通的一句话。'],
  ['mixed bracket + quote', '【别闹。】他压低声音：「你再这样我就走了。」']
];
for (const [name, input] of cases) {
  console.log(JSON.stringify(name), '=>', JSON.stringify(buildAssistantSpeechText(input)));
}
