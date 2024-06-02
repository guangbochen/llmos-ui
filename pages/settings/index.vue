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

</script>

<template>
    <div class="p-5">
        <h1 class="text-2xl">
            Settings
            <div class="float-right">
                <UDropdown :items="addOptions" :popper="{ placement: 'bottom-start' }">
                    <UButton icon="i-heroicons-plus" aria-label="Add" size="sm" class="mr-4">
                        Add
                    </UButton>
                </UDropdown>
            </div>
        </h1>
        <UDivider class="my-2" />

        <UTable :rows="settings" v-model="selected"
            :empty-state="{ icon: 'i-heroicons-circle-stack-20-solid', label: 'No items.' }" class="w-full"
            :columns="columns">

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