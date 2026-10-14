import { createRoot } from 'react-dom/client';
import '../src/styles/tokens.css';
import '../src/styles/base.css';
import '../src/styles/shell.css';
import '../src/styles/voice-call.css';
import { Icon } from '../src/ui/Icon';

function Real() {
  return (
    <div className="topbar-actions">
      <button type="button" className="action-btn icon-btn topbar-call-btn"><Icon name="phone" size={17} /></button>
      <button type="button" className="action-btn icon-btn topbar-reading-btn"><Icon name="openBook" size={19} /></button>
      <button type="button" className="action-btn icon-btn topbar-new-chat-btn topbar-collaborator-settings-btn"><Icon name="persona" size={19} /></button>
    </div>
  );
}

function Before() {
  const b = (cls: string, name: any, s: number) => (
    <button type="button" className={`action-btn icon-btn ${cls}`} style={{ width: 44, minWidth: 44 }}><Icon name={name} size={s} /></button>
  );
  return (
    <div className="topbar-actions" style={{ gap: 7 }}>
      {b('topbar-call-btn', 'phone', 18)}
      {b('topbar-reading-btn', 'openBook', 18)}
      {b('topbar-new-chat-btn', 'persona', 18)}
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <div className="app-shell chat" style={{ background: '#fff', fontFamily: 'system-ui, sans-serif', padding: 16 }}>
    <div style={{ fontSize: 12, color: '#8a8a8a', marginBottom: 8 }}>改后（真实 CSS）</div>
    <Real />
    <div style={{ fontSize: 12, color: '#8a8a8a', margin: '26px 0 8px' }}>改前（对照）</div>
    <Before />
  </div>
);
