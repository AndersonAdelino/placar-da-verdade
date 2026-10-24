// Resumão dos debates: lê os placares revisados e mostra os dois debates juntos ou um de cada vez
const BASE = 'https://placar-dados.zenithonacademy.com.br/'
const DEBATES = { '2026-10-18': '18/10 · Band', '2026-10-23': '23/10 · Globo' }
const ROTULO = { verdadeiro: 'Verdadeiro', impreciso: 'Impreciso', falso: 'Falso', sem_dados: 'Sem dados', em_revisao: 'Em revisão' }
const $ = id => document.getElementById(id)
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`)
// Mesmo id do app.js: o link #fato-id abre a checagem no placar daquele debate
const idDe = x => x.t.toString(36) + x.quem + [...String(x.afirmacao)].reduce((s, c) => (s * 31 + c.charCodeAt(0)) >>> 0, 7).toString(36)
const CAMPOS = ['verdadeiro', 'impreciso', 'falso', 'sem_dados', 'propostas', 'ataques']
let dados = {}, escolha = 'todos'

const soma = q => Object.fromEntries(CAMPOS.map(k => [k, debates().reduce((s, d) => s + (dados[d].candidatos[q][k] ?? 0), 0)]))
const debates = () => escolha === 'todos' ? Object.keys(DEBATES) : [escolha]
const erro = c => { const t = c.verdadeiro + c.impreciso + c.falso; return t ? (c.falso + c.impreciso / 2) / t : 0 }
const pct = c => Math.round(erro(c) * 100)
const falas = () => debates().flatMap(d => dados[d].fatos.flatMap(f => f.declaracoes).map(x => ({ ...x, debate: d })))
const link = x => `./?d=${x.debate}#fato-${idDe(x)}`

