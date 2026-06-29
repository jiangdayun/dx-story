import OpenAI from 'openai'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const aiApiKey = process.env.AI_API_KEY
const aiBaseUrl = process.env.AI_BASE_URL
const aiModel = process.env.AI_MODEL || 'glm-4-flash'

type ChatMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

type RecordRow = {
  type: string
  content: string
  created_at: string
}

type TagRow = {
  id: string
  name: string
  color: string
}

type DayTagStateRow = {
  target_date: string
  tag_id: string
}

type ChatRequest = {
  messages?: ChatMessage[]
  mode?: 'chat' | 'inspiration'
  type?: '高光' | '阵雨' | '顿悟'
  limit?: number
}

type RecordType = '高光' | '阵雨' | '顿悟'

const typePrompts: Record<RecordType, string> = {
  高光: '请给用户一个温柔、具体、容易下笔的写作引导，帮助他记录今天的高光时刻，语气轻盈但不空泛。',
  阵雨: '请给用户一个冷静、温和、有边界感的写作引导，帮助他描述今天的低落、争执或委屈，先聚焦事实与感受，不做过度诊断。',
  顿悟: '请给用户一个清晰、启发式的写作引导，帮助他记录今天突然想明白的一件事，鼓励他写下触发点、感受和变化。',
}

function isRecordType(value: unknown): value is RecordType {
  return value === '高光' || value === '阵雨' || value === '顿悟'
}

function createAuthedSupabase(token: string) {
  return createClient(supabaseUrl!, supabaseAnonKey!, {
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
}

function buildSystemPrompt(mode: 'chat' | 'inspiration', userLabel: string) {
  if (mode === 'inspiration') {
    return [
      '你是一位擅长陪伴写作的温柔引导者。',
      '你的任务不是长篇分析，而是给出一小段可直接使用的写作引导。',
      '请使用中文，控制在 2 到 4 句，具体、自然、可落笔。',
      `当前用户：${userLabel}。`,
    ].join('\n')
  }

  return [
    '你是一个冷静、温和、懂心理学和亲密关系的倾听者。',
    '你会先理解用户，再给出不过度诊断、不过度控制的回应。',
    '请使用中文，保持真诚、克制、有边界感；必要时给出 2 到 3 条可执行建议。',
    `当前用户：${userLabel}。`,
  ].join('\n')
}

function formatRecords(records: RecordRow[]) {
  if (!records.length) return '暂无历史记录。'

  return records
    .map((record, index) => {
      const createdAt = new Date(record.created_at).toLocaleString('zh-CN', {
        hour12: false,
      })
      return `${index + 1}. [${record.type}] ${createdAt}\n${record.content || '无文字内容'}`
    })
    .join('\n\n')
}

function formatTags(tags: TagRow[]) {
  if (!tags.length) return '暂无自定义标签。'
  return tags.map((tag) => `${tag.name}（${tag.color}）`).join('、')
}

function formatDayTagStates(dayTagStates: DayTagStateRow[], tags: TagRow[]) {
  if (!dayTagStates.length) return '最近没有设置情绪热力图标签。'

  return dayTagStates
    .map((state) => {
      const matchedTag = tags.find((tag) => tag.id === state.tag_id)
      const tagName = matchedTag?.name || '未知标签'
      const tagColor = matchedTag?.color || '未知颜色'
      return `${state.target_date}: ${tagName}（${tagColor}）`
    })
    .join('\n')
}

export async function POST(request: Request) {
  try {
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ error: '缺少 Supabase 环境变量。' }, { status: 500 })
    }

    if (!aiApiKey || !aiBaseUrl) {
      return NextResponse.json({ error: '缺少 AI_API_KEY 或 AI_BASE_URL。' }, { status: 500 })
    }

    const authorization = request.headers.get('authorization')
    const token = authorization?.replace(/^Bearer\s+/i, '').trim()
    if (!token) {
      return NextResponse.json({ error: '缺少用户登录令牌。' }, { status: 401 })
    }

    const body = (await request.json()) as ChatRequest
    const messages = Array.isArray(body.messages) ? body.messages.filter((item) => item?.content?.trim()) : []
    const mode = body.mode === 'inspiration' ? 'inspiration' : 'chat'
    const recordType = body.type
    const inspirationType = isRecordType(recordType) ? recordType : null
    const limit = typeof body.limit === 'number' ? Math.min(Math.max(body.limit, 1), 20) : 10

    if (!messages.length && mode !== 'inspiration') {
      return NextResponse.json({ error: '对话内容不能为空。' }, { status: 400 })
    }

    if (mode === 'inspiration' && !inspirationType) {
      return NextResponse.json({ error: '灵感模式缺少记录分类。' }, { status: 400 })
    }

    const supabase = createAuthedSupabase(token)
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ error: '用户身份验证失败。' }, { status: 401 })
    }

    const [recordsRes, tagsRes, dayStatesRes] = await Promise.all([
      supabase
        .from('records')
        .select('type, content, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(limit),
      supabase
        .from('tags')
        .select('id, name, color')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('day_tag_states')
        .select('target_date, tag_id')
        .eq('user_id', user.id)
        .order('target_date', { ascending: false })
        .limit(60),
    ])

    if (recordsRes.error || tagsRes.error || dayStatesRes.error) {
      return NextResponse.json(
        {
          error: '读取用户历史记录失败。',
          details:
            recordsRes.error?.message ||
            tagsRes.error?.message ||
            dayStatesRes.error?.message,
        },
        { status: 500 }
      )
    }

    const records = (recordsRes.data || []) as RecordRow[]
    const tags = (tagsRes.data || []) as TagRow[]
    const dayTagStates = (dayStatesRes.data || []) as DayTagStateRow[]
    const userLabel = user.email || user.id
    const openai = new OpenAI({
      apiKey: aiApiKey,
      baseURL: aiBaseUrl,
    })

    const contextMessage: ChatMessage = {
      role: 'system',
      content: [
        '以下是当前用户的背景信息，请你据此理解对话，但不要机械复述。',
        `用户标识：${userLabel}`,
        `最近记录：\n${formatRecords(records)}`,
        `自定义标签：${formatTags(tags)}`,
        `情绪热力图最近标签状态：\n${formatDayTagStates(dayTagStates, tags)}`,
      ].join('\n\n'),
    }

    const promptMessages: ChatMessage[] =
      mode === 'inspiration'
        ? [
            {
              role: 'user',
              content: [
                `用户想记录的分类：${inspirationType}`,
                typePrompts[inspirationType!],
                '请直接输出一段可以放进输入框的灵感引导，不要加标题，不要用项目符号。',
              ].join('\n'),
            },
          ]
        : messages.map((message) => ({
            role: message.role,
            content: message.content.trim(),
          }))

    const completion = await openai.chat.completions.create({
      model: aiModel,
      temperature: mode === 'inspiration' ? 0.9 : 0.7,
      messages: [
        { role: 'system', content: buildSystemPrompt(mode, userLabel) },
        contextMessage,
        ...promptMessages,
      ],
    })

    const answer = completion.choices[0]?.message?.content?.trim()
    if (!answer) {
      return NextResponse.json({ error: 'AI 未返回有效内容。' }, { status: 502 })
    }

    return NextResponse.json({
      answer,
      model: aiModel,
      mode,
      context: {
        userId: user.id,
        recentRecordCount: records.length,
        tagCount: tags.length,
        dayTagStateCount: dayTagStates.length,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : '未知错误'
    return NextResponse.json(
      { error: 'AI 对话接口执行失败。', details: message },
      { status: 500 }
    )
  }
}
