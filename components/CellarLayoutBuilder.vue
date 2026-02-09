<script setup lang="ts">
interface LayoutConfig {
  disabledCells?: string[]
  rowLabels?: 'numbers' | 'letters'
  colLabels?: 'numbers' | 'letters'
  startFromBottom?: boolean
}

interface CellarLayout {
  rows: number
  columns: number
  layoutConfig: LayoutConfig
}

interface Props {
  modelValue?: CellarLayout | null
  cellarName?: string
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: null,
  cellarName: 'Cellar',
})

const emit = defineEmits<{
  'update:modelValue': [value: CellarLayout]
  save: [value: CellarLayout]
  cancel: []
}>()

const { t } = useI18n()

const rows = ref(props.modelValue?.rows || 5)
const columns = ref(props.modelValue?.columns || 6)
const disabledCells = ref<Set<string>>(new Set(props.modelValue?.layoutConfig?.disabledCells || []))
const rowLabels = ref<'numbers' | 'letters'>(props.modelValue?.layoutConfig?.rowLabels || 'letters')
const colLabels = ref<'numbers' | 'letters'>(props.modelValue?.layoutConfig?.colLabels || 'numbers')
const startFromBottom = ref(props.modelValue?.layoutConfig?.startFromBottom ?? true)

const maxRows = 20
const maxColumns = 20

const getCellKey = (row: number, col: number) => `${row}-${col}`

const isCellDisabled = (row: number, col: number) => disabledCells.value.has(getCellKey(row, col))

const toggleCell = (row: number, col: number) => {
  const key = getCellKey(row, col)
  if (disabledCells.value.has(key)) {
    disabledCells.value.delete(key)
  } else {
    disabledCells.value.add(key)
  }
  disabledCells.value = new Set(disabledCells.value)
  emitUpdate()
}

const getRowLabel = (row: number) => {
  const actualRow = startFromBottom.value ? rows.value - row : row + 1
  if (rowLabels.value === 'letters') {
    return String.fromCharCode(64 + actualRow)
  }
  return actualRow.toString()
}

const getColLabel = (col: number) => {
  if (colLabels.value === 'letters') {
    return String.fromCharCode(65 + col)
  }
  return (col + 1).toString()
}

const enabledCellCount = computed(() => {
  let count = 0
  for (let r = 0; r < rows.value; r++) {
    for (let c = 0; c < columns.value; c++) {
      if (!isCellDisabled(r, c)) count++
    }
  }
  return count
})

const currentLayout = computed<CellarLayout>(() => ({
  rows: rows.value,
  columns: columns.value,
  layoutConfig: {
    disabledCells: Array.from(disabledCells.value),
    rowLabels: rowLabels.value,
    colLabels: colLabels.value,
    startFromBottom: startFromBottom.value,
  },
}))

const emitUpdate = () => {
  emit('update:modelValue', currentLayout.value)
}

const handleSave = () => {
  emit('save', currentLayout.value)
}

const handleCancel = () => {
  emit('cancel')
}

const clearDisabled = () => {
  disabledCells.value = new Set()
  emitUpdate()
}

const updateRows = (value: number) => {
  const newRows = Math.min(Math.max(1, value), maxRows)
  const cellsToRemove: string[] = []
  disabledCells.value.forEach(key => {
    const [r] = key.split('-').map(Number)
    if (r >= newRows) cellsToRemove.push(key)
  })
  cellsToRemove.forEach(key => disabledCells.value.delete(key))
  rows.value = newRows
  emitUpdate()
}

const updateColumns = (value: number) => {
  const newCols = Math.min(Math.max(1, value), maxColumns)
  const cellsToRemove: string[] = []
  disabledCells.value.forEach(key => {
    const [, c] = key.split('-').map(Number)
    if (c >= newCols) cellsToRemove.push(key)
  })
  cellsToRemove.forEach(key => disabledCells.value.delete(key))
  columns.value = newCols
  emitUpdate()
}

