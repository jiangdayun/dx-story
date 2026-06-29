'use client'

import { FormEvent, useMemo, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Loader2, MessageSquare, Send, Sparkles, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'

type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

const starterMessage =
  '你好，我会结合你的记录内容和情绪热力图，陪你一起梳理最近的情绪变化。你可以直接告诉我，这几天你最在意的事情是什么。'

export default function AiChatWidget() {
  const router = useRouter()
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: starterMessage },
  ])
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  const hidden = useMemo(() => pathname === '/login', [pathname])

  if (hidden) return null

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    const text = input.trim()
    if (!text || sending) return

    setSending(true)
    setError('')

    const nextMessages: ChatMessage[] = [...messages, { role: 'user', content: text }]
    setMessages(nextMessages)
    setInput('')

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.access_token) {
        router.push('/login')
        return
      }

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          mode: 'chat',
          messages: nextMessages.map((message) => ({
            role: message.role,
            content: message.content,
          })),
          limit: 12,
        }),
      })

      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload?.error || payload?.details || 'AI 暂时没有成功响应。')
      }

      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          content: payload.answer || '我刚刚有点走神了，你可以再问我一次。',
        },
      ])
    } catch (requestError) {
      const message =
        requestError instanceof Error ? requestError.message : 'AI 暂时没有成功响应。'
      setError(message)
      setMessages((current) => current.slice(0, -1))
      setInput(text)
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#2F2418]/20 px-4 py-6 backdrop-blur-[2px]">
          <div className="w-[min(92vw,32rem)] overflow-hidden rounded-3xl border border-[#E8E0D5] bg-[#FFFDF8] shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#EFE6D8] bg-[#F8F1E6] px-4 py-3">
              <div>
                <p className="text-sm font-medium text-[#5C4D3D]">AI 咨询</p>
                <p className="text-xs text-[#8B7355]">结合记录与情绪热力图进行陪伴式分析</p>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="rounded-full p-2 text-[#8B7355] transition hover:bg-white/80"
                aria-label="关闭 AI 咨询窗口"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[min(60vh,30rem)] space-y-3 overflow-y-auto px-4 py-4">
              {messages.map((message, index) => (
                <div
                  key={`${message.role}-${index}`}
                  className={`rounded-2xl px-4 py-3 text-sm leading-6 ${
                    message.role === 'assistant'
                      ? 'bg-[#F7EFE3] text-[#5C4D3D]'
                      : 'ml-10 bg-[#8B7355] text-white'
                  }`}
                >
                  {message.content}
                </div>
              ))}
              {sending && (
                <div className="flex items-center gap-2 rounded-2xl bg-[#F7EFE3] px-4 py-3 text-sm text-[#8B7355]">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  AI 正在结合你的记录整理回应...
                </div>
              )}
              {error && (
                <div className="rounded-2xl bg-[#FFF1F1] px-4 py-3 text-sm text-[#A45A52]">
                  {error}
                </div>
              )}
            </div>

            <form onSubmit={handleSubmit} className="border-t border-[#EFE6D8] bg-white px-4 py-4">
              <div className="mb-3 flex items-center gap-2 rounded-2xl bg-[#FCF8F1] px-3 py-2 text-xs text-[#8B7355]">
                <Sparkles className="h-3.5 w-3.5" />
                AI 会参考你的最近记录、自定义标签和情绪热力图状态
              </div>
              <div className="flex items-end gap-2">
                <textarea
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  placeholder="想聊聊最近的情绪变化，或者请 AI 帮你梳理关系与感受..."
                  rows={3}
                  className="min-h-[5.5rem] flex-1 resize-none rounded-2xl border border-[#E8E0D5] bg-[#FFFDF8] px-4 py-3 text-sm text-[#5C4D3D] outline-none transition focus:border-[#CDB99C] focus:ring-2 focus:ring-[#E8D8C2]"
                />
                <button
                  type="submit"
                  disabled={sending || !input.trim()}
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-[#8B7355] text-white transition hover:scale-105 hover:bg-[#7A6348] disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="发送给 AI"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <button
        onClick={() => setIsOpen((current) => !current)}
        className="fixed bottom-8 right-8 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#8B7355] text-white shadow-lg transition hover:scale-110"
        aria-label="打开 AI 咨询"
      >
        <MessageSquare className="h-6 w-6" />
      </button>
    </>
  )
}
