import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useJournalStore } from './journal'

export type JournalList = 'record' | 'plan'

// A one-shot destination for tab navigation; never persisted with food data.
export const useJournalNavigation = defineStore('journalNavigation', () => {
  const requestedList = ref<JournalList | null>(null)
  function openToday(list: JournalList) {
    const journal = useJournalStore()
    journal.refresh()
    journal.selectDate(journal.today)
    requestedList.value = list
    uni.switchTab({
      url: '/pages/record/index',
      fail: () => {
        requestedList.value = null
        uni.showToast({ title: '页面未打开，请从底部「记录」进入', icon: 'none' })
      },
    })
  }
  function consume() {
    const list = requestedList.value
    requestedList.value = null
    return list
  }
  return { openToday, consume }
})
