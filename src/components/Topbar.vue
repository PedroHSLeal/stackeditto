<template>
  <div id="topbar">
    <slot />
  </div>
</template>

<style scoped>
#topbar {
  background-color: lightblue;
  height: 24px;
  display: flex;
  align-items: center;
  padding-left: 8px;
  gap: 10px;
}

#topbar> :slotted(button) {
  padding: 0 3px;
  border: 0;
}
</style>