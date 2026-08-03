// Google Places API (New)로 spots/maps 테이블의 빈 image_url / cover_image_url을 채우는 배치 스크립트.
// 사용법:
//   node fetch_spot_photos.js                    -> spots 전체 (미완료분만) 처리
//   node fetch_spot_photos.js --limit=5           -> spots 5개만 테스트 처리
//   node fetch_spot_photos.js --target=maps       -> maps만 처리
//   node fetch_spot_photos.js --target=all --limit=5
//
// 중단 후 재실행하면 photo_fetch_progress.log를 읽어 success/skip_no_photo 처리된 항목은 건너뛰고
// error 처리된 항목만 다시 시도한다.

const fs = require('fs');
const path = require('path');

function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1);
    const commentIdx = value.search(/\s+#/);
    if (commentIdx !== -1) value = value.slice(0, commentIdx);
    value = value.trim().replace(/^["']|["']$/g, '');
    if (!(key in process.env)) process.env[key] = value;
  }
}
loadEnv();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GOOGLE_PLACES_SERVER_KEY = process.env.GOOGLE_PLACES_SERVER_KEY;

const PROGRESS_FILE = path.join(__dirname, 'photo_fetch_progress.log');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomDelay() {
  return 500 + Math.random() * 500; // 500ms ~ 1000ms
}

function loadProgress() {
  const map = new Map(); // key: `${table}:${id}` -> status
  if (!fs.existsSync(PROGRESS_FILE)) return map;
  const lines = fs.readFileSync(PROGRESS_FILE, 'utf8').split('\n').filter(Boolean);
  for (const line of lines) {
    try {
      const entry = JSON.parse(line);
      map.set(`${entry.table}:${entry.id}`, entry.status);
    } catch {
      // 손상된 줄은 무시
    }
  }
  return map;
}

function appendProgress(entry) {
  fs.appendFileSync(PROGRESS_FILE, JSON.stringify({ ...entry, ts: new Date().toISOString() }) + '\n');
}

function isDone(progressMap, table, id) {
  const status = progressMap.get(`${table}:${id}`);
  return status === 'success' || status === 'skip_no_photo';
}

// Places API (New) 호출 공통 래퍼: 429 / RESOURCE_EXHAUSTED 시 최대 3회 지수 백오프 재시도
async function fetchWithRetry(url, options, maxRetries = 3) {
  let attempt = 0;
  while (true) {
    const res = await fetch(url, options);
    let data = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    const isRateLimited = res.status === 429 || data?.error?.status === 'RESOURCE_EXHAUSTED';
    if (isRateLimited) {
      attempt++;
      if (attempt > maxRetries) {
        throw new Error(`재시도 ${maxRetries}회 초과 (429/RESOURCE_EXHAUSTED): ${JSON.stringify(data)}`);
      }
      const backoffMs = 1000 * 2 ** (attempt - 1); // 1s, 2s, 4s
      console.log(`    ↳ rate limited, ${backoffMs}ms 후 재시도 (${attempt}/${maxRetries})`);
      await sleep(backoffMs);
      continue;
    }
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${JSON.stringify(data)}`);
    }
    return data;
  }
}

async function placesSearchText(query) {
  return fetchWithRetry('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': GOOGLE_PLACES_SERVER_KEY,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.photos',
    },
    body: JSON.stringify({ textQuery: query }),
  });
}

async function getPhotoMediaUrl(photoName) {
  const url = `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=800&skipHttpRedirect=true&key=${GOOGLE_PLACES_SERVER_KEY}`;
  const data = await fetchWithRetry(url, { method: 'GET' });
  return data.photoUri;
}

async function supabaseSelect(table, query) {
  const url = `${SUPABASE_URL}/rest/v1/${table}?${query}`;
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });
  if (!res.ok) {
    throw new Error(`Supabase select 실패 (${table}): ${res.status} ${await res.text()}`);
  }
  return res.json();
}

async function supabaseUpdate(table, id, patch) {
  const url = `${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    throw new Error(`Supabase update 실패 (${table} ${id}): ${res.status} ${await res.text()}`);
  }
}

function toAttribution(photo) {
  return (photo.authorAttributions || []).map((a) => ({
    displayName: a.displayName || null,
    uri: a.uri || null,
  }));
}

// 공통 처리 루프: spots/maps 둘 다 이 함수를 통해 처리한다.
// limit은 "미완료(progress log 기준) 중 N개"를 의미 - 필터링 이후에 자른다.
async function processTable({ table, imageColumn, rows, limit, progressMap, buildQuery, label }) {
  const notDone = rows.filter((r) => !isDone(progressMap, table, r.id));
  const pending = typeof limit === 'number' ? notDone.slice(0, limit) : notDone;
  console.log(`\n[${table}] 대상 ${rows.length}개 중 미완료 ${notDone.length}개, 이번 실행 ${pending.length}개 처리 시작\n`);

  let success = 0;
  let skip = 0;
  let fail = 0;

  for (let i = 0; i < pending.length; i++) {
    const row = pending[i];
    const progressTag = `[${i + 1}/${pending.length}]`;
    const name = label(row);
    try {
      await sleep(randomDelay());
      const searchRes = await placesSearchText(buildQuery(row));
      const place = searchRes.places?.[0];
      const photo = place?.photos?.[0];

      if (!photo) {
        console.log(`${progressTag} ${name}: 사진 없음 - 스킵`);
        appendProgress({ table, id: row.id, status: 'skip_no_photo' });
        skip++;
        continue;
      }

      await sleep(randomDelay());
      const photoUri = await getPhotoMediaUrl(photo.name);

      await supabaseUpdate(table, row.id, {
        [imageColumn]: photoUri,
        photo_attribution: toAttribution(photo),
      });

      console.log(`${progressTag} ${name}: 성공`);
      appendProgress({ table, id: row.id, status: 'success' });
      success++;
    } catch (err) {
      console.log(`${progressTag} ${name}: 실패 - ${err.message}`);
      appendProgress({ table, id: row.id, status: 'error', error: err.message });
      fail++;
    }
  }

  console.log(`\n[${table}] 완료 — 성공 ${success} / 스킵(사진없음) ${skip} / 실패 ${fail} (이번 실행 대상 ${pending.length}개 중)`);
  return { success, skip, fail };
}

async function processSpots({ limit, progressMap }) {
  const rows = await supabaseSelect('spots', 'select=id,name,address&image_url=is.null&order=id');
  return processTable({
    table: 'spots',
    imageColumn: 'image_url',
    rows,
    limit,
    progressMap,
    buildQuery: (r) => `${r.name} ${r.address || ''}`.trim(),
    label: (r) => r.name,
  });
}

async function processMaps({ limit, progressMap }) {
  // 주의: map은 실제 장소가 아니라 "주제로 묶인 컬렉션"이라 title로 검색하면
  // Places API가 엉뚱한 장소를 매칭할 수 있다. 결과를 눈으로 한 번 확인하고 쓸 것.
  const rows = await supabaseSelect('maps', 'select=id,title,city&cover_image_url=is.null&order=id');
  return processTable({
    table: 'maps',
    imageColumn: 'cover_image_url',
    rows,
    limit,
    progressMap,
    buildQuery: (r) => `${r.title} ${r.city || ''}`.trim(),
    label: (r) => r.title,
  });
}

function getArg(name, def) {
  const found = process.argv.slice(2).find((a) => a.startsWith(`--${name}=`));
  return found ? found.split('=')[1] : def;
}

async function main() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY가 .env에 없습니다.');
    process.exit(1);
  }
  if (!GOOGLE_PLACES_SERVER_KEY) {
    console.error('GOOGLE_PLACES_SERVER_KEY가 .env에 없습니다.');
    process.exit(1);
  }

  const limitArg = getArg('limit', null);
  const limit = limitArg ? parseInt(limitArg, 10) : null;
  const target = getArg('target', 'spots'); // spots | maps | all

  console.log(`대상: ${target}${limit ? ` (limit=${limit})` : ' (전체 미완료분)'}`);

  const progressMap = loadProgress();
  const totals = { success: 0, skip: 0, fail: 0 };

  if (target === 'spots' || target === 'all') {
    const r = await processSpots({ limit, progressMap });
    totals.success += r.success;
    totals.skip += r.skip;
    totals.fail += r.fail;
  }
  if (target === 'maps' || target === 'all') {
    const r = await processMaps({ limit, progressMap });
    totals.success += r.success;
    totals.skip += r.skip;
    totals.fail += r.fail;
  }

  console.log(`\n=== 전체 요약 === 성공 ${totals.success} / 스킵 ${totals.skip} / 실패 ${totals.fail}`);
}

main().catch((err) => {
  console.error('스크립트 실행 중 오류:', err);
  process.exit(1);
});
