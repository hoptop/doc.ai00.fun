import { useEffect, useState } from 'react'
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { supabase, Profile, emailToUsername } from './lib/supabase'
import { Session } from '@supabase/supabase-js'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Pending from './pages/Pending'
import Course from './pages/Course'
import CourseDetail from './pages/CourseDetail'
import Admin from './pages/Admin'

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    // 处理 GitHub Pages SPA 重定向
    const redirect = sessionStorage.getItem('redirect')
    if (redirect && redirect !== location.pathname) {
      sessionStorage.removeItem('redirect')
      navigate(redirect, { replace: true })
    }
  }, [navigate, location.pathname])

  useEffect(() => {
    // 获取当前会话
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) {
        fetchProfile(session)
      } else {
        setLoading(false)
      }
    })

    // 监听认证状态变化
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session)
        if (session) {
          await fetchProfile(session)
        } else {
          setProfile(null)
          setLoading(false)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const fetchProfile = async (currentSession: Session) => {
    const userId = currentSession.user.id
    const userEmail = currentSession.user.email || ''
    
    try {
      // 尝试获取 profile
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) {
        // 如果是 "没有找到记录" 的错误，尝试创建 profile
        if (error.code === 'PGRST116') {
          console.log('Profile not found, creating...')
          const username = currentSession.user.user_metadata?.username || emailToUsername(userEmail)
          
          const { data: newProfile, error: insertError } = await supabase
            .from('profiles')
            .insert({
              id: userId,
              username: username,
              is_active: false,
              is_admin: false
            })
            .select()
            .single()

          if (insertError) {
            console.error('Error creating profile:', insertError)
            setError(`创建用户资料失败: ${insertError.message}`)
            setProfile(null)
          } else {
            setProfile(newProfile)
          }
        } else {
          console.error('Error fetching profile:', error)
          setError(`获取用户资料失败: ${error.message}`)
          setProfile(null)
        }
      } else {
        setProfile(data)
        setError(null)
      }
    } catch (err) {
      console.error('Unexpected error:', err)
      setError('发生未知错误')
      setProfile(null)
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setSession(null)
    setProfile(null)
    navigate('/login')
  }

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner"></div>
        <p>加载中...</p>
      </div>
    )
  }

  // 显示错误状态
  if (error && session) {
    return (
      <div className="loading-screen">
        <p style={{ color: '#ef4444', marginBottom: '1rem' }}>{error}</p>
        <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '1rem' }}>
          请检查 Supabase 数据库配置是否正确
        </p>
        <button 
          onClick={handleLogout}
          style={{
            padding: '0.75rem 1.5rem',
            background: '#00f0ff',
            color: '#0a0e17',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: 500
          }}
        >
          退出登录
        </button>
      </div>
    )
  }

  // 路由守卫逻辑
  const isAuthenticated = !!session
  const isActive = profile?.is_active ?? false
  const isAdmin = profile?.is_admin ?? false

  return (
    <div className="app">
      {isAuthenticated && (
        <header className="app-header">
          <div className="header-content">
            <h1 className="logo">AI课程中心</h1>
            <nav className="nav-links">
              {isActive && (
                <a href="/courses" onClick={(e) => { e.preventDefault(); navigate('/courses') }}>
                  课程
                </a>
              )}
              {isAdmin && (
                <a href="/admin" onClick={(e) => { e.preventDefault(); navigate('/admin') }}>
                  管理
                </a>
              )}
              <span className="username">@{profile?.username}</span>
              <button onClick={handleLogout} className="logout-btn">
                退出
              </button>
            </nav>
          </div>
        </header>
      )}

      <main className="main-content">
        <Routes>
          {/* 公开路由 */}
          <Route
            path="/login"
            element={
              !isAuthenticated ? (
                <Login />
              ) : isActive ? (
                <Navigate to="/courses" replace />
              ) : (
                <Navigate to="/pending" replace />
              )
            }
          />
          <Route
            path="/signup"
            element={
              !isAuthenticated ? (
                <Signup />
              ) : (
                <Navigate to="/pending" replace />
              )
            }
          />

          {/* 等待激活 */}
          <Route
            path="/pending"
            element={
              !isAuthenticated ? (
                <Navigate to="/login" replace />
              ) : isActive ? (
                <Navigate to="/courses" replace />
              ) : (
                <Pending username={profile?.username} onLogout={handleLogout} />
              )
            }
          />

          {/* 课程页面 - 需要激活 */}
          <Route
            path="/courses"
            element={
              !isAuthenticated ? (
                <Navigate to="/login" replace />
              ) : !isActive ? (
                <Navigate to="/pending" replace />
              ) : (
                <Course />
              )
            }
          />
          <Route
            path="/courses/:slug"
            element={
              !isAuthenticated ? (
                <Navigate to="/login" replace />
              ) : !isActive ? (
                <Navigate to="/pending" replace />
              ) : (
                <CourseDetail />
              )
            }
          />

          {/* 管理员页面 */}
          <Route
            path="/admin"
            element={
              !isAuthenticated ? (
                <Navigate to="/login" replace />
              ) : !isAdmin ? (
                <Navigate to="/courses" replace />
              ) : (
                <Admin />
              )
            }
          />

          {/* 默认路由 */}
          <Route
            path="*"
            element={
              !isAuthenticated ? (
                <Navigate to="/login" replace />
              ) : isActive ? (
                <Navigate to="/courses" replace />
              ) : (
                <Navigate to="/pending" replace />
              )
            }
          />
        </Routes>
      </main>
    </div>
  )
}

export default App
