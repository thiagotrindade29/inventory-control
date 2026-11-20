import { useState } from 'react'
import { api, setAuthSession } from '../services/api.js'

export default function AuthView({ setupRequired, onAuthenticated }) {
  const [isSetup, setIsSetup] = useState(setupRequired)
  const [form, setForm] = useState({ email: '', password: '', displayName: '', bootstrapKey: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
    setError('')
  }

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const session = isSetup
        ? await api.setupAdmin(form)
        : await api.login({ email: form.email, password: form.password })
      setAuthSession(session)
      onAuthenticated(session)
    } catch (err) {
      const details = err.data?.errors
      setError(Array.isArray(details) ? details.join(' ') : err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="auth-screen">
      <section className="auth-card" aria-labelledby="auth-title">
        <div className="auth-brand">
          <div className="brand-logo">CE</div>
          <span>Casa Financeira</span>
        </div>
        <p className="auth-eyebrow">CONTROLE DE ESTOQUE E FINANÇAS</p>
        <h1 id="auth-title">{isSetup ? 'Configure sua conta' : 'Bem-vindo de volta'}</h1>
        <p className="auth-description">
          {isSetup
            ? 'Crie a conta administradora para proteger o acesso ao seu inventário.'
            : 'Entre com seu e-mail e senha para acessar seu inventário.'}
        </p>

        <form className="auth-form" onSubmit={submit}>
          {isSetup && <>
            <label>Chave de configuração
              <input autoComplete="off" required minLength={24} value={form.bootstrapKey} onChange={(e) => update('bootstrapKey', e.target.value)} />
              <small>Chave definida no User Secrets do backend. Usada apenas uma vez.</small>
            </label>
            <label>Seu nome
              <input autoComplete="name" required minLength={2} maxLength={120} value={form.displayName} onChange={(e) => update('displayName', e.target.value)} />
            </label>
          </>}
          <label>E-mail
            <input type="email" autoComplete="email" required maxLength={256} value={form.email} onChange={(e) => update('email', e.target.value)} />
          </label>
          <label>Senha
            <input type="password" autoComplete={isSetup ? 'new-password' : 'current-password'} required minLength={isSetup ? 12 : 1} maxLength={128} value={form.password} onChange={(e) => update('password', e.target.value)} />
            {isSetup && <small>Use ao menos 12 caracteres, incluindo maiúscula, minúscula, número e símbolo.</small>}
          </label>
          {error && <div className="auth-error" role="alert">{error}</div>}
          <button className="btn btn-primary auth-submit" type="submit" disabled={busy}>
            {busy ? 'Aguarde…' : isSetup ? 'Criar conta administradora' : 'Entrar'}
          </button>
        </form>
        {!setupRequired && <p className="auth-security-note">A sessão fica ativa apenas nesta aba e expira após 20 minutos.</p>}
      </section>
    </main>
  )
}
