// Contador de quem está com o site aberto agora. Cada aba abre um WebSocket em /ao-vivo;
// um único Durable Object guarda as conexões (hibernando, sem custo parado) e a cada 5s
// manda o total para todo mundo. Pelo mesmo canal chegam as reações (emoji), somadas e devolvidas a cada 1,5s.
// /contestar recebe o "Achou erro nesta checagem?". O resto do site são arquivos estáticos que nem passam por aqui.
import { DurableObject } from 'cloudflare:workers'

// Só abas do próprio site contam (ao trocar de domínio, adicionar aqui e no site/_headers)
const ORIGENS = ['https://placardaverdade.com.br', 'https://www.placardaverdade.com.br', 'https://placar.zenithonacademy.com.br', 'https://placar-da-verdade.zenithon.workers.dev']
// Contra quem abre milhares de conexões para inflar o número ou derrubar o contador.
// Alto por IP porque operadora de celular põe muita gente atrás do mesmo IP (CGNAT).
const POR_IP = 50, TOTAL = 30000
// Desligar as reações: false + npm run deploy (o site esconde os botões quando o servidor não as anuncia)
const REACOES = true, EMOJIS = 5

export class Contador extends DurableObject {
  recentes = new Map() // ip → última visita contada (só em memória: se o objeto dormir, zera, e tudo bem)
  // ponytail: reações somadas só em memória; se o objeto hibernar entre uma reação e o envio, aquele lote se perde (é só emoji)
  soma = new Array(EMOJIS).fill(0)
  async fetch(req) {
    const ip = req.headers.get('CF-Connecting-IP') ?? '?'
    if (this.ctx.getWebSockets(ip).length >= POR_IP || this.ctx.getWebSockets().length >= TOTAL)
      return new Response('Muitas conexões', { status: 429 })
    // Visita = abrir a página (reconexão não conta). Mesmo IP só conta de novo depois de 10 min,
    // para recarregar a página sem parar não inflar o número
    if (new URL(req.url).searchParams.has('nova') && Date.now() - (this.recentes.get(ip) ?? 0) > 600_000) {
      this.recentes.set(ip, Date.now())
      if (this.recentes.size > 50_000) this.recentes.clear()
      await this.ctx.storage.put('visitas', ((await this.ctx.storage.get('visitas')) ?? 0) + 1)
    }
    const [cliente, servidor] = Object.values(new WebSocketPair())
    this.ctx.acceptWebSocket(servidor, [ip])
    await this.agendar()
    return new Response(null, { status: 101, webSocket: cliente })
  }
  // Reação: a aba manda no máximo 1 lote por segundo, ex. [0,2,0,0,1] (quantas de cada emoji)
  async webSocketMessage(ws, msg) {
    if (!REACOES) return
    const agora = Date.now(), ultimo = ws.deserializeAttachment() ?? 0
    if (agora - ultimo < 800) return // mais rápido que isso é robô: ignora
    ws.serializeAttachment(agora)
    let r; try { r = JSON.parse(msg).r } catch { return }
    if (!Array.isArray(r) || r.length !== EMOJIS) return
    for (let i = 0; i < EMOJIS; i++) this.soma[i] += Math.min(5, Math.max(0, Math.floor(+r[i] || 0)))
    await this.agendar(1500)
  }
  async webSocketClose() { await this.agendar() }
  async webSocketError() { await this.agendar() }
  // Junta entradas e saídas numa transmissão só, a cada 5s (senão 10 mil entradas = 10 mil × 10 mil mensagens)
  async agendar(ms = 5000) {
    const atual = await this.ctx.storage.getAlarm()
    if (!atual || atual > Date.now() + ms) await this.ctx.storage.setAlarm(Date.now() + ms)
  }
  async alarm() {
    const conexoes = this.ctx.getWebSockets()
    const r = this.soma.some(Boolean) ? this.soma : undefined
    this.soma = new Array(EMOJIS).fill(0)
    const msg = JSON.stringify({ agora: conexoes.length, visitas: (await this.ctx.storage.get('visitas')) ?? 0, reacoes: REACOES, r })
    // ponytail: um objeto só aguenta dezenas de milhares de conexões; acima disso, dividir em vários e somar
    for (const ws of conexoes) try { ws.send(msg) } catch {}
  }
}

// "Achou erro nesta checagem?": guarda o aviso para a revisão pós-debate. Não guarda IP nem nada de quem enviou
async function contestar(req, env) {
  if (req.method !== 'POST') return new Response('Use POST', { status: 405 })
  if (!ORIGENS.includes(req.headers.get('Origin'))) return new Response('Origem não permitida', { status: 403 })
  const { success } = await env.LIMITE.limit({ key: req.headers.get('CF-Connecting-IP') ?? '?' })
  if (!success) return new Response('Muitos avisos seguidos. Tente de novo em um minuto.', { status: 429 })
  let d; try { d = JSON.parse((await req.text()).slice(0, 8000)) } catch { return new Response('JSON inválido', { status: 400 }) }
  if (d.mel) return new Response(null, { status: 204 }) // campo escondido preenchido = robô; finge que deu certo
  const txt = (v, max) => String(v ?? '').trim().slice(0, max)
  const aviso = { em: new Date().toISOString(), debate: txt(d.debate, 40), id: txt(d.id, 40), quem: txt(d.quem, 60), veredito: txt(d.veredito, 20),
    afirmacao: txt(d.afirmacao, 400), texto: txt(d.texto, 1000), link: /^https?:\/\//i.test(d.link ?? '') ? txt(d.link, 500) : '' }
  if (aviso.texto.length < 10 || !aviso.id) return new Response('Explique o erro em pelo menos 10 letras.', { status: 400 })
  await env.CONTESTACOES.put(`${aviso.em}-${crypto.randomUUID().slice(0, 8)}`, JSON.stringify(aviso))
  return new Response(null, { status: 204 })
}

export default {
  fetch(req, env) {
    if (new URL(req.url).pathname === '/contestar') return contestar(req, env)
    if (new URL(req.url).pathname !== '/ao-vivo' || req.headers.get('Upgrade') !== 'websocket')
      return new Response('Não encontrado', { status: 404 })
    if (!ORIGENS.includes(req.headers.get('Origin'))) return new Response('Origem não permitida', { status: 403 })
    return env.CONTADOR.get(env.CONTADOR.idFromName('geral')).fetch(req)
  },
}
