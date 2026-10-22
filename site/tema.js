// Modo escuro opcional: o padrão é sempre o claro. Roda no <head> para a página já abrir no tema escolhido, sem piscar
const temaSalvo = (() => { try { return localStorage.getItem('tema') } catch { return null } })()
if (temaSalvo === 'escuro') document.documentElement.dataset.tema = 'escuro'
addEventListener('DOMContentLoaded', () => {
  const b = document.getElementById('tema-botao')
  if (!b) return
  const marcar = () => {
    const escuro = document.documentElement.dataset.tema === 'escuro'
    b.setAttribute('aria-pressed', escuro); b.firstElementChild.textContent = escuro ? '☀️' : '🌙'
    b.title = b.ariaLabel = escuro ? 'Voltar ao modo claro' : 'Modo escuro'
  }
  marcar()
  b.onclick = () => {
    const escuro = document.documentElement.dataset.tema !== 'escuro'
    if (escuro) document.documentElement.dataset.tema = 'escuro'; else delete document.documentElement.dataset.tema
    try { localStorage.setItem('tema', escuro ? 'escuro' : 'claro') } catch {}
    marcar()
  }
})
