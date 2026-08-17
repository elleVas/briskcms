import { useState } from 'react';
import { Puck } from '@puckeditor/core';
import '@puckeditor/core/puck.css';
import { puckConfig } from '@brisk/puck-config';
import { toPuckData } from '../lib/puck-data-mapper.js';
import { Button } from '../components/ui/button.js';
import { ForgotPasswordForm } from './forgot-password-form.js';
import { LoginForm } from './login-form.js';
import { ResetPasswordForm } from './reset-password-form.js';
import { usePageEditor } from './use-page-editor.js';
import { VerifyEmailView } from './verify-email-view.js';

export function App() {
  const {
    page,
    status,
    needsLogin,
    handleLogin,
    handleLogout,
    handleChange,
    handlePublish,
  } = usePageEditor();
  const [authView, setAuthView] = useState<'login' | 'forgot-password'>(
    'login',
  );

  // Public flows, independent of session state — a user following an
  // email link isn't necessarily authenticated yet.
  const searchParams = new URLSearchParams(window.location.search);
  const resetToken = searchParams.get('resetToken');
  const verifyToken = searchParams.get('verifyToken');
  if (resetToken) {
    return <ResetPasswordForm token={resetToken} />;
  }
  if (verifyToken) {
    return <VerifyEmailView token={verifyToken} />;
  }

  if (needsLogin) {
    if (authView === 'forgot-password') {
      return <ForgotPasswordForm onBackToLogin={() => setAuthView('login')} />;
    }
    return (
      <LoginForm
        onLogin={handleLogin}
        onForgotPassword={() => setAuthView('forgot-password')}
      />
    );
  }

  if (!page) {
    return <p>{status}</p>;
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div className="flex items-center justify-between border-b px-3 py-1 text-xs text-muted-foreground">
        <span>{status}</span>
        <Button variant="ghost" size="sm" onClick={handleLogout}>
          Esci
        </Button>
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
