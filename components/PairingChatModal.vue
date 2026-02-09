<script setup lang="ts">
const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const { t } = useI18n({ useScope: 'global' })

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

const messages = ref<ChatMessage[]>([])
const inputMessage = ref('')
const isLoading = ref(false)
const error = ref('')
const chatContainer = ref<HTMLElement | null>(null)

const closeModal = () => {
  emit('update:modelValue', false)
}

const scrollToBottom = () => {
  nextTick(() => {
    if (chatContainer.value) {
      chatContainer.value.scrollTop = chatContainer.value.scrollHeight
    }
  })
}

const sendMessage = async () => {
  if (!inputMessage.value.trim() || isLoading.value) return

  const userMessage = inputMessage.value.trim()
  inputMessage.value = ''
  error.value = ''

  messages.value.push({ role: 'user', content: userMessage })
  scrollToBottom()

  isLoading.value = true
  try {
    const result = await $fetch<{ reply: string }>('/api/chat/pairing', {
      method: 'POST',
      body: {
        message: userMessage,
        history: messages.value.slice(0, -1),
      },
    })
    messages.value.push({ role: 'assistant', content: result.reply })
    scrollToBottom()
  } catch (e: unknown) {
    const fetchError = e as { data?: { message?: string }; statusCode?: number }
    if (fetchError.statusCode === 503) {
      error.value = t('pairing.aiNotConfigured')
    } else {
      error.value = t('pairing.failedToRespond')
    }
  } finally {
    isLoading.value = false
  }
}

// Reset on open
watch(() => props.modelValue, (isOpen) => {
  if (isOpen && messages.value.length === 0) {
    messages.value = [{
      role: 'assistant',
      content: t('pairing.greeting'),
    }]
  }
})

// Escape key
const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && props.modelValue) {
    closeModal()
  }
}

onMounted(() => window.addEventListener('keydown', handleKeydown))
onUnmounted(() => window.removeEventListener('keydown', handleKeydown))
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition ease-out duration-200"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition ease-in duration-150"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="modelValue"
        class="fixed inset-0 z-50 overflow-y-auto"
      >
        <!-- Backdrop -->
        <div
          class="fixed inset-0 bg-muted-900/50"
          @click="closeModal"
        />

        <!-- Modal -->
        <div class="relative min-h-screen flex items-center justify-center p-4">
          <Transition
            enter-active-class="transition ease-out duration-200"
            enter-from-class="opacity-0 scale-95"
            enter-to-class="opacity-100 scale-100"
            leave-active-class="transition ease-in duration-150"
            leave-from-class="opacity-100 scale-100"
            leave-to-class="opacity-0 scale-95"
          >
            <div
              v-if="modelValue"
              class="relative bg-white rounded-xl border-2 border-muted-200 w-full max-w-lg flex flex-col"
              style="max-height: 80vh"
              @click.stop
            >
              <!-- Header -->
              <div class="bg-white border-b border-muted-200 px-6 py-4 flex items-center justify-between flex-shrink-0">
                <div class="flex items-center gap-2.5">
                  <div class="w-8 h-8 rounded-lg bg-secondary-100 flex items-center justify-center">
                    <svg class="w-4 h-4 text-secondary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </div>
                  <h2 class="text-lg font-display font-bold text-muted-900">{{ $t('pairing.title') }}</h2>
                </div>
                <button
                  type="button"
                  class="text-muted-400 hover:text-muted-600 transition-transform hover:scale-105"
                  @click="closeModal"
                >
                  <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <!-- Messages -->
              <div
                ref="chatContainer"
                class="flex-1 overflow-y-auto px-6 py-4 space-y-4"
              >
                <div
                  v-for="(msg, idx) in messages"
                  :key="idx"
                  class="flex"
                  :class="msg.role === 'user' ? 'justify-end' : 'justify-start'"
                >
                  <div
                    class="max-w-[80%] rounded-2xl px-4 py-3 text-sm"
                    :class="msg.role === 'user'
                      ? 'bg-primary-600 text-white rounded-br-md'
                      : 'bg-muted-100 text-muted-800 rounded-bl-md'"
                  >
                    <p class="whitespace-pre-wrap">{{ msg.content }}</p>
                  </div>
                </div>

                <!-- Loading indicator -->
                <div v-if="isLoading" class="flex justify-start">
                  <div class="bg-muted-100 rounded-2xl rounded-bl-md px-4 py-3">
                    <div class="flex items-center gap-1.5">
                      <div class="w-2 h-2 bg-muted-400 rounded-full animate-bounce" style="animation-delay: 0ms" />
                      <div class="w-2 h-2 bg-muted-400 rounded-full animate-bounce" style="animation-delay: 150ms" />
                      <div class="w-2 h-2 bg-muted-400 rounded-full animate-bounce" style="animation-delay: 300ms" />
                    </div>
                  </div>
                </div>

                <!-- Error -->
                <div v-if="error" class="p-3 text-sm text-red-700 bg-red-50 rounded-lg">
                  {{ error }}
                </div>
              </div>

              <!-- Input -->
              <div class="border-t border-muted-200 px-6 py-4 flex-shrink-0">
                <div class="flex gap-2">
                  <input
                    v-model="inputMessage"
                    type="text"
                    :placeholder="$t('pairing.placeholder')"
                    class="input flex-1 text-sm"
                    :disabled="isLoading"
                    @keydown.enter="sendMessage"
                  >
                  <button
                    type="button"
                    class="px-4 py-2 text-sm font-semibold text-white bg-secondary-600 rounded-xl hover:bg-secondary-700 hover:scale-105 transition-all disabled:opacity-50"
                    :disabled="isLoading || !inputMessage.trim()"
                    @click="sendMessage"
                  >
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  </button>
                </div>
                <p class="text-xs text-muted-400 mt-2">{{ $t('pairing.hint') }}</p>
              </div>
            </div>
          </Transition>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
