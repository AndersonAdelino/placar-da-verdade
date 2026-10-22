// Lista os avisos de "Achou erro nesta checagem?" (KV CONTESTACOES), do mais antigo ao mais novo. Uso: npm run contestacoes
import { execFileSync } from 'node:child_process'
const wr = (...a) => execFileSync(process.execPath, ['node_modules/wrangler/bin/wrangler.js', 'kv', ...a, '--binding', 'CONTESTACOES', '--remote'], { encoding: 'utf8' })
const chaves = JSON.parse(wr('key', 'list'))
for (const { name } of chaves) {
  const a = JSON.parse(wr('key', 'get', name))
  console.log(`\n[${a.em.slice(0, 16)}] ${a.debate} · ${a.quem} · ${a.veredito} · #fato-${a.id}\n  Fala: ${a.afirmacao}\n  Aviso: ${a.texto}${a.link ? `\n  Link: ${a.link}` : ''}`)
}
console.log(`\n${chaves.length} aviso(s)`)
