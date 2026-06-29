import type { Metadata } from 'next'
import './globals.css'
import AiChatWidget from '@/components/AiChatWidget'

export const metadata: Metadata = {
  title: '我和我们的切片',
  description: '记录生活中的高光、阵雨和顿悟时刻',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen bg-[#FDFBF7]">
        {children}
        <AiChatWidget />
      </body>
    </html>
  )
}
