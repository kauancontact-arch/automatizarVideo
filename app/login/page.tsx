'use client';

import { useState } from 'react';

export default function Login() {
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [indo, setIndo] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setIndo(true);
    setErro('');

    const r = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ senha }),
    });

    if (r.ok) window.location.href = '/flows';
    else {
      setErro('Senha incorreta.');
      setIndo(false);
    }
  }

  return (
    <form onSubmit={entrar} style={{ maxWidth: 320, margin: '80px auto' }}>
      <h1>automatizarVideo</h1>
      <p className="sub">Entre para continuar.</p>
      <input
        type="password"
        value={senha}
        onChange={(e) => setSenha(e.target.value)}
        placeholder="Senha"
        autoFocus
      />
      {erro && <p style={{ color: 'var(--erro)', fontSize: 13 }}>{erro}</p>}
      <button type="submit" disabled={indo} style={{ marginTop: 12, width: '100%' }}>
        {indo ? 'Entrando...' : 'Entrar'}
      </button>
    </form>
  );
}
