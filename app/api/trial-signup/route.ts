import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

export async function POST(request: Request) {
  try {
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        {
          error:
            '缺少服务端注册配置。请在 .env.local 中补充 SUPABASE_SERVICE_ROLE_KEY。',
        },
        { status: 500 }
      )
    }

    const body = await request.json()
    const username = typeof body.username === 'string' ? body.username.trim().toLowerCase() : ''
    const password = typeof body.password === 'string' ? body.password : ''
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''

    if (!/^[a-z0-9_]{2,20}$/.test(username)) {
      return NextResponse.json(
        { error: '用户名只支持 2-20 位字母、数字或下划线。' },
        { status: 400 }
      )
    }

    if (!password || password.length < 6) {
      return NextResponse.json(
        { error: '密码长度太短，请至少输入 6 位。' },
        { status: 400 }
      )
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    const { data, error } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        username,
        is_trial_user: true,
      },
    })

    if (error) {
      const message = error.message || '注册失败，请稍后重试。'
      if (/already been registered|already exists|duplicate/i.test(message)) {
        return NextResponse.json(
          { error: '这个用户名已经注册过了，请直接登录。' },
          { status: 409 }
        )
      }

      return NextResponse.json({ error: message }, { status: 400 })
    }

    return NextResponse.json({
      ok: true,
      userId: data.user?.id || null,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : '未知错误'
    return NextResponse.json(
      { error: `注册接口执行失败：${message}` },
      { status: 500 }
    )
  }
}
