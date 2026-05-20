-- 0007: production_shifts táblához end_shots_absolute mező
-- Tárolja az abszolút vég lövésszámot a következő műszak auto-kitöltéséhez

ALTER TABLE production_shifts ADD COLUMN end_shots_absolute INTEGER;
