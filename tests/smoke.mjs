// Teste de fumaça: abre o app num Chromium sem GPU (SwiftShader), monta todas as combinações
// de raça × classe × gênero × tier × montaria e falha se aparecer qualquer erro no console.
// Uso: npm test   (ou: node tests/smoke.mjs [--quick])
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const QUICK = process.argv.includes('--quick');
const TYPES = { '.html':'text/html', '.js':'text/javascript', '.webmanifest':'application/manifest+json', '.png':'image/png', '.svg':'image/svg+xml', '.woff2':'font/woff2', '.ttf':'font/ttf' };
const server = createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^([/\\])+/, '') || 'index.html';
  try { const body = await readFile(join(ROOT, path)); res.writeHead(200, { 'content-type': TYPES[extname(path)] || 'application/octet-stream' }); res.end(body); }
  catch { res.writeHead(404); res.end(); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const URL0 = `http://127.0.0.1:${server.address().port}/index.html`;

let failures = 0;
const fail = (msg) => { failures++; console.error('✗ ' + msg); };
const ok = (msg) => console.log('✓ ' + msg);

const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
async function openPage(stored) {
  const page = await browser.newPage({ viewport: { width: 420, height: 860 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/favicon|404/.test(m.text())) errors.push(m.text()); });
  await page.addInitScript(s => { try { localStorage.clear(); if (s !== undefined) localStorage.setItem('munchkin3d_companion_v2', s); } catch {} }, stored);
  await page.goto(URL0);
  await page.waitForFunction(() => typeof Engine !== 'undefined' && typeof S !== 'undefined', null, { timeout: 30000 });
  return { page, errors };
}

try {
  // 1) abre limpo e confere as contas básicas
  {
    const { page, errors } = await openPage();
    const r = await page.evaluate(() => {
      S.level = 3; SLOT_KEYS.forEach(k => { S.slots[k].b = 0; S.slots[k].on = true; }); S.slots.head.b = 2; S.slots.hand1.b = 3; S.curse = false; renderAll();
      const a = power(); S.curse = true; const b = power(); S.curse = false; S.slots.hand1.on = false; const c = power(); S.slots.hand1.on = true; renderAll();
      return { a, b, c, webgl: !!Engine.debug().renderer };
    });
    r.a === 8 ? ok('poder = nível + equipamentos') : fail(`poder esperado 8, veio ${r.a}`);
    r.b === 3 ? ok('maldição tira 5') : fail(`com maldição esperado 3, veio ${r.b}`);
    r.c === 5 ? ok('item desligado não conta') : fail(`item desligado esperado 5, veio ${r.c}`);
    r.webgl ? ok('WebGL ativo') : fail('sem renderer WebGL');
    if (errors.length) fail('erros ao abrir: ' + errors.join(' | ')); else ok('abre sem erros');
    await page.close();
  }

  // 2) estado salvo corrompido não derruba o app
  for (const bad of ['{', 'null', '"x"', JSON.stringify({ slots: 'oi', races: 'elf', level: 'NaN', combat: { monster: 'abc' }, players: [1, 2, 3], teams: [null, { a: 5 }] })]) {
    const { page, errors } = await openPage(bad);
    const st = await page.evaluate(() => ({ lvl: S.level, races: S.races, monster: S.combat.monster, b: S.slots.head.b, p: power() }));
    const sane = st.lvl === 1 && Array.isArray(st.races) && st.races.length && Number.isFinite(st.monster) && st.b === 0 && Number.isFinite(st.p);
    if (!sane || errors.length) fail(`estado corrompido ${bad.slice(0, 30)} → ${JSON.stringify(st)} ${errors.join(' | ')}`);
    await page.close();
  }
  ok('estado salvo corrompido é saneado');

  // 3) monta todas as combinações do herói e anima alguns quadros
  {
    const { page, errors } = await openPage();
    const races = ['human', 'elf', 'dwarf', 'halfling', 'orc', 'gnome'];
    const classes = ['none', 'warrior', 'wizard', 'cleric', 'thief', 'bard'];
    const tiers = QUICK ? [0, 9] : [0, 3, 9, 20];
    const cfgs = [];
    for (const r of races) for (const c of classes) for (const g of ['M', 'F']) for (const t of tiers)
      cfgs.push({ races: [r], classes: [c], gender: g, t, twoHanded: t === 9, superMunchkin: t === 20 && c !== 'none', halfBreed: false });
    // misturas, montarias e seguidor
    cfgs.push({ races: ['elf', 'dwarf'], classes: ['wizard', 'thief'], gender: 'F', t: 6, halfBreed: true, superMunchkin: true, twoHanded: false });
    for (const m of [1, 4, 9, 20]) cfgs.push({ races: ['human'], classes: ['warrior'], gender: 'M', t: 5, mount: m, hire: m, twoHanded: false, superMunchkin: false, halfBreed: false });
    const t0 = Date.now();
    const bad = await page.evaluate(cfgs => {
      const out = [];
      for (const c of cfgs) {
        try {
          Object.assign(S, { races: c.races, classes: c.classes, gender: c.gender, twoHanded: c.twoHanded, superMunchkin: c.superMunchkin, halfBreed: c.halfBreed });
          SLOT_KEYS.forEach(k => { S.slots[k].b = (k === 'mount' ? (c.mount || 0) : k === 'hireling' ? (c.hire || 0) : c.t); S.slots[k].on = true; });
          renderAll();
          for (let i = 0; i < 4; i++) Engine.__tick(1 / 30);
          const { scene } = Engine.debug();
          let nan = false; scene.traverse(o => { if (!Number.isFinite(o.position.x + o.position.y + o.position.z + o.quaternion.x)) nan = true; });
          if (nan) out.push(JSON.stringify(c) + ' → NaN na pose');
        } catch (e) { out.push(JSON.stringify(c) + ' → ' + e.message); }
      }
      return out;
    }, cfgs);
    bad.forEach(fail);
    if (!bad.length) ok(`${cfgs.length} combinações de herói montadas e animadas (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
    // reações e humores não quebram
    const r = await page.evaluate(() => { try { ['happy', 'sad', 'scared', 'focus', 'smile'].forEach(m => Engine.mood(m, 1)); for (let i = 0; i < 90; i++) Engine.__tick(1 / 30); return null; } catch (e) { return e.message; } });
    r ? fail('humores: ' + r) : ok('humores e reações animam');
    if (errors.length) fail('erros durante as combinações: ' + [...new Set(errors)].slice(0, 5).join(' | '));
    await page.close();
  }
} finally {
  await browser.close();
  server.close();
}
if (failures) { console.error(`\n${failures} falha(s)`); process.exit(1); }
console.log('\nTudo certo.');
