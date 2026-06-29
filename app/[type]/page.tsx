'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft, ImagePlus, Loader2, Send, Sparkles, X } from 'lucide-react'
import { supabase, isDemo } from '@/lib/supabase'

const inspirations = [
  '今天有什么让你开心的小事？',
  '记录一个你感谢的瞬间',
  '是什么让你今天感觉不一样？',
  '写下一个值得被记住的细节',
  '如果用一句话总结今天，会是什么？',
]

interface Record {
  id: string
  content: string
  created_at: string
  color_tag?: string
  image_url?: string | null
}

export default function RecordPage() {
  const router = useRouter()
  const params = useParams()
  const type = decodeURIComponent(params.type as string)
  
  const [content, setContent] = useState('')
  const [records, setRecords] = useState<Record[]>([])
  const [loading, setLoading] = useState(false)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [inspirationLoading, setInspirationLoading] = useState(false)
  const [inspirationError, setInspirationError] = useState('')

  useEffect(() => {
    loadRecords()
  }, [type])

  const loadRecords = async () => {
    if (isDemo) {
      const isLoggedIn = localStorage.getItem('demoLoggedIn')
      if (!isLoggedIn) {
        router.push('/login')
        return
      }
      const savedRecords = localStorage.getItem(`demoRecords_${type}`)
      setRecords(savedRecords ? JSON.parse(savedRecords) : [])
    } else {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }

      const { data } = await supabase
        .from('records')
        .select('*')
        .eq('type', type)
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })

      setRecords(data || [])
    }
  }

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (file.size > 2 * 1024 * 1024) {
      alert('图片请控制在 2MB 以内，便于试用阶段更顺畅地保存。')
      event.target.value = ''
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : null
      setImagePreview(result)
    }
    reader.readAsDataURL(file)
    event.target.value = ''
  }

  const resetComposer = () => {
    setContent('')
    setImagePreview(null)
    setInspirationError('')
  }

  const handleSubmit = async () => {
    if (!content.trim() && !imagePreview) return

    setLoading(true)
    if (isDemo) {
      const newRecord: Record = {
        id: Date.now().toString(),
        content: content.trim(),
        created_at: new Date().toISOString(),
        image_url: imagePreview,
      }
      const updatedRecords = [newRecord, ...records]
      localStorage.setItem(`demoRecords_${type}`, JSON.stringify(updatedRecords))
      setRecords(updatedRecords)
      resetComposer()
    } else {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (session) {
        const { error } = await supabase.from('records').insert({
          user_id: session.user.id,
          type,
          content: content.trim(),
          image_url: imagePreview,
        })
        if (error) {
          if (/image_url/i.test(error.message)) {
            alert('数据库还没有添加图片字段，请把新的 supabase_schema.sql 再执行一次。')
          } else {
            alert(error.message)
          }
          setLoading(false)
          return
        }
        resetComposer()
        loadRecords()
      }
    }
    setLoading(false)
  }

  const getAiInspiration = async () => {
    setInspirationError('')

    if (isDemo) {
      const random = inspirations[Math.floor(Math.random() * inspirations.length)]
      setContent(random)
      return
    }

    setInspirationLoading(true)
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
          mode: 'inspiration',
          type,
        }),
      })

      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload?.error || payload?.details || 'AI 灵感暂时获取失败。')
      }

      setContent(payload.answer || '')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'AI 灵感暂时获取失败。'
      setInspirationError(message)
      const random = inspirations[Math.floor(Math.random() * inspirations.length)]
      setContent((current) => current || random)
    } finally {
      setInspirationLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#FDFBF7] flex flex-col">
      <div className="p-4 flex items-center gap-4 bg-white/50 border-b border-[#E8E0D5]">
        <button onClick={() => router.back()} className="p-2 hover:bg-white rounded-full">
          <ArrowLeft className="w-5 h-5 text-[#5C4D3D]" />
        </button>
        <h1 className="text-lg font-medium text-[#5C4D3D]">记录{type}时刻</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-4 pb-48">
        <div className="space-y-4 max-w-md mx-auto">
          {records.map((record) => (
            <div
              key={record.id}
              className="bg-white rounded-xl p-4 shadow-sm border border-[#E8E0D5]"
            >
              {record.image_url && (
                <img
                  src={record.image_url}
                  alt="记录图片"
                  className="mb-3 w-full rounded-xl border border-[#E8E0D5] object-cover"
                />
              )}
              <p className="text-[#5C4D3D] mb-2">{record.content}</p>
              <p className="text-xs text-[#8B7355]">
                {new Date(record.created_at).toLocaleString('zh-CN')}
              </p>
            </div>
          ))}
          {records.length === 0 && (
            <div className="text-center text-[#8B7355] py-12">
              还没有记录，开始写下第一条吧 ✨
            </div>
          )}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-[#FDFBF7] border-t border-[#E8E0D5] p-4">
        <div className="max-w-md mx-auto space-y-3">
          {type === '阵雨' && (
            <div className="bg-blue-50 text-blue-700 text-sm p-3 rounded-lg text-center">
              试着剥离情绪，只描述客观发生的事实，我们一起来想办法。
            </div>
          )}
          
          <div className="flex gap-2">
            <button
              onClick={getAiInspiration}
              disabled={inspirationLoading}
              className="flex items-center gap-2 rounded-xl border border-[#E8E0D5] bg-white px-3 py-3 text-sm text-[#8B7355] transition-colors hover:bg-[#FAF7F2] disabled:opacity-60"
            >
              {inspirationLoading ? (
                <Loader2 className="h-5 w-5 animate-spin text-[#8B7355]" />
              ) : (
                <Sparkles className="h-5 w-5 text-[#8B7355]" />
              )}
              <span>灵感</span>
            </button>

            <label className="p-3 bg-white rounded-xl border border-[#E8E0D5] hover:bg-[#FAF7F2] transition-colors flex-shrink-0 cursor-pointer">
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageChange}
              />
              <ImagePlus className="w-5 h-5 text-[#8B7355]" />
            </label>
            
            <div className="flex-1 relative">
              {imagePreview && (
                <div className="mb-3 relative overflow-hidden rounded-xl border border-[#E8E0D5] bg-white p-2">
                  <img
                    src={imagePreview}
                    alt="待上传图片"
                    className="max-h-48 w-full rounded-lg object-cover"
                  />
                  <button
                    onClick={() => setImagePreview(null)}
                    className="absolute right-4 top-4 rounded-full bg-white/90 p-1 text-[#8B7355] shadow-sm"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="写下你的想法，或配上一张照片..."
                rows={2}
                className="w-full p-3 pr-12 bg-white rounded-xl border border-[#E8E0D5] focus:outline-none focus:ring-2 focus:ring-[#8B7355] resize-none"
              />
              <button
                onClick={handleSubmit}
                disabled={loading || (!content.trim() && !imagePreview)}
                className="absolute right-2 bottom-2 p-2 bg-[#8B7355] text-white rounded-lg hover:bg-[#7A6348] disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>

          {inspirationError && (
            <div className="rounded-xl border border-[#F0D3D3] bg-[#FFF4F4] p-3 text-sm text-[#A45A52]">
              {inspirationError}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
