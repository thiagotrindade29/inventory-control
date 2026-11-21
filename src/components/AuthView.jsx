import { useState } from 'react'
import '../Auth.css'
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
    <main className="auth-screen auth-spatial">
      <div className="auth-layout">
        <section className="auth-hero" aria-label="AstroGestão">
          <div className="auth-brand auth-brand-hero">
            <img className="auth-logo" src="/astrogestao.svg" alt="" aria-hidden="true" />
            <span>AstroGestão</span>
          </div>
          <div className="auth-hero-copy">
            <p className="auth-eyebrow">SEU ESPAÇO, SOB CONTROLE</p>
            <h2>Organize seu estoque.<br /><span>Tenha clareza para decidir.</span></h2>
            <p>Produtos, movimentações e gastos reunidos em um só lugar.</p>
          </div>
        </section>

        <section className="auth-form-panel" aria-labelledby="auth-title">
          <div className="auth-mobile-brand">
            <img className="auth-logo" src="/astrogestao.svg" alt="" aria-hidden="true" />
            <span>AstroGestão</span>
            <span className="auth-mobile-badge">{isSetup ? 'PRIMEIRO ACESSO' : 'ACESSO SEGURO'}</span>
          </div>

          <div className="auth-card">
            <p className="auth-eyebrow">{isSetup ? 'CONFIGURAÇÃO INICIAL' : 'BEM-VINDO DE VOLTA'}</p>
            <h1 id="auth-title">{isSetup ? 'Crie sua conta' : 'Entre na sua conta'}</h1>
            <p className="auth-description">
              {isSetup
                ? 'Crie a conta administradora para proteger o acesso ao seu inventário.'
                : 'Acesse seu inventário usando seu e-mail e senha.'}
            </p>

            <form className="auth-form" onSubmit={submit}>
              {isSetup && <>
                <label>Chave de configuração (Auth__BootstrapKey)
                  <input type="password" autoComplete="off" required minLength={32} maxLength={128} placeholder="Cole a chave configurada no Render" value={form.bootstrapKey} onChange={(e) => update('bootstrapKey', e.target.value)} />
                  <small>Informe exatamente o valor da variável Auth__BootstrapKey no Web Service da API. A chave de User Secrets local é diferente. Usada uma vez para criar o primeiro administrador.</small>
                </label>
                <label>Seu nome
                  <input autoComplete="name" required minLength={2} maxLength={120} value={form.displayName} onChange={(e) => update('displayName', e.target.value)} />
                </label>
              </>}
              <label>E-mail
                <input type="email" autoComplete="email" required maxLength={256} placeholder="seu@email.com" value={form.email} onChange={(e) => update('email', e.target.value)} />
              </label>
              <label>Senha
                <input type="password" autoComplete={isSetup ? 'new-password' : 'current-password'} required minLength={isSetup ? 12 : 1} maxLength={128} placeholder={isSetup ? 'Crie uma senha segura' : 'Digite sua senha'} value={form.password} onChange={(e) => update('password', e.target.value)} />
                {isSetup && <small>Use ao menos 12 caracteres, incluindo maiúscula, minúscula, número e símbolo.</small>}
              </label>
              {error && <div className="auth-error" role="alert">{error}</div>}
              <button className="btn btn-primary auth-submit" type="submit" disabled={busy}>
                {busy ? 'Aguarde…' : isSetup ? 'Criar conta administradora' : 'Entrar'}
              </button>
            </form>
            {!setupRequired && <p className="auth-security-note">Sua sessão expira após 20 minutos de acesso.</p>}
            <p className="auth-terms">Acesso privado ao inventário desta instalação.</p>
          </div>
        </section>
      </div>
      <footer className="auth-copyright">© {new Date().getFullYear()} AstroGestão</footer>
    </main>
  )
}
