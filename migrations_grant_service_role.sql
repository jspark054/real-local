-- 2026-08-03: service_role이 spots/maps 테이블에 접근하지 못하는 문제 해결
-- 원인: 테이블에 service_role 대상 GRANT가 누락되어 있었음 (오늘 발견, 기존부터 있던 문제로 추정)
-- Supabase Dashboard > SQL Editor 에서 실행

GRANT SELECT, UPDATE ON public.spots TO service_role;
GRANT SELECT, UPDATE ON public.maps TO service_role;

-- 확인용: 아래 실행 시 정상적으로 결과가 나와야 함
-- SELECT id, image_url, photo_attribution FROM spots LIMIT 1;
