import { Puck } from '@puckeditor/core';
import '@puckeditor/core/puck.css';
import { puckConfig } from '@brisk/puck-config';
import { toPuckData } from '../lib/puck-data-mapper.js';
import { LoginForm } from './login-form.js';
import { usePageEditor } from './use-page-editor.js';

export function App() {
  const { page, status, needsLogin, handleLogin, handleChange, handlePublish } =
    usePageEditor();

  if (needsLogin) {
    return <LoginForm onLogin={handleLogin} />;
  }

  if (!page) {
    return <p>{status}</p>;
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '4px 12px', fontSize: 12, color: '#666' }}>
        {status}
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        <Puck
          config={puckConfig}
          data={toPuckData(page.content)}
          onChange={handleChange}
          onPublish={handlePublish}
        />
      </div>
    </div>
  );
}

export default App;
