-- 添加 NotifyX 配置字段到通知设置表
-- 迁移文件：0002_add_notifyx_settings.sql

ALTER TABLE notification_settings ADD COLUMN notifyx_enabled BOOLEAN DEFAULT false;
ALTER TABLE notification_settings ADD COLUMN notifyx_api_key TEXT;

-- 添加注释说明
-- notifyx_enabled: 是否启用 NotifyX 通知
-- notifyx_api_key: NotifyX API 密钥
