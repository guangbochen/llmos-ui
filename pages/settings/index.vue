<script setup lang="ts">
import { timeAgo } from '@/utils/date';

const setting = useSettings();
const settings = await setting.findAll()

const columns = [
  { key: 'metadata.state.name', label: 'State', sortable: true },
  { key: 'id', label: 'Name', sortable: true },
  { key: 'value', label: 'Value', sortable: true },
  { key: 'actions' },
]

const q = ref('')
const selected = ref([])

const filteredRows = computed(() => {
  if (!q.value) {
    return settings
  }

  return settings.filter((setting) => {
    return Object.values(setting).some((value) => {
      return String(value).toLowerCase().includes(q.value.toLowerCase())
    })
  })
})
</script>

<template>
    <div class="p-5">
        <h1 class="text-2xl">
            Settings
            <div class="float-right">
                <UDropdown :items="addOptions" :popper="{ placement: 'bottom-start' }">
                    <UButton icon="i-heroicons-plus" aria-label="Add" size="sm" class="mr-4">
                        Create
                    </UButton>
                </UDropdown>
            </div>
        </h1>
        <UDivider class="my-2" />

        <div class="flex px-3 py-3.5 border-b border-gray-200 dark:border-gray-700">
            <UInput v-model="q" placeholder="Filter..." />
        </div>
        <UTable :rows="filteredRows" v-model="selected" :columns="columns">
            <template #value-data="{ row }">
                <span v-if="row.value">
                    {{ row.id }}
                </span>
                <span v-else>
                    <span class="text-gray-400"></span>
                </span>
            </template>

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
</template>

<style scoped>
</style>