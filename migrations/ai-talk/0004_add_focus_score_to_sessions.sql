-- Add focus_score column to ai_talk_sessions for session retention / anti-derailment tracking
ALTER TABLE ai_talk_sessions ADD COLUMN focus_score INTEGER DEFAULT 100;
