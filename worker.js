/**
 * Cloudflare Worker — 한국은행 ECOS 환율 API CORS 프록시
 *
 * 배포 후 Cloudflare 대시보드에서 환경변수(Secret) 추가:
 *   변수명: BOK_API_KEY
 *   값:     한국은행 ECOS API 인증키
 */

const ALLOWED_ORIGINS = [
  'https://lizcheese-404.github.io',
  'http://localhost:3000',
  'http://127.0.0.1:5500',
  'null', // file:// 로컬 실행
];

const BOK_BASE = 'https://ecos.bok.or.kr/api/StatisticSearch';

// 731Y001: 주요국 통화의 대원화환율 (일별)
const ITEMS = [
  { code: '0000001', cur_unit: 'USD' },
  { code: '0000002', cur_unit: 'JPY(100)' },
  { code: '0000003', cur_unit: 'EUR' },
];

function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

function dateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

async function fetchRate(apiKey, startDate, endDate, itemCode) {
  const url = `${BOK_BASE}/${apiKey}/json/kr/1/10/731Y001/D/${startDate}/${endDate}/${itemCode}`;
  const res = await fetch(url, { cf: { connectTimeoutMs: 8000, readTimeoutMs: 8000 } });
  const data = await res.json();
  const rows = data?.StatisticSearch?.row;
  if (!rows || rows.length === 0) return null;
  const latest = rows[rows.length - 1];
  return { value: latest.DATA_VALUE, time: latest.TIME };
}

async function fetchOfficialRates(apiKey) {
  const today = new Date();
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const endDate = dateStr(today);
  const startDate = dateStr(weekAgo);

  const results = await Promise.all(
    ITEMS.map(item => fetchRate(apiKey, startDate, endDate, item.code))
  );

  const output = ITEMS.map((item, i) => ({
    cur_unit: item.cur_unit,
    deal_bas_r: results[i]?.value ?? null,
    time: results[i]?.time ?? null,
  })).filter(r => r.deal_bas_r !== null);

  if (output.length === 0) throw new Error('환율 데이터 없음');
  return output;
}

// 일별 환율이므로 상류(BOK) 호출을 30분간 캐시해 쿼터 소모를 최소화한다.
const CACHE_TTL_SECONDS = 1800;
const CACHE_KEY = new Request('https://exim-proxy.internal/rates');

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get('Origin') || '';

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (request.method !== 'GET') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    // 교차출처 차단: Origin 헤더가 있으나 허용 목록에 없으면 거부한다.
    // (CORS 헤더만으로는 브라우저 표시만 막힐 뿐이므로 명시적으로 403 응답)
    if (origin && !ALLOWED_ORIGINS.includes(origin)) {
      return new Response(JSON.stringify({ error: 'forbidden' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
      });
    }

    // 캐시 우선 조회 — 직접 호출이 반복돼도 대부분 캐시에서 응답되어 상류 호출이 줄어든다.
    const cache = caches.default;
    const hit = await cache.match(CACHE_KEY);
    if (hit) {
      const body = await hit.text();
      return new Response(body, {
        headers: { 'Content-Type': 'application/json', 'X-Cache': 'HIT', ...corsHeaders(origin) },
      });
    }

    try {
      const apiKey = env.BOK_API_KEY;
      if (!apiKey) throw new Error('not_configured');
      const output = await fetchOfficialRates(apiKey);
      const payload = JSON.stringify(output);

      // CORS 헤더는 origin마다 달라지므로 캐시 본문에는 포함하지 않는다.
      ctx.waitUntil(cache.put(CACHE_KEY, new Response(payload, {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': `public, max-age=${CACHE_TTL_SECONDS}`,
        },
      })));

      return new Response(payload, {
        headers: { 'Content-Type': 'application/json', 'X-Cache': 'MISS', ...corsHeaders(origin) },
      });
    } catch (e) {
      // 내부 메시지를 노출하지 않고 일반화된 에러만 반환한다.
      return new Response(JSON.stringify({ error: 'upstream_error' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
      });
    }
  },
};
