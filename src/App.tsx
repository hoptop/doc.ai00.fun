import { useEffect, useState } from 'react'
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { supabase, Profile } from './lib/supabase'
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
        fetchProfile(session.user.id)
      } else {
        setLoading(false)
      }
    })

    // 监听认证状态变化
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session)
        if (session) {
          await fetchProfile(session.user.id)
        } else {
          setProfile(null)
          setLoading(false)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) throw error
      setProfile(data)
    } catch (error) {
      console.error('Error fetching profile:', error)
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
