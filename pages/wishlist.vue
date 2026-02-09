<script setup lang="ts">
definePageMeta({
  middleware: 'auth',
})

const { t } = useI18n({ useScope: 'global' })
const route = useRoute()

// Filter state
const itemTypeFilter = ref(route.query.type as string || '')

// Modal state
const showModal = ref(false)
const isAdding = ref(false)
const newItem = ref({
  itemType: 'wine' as 'wine' | 'producer',
  name: '',
  vintage: null as number | null,
  notes: '',
  priceTarget: '',
  priceCurrency: 'EUR' as 'EUR' | 'USD' | 'GBP' | 'ZAR' | 'CHF',
  url: '',
  regionId: null as number | null,
  winesOfInterest: '',
})

// Delete confirmation
const deletingId = ref<number | null>(null)

// Reference data
const { data: regionsData } = await useFetch('/api/regions')

// Fetch wishlist
const { data: items, refresh, pending } = await useFetch('/api/wishlist', {
  query: computed(() => ({
    itemType: itemTypeFilter.value || undefined,
  })),
})

// Tabs
const tabs = computed(() => [
  { value: '', label: t('wishlist.all') },
  { value: 'wine', label: t('wishlist.wines') },
  { value: 'producer', label: t('wishlist.producers') },
])

const getTypeBadgeClasses = (type: string) => {
  return type === 'wine'
    ? 'bg-primary-100 text-primary-700'
    : 'bg-purple-100 text-purple-700'
}

const getTypeLabel = (type: string) => {
  return type === 'wine' ? t('wishlist.wine') : t('wishlist.producer')
}

const formatCurrency = (value: string | number | null, currency = 'EUR') => {
  if (!value) return null
  return new Intl.NumberFormat('en-EU', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
  }).format(Number(value))
}

