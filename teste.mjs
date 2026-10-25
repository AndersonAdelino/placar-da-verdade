// Checagem do filtro de datas da busca (o que é "futuro" na simulação). Rode: node teste.mjs
const src = (await import('node:fs')).readFileSync(new URL('robo.mjs', import.meta.url), 'utf8')
const fn = src.slice(src.indexOf('const MESES'), src.indexOf('async function buscar'))
const depoisDe = new Function(fn + 'return depoisDe')()
const L = new Date('2022-10-16T23:00:00Z')
const casos = [
  ['https://g1.globo.com/x/noticia/2022/10/17/fato.ghtml', '', '', true],
  ['https://g1.globo.com/x/noticia/2019/04/15/a.ghtml', '', '', false],
  ['https://www.cnnbrasil.com.br/politica/fatos-lula', 'Fatos', 'da CNN 18/10/22 às 19:44 texto', true],
  ['https://www.cnnbrasil.com.br/politica/fatos-lula', 'Fatos', 'da CNN 18/10/2022 às 19:44', true],
  ['https://exemplo.com/a', 'X', 'publicado em 17 de outubro de 2022', true],
  ['https://exemplo.com/a', 'X', 'publicado em 1 de outubro de 2022', false], // mês por extenso estava um mês adiantado
  ['https://exemplo.com/a', 'X', 'publicado em 01/10/2022', false],
  ['https://exemplo.com/a', 'Salário mínimo de R$ 1.741 em 2027', '', true],
  ['https://exemplo.com/a', 'Histórico', 'de 2003 a 2016 o mínimo subiu', false],
]
for (const [u, t, c, esperado] of casos) console.log(depoisDe(L, u, t, c) === esperado ? 'ok ' : 'ERRO', u, t, c)

// Trava de fala repetida: frase contrária ou negada não pode sumir como "repetida"
const rep = src.slice(src.indexOf('const palavras'), src.indexOf('const checadas'))
const repetida = new Function(rep + 'return repetida')()
const lista = { 1: ['O desemprego caiu de 12 para 8 por cento'] }
for (const [frase, esperado] of [
  ['O desemprego caiu de 12 para 8 por cento.', true],
  ['O desemprego caiu de 12 para 8%', true],
  ['O desemprego subiu de 8 para 12 por cento', false],
  ['O desemprego não caiu de 12 para 8 por cento', false],
]) console.log(repetida('1', frase, lista) === esperado ? 'ok ' : 'ERRO', frase)
