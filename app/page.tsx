'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Calendar } from 'lucide-react'
import { supabase, isDemo } from '@/lib/supabase'

const greetings = [
  '今天也要好好生活 ✨',
  '你好呀，今天过得怎么样？',
  '每一个当下，都值得被记录',
  '欢迎回来，温柔的你 🌿',
  '今天有什么特别的时刻吗？',
]

const cardData = [
  { type: '高光', emoji: '✨', color: 'from-yellow-100 to-amber-50', textColor: 'text-amber-700' },
  { type: '阵雨', emoji: '🌧️', color: 'from-blue-100 to-slate-50', textColor: 'text-blue-700' },
  { type: '顿悟', emoji: '🌱', color: 'from-green-100 to-emerald-50', textColor: 'text-green-700' },
]

export default function HomePage() {
  const router = useRouter()
  const [greeting, setGreeting] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setGreeting(greetings[Math.floor(Math.random() * greetings.length)])
    
    const checkUser = async () => {
      if (isDemo) {
        const isLoggedIn = localStorage.getItem('demoLoggedIn')
        if (!isLoggedIn) {
          router.push('/login')
        }
      } else {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
          router.push('/login')
        }
      }
      setLoading(false)
    }
    checkUser()
  }, [router])

  const handleLogout = async () => {
    if (isDemo) {
      localStorage.removeItem('demoLoggedIn')
    } else {
      await supabase.auth.signOut()
    }
    router.push('/login')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FDFBF7] flex items-center justify-center">
        <div className="text-[#8B7355]">加载中...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#FDFBF7] p-6">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-lg text-[#5C4D3D] font-light">{greeting}</h1>
        <button
          onClick={() => router.push('/calendar')}
          className="p-3 rounded-full bg-white/70 hover:bg-white shadow-sm transition-all"
        >
          <Calendar className="w-6 h-6 text-[#8B7355]" />
        </button>
      </div>

      <div className="space-y-4 max-w-md mx-auto">
        {cardData.map((card) => (
          <button
            key={card.type}
            onClick={() => router.push(`/${encodeURIComponent(card.type)}`)}
            className={`w-full p-6 rounded-2xl bg-gradient-to-br ${card.color} hover:scale-[1.02] transition-transform shadow-sm`}
          >
            <div className="flex items-center gap-4">
              <span className="text-4xl">{card.emoji}</span>
              <div className="text-left">
                <div className={`text-xl font-medium ${card.textColor}`}>
                  记录{card.type}时刻
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>

      <button
        onClick={handleLogout}
        className="fixed bottom-8 left-8 text-sm text-[#8B7355] hover:underline"
      >
        退出登录
      </button>
    </div>
  )
}
