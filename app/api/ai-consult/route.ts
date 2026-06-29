import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const aiApiUrl = process.env.AI_API_URL
const aiApiKey = process.env.AI_API_KEY
const aiModel = process.env.AI_MODEL || 'gpt-4o-mini'

type RecordRow = {
  type: string
  content: string
  created_at: string
}

type TagRow = {
  name: string
  color: string
}

export async function POST(request: Request) {
  try {
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { error: '缺少 Supabase 环境变量。' },
        { status: 500 }
      )
    }

    if (!aiApiUrl || !aiApiKey) {
      return NextResponse.json(
        { error: '尚未配置 AI_API_URL 或 AI_API_KEY。' },
        { status: 501 }
      )
    }

    const authorization = request.headers.get('authorization')
    const token = authorization?.replace(/^Bearer\s+/i, '').trim()

    if (!token) {
      return NextResponse.json(
        { error: '缺少用户登录令牌。' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const question = typeof body.question === 'string' ? body.question.trim() : ''
    const limit = typeof body.limit === 'number' ? Math.min(Math.max(body.limit, 1), 20) : 10

    if (!question) {
      return NextResponse.json(
        { error: '问题不能为空。' },
        { status: 400 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    })

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json(
        { error: '用户身份验证失败。' },
        { status: 401 }
      )
    }

    const [recordsResponse, tagsResponse] = await Promise.all([
      supabase
        .from('records')
        .select('type, content, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(limit),
      supabase
        .from('tags')
        .select('name, color')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),
    ])

    if (recordsResponse.error || tagsResponse.error) {
      return NextResponse.json(
        {
          error: '读取用户历史记录失败。',
          details: recordsResponse.error?.message || tagsResponse.error?.message,
        },
        { status: 500 }
      )
    }

    const records = (recordsResponse.data || []) as RecordRow[]
    const tags = (tagsResponse.data || []) as TagRow[]

    const recordsText = records.length
      ? records
          .map((record, index) => {
            const createdAt = new Date(record.created_at).toLocaleString('zh-CN', {
              hour12: false,
            })
            return `${index + 1}. [${record.type}] ${createdAt}\n${record.content}`
          })
          .join('\n\n')
      : '暂无历史记录'

    const tagsText = tags.length
      ? tags.map((tag) => `${tag.name}(${tag.color})`).join('、')
      : '暂无自定义标签'

    const aiResponse = await fetch(aiApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${aiApiKey}`,
      },
      body: JSON.stringify({
        model: aiModel,
        messages: [
          {
            role: 'system',
            content:
              '你是一个温柔、克制、注重边界的情绪整理助手。请基于用户的历史记录，给出有共情、不过度诊断、可执行的建议。',
          },
          {
            role: 'user',
            content: [
              `用户邮箱：${user.email || '未知'}`,
              `用户标签：${tagsText}`,
              `最近记录：\n${recordsText}`,
              `当前提问：${question}`,
            ].join('\n\n'),
          },
        ],
        temperature: 0.7,
      }),
    })

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text()
      return NextResponse.json(
        { error: 'AI 服务调用失败。', details: errorText },
        { status: 502 }
      )
    }

    const payload = await aiResponse.json()
    const answer =
      payload?.choices?.[0]?.message?.content ||
      payload?.output_text ||
      'AI 已成功响应，但未返回可识别的文本内容。'

    return NextResponse.json({
      answer,
      context: {
        userId: user.id,
        recentRecordCount: records.length,
        tagCount: tags.length,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : '未知错误'
    return NextResponse.json(
      { error: 'AI 咨询接口执行失败。', details: message },
      { status: 500 }
    )
  }
}
