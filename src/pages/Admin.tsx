import { useEffect, useState } from 'react'
import { supabase, Profile } from '../lib/supabase'

function Admin() {
  const [users, setUsers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activating, setActivating] = useState<string | null>(null)

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setUsers(data || [])
    } catch (err) {
      console.error('Error fetching users:', err)
      setError('加载用户列表失败')
    } finally {
      setLoading(false)
    }
  }

  const toggleActive = async (userId: string, currentStatus: boolean) => {
    setActivating(userId)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: !currentStatus })
        .eq('id', userId)

      if (error) throw error

      setUsers(users.map(u =>
        u.id === userId ? { ...u, is_active: !currentStatus } : u
      ))
    } catch (err) {
      console.error('Error updating user:', err)
      alert('操作失败，请重试')
    } finally {
      setActivating(null)
    }
  }

  const toggleAdmin = async (userId: string, currentStatus: boolean) => {
    setActivating(userId)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_admin: !currentStatus })
        .eq('id', userId)

      if (error) throw error

      setUsers(users.map(u =>
        u.id === userId ? { ...u, is_admin: !currentStatus } : u
      ))
    } catch (err) {
      console.error('Error updating user:', err)
      alert('操作失败，请重试')
    } finally {
      setActivating(null)
    }
  }

  if (loading) {
    return (
      <div className="admin-loading">
        <div className="loading-spinner"></div>
        <p>加载用户列表...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="admin-error">
        <p>{error}</p>
        <button onClick={fetchUsers}>重试</button>
      </div>
    )
  }

  const pendingUsers = users.filter(u => !u.is_active)
  const activeUsers = users.filter(u => u.is_active)

  return (
    <div className="admin-container">
      <div className="admin-header">
        <h2>用户管理</h2>
        <p>共 {users.length} 位用户，其中 {pendingUsers.length} 位待激活</p>
      </div>

      {pendingUsers.length > 0 && (
        <div className="admin-section">
          <h3>待激活用户 ({pendingUsers.length})</h3>
          <div className="user-table">
            <div className="user-table-header">
              <span>用户名</span>
              <span>注册时间</span>
              <span>操作</span>
            </div>
            {pendingUsers.map(user => (
              <div key={user.id} className="user-row pending">
                <span className="user-name">@{user.username}</span>
                <span className="user-date">
                  {new Date(user.created_at).toLocaleDateString('zh-CN')}
                </span>
                <div className="user-actions">
                  <button
                    className="activate-btn"
                    onClick={() => toggleActive(user.id, user.is_active)}
                    disabled={activating === user.id}
                  >
                    {activating === user.id ? '处理中...' : '激活'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="admin-section">
        <h3>已激活用户 ({activeUsers.length})</h3>
        {activeUsers.length === 0 ? (
          <p className="no-users">暂无已激活用户</p>
        ) : (
          <div className="user-table">
            <div className="user-table-header">
              <span>用户名</span>
              <span>注册时间</span>
              <span>角色</span>
              <span>操作</span>
            </div>
            {activeUsers.map(user => (
              <div key={user.id} className="user-row active">
                <span className="user-name">
                  @{user.username}
                  {user.is_admin && <span className="admin-badge">管理员</span>}
                </span>
                <span className="user-date">
                  {new Date(user.created_at).toLocaleDateString('zh-CN')}
                </span>
                <span className="user-role">
                  {user.is_admin ? '管理员' : '普通用户'}
                </span>
                <div className="user-actions">
                  <button
                    className="deactivate-btn"
                    onClick={() => toggleActive(user.id, user.is_active)}
                    disabled={activating === user.id}
                  >
                    停用
                  </button>
                  <button
                    className={user.is_admin ? 'revoke-admin-btn' : 'grant-admin-btn'}
                    onClick={() => toggleAdmin(user.id, user.is_admin)}
                    disabled={activating === user.id}
                  >
                    {user.is_admin ? '撤销管理员' : '设为管理员'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default Admin
