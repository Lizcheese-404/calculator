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
  const url = `${BOK_BASE}/${apiKey}/json/kr/1/3/731Y001/D/${startDate}/${endDate}/${itemCode}`;
  const res = await fetch(url, { cf: { connectTimeoutMs: 8000, readTimeoutMs: 8000 } });
  const data = await res.json();
  const rows = data?.StatisticSearch?.row;
  if (!rows || rows.length === 0) return null;
  // 가장 최근 날짜의 값 반환
  const latest = rows[rows.length - 1];
  return { value: latest.DATA_VALUE, time: latest.TIME };
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

    const apiKey = env.BOK_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'BOK_API_KEY not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
      });
    }

    // 오늘부터 7일 이전 범위 조회 (주말·공휴일 대비)
    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const endDate = dateStr(today);
    const startDate = dateStr(weekAgo);

    try {
      const results = await Promise.all(
        ITEMS.map(item => fetchRate(apiKey, startDate, endDate, item.code))
      );

      const output = ITEMS.map((item, i) => ({
        cur_unit: item.cur_unit,
        deal_bas_r: results[i]?.value ?? null,
        time: results[i]?.time ?? null,
      })).filter(r => r.deal_bas_r !== null);

      if (output.length === 0) {
        return new Response(JSON.stringify({ error: '환율 데이터 없음' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
        });
      }

      return new Response(JSON.stringify(output), {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=21600',
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