function desenhar() {
  const nomes = { 1: dados['2026-10-23'].candidatos['1'].nome, 2: dados['2026-10-23'].candidatos['2'].nome }
  const A = soma('1'), B = soma('2'), dif = erro(B) - erro(A)
  // Ponteiro: esquerda = Lula erra mais, direita = Flávio erra mais (mesma regra do placar)
  $('medidor').innerHTML = `<svg viewBox="0 0 320 190" role="img" aria-label="Mentirômetro: ${esc(nomes[1])} ${pct(A)}% de erro, ${esc(nomes[2])} ${pct(B)}%">
      <path d="M30 160 A130 130 0 0 1 290 160" fill="none" stroke="var(--borda)" stroke-width="26"/>
      <path d="M30 160 A130 130 0 0 1 95 47.4" fill="none" stroke="var(--falso)" stroke-width="26"/>
      <path d="M225 47.4 A130 130 0 0 1 290 160" fill="none" stroke="var(--falso)" stroke-width="26"/>
      <g class="ponteiro" style="transform: rotate(${dif * 90}deg)"><line x1="160" y1="160" x2="160" y2="44" stroke="var(--tinta)" stroke-width="5" stroke-linecap="round"/></g>
      <circle cx="160" cy="160" r="10" fill="var(--tinta)"/>
      <text x="4" y="186" font-size="13" font-weight="800" fill="var(--tinta)" text-anchor="start">${esc(nomes[1])}</text>
      <text x="316" y="186" font-size="13" font-weight="800" fill="var(--tinta)" text-anchor="end">${esc(nomes[2])}</text></svg>
    <p class="veredito-texto">${Math.abs(dif) < 0.1 ? 'Empate técnico<small>os dois erraram parecido</small>' : `${esc(nomes[dif > 0 ? 2 : 1])} errou mais<small>${pct(dif > 0 ? B : A)}% contra ${pct(dif > 0 ? A : B)}% de índice de erro</small>`}</p>`
  $('cands').innerHTML = [['1', A], ['2', B]].map(([q, c]) => { const t = c.verdadeiro + c.impreciso + c.falso || 1
    return `<div class="cand"><h3>${esc(nomes[q])}</h3><div class="pct">${pct(c)}<small>% de erro</small></div>
      <div class="barra" role="img" aria-label="${c.verdadeiro} verdadeiros, ${c.impreciso} imprecisos, ${c.falso} falsos"><span class="v" style="flex-grow:${c.verdadeiro / t}"></span><span class="i" style="flex-grow:${c.impreciso / t}"></span><span class="f" style="flex-grow:${c.falso / t}"></span></div>
      <div class="contagem">${c.verdadeiro} verdadeiros · ${c.impreciso} imprecisos · ${c.falso} falsos · ${c.sem_dados} sem dados</div>
      ${escolha === 'todos' ? `<div class="contagem">${Object.keys(DEBATES).map(d => `${DEBATES[d].split(' ')[0]}: ${pct(dados[d].candidatos[q])}%`).join(' · ')}</div>` : ''}</div>` }).join('')
  $('tom').innerHTML = [['1', A], ['2', B]].map(([q, c]) => `<div class="cand"><h3>${esc(nomes[q])}</h3>
      <div class="numeros"><div class="p"><b>${c.propostas}</b>propostas</div><div class="a"><b>${c.ataques}</b>ataques</div></div>
      <div class="tom" role="img" aria-label="${c.propostas} propostas e ${c.ataques} ataques"><span class="p" style="flex-grow:${c.propostas}"></span><span class="a" style="flex-grow:${c.ataques}"></span></div></div>`).join('')
  const lista = arr => arr.length ? `<ul class="falas">${arr.map(x => `<li><a href="${link(x)}"><span class="tecla ${x.veredito} ${x.veredito[0]}">${ROTULO[x.veredito] ?? x.veredito}</span></a><span class="data">${DEBATES[x.debate]}</span>
      <p><a href="${link(x)}">“${esc(x.afirmacao)}”</a></p>${x.motivo ? `<p class="motivo">${esc(x.motivo)}</p>` : ''}</li>`).join('')}</ul>` : '<p class="vazio">Nenhuma fala falsa.</p>'
  const todas = falas()
  $('falsos').innerHTML = ['1', '2'].map(q => `<div><h3>${esc(nomes[q])}</h3>${lista(todas.filter(x => x.quem === q && x.veredito === 'falso'))}</div>`).join('')
  const rep = falas().filter(x => x.ja_checado)
  $('repetidas').innerHTML = rep.length ? rep.map(x => `<li><span class="tecla ${x.veredito} ${x.veredito[0]}">${ROTULO[x.veredito] ?? x.veredito}</span><b>${esc(nomes[x.quem])}</b>
      <p><a href="${link(x)}">“${esc(x.afirmacao)}”</a></p></li>`).join('') : '<li class="vazio">Nenhuma fala repetida neste recorte.</li>'
  const texto = `Os 2 debates do 2º turno em números (checagem com fonte em cada fala):\n${nomes[1]}: ${pct(A)}% de erro, ${A.propostas} propostas, ${A.ataques} ataques\n${nomes[2]}: ${pct(B)}% de erro, ${B.propostas} propostas, ${B.ataques} ataques\n\nVeja fala por fala: ${location.origin}/resumo`
  $('r-zap').href = `https://wa.me/?text=${encodeURIComponent(texto)}`
  $('r-mais').hidden = !navigator.share
  $('r-mais').onclick = () => navigator.share({ title: 'Resumão dos debates', text: texto }).catch(() => {})
}

