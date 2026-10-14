import { createRoot } from 'react-dom/client';
import '../src/styles/tokens.css';
import '../src/styles/base.css';
import { MessageMarkdown } from '../src/ui/worlds/chat/message/MessageMarkdown';

function AssistantRow({ content }: { content: string }) {
  return (
    <div className="msg-row assistant idle">
      <div className="message-turn assistant">
        <div className="message-turn-body assistant">
          <div className="message-turn-stack assistant">
            <div className="bubble-frame assistant idle">
              <div className="bubble assistant">
                <MessageMarkdown content={content} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function UserRow({ content }: { content: string }) {
  return (
    <div className="msg-row user idle">
      <div className="message-turn user">
        <div className="message-turn-body user">
          <div className="message-turn-stack user">
            <div className="bubble-frame user idle">
              <div className="bubble user">
                <MessageMarkdown content={content} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SystemNote({ content }: { content: string }) {
  return (
    <div className="msg-row system idle">
      <div className="system-inline-note">{content}</div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <div className="app-shell chat">
    <section className="world world-chat timeline-light">
      <div className="chat-flow-shell">
        <div className="chat-flow follow-latest generation-settled">
          <UserRow content="【今天怎么样？】" />
          <AssistantRow content={'（把灯调暗）【今天好累。】【早点睡吧。】'} />
          <SystemNote content="（通话结束：03:21）" />
          <AssistantRow content={'【今天就到这里吧。】\n\n（她把手机换成免提，声音软下来）【明天我叫你起床。】【不许偷偷熬夜。】'} />
        </div>
      </div>
    </section>
  </div>
);
