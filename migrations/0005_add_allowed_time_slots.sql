-- Add allowed_time_slots column to notification_settings table
ALTER TABLE notification_settings ADD COLUMN allowed_time_slots TEXT;
