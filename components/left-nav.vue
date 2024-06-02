<script setup lang="ts">
// import { useSettings, useClusters, useUser } from '@/stores/steve'
const route = useRouter()
const links = [{
  label: 'Home',
  icon: 'i-heroicons-home',
  to: '/home'
}, {
  label: 'Users',
  icon: 'i-heroicons-users',
  to: '/users'
}, {
  label: 'Model Files',
  icon: 'i-heroicons-document-text',
  to: '/modelfiles'
}]
</script>

<template>
  <UVerticalNavigation :links="links" />
</template>

<style lang="scss" scoped>
  H4 {
    padding-left: 1rem;
  }

  LI {
    display: block;
  }
  .active {
    background-color: red;
  }

  .delete-btn {
    display: none;
  }

  :deep(A:hover .delete-btn) {
    display: initial;
  }
</style>
