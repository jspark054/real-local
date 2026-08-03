-- 2026-08-03: Google Places 사진 저작자 정보 저장용 컬럼 추가
-- Supabase Dashboard > SQL Editor 에서 실행

ALTER TABLE spots ADD COLUMN IF NOT EXISTS photo_attribution jsonb;
ALTER TABLE maps ADD COLUMN IF NOT EXISTS photo_attribution jsonb;

-- 저장 예시: {"displayName": "ky yong", "uri": "https://maps.google.com/maps/contrib/..."}
