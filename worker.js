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

async function fetchOfficialRates(apiKey, origin) {
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

async function fetchCurrentRates(origin) {
  // open.er-api.com 무료 실시간 환율 (USD 기준)
  const res = await fetch('https://open.er-api.com/v6/latest/USD', {
    cf: { connectTimeoutMs: 8000, readTimeoutMs: 8000 },
  });
  const data = await res.json();
  if (data.result !== 'success') throw new Error('환율 조회 실패');

  const krw = data.rates.KRW;
  const jpy = data.rates.JPY;
  const eur = data.rates.EUR;

  // 업데이트 시각을 YYYYMMDD HH:MM(UTC) 형태로 전달
  const updated = data.time_last_update_utc ?? null;

  return [
    { cur_unit: 'USD',     deal_bas_r: krw.toFixed(2),               time: updated },
    { cur_unit: 'JPY(100)',deal_bas_r: (krw / jpy * 100).toFixed(2), time: updated },
    { cur_unit: 'EUR',     deal_bas_r: (krw / eur).toFixed(2),       time: updated },
  ];
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (request.method !== 'GET') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('mode') || 'official';

    try {
      let output;
      if (mode === 'current') {
        output = await fetchCurrentRates(origin);
      } else {
        const apiKey = env.BOK_API_KEY;
        if (!apiKey) throw new Error('BOK_API_KEY not configured');
        output = await fetchOfficialRates(apiKey, origin);
      }

      return new Response(JSON.stringify(output), {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': mode === 'current' ? 'no-store' : 'public, max-age=21600',
          ...corsHeaders(origin),
        },
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 502,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
      });
    }
  },
};