watch([rowLabels, colLabels, startFromBottom], () => {
  emitUpdate()
})
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h3 class="text-lg font-display font-bold text-muted-900">
        {{ $t('cellars.designLayoutTitle') }} {{ cellarName }}
      </h3>
      <span class="text-sm text-muted-500">
        {{ enabledCellCount }} {{ $t('cellars.slots') }}
      </span>
    </div>

    <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
      <div>
        <label class="label">{{ $t('cellars.rowsLabel') }}</label>
        <div class="flex items-center gap-2">
          <button
            type="button"
            class="w-8 h-8 rounded-lg bg-muted-100 hover:bg-muted-200 flex items-center justify-center text-muted-600 font-bold transition-colors"
            :disabled="rows <= 1"
            @click="updateRows(rows - 1)"
          >
            -
          </button>
          <input
            :value="rows"
            type="number"
            min="1"
            :max="maxRows"
            class="input w-16 text-center"
            @input="updateRows(Number(($event.target as HTMLInputElement).value))"
          >
          <button
            type="button"
            class="w-8 h-8 rounded-lg bg-muted-100 hover:bg-muted-200 flex items-center justify-center text-muted-600 font-bold transition-colors"
            :disabled="rows >= maxRows"
            @click="updateRows(rows + 1)"
          >
            +
          </button>
        </div>
      </div>

      <div>
        <label class="label">{{ $t('cellars.columnsLabel') }}</label>
        <div class="flex items-center gap-2">
          <button
            type="button"
            class="w-8 h-8 rounded-lg bg-muted-100 hover:bg-muted-200 flex items-center justify-center text-muted-600 font-bold transition-colors"
            :disabled="columns <= 1"
            @click="updateColumns(columns - 1)"
          >
            -
          </button>
          <input
            :value="columns"
            type="number"
            min="1"
            :max="maxColumns"
            class="input w-16 text-center"
            @input="updateColumns(Number(($event.target as HTMLInputElement).value))"
          >
          <button
            type="button"
            class="w-8 h-8 rounded-lg bg-muted-100 hover:bg-muted-200 flex items-center justify-center text-muted-600 font-bold transition-colors"
            :disabled="columns >= maxColumns"
            @click="updateColumns(columns + 1)"
          >
            +
          </button>
        </div>
      </div>

      <div>
        <label class="label">{{ $t('cellars.rowLabels') }}</label>
        <select v-model="rowLabels" class="input w-full">
          <option value="letters">{{ $t('cellars.lettersOption') }}</option>
          <option value="numbers">{{ $t('cellars.numbersOption') }}</option>
        </select>
      </div>

      <div>
        <label class="label">{{ $t('cellars.columnLabels') }}</label>
        <select v-model="colLabels" class="input w-full">
          <option value="numbers">{{ $t('cellars.numbersOption') }}</option>
          <option value="letters">{{ $t('cellars.lettersOption') }}</option>
        </select>
      </div>
    </div>

    <div class="flex items-center gap-4">
      <label class="flex items-center gap-2 cursor-pointer">
        <input
          v-model="startFromBottom"
          type="checkbox"
          class="w-4 h-4 text-primary border-2 border-muted-300 rounded focus:ring-primary"
        >
        <span class="text-sm font-medium text-muted-700">{{ $t('cellars.numberFromBottom') }}</span>
      </label>
      <button
        v-if="disabledCells.size > 0"
        type="button"
        class="text-sm text-primary-600 hover:text-primary-700 font-medium"
        @click="clearDisabled"
      >
        {{ $t('cellars.resetAllCells') }}
      </button>
    </div>

    <div class="p-4 bg-muted-50 rounded-xl border-2 border-muted-200">
      <p class="text-xs text-muted-500 mb-3">
        {{ $t('cellars.cellToggleHint') }}
      </p>
      
      <div class="overflow-x-auto">
        <div class="inline-block">
          <div class="flex">
            <div class="w-8" />
            <div
              v-for="col in columns"
              :key="`header-${col}`"
              class="w-10 h-6 flex items-center justify-center text-xs font-bold text-muted-500"
            >
              {{ getColLabel(col - 1) }}
            </div>
          </div>
          
          <div
            v-for="row in rows"
            :key="`row-${row}`"
            class="flex"
          >
            <div class="w-8 h-10 flex items-center justify-center text-xs font-bold text-muted-500">
              {{ getRowLabel(row - 1) }}
            </div>
            <button
              v-for="col in columns"
              :key="`cell-${row}-${col}`"
              type="button"
              class="w-10 h-10 m-0.5 rounded-lg border-2 transition-all duration-150"
              :class="isCellDisabled(row - 1, col - 1)
                ? 'bg-muted-100 border-muted-200 opacity-40'
                : 'bg-white border-muted-300 hover:border-primary-400 hover:bg-primary-50'"
              @click="toggleCell(row - 1, col - 1)"
            >
              <span
                v-if="!isCellDisabled(row - 1, col - 1)"
                class="block w-6 h-6 mx-auto rounded-full bg-muted-200"
              />
              <svg
                v-else
                class="w-4 h-4 mx-auto text-muted-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="flex justify-end gap-3">
      <button
        type="button"
        class="btn-secondary"
        @click="handleCancel"
      >
        {{ $t('common.cancel') }}
      </button>
      <button
        type="button"
        class="btn-primary"
        @click="handleSave"
      >
        {{ $t('cellars.saveLayout') }}
      </button>
    </div>
  </div>
</template>
