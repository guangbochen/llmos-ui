<script setup lang="ts">

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
  <nav>
    <LeftNav />
  </nav>
  <aside>
    <ThemeToggle />
  </aside>
  <main>
    <slot />
  </main>
</template>

<style lang="scss">
  .root {
    --nav-width: 300px;
    --aside-height: 50px;

    display: grid;
    grid-template-areas: "nav main"
                         "aside main";
    grid-template-columns: var(--nav-width) 1fr;
    grid-template-rows: 1fr var(--aside-height);
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;

    NAV {
      grid-area: nav;
      overflow: auto;
    }

    ASIDE {
      grid-area: aside;
      line-height: var(--aside-height);
    }

    MAIN {
      grid-area: main;
      overflow: auto;
      position: relative;
    }
  }
</style>