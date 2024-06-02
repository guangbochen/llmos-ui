<script setup lang="ts">
// import type { ModelFile } from '~/types'
const items = [
  [{
    label: 'Edit',
    icon: 'i-heroicons-pencil-square-20-solid',
    click: () => {
      console.log('Edit')
    }
  }, {
    label: 'Edit YAML',
    icon: 'i-heroicons-document-text',
  }, {
    label: 'Duplicate',
    icon: 'i-heroicons-document-duplicate-20-solid',
  }], [
    {
      label: 'Download YAML',
      icon: 'i-heroicons-arrow-down-tray',
    },
    {
    label: 'Delete',
    icon: 'i-heroicons-trash-20-solid',
  }]
]
</script>

<template>
  <div class="flex items-center gap-1">
    <UDropdown
      :items="items"
      position="bottom-end"
    >
      <UButton
        icon="i-heroicons-ellipsis-vertical"
        color="gray"
        variant="ghost"
      />
    </UDropdown>
  </div>
</template>
