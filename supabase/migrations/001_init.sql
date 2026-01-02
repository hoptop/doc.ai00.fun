-- ============================================
-- Supabase Schema: profiles + course_pages
-- ============================================

-- 1. profiles 表：存储用户信息与激活状态
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  is_active BOOLEAN DEFAULT FALSE NOT NULL,
  is_admin BOOLEAN DEFAULT FALSE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 2. course_pages 表：存储课程 Markdown 内容
CREATE TABLE IF NOT EXISTS public.course_pages (
  id BIGSERIAL PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  sort_order INT DEFAULT 0 NOT NULL,
  md_content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ============================================
-- 触发器：用户注册后自动创建 profiles 行
-- ============================================

-- 函数：从 raw_user_meta_data 读取 username 并创建 profile
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, is_active, is_admin)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', SPLIT_PART(NEW.email, '@', 1)),
    FALSE,
    FALSE
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 触发器：auth.users 插入后执行
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- RLS 策略：profiles
-- ============================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 用户可以读取自己的 profile
CREATE POLICY "Users can view own profile"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

-- 管理员可以读取所有 profiles
CREATE POLICY "Admins can view all profiles"
  ON public.profiles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_admin = TRUE
    )
  );

-- 管理员可以更新任何 profile（用于激活用户）
CREATE POLICY "Admins can update profiles"
  ON public.profiles
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_admin = TRUE
    )
  );

-- ============================================
-- RLS 策略：course_pages
-- ============================================

ALTER TABLE public.course_pages ENABLE ROW LEVEL SECURITY;

-- 只有已激活用户可以读取课程内容
CREATE POLICY "Active users can view courses"
  ON public.course_pages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_active = TRUE
    )
  );

-- 管理员可以插入/更新/删除课程
CREATE POLICY "Admins can manage courses"
  ON public.course_pages
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_admin = TRUE
    )
  );

-- ============================================
-- 索引
-- ============================================

CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_is_active ON public.profiles(is_active);
CREATE INDEX IF NOT EXISTS idx_course_pages_slug ON public.course_pages(slug);
CREATE INDEX IF NOT EXISTS idx_course_pages_sort_order ON public.course_pages(sort_order);

-- ============================================
-- 更新时间触发器
-- ============================================

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at ON public.course_pages;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.course_pages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
