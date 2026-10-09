const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

// Exercise the real server pages and middleware with authenticated-session fixtures.
// Next's redirect/notFound control flow is represented by distinct thrown errors.
let session = { id: 'shun-account', displayName: 'しゅん' };
let configured = true;
const exit = (kind, location) => { throw Object.assign(new Error(kind), { kind, location }); };
const TownBuilder = () => null;
const component = () => null;
const esm = value => ({ __esModule: true, default: value });
const stubs = {
  'next/link': esm(component),
  'next/image': esm(component),
  'next/navigation': { notFound: () => exit('notFound'), redirect: location => exit('redirect', location) },
  '@/components/page-body': { PageBody: component },
  '@/components/page-header': { TopHeader: component },
  '@/components/games/town-builder': { TownBuilder },
  '@/lib/supabase/server': { requireUser: async () => {
    if (!session) exit('redirect', '/login');
    return { user: session };
  } },
  '@/lib/supabase/env': { getSupabaseEnv: () => configured ? { url: 'https://example.test', anonKey: 'test' } : null },
  '@supabase/ssr': { createServerClient: () => ({ auth: { getClaims: async () => ({ data: { claims: session ? { sub: session.id } : null } }) } }) },
  '@/lib/app-backgrounds': { APP_BACKGROUND_COOKIE: 'background', isAppBackgroundId: () => true },
  '@/lib/dog-skins': { DOG_SKIN_COOKIE: 'skin', isDogSkinId: () => true },
  'next/server': { NextResponse: {
    next: () => ({ kind: 'next', cookies: { set() {} } }),
    redirect: url => ({ kind: 'redirect', url }),
  } },
};
const cache = new Map();
function load(file) {
  const absolute = path.resolve(file);
  if (cache.has(absolute)) return cache.get(absolute);
  const compiled = ts.transpileModule(fs.readFileSync(absolute, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const mod = { exports: {} };
  const resolve = name => {
    if (stubs[name]) return stubs[name];
    if (name.startsWith('@/')) return load(path.join('src', name.slice(2)) + '.ts');
    return require(name);
  };
  new Function('require', 'exports', 'module', compiled)(resolve, mod.exports, mod);
  cache.set(absolute, mod.exports);
  return mod.exports;
}
function elements(node) {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(elements);
  return node.props ? [node, ...elements(node.props.children)] : [];
}
const games = load('src/app/(app)/games/page.tsx').default;
const town = load('src/app/(app)/games/town-builder/page.tsx').default;
const preview = load('src/app/mini-games-preview/town-builder/page.tsx').default;
const { middleware } = load('src/middleware.ts');
const request = pathname => {
  const url = new URL(pathname, 'https://odekake.test');
  url.clone = () => new URL(url);
  return { nextUrl: url, cookies: { getAll: () => [], get: () => undefined } };
};
const control = (kind, location) => error => error.kind === kind && (!location || error.location === location);
let passed = 0;
const test = async (name, fn) => { await fn(); passed++; console.log(`PASS ${name}`); };

(async () => {
  await test('しゅん sees the menu entry and opens the game using their account save key', async () => {
    const menu = elements(await games());
    assert(menu.some(e => e.props.href === '/games/town-builder'));
    assert(elements(await town()).some(e => e.type === TownBuilder && e.props.userId === session.id));
  });
  await test('other names do not see the entry and cannot open either URL', async () => {
    for (const displayName of ['別のユーザー', 'しゅんだ', 'シュン', 'shun', '', null]) {
      session = { id: 'other-account', displayName };
      const menu = elements(await games());
      assert(!menu.some(e => e.props.href === '/games/town-builder'));
      assert(menu.some(e => e.props.href === '/games/pinball'));
      await assert.rejects(town(), control('notFound'));
      await assert.rejects(preview(), control('notFound'));
    }
  });
  await test('logged-out users never receive a game page or public demo', async () => {
    session = null;
    for (const page of [games, town, preview]) await assert.rejects(page(), control('redirect', '/login'));
  });
  await test('the old preview URL sends しゅん to the protected main game', async () => {
    session = { id: 'shun-account', displayName: 'しゅん' };
    await assert.rejects(preview(), control('redirect', '/games/town-builder'));
  });
  await test('middleware requires login for game and old preview, including subpaths', async () => {
    session = null;
    for (const route of ['/games/town-builder', '/mini-games-preview/town-builder', '/mini-games-preview/town-builder/subpath']) {
      const response = await middleware(request(route));
      assert.equal(response.kind, 'redirect');
      assert.equal(response.url.pathname, '/login');
      assert.equal(response.url.searchParams.get('next'), route);
    }
  });
  await test('other public previews remain available', async () => {
    assert.equal((await middleware(request('/mini-games-preview'))).kind, 'next');
    assert.equal((await middleware(request('/memory-game-preview'))).kind, 'next');
  });
  await test('missing authentication configuration cannot expose the game', async () => {
    configured = false;
    for (const route of ['/games/town-builder', '/mini-games-preview/town-builder']) {
      const response = await middleware(request(route));
      assert.equal(response.kind, 'redirect');
      assert.equal(response.url.pathname, '/setup');
    }
  });
  console.log(`${passed} town access checks passed`);
})().catch(error => { console.error(error); process.exitCode = 1; });
