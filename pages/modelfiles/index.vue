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

</script>

<template>
    <div class="p-5">
        <h1 class="text-2xl">
            Model Files
            <div class="float-right">
                <UDropdown :items="addOptions" :popper="{ placement: 'bottom-start' }">
                    <UButton icon="i-heroicons-plus" aria-label="Add" size="sm" class="mr-4">
                        Add
                    </UButton>
                </UDropdown>
            </div>
        </h1>
        <UDivider class="my-2" />

        <UTable :rows="modelfiles" :columns="columns">
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