// Card vertical (1080x1920) com os dois debates, para Stories e Status (sempre os 2 debates, sem filtro)
async function card() {
  await document.fonts.load('900 10px Archivo').catch(() => {})
  const W = 1080, H = 1920, M = 90, cv = document.createElement('canvas'), g = cv.getContext('2d')
  cv.width = W; cv.height = H
  const fonte = (peso, px, estreita) => { g.font = `${peso} ${px}px Archivo, system-ui, sans-serif`; g.fontStretch = estreita ? 'extra-condensed' : 'normal' }
  const c = { 1: dados['2026-10-23'].candidatos['1'], 2: dados['2026-10-23'].candidatos['2'] }
  const tot = q => Object.fromEntries(CAMPOS.map(k => [k, Object.keys(DEBATES).reduce((s, d) => s + (dados[d].candidatos[q][k] ?? 0), 0)]))
  const A = tot('1'), B = tot('2')
  g.fillStyle = '#e4e6e3'; g.fillRect(0, 0, W, H)
  g.fillStyle = '#fbfbf8'; g.beginPath(); g.roundRect(40, 40, W - 80, H - 80, 36); g.fill()
  g.fillStyle = '#1b1d1c'; fonte(900, 110, true); g.fillText('Placar da Verdade', M, 210)
  g.fillStyle = '#5e625f'; fonte(400, 38); g.fillText('Debates do 2º turno · 18/10 e 23/10 · revisados', M, 275)
  g.fillStyle = '#1b1d1c'; fonte(900, 96, true); g.fillText('Os 2 debates em números', M, 420)
  const cA = W / 2 + 150, cB = W - M
  fonte(800, 46, true); g.textAlign = 'right'; g.fillText(c[1].nome, cA, 530); g.fillText(c[2].nome, cB, 530); g.textAlign = 'left'
  const linhas = [['Índice de erro', pct(A) + '%', pct(B) + '%', '#c62828'], ['Falsos', A.falso, B.falso, '#c62828'], ['Verdadeiros', A.verdadeiro, B.verdadeiro, '#1d8a4a'],
    ['Propostas', A.propostas, B.propostas, '#2457a6'], ['Ataques', A.ataques, B.ataques, '#b5367a']]
  linhas.forEach(([rotulo, va, vb, cor], i) => {
    const y = 680 + i * 210
    g.fillStyle = '#b9bdb8'; g.fillRect(M, y - 150, W - 2 * M, 3)
    g.fillStyle = '#1b1d1c'; fonte(800, 52, true); g.fillText(rotulo, M, y - 40)
    g.fillStyle = cor; fonte(900, 130, true); g.textAlign = 'right'; g.fillText(String(va), cA, y); g.fillText(String(vb), cB, y); g.textAlign = 'left'
  })
  g.textAlign = 'center'
  g.fillStyle = '#1b1d1c'; fonte(800, 44); g.fillText('Confere fala por fala, com a fonte:', W / 2, H - 240)
  fonte(900, 64, true); g.fillText(`${location.host}/resumo`, W / 2, H - 170)
  g.fillStyle = '#5e625f'; fonte(400, 34); g.fillText('Checagem automática por IA, revisada. Confira a fonte.', W / 2, H - 110)
  return new Promise(ok => cv.toBlob(ok, 'image/png'))
}
$('r-imagem').onclick = async () => {
  const b = await card(), f = new File([b], 'resumao-debates.png', { type: 'image/png' })
  if (navigator.canShare?.({ files: [f] })) return navigator.share({ files: [f], title: 'Resumão dos debates' }).catch(() => {})
  const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = f.name; a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 5000)
}

document.querySelector('.filtro').addEventListener('click', e => {
  const b = e.target.closest('[data-debate]')
  if (!b || !Object.keys(dados).length) return
  escolha = b.dataset.debate
  for (const x of document.querySelectorAll('[data-debate]')) x.setAttribute('aria-pressed', x === b)
  desenhar()
})

Promise.all(Object.keys(DEBATES).map(d => fetch(`${BASE}placar-${d}.json?t=${Math.floor(Date.now() / 60000)}`).then(r => r.json()).then(j => [d, j])))
  .then(lista => { dados = Object.fromEntries(lista); desenhar() })
  .catch(() => { $('medidor').innerHTML = '<p class="vazio">Não deu para carregar os dados agora. Tente de novo em instantes.</p>' })
