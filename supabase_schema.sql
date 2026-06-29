-- 创建 records 表
CREATE TABLE IF NOT EXISTS records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('高光', '阵雨', '顿悟')),
  content TEXT NOT NULL,
  image_url TEXT,
  color_tag TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 创建 tags 表
CREATE TABLE IF NOT EXISTS tags (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 创建每天的标签状态表
CREATE TABLE IF NOT EXISTS day_tag_states (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  tag_id UUID REFERENCES tags(id) ON DELETE CASCADE NOT NULL,
  target_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 每个用户每天只保留一个标签状态
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'day_tag_states_user_id_tag_id_target_date_key'
  ) THEN
    ALTER TABLE day_tag_states
    DROP CONSTRAINT day_tag_states_user_id_tag_id_target_date_key;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'day_tag_states_user_id_target_date_key'
  ) THEN
    ALTER TABLE day_tag_states
    ADD CONSTRAINT day_tag_states_user_id_target_date_key UNIQUE (user_id, target_date);
  END IF;
END $$;

-- 为已存在的表补充新字段
ALTER TABLE records ADD COLUMN IF NOT EXISTS image_url TEXT;

-- 启用 RLS (Row Level Security)
ALTER TABLE records ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE day_tag_states ENABLE ROW LEVEL SECURITY;

-- records 表的 RLS 策略
DROP POLICY IF EXISTS "用户可以查看自己的记录" ON records;
CREATE POLICY "用户可以查看自己的记录"
  ON records
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "用户可以插入自己的记录" ON records;
CREATE POLICY "用户可以插入自己的记录"
  ON records
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "用户可以更新自己的记录" ON records;
CREATE POLICY "用户可以更新自己的记录"
  ON records
  FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "用户可以删除自己的记录" ON records;
CREATE POLICY "用户可以删除自己的记录"
  ON records
  FOR DELETE
  USING (auth.uid() = user_id);

-- tags 表的 RLS 策略
DROP POLICY IF EXISTS "用户可以查看自己的标签" ON tags;
CREATE POLICY "用户可以查看自己的标签"
  ON tags
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "用户可以插入自己的标签" ON tags;
CREATE POLICY "用户可以插入自己的标签"
  ON tags
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "用户可以更新自己的标签" ON tags;
CREATE POLICY "用户可以更新自己的标签"
  ON tags
  FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "用户可以删除自己的标签" ON tags;
CREATE POLICY "用户可以删除自己的标签"
  ON tags
  FOR DELETE
  USING (auth.uid() = user_id);

-- day_tag_states 表的 RLS 策略
DROP POLICY IF EXISTS "用户可以查看自己的每日标签状态" ON day_tag_states;
CREATE POLICY "用户可以查看自己的每日标签状态"
  ON day_tag_states
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "用户可以插入自己的每日标签状态" ON day_tag_states;
CREATE POLICY "用户可以插入自己的每日标签状态"
  ON day_tag_states
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "用户可以更新自己的每日标签状态" ON day_tag_states;
CREATE POLICY "用户可以更新自己的每日标签状态"
  ON day_tag_states
  FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "用户可以删除自己的每日标签状态" ON day_tag_states;
CREATE POLICY "用户可以删除自己的每日标签状态"
  ON day_tag_states
  FOR DELETE
  USING (auth.uid() = user_id);