const formatDate = (date: string | Date | null) => {
  if (!date) return '-'
  return new Date(date).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

const openModal = () => {
  const defaultType = itemTypeFilter.value === 'wine' || itemTypeFilter.value === 'producer'
    ? itemTypeFilter.value
    : 'wine'
  newItem.value = {
    itemType: defaultType,
    name: '',
    vintage: null,
    notes: '',
    priceTarget: '',
    priceCurrency: 'EUR',
    url: '',
    regionId: null,
    winesOfInterest: '',
  }
  showModal.value = true
}

const closeModal = () => {
  showModal.value = false
}

const addItem = async () => {
  if (!newItem.value.name.trim()) return

  isAdding.value = true
  const isWine = newItem.value.itemType === 'wine'
  try {
    await $fetch('/api/wishlist', {
      method: 'POST',
      body: {
        itemType: newItem.value.itemType,
        name: newItem.value.name.trim(),
        vintage: isWine && newItem.value.vintage ? newItem.value.vintage : null,
        notes: newItem.value.notes.trim() || null,
        priceTarget: isWine && newItem.value.priceTarget ? newItem.value.priceTarget : null,
        priceCurrency: isWine ? newItem.value.priceCurrency : undefined,
        url: isWine && newItem.value.url.trim() ? newItem.value.url.trim() : null,
        regionId: !isWine && newItem.value.regionId ? newItem.value.regionId : null,
        winesOfInterest: !isWine && newItem.value.winesOfInterest.trim() ? newItem.value.winesOfInterest.trim() : null,
      },
    })
    closeModal()
    await refresh()
  } catch (e) {
    console.error('Failed to add wishlist item', e)
  } finally {
    isAdding.value = false
  }
}

const deleteItem = async (id: number) => {
  try {
    await $fetch(`/api/wishlist/${id}`, { method: 'DELETE' })
    deletingId.value = null
    await refresh()
  } catch (e) {
    console.error('Failed to delete wishlist item', e)
  }
}

const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && showModal.value) {
    closeModal()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <div>
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
      <div>
        <h1 class="text-2xl font-bold text-muted-900">{{ $t('wishlist.title') }}</h1>
        <p class="mt-1 text-sm text-muted-500">{{ $t('wishlist.subtitle') }}</p>
      </div>
      <button
        class="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-primary-600 rounded-lg hover:bg-primary-700 hover:scale-105 transition-transform"
        @click="openModal"
      >
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
        {{ $t('wishlist.addToWishlist') }}
      </button>
    </div>

    <!-- Type tabs -->
    <div class="flex gap-1 border-b border-muted-200 mb-4 overflow-x-auto">
      <button
        v-for="tab in tabs"
        :key="tab.value"
        class="px-3 sm:px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors whitespace-nowrap"
        :class="itemTypeFilter === tab.value
          ? 'text-primary-600 border-primary-600'
          : 'text-muted-500 border-transparent hover:text-muted-700 hover:border-muted-300'"
        @click="itemTypeFilter = tab.value"
      >
        {{ tab.label }}
      </button>
    </div>

    <!-- Loading state -->
    <div v-if="pending" class="text-center py-12">
      <p class="text-muted-500">{{ $t('wishlist.loadingWishlist') }}</p>
    </div>

    <!-- Empty state -->
    <div v-else-if="!items?.length" class="text-center py-12">
      <svg class="mx-auto h-12 w-12 text-muted-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
      </svg>
      <h3 class="mt-4 text-lg font-semibold text-muted-900">{{ $t('wishlist.nothingOnWishlist') }}</h3>
      <p class="mt-2 text-sm text-muted-500">
        {{ itemTypeFilter ? $t('wishlist.noItemsFilter') : $t('wishlist.noItemsEmpty') }}
      </p>
      <button
        class="mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-primary-600 bg-primary-50 rounded-lg hover:bg-primary-100 hover:scale-102 transition-transform"
        @click="openModal"
      >
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
        {{ $t('wishlist.addFirstItem') }}
      </button>
    </div>

    <!-- Wishlist cards -->
    <div v-else class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <div
        v-for="item in items"
        :key="item.id"
        class="bg-white border border-muted-200 rounded-lg p-4 hover:border-muted-300 transition-colors"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-1">
              <span
                class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold flex-shrink-0"
                :class="getTypeBadgeClasses(item.itemType)"
              >
                {{ getTypeLabel(item.itemType) }}
              </span>
              <span v-if="item.vintage" class="text-xs text-muted-500">{{ item.vintage }}</span>
              <span v-if="item.regionName" class="text-xs text-muted-500">{{ item.regionName }}</span>
            </div>
            <h3 class="font-display font-bold text-muted-900 truncate">{{ item.name }}</h3>
          </div>

          <div class="flex-shrink-0">
            <button
              v-if="deletingId !== item.id"
              class="p-1.5 text-muted-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors"
              @click="deletingId = item.id"
            >
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
            <div v-else class="flex items-center gap-1">
              <button
                class="p-1.5 text-red-600 hover:text-red-700 rounded-lg hover:bg-red-50 transition-colors"
                @click="deleteItem(item.id)"
              >
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>
              </button>
              <button
                class="p-1.5 text-muted-400 hover:text-muted-600 rounded-lg hover:bg-muted-100 transition-colors"
                @click="deletingId = null"
              >
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        <p v-if="item.winesOfInterest" class="mt-2 text-sm text-muted-600">
          <span class="text-xs font-semibold text-muted-400">{{ $t('wishlist.winesLabel') }}</span> {{ item.winesOfInterest }}
        </p>

        <p v-if="item.notes" class="mt-2 text-sm text-muted-600 line-clamp-2">{{ item.notes }}</p>

        <div class="flex items-center gap-3 mt-3 pt-3 border-t border-muted-100 text-xs text-muted-500">
          <span v-if="item.priceTarget" class="font-semibold text-muted-700">
            {{ formatCurrency(item.priceTarget, item.priceCurrency || 'EUR') }}
          </span>
          <a
            v-if="item.url"
            :href="item.url"
            target="_blank"
            rel="noopener noreferrer"
            class="text-primary-600 hover:text-primary-700 hover:underline truncate"
          >
            {{ $t('wishlist.link') }}
          </a>
          <span class="ml-auto">{{ formatDate(item.createdAt) }}</span>
        </div>
      </div>
    </div>

    <!-- Add Modal -->
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
          v-if="showModal"
          class="fixed inset-0 z-50 overflow-y-auto"
        >
          <div
            class="fixed inset-0 bg-muted-900/50"
            @click="closeModal"
          />

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
                v-if="showModal"
                class="relative bg-white rounded-xl border-2 border-muted-200 w-full max-w-lg"
                @click.stop
              >
                <!-- Header -->
                <div class="border-b border-muted-200 px-6 py-4 flex items-center justify-between">
                  <h2 class="text-xl font-semibold text-muted-900">{{ $t('wishlist.addToWishlist') }}</h2>
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

                <!-- Content -->
                <div class="p-6 space-y-4">
                  <div>
                    <label class="block text-xs font-semibold text-muted-500 mb-1">{{ $t('wishlist.type') }}</label>
                    <select v-model="newItem.itemType" class="input text-sm">
                      <option value="wine">{{ $t('wishlist.wine') }}</option>
                      <option value="producer">{{ $t('wishlist.producerDomaine') }}</option>
                    </select>
                  </div>

                  <div>
                    <label class="block text-xs font-semibold text-muted-500 mb-1">{{ $t('wishlist.name') }}</label>
                    <input
                      v-model="newItem.name"
                      type="text"
                      class="input text-sm"
                      :placeholder="newItem.itemType === 'wine' ? $t('wishlist.wineNamePlaceholder') : $t('wishlist.producerNamePlaceholder')"
                    >
                  </div>

                  <!-- Wine-specific fields -->
                  <template v-if="newItem.itemType === 'wine'">
                    <div>
                      <label class="block text-xs font-semibold text-muted-500 mb-1">{{ $t('wishlist.vintageOptional') }}</label>
                      <input
                        v-model.number="newItem.vintage"
                        type="number"
                        min="1900"
                        max="2100"
                        class="input text-sm w-32"
                        placeholder="e.g. 2020"
                      >
                    </div>

                    <div>
                      <label class="block text-xs font-semibold text-muted-500 mb-1">{{ $t('wishlist.priceTarget') }}</label>
                      <div class="flex gap-2">
                        <input
                          v-model="newItem.priceTarget"
                          type="text"
                          class="input text-sm flex-1"
                          placeholder="e.g. 50"
                        >
                        <select v-model="newItem.priceCurrency" class="input text-sm w-24">
                          <option value="EUR">EUR</option>
                          <option value="USD">USD</option>
                          <option value="GBP">GBP</option>
                          <option value="ZAR">ZAR</option>
                          <option value="CHF">CHF</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label class="block text-xs font-semibold text-muted-500 mb-1">{{ $t('wishlist.linkOptional') }}</label>
                      <input
                        v-model="newItem.url"
                        type="url"
                        class="input text-sm"
                        placeholder="https://..."
                      >
                    </div>
                  </template>

                  <!-- Producer-specific fields -->
                  <template v-if="newItem.itemType === 'producer'">
                    <div>
                      <label class="block text-xs font-semibold text-muted-500 mb-1">{{ $t('wishlist.regionOptional') }}</label>
                      <select v-model="newItem.regionId" class="input text-sm">
                        <option :value="null">{{ $t('wishlist.selectRegion') }}</option>
                        <option v-for="r in regionsData" :key="r.id" :value="r.id">
                          {{ r.name }}
                        </option>
                      </select>
                    </div>

                    <div>
                      <label class="block text-xs font-semibold text-muted-500 mb-1">{{ $t('wishlist.winesOfInterest') }}</label>
                      <input
                        v-model="newItem.winesOfInterest"
                        type="text"
                        class="input text-sm"
                        :placeholder="$t('wishlist.winesOfInterestPlaceholder')"
                      >
                    </div>
                  </template>

                  <div>
                    <label class="block text-xs font-semibold text-muted-500 mb-1">{{ $t('wishlist.notesOptional') }}</label>
                    <textarea
                      v-model="newItem.notes"
                      rows="2"
                      class="input text-sm"
                      :placeholder="newItem.itemType === 'wine' ? $t('wishlist.wineNotesPlaceholder') : $t('wishlist.producerNotesPlaceholder')"
                    />
                  </div>
                </div>

                <!-- Footer -->
                <div class="flex justify-end gap-3 px-6 py-4 border-t border-muted-200">
                  <button
                    type="button"
                    class="px-4 py-2 text-sm font-semibold text-muted-700 bg-white border border-muted-300 rounded-lg hover:bg-muted-50 hover:scale-102 transition-transform"
                    @click="closeModal"
                  >
                    {{ $t('common.cancel') }}
                  </button>
                  <button
                    type="button"
                    :disabled="!newItem.name.trim() || isAdding"
                    class="px-4 py-2 text-sm font-semibold text-white bg-primary-600 rounded-lg hover:bg-primary-700 hover:scale-105 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
                    @click="addItem"
                  >
                    {{ isAdding ? $t('wishlist.adding') : $t('common.add') }}
                  </button>
                </div>
              </div>
            </Transition>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
