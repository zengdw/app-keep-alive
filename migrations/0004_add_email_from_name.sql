-- Add email_from and email_name columns to notification_settings table
ALTER TABLE notification_settings ADD COLUMN email_from TEXT;
ALTER TABLE notification_settings ADD COLUMN email_name TEXT;
