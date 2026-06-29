'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { supabase, isDemo } from '@/lib/supabase'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const router = useRouter()

  const normalizeUsername = (value: string) => value.trim().toLowerCase()

  const usernameToEmail = (value: string) => {
    const normalized = normalizeUsername(value)
    const safeUsername = normalized.replace(/[^a-z0-9_]/g, '_')
    return `${safeUsername}@trial.example.com`
  }

  const getFriendlyAuthError = (message: string) => {
    if (/Email logins are disabled/i.test(message)) {
      return 'Supabase 当前关闭了邮箱密码登录。请到 Authentication -> Providers -> Email 中开启 Email provider。若你不想验证真实邮箱，再关闭 Confirm email 即可。'
    }
    if (/Invalid login credentials/i.test(message)) {
      return '用户名或密码不正确，请重新输入。'
    }
    if (/User already registered/i.test(message)) {
      return '这个用户名已经注册过了，请直接登录。'
    }
    if (/Password should be at least/i.test(message)) {
      return '密码长度太短，请至少输入 6 位。'
    }
    if (/email rate limit exceeded/i.test(message)) {
      return '当前项目触发了 Supabase 默认邮件限流。已改为服务端试用注册模式；如果仍看到这条提示，请检查是否已配置 SUPABASE_SERVICE_ROLE_KEY。'
    }
    if (/is invalid/i.test(message)) {
      return '用户名格式转换失败，请换一个只包含字母、数字或下划线的用户名重试。'
    }
    return message
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setErrorMessage('')

    const normalizedUsername = normalizeUsername(username)
    const internalEmail = usernameToEmail(username)

    if (!/^[a-z0-9_]{2,20}$/.test(normalizedUsername)) {
      setErrorMessage('用户名只支持 2-20 位字母、数字或下划线。')
      setLoading(false)
      return
    }

    try {
      if (isDemo) {
        // 演示模式：直接登录/注册都直接通过
        setTimeout(() => {
          localStorage.setItem('demoLoggedIn', 'true')
          router.push('/')
        }, 500)
      } else {
        if (isSignUp) {
          const response = await fetch('/api/trial-signup', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              username: normalizedUsername,
              password,
              email: internalEmail,
            }),
          })
          const payload = await response.json()
          if (!response.ok) {
            throw new Error(payload?.error || '注册失败，请稍后重试。')
          }
          setIsSignUp(false)
          setErrorMessage('注册成功，请直接使用用户名和密码登录。')
        } else {
          const { error } = await supabase.auth.signInWithPassword({
            email: internalEmail,
            password,
          })
          if (error) throw error
          router.push('/')
        }
      }
    } catch (error: any) {
      setErrorMessage(getFriendlyAuthError(error.message || '登录失败，请稍后重试。'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F7F1E6] flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md">
        <div className="relative mx-auto aspect-[691/1024] w-full max-w-[430px]">
          <Image
            src="/rose-frame.png"
            alt="玫瑰边框"
            fill
            priority
            className="z-0 object-contain select-none pointer-events-none"
          />

          <div className="absolute inset-x-[16%] top-[16%] bottom-[16%] z-10 flex flex-col">
            <div className="text-center mb-8 sm:mb-10">
              <h1 className="font-kaiti whitespace-nowrap text-[1.8rem] leading-tight text-[#A48B67] tracking-[0.08em] sm:text-[2.4rem]">
                我和我们的切片
              </h1>
            </div>

            <form onSubmit={handleSubmit} className="mx-auto mt-3 w-full max-w-[320px] space-y-3">
              <input
                type="text"
                placeholder="用户名"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full rounded-[18px] border border-[#D8CBB8] bg-[#F8F1E7]/95 px-4 py-3 text-base text-[#8D7A5E] outline-none transition focus:border-[#B39A79] focus:ring-2 focus:ring-[#CDB99C]"
                required
              />
              <input
                type="password"
                placeholder="密码"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-[18px] border border-[#D8CBB8] bg-[#F8F1E7]/95 px-4 py-3 text-base text-[#8D7A5E] outline-none transition focus:border-[#B39A79] focus:ring-2 focus:ring-[#CDB99C]"
                required
              />
              {errorMessage && (
                <div className="rounded-[18px] border border-[#E2C7BE] bg-[#FFF5F2] px-4 py-3 text-sm leading-6 text-[#9A5B4D]">
                  {errorMessage}
                </div>
              )}
              <p className="px-1 text-sm text-[#A48B67]">
                试用版支持用户名登录，用户名仅限字母、数字和下划线。
              </p>
              <button
                type="submit"
                disabled={loading}
                className="mt-1 w-full rounded-[18px] bg-[#9E8463] py-3 text-xl font-medium tracking-[0.16em] text-[#F8F2E8] transition hover:bg-[#8C7355] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? '处理中...' : (isSignUp ? '注册' : '登录')}
              </button>
            </form>

            <button
              onClick={() => setIsSignUp(!isSignUp)}
              className="mt-5 text-center text-lg text-[#A48B67] transition hover:text-[#8C7355]"
            >
              {isSignUp ? '已有账号？去登录' : '没有账号？去注册'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
