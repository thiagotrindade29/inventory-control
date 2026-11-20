import { useEffect, useState } from 'react'
import { api } from '../services/api.js'

export default function UsersView() {
  const [users, setUsers] = useState([])
  const [form, setForm] = useState({ displayName: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  async function refresh() {
    setUsers(await api.getUsers())
  }

  useEffect(() => { refresh().catch((err) => setError(err.message)) }, [])

  async function createUser(event) {
    event.preventDefault()
    setError('')
    setNotice('')
    setBusy(true)
    try {
      await api.createUser(form)
      setForm({ displayName: '', email: '', password: '' })
      setNotice('Acesso criado. Compartilhe a senha inicial com a pessoa por um canal seguro.')
      await refresh()
    } catch (err) {
      setError(Array.isArray(err.data?.errors) ? err.data.errors.join(' ') : err.message)
    } finally {
      setBusy(false)
    }
  }

  async function removeUser(user) {
    if (!window.confirm(`Remover o acesso de ${user.displayName} (${user.email})?`)) return
    try {
      await api.deleteUser(user.id)
      setUsers((current) => current.filter((item) => item.id !== user.id))
    } catch (err) {
      setError(err.message)
    }
  }

  return <div className="view-stack">
    <div className="view-header"><div><h1>Usuários e acessos</h1><p>Gerencie quem pode entrar neste inventário compartilhado.</p></div></div>
    <section className="panel users-panel">
      <h2>Adicionar usuário</h2>
      <form className="user-create-form" onSubmit={createUser}>
        <label>Nome<input required minLength={2} maxLength={120} value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} /></label>
        <label>E-mail<input required type="email" maxLength={256} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
        <label>Senha inicial<input required type="password" minLength={12} maxLength={128} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /><small>Mínimo 12 caracteres, com maiúscula, minúscula, número e símbolo.</small></label>
        <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? 'Criando…' : 'Criar acesso'}</button>
      </form>
      {error && <p className="auth-error" role="alert">{error}</p>}
      {notice && <p className="users-notice" role="status">{notice}</p>}
    </section>
    <section className="panel users-panel">
      <h2>Contas cadastradas</h2>
      <div className="users-list">{users.map((user) => <article className="user-row" key={user.id}>
        <div><strong>{user.displayName}</strong><span>{user.email}</span></div>
        <button className="btn btn-sm btn-danger" type="button" onClick={() => removeUser(user)}>Remover</button>
      </article>)}</div>
    </section>
  </div>
}
