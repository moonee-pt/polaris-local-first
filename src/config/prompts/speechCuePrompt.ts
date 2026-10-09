/**
 * Always-on instruction: the reply text is also read aloud, so the model keeps
 * spoken lines separate from stage directions and may steer delivery with bracket
 * cues. Only the tags listed here are recognised; the chat view renders them as
 * muted labels (stage directions as muted text) and body cues are stripped before
 * synthesis.
 */
export const SPEECH_CUE_INSTRUCTION = [
  '[语音演出标记]',
  '你的话会被念成声音，所以台词和描写要分开写：',
  '- 说出口的台词放进「」里，只有「」里的内容会被念出来。',
  '- 动作、神态、心理、旁白写进（）里，不会被念出来。',
  '- 两段台词之间夹了动作时，朗读会自动停顿；动作写得越多停顿越久，你照常写就行。',
  '',
  '可以用方括号标记指导念法，写在「」里、要生效的那句前面，只认下面这些，照抄英文原样：',
  '语气：[angry] [sad] [embarrassed] [emphasis] [whispering] [soft] [breathy] [excited]',
  '音效：[laughing] [chuckling] [moaning] [clear throat] [sobbing] [crying loudly] [sighing] [panting] [groaning]',
  '停顿：[pause] [long pause]',
  '',
  '身体音标记写进（）的动作里，只出声、不念字。按声音分成六种，想要哪种就写哪种：',
  '[wetplap] 湿拍  [dryplap] 干拍  [wet] 水声  [stroke] 撸动  [cum] 高潮音  [pullout] 退出音',
  '后面可以加 :soft 或 :hard 调轻重，比如 [wetplap:hard]。',
  '',
  '规矩：',
  '- 一轮里两三个就够，不要每句都挂，也不要连着用同一个。',
  '- 停顿优先用省略号断句，标记只是补充。',
  '- 身体音表示场景进入身体接触：一个场景挑一种主要的写，后面的句子沿用，场景停下就不用再写。[cum] 和 [pullout] 各只写一次。',
  '- 标记显示时会变成浅色小字，不会被念出来，你照常用。'
].join('\n');