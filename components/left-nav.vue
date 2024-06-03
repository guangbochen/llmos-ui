<script setup lang="ts">
const route = useRouter()
const links = [{
  label: 'Home',
  icon: 'i-heroicons-home',
  to: '/home'
}, {
  label: 'Users',
  icon: 'i-heroicons-user-group',
  to: '/users'
}, {
  label: 'Model Files',
  icon: 'i-heroicons-document-text',
  to: '/modelfiles'
}, {
  label: 'Settings',
  icon: 'i-heroicons-cog-8-tooth',
  to: '/settings'
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
