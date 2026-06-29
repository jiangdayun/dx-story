'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Check, Trash2, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'

const defaultTagColor = '#D9A066'

interface CalendarTag {
  id: string
  name: string
  color: string
}

interface DayTagState {
  id: string
  tag_id: string
  target_date: string
  tag: CalendarTag | null
}

export default function CalendarPage() {
  const router = useRouter()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [tags, setTags] = useState<CalendarTag[]>([])
  const [dayTagStates, setDayTagStates] = useState<DayTagState[]>([])
  const [newTagName, setNewTagName] = useState('')
  const [newTagColor, setNewTagColor] = useState(defaultTagColor)
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const [tagActionMessage, setTagActionMessage] = useState('')
  const [tagActionError, setTagActionError] = useState('')
  const [savingDayTag, setSavingDayTag] = useState(false)
  const [dayStatesReady, setDayStatesReady] = useState(true)

  useEffect(() => {
    loadData()
  }, [currentDate])

  const loadData = async () => {
    setTagActionError('')
    setTagActionMessage('')
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      router.push('/login')
      return
    }

    const monthStart = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-01`
    const monthEnd = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate()).padStart(2, '0')}`

    const [tagsRes, dayStatesRes] = await Promise.all([
      supabase.from('tags').select('*').eq('user_id', session.user.id),
      supabase
        .from('day_tag_states')
        .select('id, tag_id, target_date')
        .eq('user_id', session.user.id)
        .gte('target_date', monthStart)
        .lte('target_date', monthEnd),
    ])

    const loadedTags = (tagsRes.data || []) as CalendarTag[]
    setTags(loadedTags)

    if (dayStatesRes.error) {
      setDayStatesReady(false)
      setTagActionError('每日标签状态还没有成功读取。请去 Supabase 重新执行最新的 `supabase_schema.sql`，这样才能给某一天设置标签。')
      setDayTagStates([])
      return
    }

    setDayStatesReady(true)
    const normalizedDayStates = ((dayStatesRes.data || []) as Array<{ id: string; tag_id: string; target_date: string }>).map((item) => ({
      id: item.id,
      tag_id: item.tag_id,
      target_date: item.target_date,
      tag: loadedTags.find((tag) => tag.id === item.tag_id) || null,
    }))
    setDayTagStates(normalizedDayStates)
  }

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const days = new Date(year, month + 1, 0).getDate()
    const firstDay = new Date(year, month, 1).getDay()
    return { days, firstDay }
  }

  const { days, firstDay } = getDaysInMonth(currentDate)
  const daysArray = Array.from({ length: days }, (_, i) => i + 1)
  const emptyDays = Array.from({ length: firstDay }, (_, i) => i)

  const getDateKey = (day: number) => {
    const year = currentDate.getFullYear()
    const month = String(currentDate.getMonth() + 1).padStart(2, '0')
    const date = String(day).padStart(2, '0')
    return `${year}-${month}-${date}`
  }

  const getDayTags = (day: number) => {
    const dateKey = getDateKey(day)
    return dayTagStates.filter((item) => item.target_date === dateKey)
  }

  const setLocalDayTagState = (dateKey: string, tag: CalendarTag | null) => {
    setDayTagStates((current) => {
      const remaining = current.filter((item) => item.target_date !== dateKey)
      if (!tag) return remaining

      return [
        {
          id: `temp-${dateKey}`,
          tag_id: tag.id,
          target_date: dateKey,
          tag,
        },
        ...remaining,
      ]
    })
  }

  const selectedDateKey = selectedDay ? getDateKey(selectedDay) : null
  const selectedDayTags = selectedDay ? getDayTags(selectedDay) : []
  const selectedDayState = selectedDayTags[0] || null

  const addTag = async () => {
    if (!newTagName.trim()) return
    const { data: { session } } = await supabase.auth.getSession()
    if (session) {
      setTagActionError('')
      const { error } = await supabase.from('tags').insert({
        user_id: session.user.id,
        name: newTagName.trim(),
        color: newTagColor,
      })
      if (error) {
        setTagActionError(`创建标签失败：${error.message}`)
        return
      }
      setNewTagName('')
      await loadData()
      setTagActionMessage(`已创建标签“${newTagName.trim()}”。`)
    }
  }

  const deleteTag = async (tagId: string) => {
    const { data: { session } } = await supabase.auth.getSession()
    if (session) {
      const { error: deleteStatesError } = await supabase
        .from('day_tag_states')
        .delete()
        .eq('tag_id', tagId)
        .eq('user_id', session.user.id)

      if (deleteStatesError) {
        setTagActionError(`删除标签失败：${deleteStatesError.message}`)
        return
      }

      const { error: deleteTagError } = await supabase
        .from('tags')
        .delete()
        .eq('id', tagId)
        .eq('user_id', session.user.id)

      if (deleteTagError) {
        setTagActionError(`删除标签失败：${deleteTagError.message}`)
        return
      }

      await loadData()
      setTagActionMessage('标签已删除。')
    }
  }

  const toggleTagForSelectedDay = async (tag: CalendarTag) => {
    if (!selectedDateKey || !dayStatesReady) return

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    setSavingDayTag(true)
    setTagActionError('')
    setTagActionMessage('')

    const existingStateForDate = dayTagStates.find(
      (item) => item.target_date === selectedDateKey
    )

    if (existingStateForDate?.tag_id === tag.id) {
      setLocalDayTagState(selectedDateKey, null)

      const { error } = await supabase
        .from('day_tag_states')
        .delete()
        .eq('id', existingStateForDate.id)
        .eq('user_id', session.user.id)

      if (error) {
        setTagActionError(`移除标签失败：${error.message}`)
        await loadData()
        setSavingDayTag(false)
        return
      }

      setTagActionMessage(`已移除 ${currentDate.getMonth() + 1} 月 ${selectedDay} 日的标签。`)
    } else {
      setLocalDayTagState(selectedDateKey, tag)

      const deleteRes = await supabase
        .from('day_tag_states')
        .delete()
        .eq('target_date', selectedDateKey)
        .eq('user_id', session.user.id)

      if (deleteRes.error) {
        setTagActionError(`更新标签失败：${deleteRes.error.message}`)
        await loadData()
        setSavingDayTag(false)
        return
      }

      const insertRes = await supabase.from('day_tag_states').insert({
        user_id: session.user.id,
        tag_id: tag.id,
        target_date: selectedDateKey,
      })

      if (insertRes.error) {
        setTagActionError(`设置标签失败：${insertRes.error.message}`)
        await loadData()
        setSavingDayTag(false)
        return
      }

      setTagActionMessage(`已将 ${currentDate.getMonth() + 1} 月 ${selectedDay} 日标记为“${tag.name}”。`)
    }

    await loadData()
    setSavingDayTag(false)
  }

  const removeStateFromSelectedDay = async (stateId: string) => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    if (!selectedDateKey) return

    const previousState = dayTagStates.find((item) => item.id === stateId) || null
    setSavingDayTag(true)
    setTagActionError('')
    setTagActionMessage('')
    setLocalDayTagState(selectedDateKey, null)

    const { error } = await supabase
      .from('day_tag_states')
      .delete()
      .eq('id', stateId)
      .eq('user_id', session.user.id)

    if (error) {
      if (previousState?.tag) {
        setLocalDayTagState(selectedDateKey, previousState.tag)
      }
      setTagActionError(`删除当天标签失败：${error.message}`)
      await loadData()
      setSavingDayTag(false)
      return
    }

    setTagActionMessage(`已清空 ${currentDate.getMonth() + 1} 月 ${selectedDay} 日的标签。`)
    await loadData()
    setSavingDayTag(false)
  }

  const goToPreviousMonth = () => {
    const nextDate = new Date(currentDate)
    nextDate.setMonth(nextDate.getMonth() - 1)
    setCurrentDate(nextDate)
    setSelectedDay(null)
  }

  const goToNextMonth = () => {
    const nextDate = new Date(currentDate)
    nextDate.setMonth(nextDate.getMonth() + 1)
    setCurrentDate(nextDate)
    setSelectedDay(null)
  }

  return (
    <div className="min-h-screen bg-[#FDFBF7]">
      <div className="p-4 flex items-center gap-4 bg-white/50 border-b border-[#E8E0D5]">
        <button onClick={() => router.back()} className="p-2 hover:bg-white rounded-full">
          <ArrowLeft className="w-5 h-5 text-[#5C4D3D]" />
        </button>
        <h1 className="text-lg font-medium text-[#5C4D3D]">情绪热力日历</h1>
      </div>

      <div className="p-4 max-w-md mx-auto">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={goToPreviousMonth}
            className="p-2 hover:bg-white rounded-full"
          >
            ←
          </button>
          <h2 className="text-lg font-medium text-[#5C4D3D]">
            {currentDate.getFullYear()}年{currentDate.getMonth() + 1}月
          </h2>
          <button
            onClick={goToNextMonth}
            className="p-2 hover:bg-white rounded-full"
          >
            →
          </button>
        </div>

        <div className="mb-4 rounded-xl border border-[#E8E0D5] bg-white p-3 text-sm text-[#8B7355]">
          <p className="font-medium text-[#5C4D3D]">显示说明</p>
          <p className="mt-1">这个日历现在只显示你为某一天设置的“标签状态”。有状态的日期会显示一个对应颜色的小圆点；没有设置的日期不会显示任何点。</p>
        </div>

        <div className="grid grid-cols-7 gap-2 mb-4">
          {['日', '一', '二', '三', '四', '五', '六'].map(day => (
            <div key={day} className="text-center text-sm text-[#8B7355] py-2">
              {day}
            </div>
          ))}
          {emptyDays.map(day => (
            <div key={`empty-${day}`} className="aspect-square" />
          ))}
          {daysArray.map(day => {
            const dayTags = getDayTags(day)
            const dayTag = dayTags[0] || null
            return (
              <button
                key={day}
                onClick={() => setSelectedDay(day)}
                className={`aspect-square flex flex-col items-center justify-center rounded-lg border relative px-1 transition ${
                  selectedDay === day
                    ? 'border-[#8B7355] ring-2 ring-[#D9C5AA]'
                    : 'border-[#E8E0D5] hover:border-[#CDB99C]'
                }`}
                style={{
                  backgroundColor: dayTag?.tag?.color ? `${dayTag.tag.color}18` : '#FFFFFF',
                }}
              >
                <span className="text-sm font-medium text-[#5C4D3D]">{day}</span>
                <div className="mt-2 min-h-[28px] flex max-w-full items-center justify-center px-1">
                  {dayTag && (
                    <div
                      className="h-3.5 w-3.5 rounded-full border border-white/90 shadow-sm"
                      style={{ backgroundColor: dayTag.tag?.color || defaultTagColor }}
                      title={dayTag.tag?.name || '标签'}
                    />
                  )}
                </div>
              </button>
            )
          })}
        </div>

        <div className="rounded-xl bg-white p-4 shadow-sm border border-[#E8E0D5]">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-medium text-[#5C4D3D]">
              {selectedDay ? `${currentDate.getMonth() + 1}月${selectedDay}日标签状态` : '每日标签状态'}
            </h3>
            {selectedDay && (
              <button
                onClick={() => setSelectedDay(null)}
                className="rounded-full p-2 text-[#8B7355] hover:bg-[#FAF7F2]"
                aria-label="关闭日期标签面板"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {!selectedDay && (
            <p className="text-sm text-[#8B7355]">点一下日历中的某一天，就能查看、添加或修改当天的标签状态。</p>
          )}

          {selectedDay && (
            <div className="space-y-4">
              <div>
                <p className="mb-2 text-sm text-[#8B7355]">当天已选标签</p>
                {!selectedDayState ? (
                  <p className="text-sm text-[#B19778]">这一天还没有标签状态。</p>
                ) : (
                  <button
                    onClick={() => removeStateFromSelectedDay(selectedDayState.id)}
                    className="flex items-center gap-2 rounded-full px-3 py-1.5 text-sm text-white"
                    style={{ backgroundColor: selectedDayState.tag?.color || '#8B7355' }}
                  >
                    <span>{selectedDayState.tag?.name || '标签'}</span>
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>

              <div>
                <p className="mb-2 text-sm text-[#8B7355]">点击下方标签即可设置或修改当天标签</p>
                {!dayStatesReady ? (
                  <p className="text-sm text-[#B19778]">日历标签数据库还没有就绪，暂时不能保存当天状态。</p>
                ) : tags.length === 0 ? (
                  <p className="text-sm text-[#B19778]">请先在下方创建自定义标签。</p>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {tags.map((tag) => {
                      const active = selectedDayState?.tag_id === tag.id
                      return (
                        <button
                          key={tag.id}
                          onClick={() => toggleTagForSelectedDay(tag)}
                          disabled={savingDayTag}
                          className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm transition ${
                            active ? 'border-transparent text-white shadow-sm' : 'border-[#E8E0D5] bg-[#FAF7F2] text-[#5C4D3D] hover:border-[#CDB99C]'
                          } ${savingDayTag ? 'opacity-60' : ''}`}
                          style={active ? { backgroundColor: tag.color } : undefined}
                        >
                          <span
                            className="h-3 w-3 rounded-full border border-white/70"
                            style={{ backgroundColor: tag.color }}
                          />
                          <span>{tag.name}</span>
                          {active && <Check className="h-3.5 w-3.5" />}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              {savingDayTag && (
                <p className="text-sm text-[#8B7355]">正在保存当天标签...</p>
              )}
              {tagActionMessage && (
                <p className="rounded-lg bg-[#F5F0E8] px-3 py-2 text-sm text-[#5C4D3D]">{tagActionMessage}</p>
              )}
              {tagActionError && (
                <p className="rounded-lg bg-[#FFF1F1] px-3 py-2 text-sm text-[#A45A52]">{tagActionError}</p>
              )}
            </div>
          )}
        </div>

        <div className="mt-8 bg-white rounded-xl p-4 shadow-sm border border-[#E8E0D5]">
          <h3 className="font-medium text-[#5C4D3D] mb-4">自定义标签</h3>
          
          <div className="space-y-3 mb-4">
            {tags.map(tag => (
              <div key={tag.id} className="flex items-center justify-between gap-3 rounded-lg bg-[#FAF7F2] px-3 py-2">
                <div className="flex items-center gap-2">
                  <div
                    className="w-4 h-4 rounded-full border border-white/70"
                    style={{ backgroundColor: tag.color }}
                  />
                  <span className="text-sm text-[#5C4D3D]">{tag.name}</span>
                </div>
                <button
                  onClick={() => deleteTag(tag.id)}
                  className="rounded-full p-2 text-[#8B7355] hover:bg-white"
                  aria-label={`删除标签 ${tag.name}`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          <div className="flex gap-2 items-center">
            <input
              type="text"
              placeholder="标签名称"
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              className="flex-1 px-3 py-2 border border-[#E8E0D5] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8B7355]"
            />
            <div className="flex items-center gap-2 rounded-lg border border-[#E8E0D5] bg-white px-3 py-2">
              <span
                className="h-4 w-4 rounded-full border border-white/70"
                style={{ backgroundColor: newTagColor }}
              />
              <input
                type="color"
                aria-label="选择标签颜色"
                value={newTagColor}
                onChange={(e) => setNewTagColor(e.target.value)}
                className="h-8 w-10 cursor-pointer border-0 bg-transparent p-0"
              />
            </div>
            <button
              onClick={addTag}
              className="px-4 py-2 bg-[#8B7355] text-white rounded-lg hover:bg-[#7A6348]"
            >
              添加
            </button>
          </div>

          <p className="mt-3 text-xs text-[#B19778]">创建好标签后，点击上面的某一天，再点标签即可把这一天标记成对应状态。</p>
        </div>
      </div>
    </div>
  )
}
