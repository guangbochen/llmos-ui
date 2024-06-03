<script setup lang="ts">
import { timeAgo } from '@/utils/date';

const mf = useModelfiles();
const modelfiles = await mf.findAll()

const columns = [
  { key: 'metadata.state.name', label: 'State', sortable: true },
  { key: 'id', label: 'Name', sortable: true },
  { key: 'status.model', label: 'Model', sortable: true },
  { key: 'status.modelID', label: 'ID', sortable: true },
  { key: 'status.byteSize', label: 'Size' },
  { key: 'metadata.creationTimestamp', label: 'Age', sortable: true },
  { key: 'actions' },
]

const q = ref('')
const selected = ref([])

const filteredRows = computed(() => {
  if (!q.value) {
    return modelfiles
  }

  return modelfiles.filter((mf) => {
    return Object.values(mf).some((value) => {
      return String(value).toLowerCase().includes(q.value.toLowerCase())
    })
  })
})

</script>

<template>
    <UCard class="w-full" :ui="{
        base: '',
        ring: '',
        divide: 'divide-y divide-gray-200 dark:divide-gray-700',
        header: { padding: 'px-4 py-5' },
        body: { padding: '', base: 'divide-y divide-gray-200 dark:divide-gray-700' },
        footer: { padding: 'p-4' }
    }">
        <div class="p-5">
            <!-- <h1 class="text-2xl"> -->
            <h1 class="font-semibold text-xl text-gray-900 dark:text-white leading-tight">
                Model Files
                <div class="float-right">
                    <UDropdown :popper="{ placement: 'bottom-start' }">
                        <UButton icon="i-heroicons-plus" aria-label="Add" size="sm" class="mr-4">
                            Create
                        </UButton>
                    </UDropdown>
                </div>
            </h1>
            <UDivider class="my-2" />

            <!-- <div class="flex px-3 py-3.5 border-b border-gray-200 dark:border-gray-700">
                <UInput v-model="q" placeholder="Filter..." />
            </div> -->
            <!-- Filters -->
            <div class="flex items-center gap-3 px-4 py-3">
                <UButton icon="i-heroicons-arrow-down-tray" label="Download YAML" color="white" />
                <UButton icon="i-heroicons-trash" label="Delete" color="white" />
                <UInput v-model="q" icon="i-heroicons-magnifying-glass-20-solid" placeholder="Filter..." class="search row" />
            </div>

            <!-- Table -->
            <UTable :rows="filteredRows" :columns="columns" v-model="selected" :loading="pending"
                sort-asc-icon="i-heroicons-arrow-up" sort-desc-icon="i-heroicons-arrow-down" sort-mode="manual"
                class="w-full" :ui="{ td: { base: 'max-w-[0] truncate' }, default: { checkbox: { color: 'gray' } } }">
                <template #metadata.state.name-data="{ row }">
                    <UBadge :label="row.metadata.state.name"
                        :color="row.metadata.state.error === false ? 'green' : row.metadata.state.transitioning === true ? 'orange' : 'red'"
                        variant="subtle" class="capitalize" :tooltip="row.metadata.state.message" />
                </template>

                <template #metadata.creationTimestamp-data="{ row }">
                    <span> {{ timeAgo(row.metadata.creationTimestamp) }} </span>
                </template>

                <template #actions-data="{ row }">
                    <TableAction :data="row" />
                </template>
            </UTable>
        </div>
    </UCard>
</template>

<style scoped>
</style>