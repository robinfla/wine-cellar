<script setup lang="ts">
definePageMeta({
  middleware: 'admin',
})

type Tab = 'users' | 'invitations' | 'wines' | 'producers' | 'regions' | 'appellations'
const activeTab = ref<Tab>('users')

interface User {
  id: number
  email: string
  name: string | null
  isAdmin: boolean
  preferredCurrency: string | null
  createdAt: string
}

interface Invitation {
  id: number
  code: string
  email: string | null
  usedAt: string | null
  usedByUserId: number | null
  usedByEmail: string | null
  createdAt: string
  expiresAt: string | null
}

interface Wine {
  id: number
  name: string
  color: string
  producerId: number
  producerName: string
  userId: number
  inventoryCount: number
  createdAt: string
}

interface Producer {
  id: number
  name: string
  regionId: number | null
  regionName: string | null
  userId: number
  wineCount: number
  createdAt: string
}

interface Region {
  id: number
  name: string
  countryCode: string
  producerCount: number
  appellationCount: number
  createdAt: string
}

interface Appellation {
  id: number
  name: string
  level: string | null
  regionId: number | null
  regionName: string | null
  wineCount: number
  createdAt: string
}

const users = ref<User[]>([])
const invitations = ref<Invitation[]>([])
const allWines = ref<Wine[]>([])
const allProducers = ref<Producer[]>([])
const allRegions = ref<Region[]>([])
const allAppellations = ref<Appellation[]>([])

const isLoadingUsers = ref(false)
const isLoadingInvitations = ref(false)
const isLoadingWines = ref(false)
const isLoadingProducers = ref(false)
const isLoadingRegions = ref(false)
const isLoadingAppellations = ref(false)

const showCreateModal = ref(false)
const newInviteEmail = ref('')
const newInviteExpiresDays = ref<number | undefined>(undefined)
const isCreating = ref(false)
const createError = ref('')

const appUrl = ref('')

const selectedWines = ref<number[]>([])
const selectedProducers = ref<number[]>([])
const selectedRegions = ref<number[]>([])
const selectedAppellations = ref<number[]>([])

const wineSearch = ref('')
const producerSearch = ref('')
const regionSearch = ref('')
const appellationSearch = ref('')

const isMerging = ref(false)

const filteredWines = computed(() => {
  if (!wineSearch.value) return allWines.value
  const search = wineSearch.value.toLowerCase()
  return allWines.value.filter(w =>
    w.name.toLowerCase().includes(search) ||
    w.producerName.toLowerCase().includes(search),
  )
})

const filteredProducers = computed(() => {
  if (!producerSearch.value) return allProducers.value
  const search = producerSearch.value.toLowerCase()
  return allProducers.value.filter(p =>
    p.name.toLowerCase().includes(search) ||
    p.regionName?.toLowerCase().includes(search),
  )
})

const filteredRegions = computed(() => {
  if (!regionSearch.value) return allRegions.value
  const search = regionSearch.value.toLowerCase()
  return allRegions.value.filter(r =>
    r.name.toLowerCase().includes(search) ||
    r.countryCode.toLowerCase().includes(search),
  )
})

const filteredAppellations = computed(() => {
  if (!appellationSearch.value) return allAppellations.value
  const search = appellationSearch.value.toLowerCase()
  return allAppellations.value.filter(a =>
    a.name.toLowerCase().includes(search) ||
    a.regionName?.toLowerCase().includes(search),
  )
})

async function loadUsers() {
  isLoadingUsers.value = true
  try {
    users.value = await $fetch<User[]>('/api/admin/users')
  } finally {
    isLoadingUsers.value = false
  }
}

async function loadInvitations() {
  isLoadingInvitations.value = true
  try {
    invitations.value = await $fetch<Invitation[]>('/api/admin/invitations')
  } finally {
    isLoadingInvitations.value = false
  }
}

async function loadWines() {
  isLoadingWines.value = true
  try {
    allWines.value = await $fetch<Wine[]>('/api/admin/wines')
  } finally {
    isLoadingWines.value = false
  }
}

async function loadProducers() {
  isLoadingProducers.value = true
  try {
    allProducers.value = await $fetch<Producer[]>('/api/admin/producers')
  } finally {
    isLoadingProducers.value = false
  }
}

async function loadRegions() {
  isLoadingRegions.value = true
  try {
    allRegions.value = await $fetch<Region[]>('/api/admin/regions')
  } finally {
    isLoadingRegions.value = false
  }
}

