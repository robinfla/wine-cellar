<script setup lang="ts">
interface LayoutConfig {
  disabledCells?: string[]
  rowLabels?: 'numbers' | 'letters'
  colLabels?: 'numbers' | 'letters'
  startFromBottom?: boolean
}

interface Bottle {
  id: number
  wineId: number
  wineName: string
  producerName: string
  vintage: number | null
  color: string
  position: string
  quantity: number
}

interface Props {
  rows: number
  columns: number
  layoutConfig?: LayoutConfig | null
  bottles?: Bottle[]
  selectable?: boolean
  selectedPositions?: string[]
}

const props = withDefaults(defineProps<Props>(), {
  layoutConfig: null,
  bottles: () => [],
  selectable: false,
  selectedPositions: () => [],
})

const { t } = useI18n()

const selectedPositionsSet = computed(() => new Set(props.selectedPositions))

const emit = defineEmits<{
  'select-position': [position: string]
  'select-bottle': [bottle: Bottle]
}>()

const disabledCells = computed(() => new Set(props.layoutConfig?.disabledCells || []))
const rowLabels = computed(() => props.layoutConfig?.rowLabels || 'letters')
const colLabels = computed(() => props.layoutConfig?.colLabels || 'numbers')
const startFromBottom = computed(() => props.layoutConfig?.startFromBottom ?? true)

const bottleMap = computed(() => {
  const map = new Map<string, Bottle>()
  props.bottles.forEach(bottle => {
    if (bottle.position) {
      // Handle comma-separated positions for bottles in multiple slots
      const positions = bottle.position.split(',')
      positions.forEach(pos => {
        map.set(pos.trim(), bottle)
      })
    }
  })
  return map
})

const getCellKey = (row: number, col: number) => `${row}-${col}`

const isCellDisabled = (row: number, col: number) => disabledCells.value.has(getCellKey(row, col))

const getBottleAt = (row: number, col: number) => bottleMap.value.get(getCellKey(row, col))

const getRowLabel = (row: number) => {
  const actualRow = startFromBottom.value ? props.rows - row : row + 1
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

const getPositionLabel = (row: number, col: number) => {
  return `${getRowLabel(row)}${getColLabel(col)}`
}

const getWineColorClass = (color: string) => {
  const colorMap: Record<string, string> = {
    red: 'bg-red-600',
    white: 'bg-amber-100 border-2 border-amber-300',
    rose: 'bg-pink-300',
    sparkling: 'bg-amber-50 border-2 border-amber-200',
    dessert: 'bg-amber-400',
    fortified: 'bg-amber-700',
  }
  return colorMap[color] || 'bg-muted-400'
}

const handleCellClick = (row: number, col: number) => {
  if (isCellDisabled(row, col)) return
  
  const bottle = getBottleAt(row, col)
  if (bottle) {
    emit('select-bottle', bottle)
  } else if (props.selectable) {
    emit('select-position', getCellKey(row, col))
  }
}

const occupiedCount = computed(() => {
  let count = 0
  for (let r = 0; r < props.rows; r++) {
    for (let c = 0; c < props.columns; c++) {
      if (!isCellDisabled(r, c) && getBottleAt(r, c)) count++
    }
  }
  return count
})

const totalSlots = computed(() => {
  let count = 0
  for (let r = 0; r < props.rows; r++) {
    for (let c = 0; c < props.columns; c++) {
      if (!isCellDisabled(r, c)) count++
    }
  }
  return count
})
</script>

<template>
  <div class="space-y-3">
    <div class="flex items-center justify-between text-sm text-muted-600">
      <span>{{ occupiedCount }} / {{ totalSlots }} {{ $t('cellars.slotsFilled') }}</span>
      <div class="flex items-center gap-3">
        <span class="flex items-center gap-1">
          <span class="w-3 h-3 rounded-full bg-red-600" /> {{ $t('colors.red') }}
        </span>
        <span class="flex items-center gap-1">
          <span class="w-3 h-3 rounded-full bg-amber-100 border border-amber-300" /> {{ $t('colors.white') }}
        </span>
        <span class="flex items-center gap-1">
          <span class="w-3 h-3 rounded-full bg-pink-300" /> {{ $t('colors.rose') }}
        </span>
      </div>
    </div>

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
            class="w-10 h-10 m-0.5 rounded-lg border-2 transition-all duration-150 relative group"
            :class="[
              isCellDisabled(row - 1, col - 1)
                ? 'bg-muted-50 border-muted-100 cursor-default'
                : getBottleAt(row - 1, col - 1)
                  ? 'bg-white border-muted-300 hover:border-primary-400 cursor-pointer'
                  : selectable
                    ? 'bg-white border-dashed border-muted-300 hover:border-primary-400 hover:bg-primary-50 cursor-pointer'
                    : 'bg-white border-dashed border-muted-200 cursor-default',
              selectedPositionsSet.has(getCellKey(row - 1, col - 1)) && 'ring-2 ring-primary-500'
            ]"
            :disabled="isCellDisabled(row - 1, col - 1)"
            @click="handleCellClick(row - 1, col - 1)"
          >
            <template v-if="!isCellDisabled(row - 1, col - 1)">
              <span
                v-if="getBottleAt(row - 1, col - 1)"
                class="block w-7 h-7 mx-auto rounded-full"
                :class="getWineColorClass(getBottleAt(row - 1, col - 1)!.color)"
              />
              <span
                v-else
                class="block w-5 h-5 mx-auto rounded-full border-2 border-dashed border-muted-300"
              />
              
              <div
                v-if="getBottleAt(row - 1, col - 1)"
                class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-muted-900 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10"
              >
                <p class="font-semibold">{{ getBottleAt(row - 1, col - 1)!.wineName }}</p>
                <p class="text-muted-300">
                  {{ getBottleAt(row - 1, col - 1)!.producerName }}
                  {{ getBottleAt(row - 1, col - 1)!.vintage || $t('common.nv') }}
                </p>
                <p class="text-muted-400 text-[10px]">{{ getPositionLabel(row - 1, col - 1) }}</p>
              </div>
            </template>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
