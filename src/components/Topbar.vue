<template>
  <div id="topbar">
    <slot />
  </div>
</template>

<style scoped>
#topbar {
  background-color: var(--primary);
  height: 100%;
  display: flex;
  align-items: center;
  padding-left: 8px;
  padding-right: 8px;
  gap: 10px;
}
</style>