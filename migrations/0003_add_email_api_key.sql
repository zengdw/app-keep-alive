-- 添加邮件 API 密钥字段到通知设置表
-- 迁移文件：0003_add_email_api_key.sql

ALTER TABLE notification_settings ADD COLUMN email_api_key TEXT;

-- 添加注释说明
-- email_api_key: 邮件服务 API 密钥（如esend SendGrid、Resend 等）
