<script setup lang="ts">
definePageMeta({
  middleware: 'admin',
})

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

const users = ref<User[]>([])
const invitations = ref<Invitation[]>([])
const isLoadingUsers = ref(true)
const isLoadingInvitations = ref(true)

const showCreateModal = ref(false)
const newInviteEmail = ref('')
const newInviteExpiresDays = ref<number | undefined>(undefined)
const isCreating = ref(false)
const createError = ref('')

const appUrl = ref('')

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
    // Fallback for older browsers or non-HTTPS
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

onMounted(() => {
  appUrl.value = useRuntimeConfig().public.appUrl || window.location.origin
  loadUsers()
  loadInvitations()
})
</script>

<template>
  <div class="max-w-6xl mx-auto py-8 px-4">
    <div class="flex items-center justify-between mb-8">
      <h1 class="text-2xl font-display font-bold">Admin Dashboard</h1>
      <NuxtLink to="/profile" class="btn-secondary text-sm">
        Back to Profile
      </NuxtLink>
    </div>

    <!-- Users Section -->
    <section class="card mb-8">
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

    <!-- Invitations Section -->
    <section class="card">
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
