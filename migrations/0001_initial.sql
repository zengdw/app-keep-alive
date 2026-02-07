-- 初始数据库架构
-- 创建用户表
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 创建任务表
CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('keepalive', 'notification')),
  schedule TEXT NOT NULL, -- Cron表达式
  config TEXT NOT NULL, -- JSON配置
  enabled BOOLEAN DEFAULT true,
  created_by TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_executed DATETIME,
  last_status TEXT CHECK (last_status IN ('success', 'failure')),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

-- 创建执行日志表
CREATE TABLE execution_logs (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  execution_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  status TEXT NOT NULL CHECK (status IN ('success', 'failure')),
  response_time INTEGER, -- 毫秒
  status_code INTEGER,
  error_message TEXT,
  details TEXT, -- JSON格式的详细信息
  FOREIGN KEY (task_id) REFERENCES tasks(id)
);

-- 创建通知配置表
CREATE TABLE notification_settings (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  email_enabled BOOLEAN DEFAULT false,
  email_address TEXT,
  webhook_enabled BOOLEAN DEFAULT false,
  webhook_url TEXT,
  failure_threshold INTEGER DEFAULT 3,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 创建索引
CREATE INDEX idx_tasks_type ON tasks(type);
CREATE INDEX idx_tasks_enabled ON tasks(enabled);
CREATE INDEX idx_tasks_created_by ON tasks(created_by);
CREATE INDEX idx_execution_logs_task_id ON execution_logs(task_id);
CREATE INDEX idx_execution_logs_execution_time ON execution_logs(execution_time);
CREATE INDEX idx_execution_logs_status ON execution_logs(status);

-- 插入默认管理员用户
INSERT INTO users (id, username, password_hash, role) 
VALUES ('admin-001', 'admin', 'bcb15f821479b4d5772bd0ca866c00ad5f926e3580720659cc80d39c9d09802a', 'admin');