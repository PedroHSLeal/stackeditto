<template>
  <div id="modal">
    <slot />
  </div>
</template>

<style scoped>
#modal {
  position: absolute;
  height: 100vh;
  width: 100vw;
  background-color: rgba(0, 0, 0, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>