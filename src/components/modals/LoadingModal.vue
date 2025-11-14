<template>
  <Modal>
    <div style="background-color: white; display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 20px; width: 250px; border-radius: 10px; padding: 12px">
      <Icon width="108" height="108" icon="svg-spinners:90-ring-with-bg" />
      <span>Espere um momento...</span>
    </div>
  </Modal>
</template>
<script setup lang="ts">
import { Icon } from "@iconify/vue";

import Modal from '../Modal.vue';
</script>