async function loadAppellations() {
  isLoadingAppellations.value = true
  try {
    allAppellations.value = await $fetch<Appellation[]>('/api/admin/appellations')
  } finally {
    isLoadingAppellations.value = false
  }
}

async function createInvitation() {
  createError.value = ''
  isCreating.value = true

  try {
    await $fetch('/api/admin/invitations', {
      method: 'POST',
      body: {
        email: newInviteEmail.value || undefined,
        expiresInDays: newInviteExpiresDays.value || undefined,
      },
    })
    showCreateModal.value = false
    newInviteEmail.value = ''
    newInviteExpiresDays.value = undefined
    await loadInvitations()
  } catch (e: any) {
    createError.value = e.data?.message || 'Failed to create invitation'
  } finally {
    isCreating.value = false
  }
}

async function deleteInvitation(id: number) {
  if (!confirm('Delete this invitation?')) return

  try {
    await $fetch(`/api/admin/invitations/${id}`, { method: 'DELETE' })
    await loadInvitations()
  } catch (e: any) {
    alert(e.data?.message || 'Failed to delete invitation')
  }
}

async function copyInviteLink(code: string) {
  const link = `${appUrl.value}/register?code=${code}`
  try {
    await navigator.clipboard.writeText(link)
  } catch {
    const textArea = document.createElement('textarea')
    textArea.value = link
    document.body.appendChild(textArea)
    textArea.select()
    document.execCommand('copy')
    document.body.removeChild(textArea)
  }
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function getInvitationStatus(inv: Invitation) {
  if (inv.usedAt) return { label: 'Used', class: 'bg-muted-100 text-muted-700' }
  if (inv.expiresAt && new Date(inv.expiresAt) < new Date()) {
    return { label: 'Expired', class: 'bg-red-100 text-red-700' }
  }
  return { label: 'Active', class: 'bg-green-100 text-green-700' }
}

function toggleWineSelection(id: number) {
  const idx = selectedWines.value.indexOf(id)
  if (idx === -1) {
    selectedWines.value.push(id)
  } else {
    selectedWines.value.splice(idx, 1)
  }
}

function toggleProducerSelection(id: number) {
  const idx = selectedProducers.value.indexOf(id)
  if (idx === -1) {
    selectedProducers.value.push(id)
  } else {
    selectedProducers.value.splice(idx, 1)
  }
}

function toggleRegionSelection(id: number) {
  const idx = selectedRegions.value.indexOf(id)
  if (idx === -1) {
    selectedRegions.value.push(id)
  } else {
    selectedRegions.value.splice(idx, 1)
  }
}

function toggleAppellationSelection(id: number) {
  const idx = selectedAppellations.value.indexOf(id)
  if (idx === -1) {
    selectedAppellations.value.push(id)
  } else {
    selectedAppellations.value.splice(idx, 1)
  }
}

async function mergeWines(targetId: number) {
  if (selectedWines.value.length < 2) return

  const sourceIds = selectedWines.value.filter(id => id !== targetId)
  const target = allWines.value.find(w => w.id === targetId)

  if (!confirm(`Merge ${sourceIds.length} wine(s) into "${target?.name}"? This will move all inventory and delete the duplicates.`)) {
    return
  }

  isMerging.value = true
  try {
    await $fetch('/api/admin/wines/merge', {
      method: 'POST',
      body: { sourceIds, targetId },
    })
    selectedWines.value = []
    await loadWines()
  } catch (e: any) {
    alert(e.data?.message || 'Failed to merge wines')
  } finally {
    isMerging.value = false
  }
}

async function mergeProducers(targetId: number) {
  if (selectedProducers.value.length < 2) return

  const sourceIds = selectedProducers.value.filter(id => id !== targetId)
  const target = allProducers.value.find(p => p.id === targetId)

  if (!confirm(`Merge ${sourceIds.length} producer(s) into "${target?.name}"? This will reassign all wines and delete the duplicates.`)) {
    return
  }

  isMerging.value = true
  try {
    await $fetch('/api/admin/producers/merge', {
      method: 'POST',
      body: { sourceIds, targetId },
    })
    selectedProducers.value = []
    await loadProducers()
    await loadWines()
  } catch (e: any) {
    alert(e.data?.message || 'Failed to merge producers')
  } finally {
    isMerging.value = false
  }
}

async function mergeRegions(targetId: number) {
  if (selectedRegions.value.length < 2) return

  const sourceIds = selectedRegions.value.filter(id => id !== targetId)
  const target = allRegions.value.find(r => r.id === targetId)

  if (!confirm(`Merge ${sourceIds.length} region(s) into "${target?.name}"? This will reassign all producers, appellations, and wines.`)) {
    return
  }

  isMerging.value = true
  try {
    await $fetch('/api/admin/regions/merge', {
      method: 'POST',
      body: { sourceIds, targetId },
    })
    selectedRegions.value = []
    await loadRegions()
    await loadProducers()
    await loadAppellations()
  } catch (e: any) {
    alert(e.data?.message || 'Failed to merge regions')
  } finally {
    isMerging.value = false
  }
}

async function mergeAppellations(targetId: number) {
  if (selectedAppellations.value.length < 2) return

  const sourceIds = selectedAppellations.value.filter(id => id !== targetId)
  const target = allAppellations.value.find(a => a.id === targetId)

  if (!confirm(`Merge ${sourceIds.length} appellation(s) into "${target?.name}"? This will reassign all wines.`)) {
    return
  }

  isMerging.value = true
  try {
    await $fetch('/api/admin/appellations/merge', {
      method: 'POST',
      body: { sourceIds, targetId },
    })
    selectedAppellations.value = []
    await loadAppellations()
  } catch (e: any) {
    alert(e.data?.message || 'Failed to merge appellations')
  } finally {
    isMerging.value = false
  }
}

watch(activeTab, (tab) => {
  if (tab === 'users' && users.value.length === 0) loadUsers()
  if (tab === 'invitations' && invitations.value.length === 0) loadInvitations()
  if (tab === 'wines' && allWines.value.length === 0) loadWines()
  if (tab === 'producers' && allProducers.value.length === 0) loadProducers()
  if (tab === 'regions' && allRegions.value.length === 0) loadRegions()
  if (tab === 'appellations' && allAppellations.value.length === 0) loadAppellations()
})

onMounted(() => {
  appUrl.value = useRuntimeConfig().public.appUrl || window.location.origin
  loadUsers()
})
</script>

<template>
  <div class="max-w-6xl mx-auto py-8 px-4">
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-display font-bold">Admin Dashboard</h1>
      <NuxtLink to="/profile" class="btn-secondary text-sm">
        Back to Profile
      </NuxtLink>
    </div>

    <!-- Tabs -->
    <div class="flex gap-1 mb-6 border-b-2 border-muted-200 overflow-x-auto">
      <button
        v-for="tab in (['users', 'invitations', 'wines', 'producers', 'regions', 'appellations'] as Tab[])"
        :key="tab"
        class="px-4 py-2 text-sm font-semibold capitalize whitespace-nowrap transition-colors -mb-0.5"
        :class="activeTab === tab
          ? 'text-primary border-b-2 border-primary'
          : 'text-muted-500 hover:text-muted-700'"
        @click="activeTab = tab"
      >
        {{ tab }}
      </button>
    </div>

    <!-- Users Tab -->
    <section v-if="activeTab === 'users'" class="card">
      <h2 class="text-lg font-semibold mb-4">Users ({{ users.length }})</h2>

      <div v-if="isLoadingUsers" class="text-muted-500 py-8 text-center">
        Loading users...
      </div>

      <div v-else class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b-2 border-muted-200">
              <th class="text-left py-2 px-3 font-semibold">Email</th>
              <th class="text-left py-2 px-3 font-semibold">Name</th>
              <th class="text-left py-2 px-3 font-semibold">Role</th>
              <th class="text-left py-2 px-3 font-semibold">Joined</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="u in users" :key="u.id" class="border-b border-muted-100">
              <td class="py-2 px-3">{{ u.email }}</td>
              <td class="py-2 px-3">{{ u.name || '-' }}</td>
              <td class="py-2 px-3">
                <span
                  class="px-2 py-0.5 rounded text-xs font-semibold"
                  :class="u.isAdmin ? 'bg-primary-100 text-primary-700' : 'bg-muted-100 text-muted-700'"
                >
                  {{ u.isAdmin ? 'Admin' : 'User' }}
                </span>
              </td>
              <td class="py-2 px-3 text-muted-600">{{ formatDate(u.createdAt) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- Invitations Tab -->
    <section v-if="activeTab === 'invitations'" class="card">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-lg font-semibold">Invitations ({{ invitations.length }})</h2>
        <button class="btn-primary text-sm" @click="showCreateModal = true">
          Create Invitation
        </button>
      </div>

      <div v-if="isLoadingInvitations" class="text-muted-500 py-8 text-center">
        Loading invitations...
      </div>

      <div v-else-if="invitations.length === 0" class="text-muted-500 py-8 text-center">
        No invitations yet. Create one to invite users.
      </div>

      <div v-else class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b-2 border-muted-200">
              <th class="text-left py-2 px-3 font-semibold">Code</th>
              <th class="text-left py-2 px-3 font-semibold">Email Restriction</th>
              <th class="text-left py-2 px-3 font-semibold">Status</th>
              <th class="text-left py-2 px-3 font-semibold">Used By</th>
              <th class="text-left py-2 px-3 font-semibold">Expires</th>
              <th class="text-left py-2 px-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="inv in invitations" :key="inv.id" class="border-b border-muted-100">
              <td class="py-2 px-3 font-mono">{{ inv.code }}</td>
              <td class="py-2 px-3">{{ inv.email || 'Anyone' }}</td>
              <td class="py-2 px-3">
                <span
                  class="px-2 py-0.5 rounded text-xs font-semibold"
                  :class="getInvitationStatus(inv).class"
                >
                  {{ getInvitationStatus(inv).label }}
                </span>
              </td>
              <td class="py-2 px-3">{{ inv.usedByEmail || '-' }}</td>
              <td class="py-2 px-3 text-muted-600">{{ formatDate(inv.expiresAt) }}</td>
              <td class="py-2 px-3">
                <div class="flex gap-2">
                  <button
                    v-if="!inv.usedAt"
                    class="text-primary hover:text-primary-700 font-semibold text-xs"
                    title="Copy invite link"
                    @click="copyInviteLink(inv.code)"
                  >
                    Copy Link
                  </button>
                  <button
                    v-if="!inv.usedAt"
                    class="text-red-600 hover:text-red-700 font-semibold text-xs"
                    @click="deleteInvitation(inv.id)"
                  >
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- Wines Tab -->
    <section v-if="activeTab === 'wines'" class="card flex flex-col" style="max-height: calc(100vh - 200px);">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 flex-shrink-0">
        <h2 class="text-lg font-semibold">Wines ({{ allWines.length }})</h2>
        <input
          v-model="wineSearch"
          type="text"
          placeholder="Search wines..."
          class="input text-sm w-full sm:w-64"
        >
      </div>

      <div v-if="selectedWines.length >= 2" class="mb-4 p-3 bg-primary-50 border-2 border-primary-200 rounded-lg flex-shrink-0">
        <p class="text-sm font-semibold mb-2">{{ selectedWines.length }} wines selected. Click one to keep:</p>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="id in selectedWines"
            :key="id"
            class="btn-primary text-xs"
            :disabled="isMerging"
            @click="mergeWines(id)"
          >
            Keep "{{ allWines.find(w => w.id === id)?.name }}"
          </button>
          <button class="btn-secondary text-xs" @click="selectedWines = []">
            Cancel
          </button>
        </div>
      </div>

      <div v-if="isLoadingWines" class="text-muted-500 py-8 text-center">
        Loading wines...
      </div>

      <div v-else class="overflow-auto flex-1">
        <table class="w-full text-sm">
          <thead class="sticky top-0 bg-white shadow-[0_2px_0_0_theme(colors.muted.200)]">
            <tr>
              <th class="w-8 py-2 px-3" />
              <th class="text-left py-2 px-3 font-semibold">Name</th>
              <th class="text-left py-2 px-3 font-semibold">Producer</th>
              <th class="text-left py-2 px-3 font-semibold">Color</th>
              <th class="text-left py-2 px-3 font-semibold">Inventory</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="w in filteredWines"
              :key="w.id"
              class="border-b border-muted-100 cursor-pointer hover:bg-muted-50"
              :class="{ 'bg-primary-50': selectedWines.includes(w.id) }"
              @click="toggleWineSelection(w.id)"
            >
              <td class="py-2 px-3">
                <input
                  type="checkbox"
                  :checked="selectedWines.includes(w.id)"
                  class="rounded"
                  @click.stop
                  @change="toggleWineSelection(w.id)"
                >
              </td>
              <td class="py-2 px-3 font-medium">{{ w.name }}</td>
              <td class="py-2 px-3">{{ w.producerName }}</td>
              <td class="py-2 px-3 capitalize">{{ w.color }}</td>
              <td class="py-2 px-3">{{ w.inventoryCount }} lots</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- Producers Tab -->
    <section v-if="activeTab === 'producers'" class="card flex flex-col" style="max-height: calc(100vh - 200px);">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 flex-shrink-0">
        <h2 class="text-lg font-semibold">Producers ({{ allProducers.length }})</h2>
        <input
          v-model="producerSearch"
          type="text"
          placeholder="Search producers..."
          class="input text-sm w-full sm:w-64"
        >
      </div>

      <div v-if="selectedProducers.length >= 2" class="mb-4 p-3 bg-primary-50 border-2 border-primary-200 rounded-lg flex-shrink-0">
        <p class="text-sm font-semibold mb-2">{{ selectedProducers.length }} producers selected. Click one to keep:</p>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="id in selectedProducers"
            :key="id"
            class="btn-primary text-xs"
            :disabled="isMerging"
            @click="mergeProducers(id)"
          >
            Keep "{{ allProducers.find(p => p.id === id)?.name }}"
          </button>
          <button class="btn-secondary text-xs" @click="selectedProducers = []">
            Cancel
          </button>
        </div>
      </div>

      <div v-if="isLoadingProducers" class="text-muted-500 py-8 text-center">
        Loading producers...
      </div>

      <div v-else class="overflow-auto flex-1">
        <table class="w-full text-sm">
          <thead class="sticky top-0 bg-white shadow-[0_2px_0_0_theme(colors.muted.200)]">
            <tr>
              <th class="w-8 py-2 px-3" />
              <th class="text-left py-2 px-3 font-semibold">Name</th>
              <th class="text-left py-2 px-3 font-semibold">Region</th>
              <th class="text-left py-2 px-3 font-semibold">Wines</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="p in filteredProducers"
              :key="p.id"
              class="border-b border-muted-100 cursor-pointer hover:bg-muted-50"
              :class="{ 'bg-primary-50': selectedProducers.includes(p.id) }"
              @click="toggleProducerSelection(p.id)"
            >
              <td class="py-2 px-3">
                <input
                  type="checkbox"
                  :checked="selectedProducers.includes(p.id)"
                  class="rounded"
                  @click.stop
                  @change="toggleProducerSelection(p.id)"
                >
              </td>
              <td class="py-2 px-3 font-medium">{{ p.name }}</td>
              <td class="py-2 px-3">{{ p.regionName || '-' }}</td>
              <td class="py-2 px-3">{{ p.wineCount }} wines</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- Regions Tab -->
    <section v-if="activeTab === 'regions'" class="card flex flex-col" style="max-height: calc(100vh - 200px);">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 flex-shrink-0">
        <h2 class="text-lg font-semibold">Regions ({{ allRegions.length }})</h2>
        <input
          v-model="regionSearch"
          type="text"
          placeholder="Search regions..."
          class="input text-sm w-full sm:w-64"
        >
      </div>

      <div v-if="selectedRegions.length >= 2" class="mb-4 p-3 bg-primary-50 border-2 border-primary-200 rounded-lg flex-shrink-0">
        <p class="text-sm font-semibold mb-2">{{ selectedRegions.length }} regions selected. Click one to keep:</p>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="id in selectedRegions"
            :key="id"
            class="btn-primary text-xs"
            :disabled="isMerging"
            @click="mergeRegions(id)"
          >
            Keep "{{ allRegions.find(r => r.id === id)?.name }}"
          </button>
          <button class="btn-secondary text-xs" @click="selectedRegions = []">
            Cancel
          </button>
        </div>
      </div>

      <div v-if="isLoadingRegions" class="text-muted-500 py-8 text-center">
        Loading regions...
      </div>

      <div v-else class="overflow-auto flex-1">
        <table class="w-full text-sm">
          <thead class="sticky top-0 bg-white shadow-[0_2px_0_0_theme(colors.muted.200)]">
            <tr>
              <th class="w-8 py-2 px-3" />
              <th class="text-left py-2 px-3 font-semibold">Name</th>
              <th class="text-left py-2 px-3 font-semibold">Country</th>
              <th class="text-left py-2 px-3 font-semibold">Producers</th>
              <th class="text-left py-2 px-3 font-semibold">Appellations</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="r in filteredRegions"
              :key="r.id"
              class="border-b border-muted-100 cursor-pointer hover:bg-muted-50"
              :class="{ 'bg-primary-50': selectedRegions.includes(r.id) }"
              @click="toggleRegionSelection(r.id)"
            >
              <td class="py-2 px-3">
                <input
                  type="checkbox"
                  :checked="selectedRegions.includes(r.id)"
                  class="rounded"
                  @click.stop
                  @change="toggleRegionSelection(r.id)"
                >
              </td>
              <td class="py-2 px-3 font-medium">{{ r.name }}</td>
              <td class="py-2 px-3">{{ r.countryCode }}</td>
              <td class="py-2 px-3">{{ r.producerCount }}</td>
              <td class="py-2 px-3">{{ r.appellationCount }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- Appellations Tab -->
    <section v-if="activeTab === 'appellations'" class="card flex flex-col" style="max-height: calc(100vh - 200px);">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 flex-shrink-0">
        <h2 class="text-lg font-semibold">Appellations ({{ allAppellations.length }})</h2>
        <input
          v-model="appellationSearch"
          type="text"
          placeholder="Search appellations..."
          class="input text-sm w-full sm:w-64"
        >
      </div>

      <div v-if="selectedAppellations.length >= 2" class="mb-4 p-3 bg-primary-50 border-2 border-primary-200 rounded-lg flex-shrink-0">
        <p class="text-sm font-semibold mb-2">{{ selectedAppellations.length }} appellations selected. Click one to keep:</p>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="id in selectedAppellations"
            :key="id"
            class="btn-primary text-xs"
            :disabled="isMerging"
            @click="mergeAppellations(id)"
          >
            Keep "{{ allAppellations.find(a => a.id === id)?.name }}"
          </button>
          <button class="btn-secondary text-xs" @click="selectedAppellations = []">
            Cancel
          </button>
        </div>
      </div>

      <div v-if="isLoadingAppellations" class="text-muted-500 py-8 text-center">
        Loading appellations...
      </div>

      <div v-else class="overflow-auto flex-1">
        <table class="w-full text-sm">
          <thead class="sticky top-0 bg-white shadow-[0_2px_0_0_theme(colors.muted.200)]">
            <tr>
              <th class="w-8 py-2 px-3" />
              <th class="text-left py-2 px-3 font-semibold">Name</th>
              <th class="text-left py-2 px-3 font-semibold">Region</th>
              <th class="text-left py-2 px-3 font-semibold">Level</th>
              <th class="text-left py-2 px-3 font-semibold">Wines</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="a in filteredAppellations"
              :key="a.id"
              class="border-b border-muted-100 cursor-pointer hover:bg-muted-50"
              :class="{ 'bg-primary-50': selectedAppellations.includes(a.id) }"
              @click="toggleAppellationSelection(a.id)"
            >
              <td class="py-2 px-3">
                <input
                  type="checkbox"
                  :checked="selectedAppellations.includes(a.id)"
                  class="rounded"
                  @click.stop
                  @change="toggleAppellationSelection(a.id)"
                >
              </td>
              <td class="py-2 px-3 font-medium">{{ a.name }}</td>
              <td class="py-2 px-3">{{ a.regionName || '-' }}</td>
              <td class="py-2 px-3">{{ a.level || '-' }}</td>
              <td class="py-2 px-3">{{ a.wineCount }} wines</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- Create Invitation Modal -->
    <div
      v-if="showCreateModal"
      class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      @click.self="showCreateModal = false"
    >
      <div class="bg-white rounded-xl border-2 border-muted-200 p-6 w-full max-w-md">
        <h3 class="text-lg font-semibold mb-4">Create Invitation</h3>

        <form class="space-y-4" @submit.prevent="createInvitation">
          <div v-if="createError" class="p-3 text-sm font-semibold text-red-700 bg-red-100 rounded-lg border-2 border-red-200">
            {{ createError }}
          </div>

          <div>
            <label for="inviteEmail" class="label">Email Restriction (optional)</label>
            <input
              id="inviteEmail"
              v-model="newInviteEmail"
              type="email"
              class="input"
              placeholder="Leave empty for anyone"
            >
            <p class="mt-1 text-xs text-muted-500">If set, only this email can use the invite</p>
          </div>

          <div>
            <label for="expiresDays" class="label">Expires In (days, optional)</label>
            <input
              id="expiresDays"
              v-model.number="newInviteExpiresDays"
              type="number"
              min="1"
              max="365"
              class="input"
              placeholder="Leave empty for no expiration"
            >
          </div>

          <div class="flex gap-3 pt-2">
            <button type="submit" :disabled="isCreating" class="btn-primary flex-1">
              {{ isCreating ? 'Creating...' : 'Create' }}
            </button>
            <button type="button" class="btn-secondary flex-1" @click="showCreateModal = false">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>
