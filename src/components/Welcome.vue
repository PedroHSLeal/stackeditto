<template>
  <div id="welcome" style="width: 100%; height: 100%">
    <div id="mascot" style="display: flex; flex-direction: column; align-items: center; justify-content: center;">
      <h1>Lumpy</h1>
      <img :src="logo" alt="lumpy logo">
    </div>
    <div style="align-self: center;">
      <div id="actions" style="display: flex; flex-direction: column; align-items: center; justify-content: center;">
        <h3 style="font-weight: 500">Funções básicas</h3>
        <div style="display: flex; flex-direction: row; gap: 8px; justify-content: center;">
          <button class="primary" @click="() => emits('action', 'openWorkspace')">Workspace</button>
          <button class="primary" @click="seila">Tour</button>
        </div>
      </div>
    </div>
    <div id="joke" style="display: flex; align-items: center; justify-content: center;">
      <Transition name="elevator">
        <p v-if="joke" style="text-align: center">{{ joke }}</p>
      </Transition>
    </div>
  </div>
</template>

<script setup lang="ts">
import logo from "@/assets/Phantom.svg";
import { highlight } from "@/services/tour";
import jokesSentences from "@/templates/jokes-sentences.txt?raw";
import { onBeforeUnmount, onMounted, shallowRef } from "vue";

const jokes = shallowRef(jokesSentences.split('\n'));
const joke = shallowRef<string | null>(null);
let intervalId: number;

const emits = defineEmits<{ (e: "action", action: "openWorkspace" | "tour"): void }>();

onMounted(() => {
  intervalId = window.setInterval(() => {
    joke.value = null;
    let timeoutId = setTimeout(() => {
      joke.value = jokes.value[Math.floor(Math.random() * jokes.value.length)];
      clearTimeout(timeoutId);
    }, 1000);
  }, 3000);
});

onBeforeUnmount(() => {
  clearInterval(intervalId);
});

function seila(evt: PointerEvent) {
  highlight(evt.target as Element);
}
</script>

<style scoped lang="scss">
@media screen and (max-width: 560px) {
  #mascot {
    margin-top: 15%;

    img {
      width: 75%;
      height: 75%;
    }
  }

  #welcome {
    grid-template-rows: repeat(3, 1fr);
  }
}

#welcome {
  display: grid;
  // grid-template-rows: 1fr 1fr;
  grid-template-rows: repeat(3, 1fr);
  // grid-template-columns: 1fr 1fr;

  /* #joke {
    grid-column: 1 / 3;
  } */

  & h1 {
    font-size: 48px;
  }
}

// #region vue transition
.elevator-enter-active {
  transition: all 0.3s ease-out;
}

.elevator-leave-active {
  transition: all 0.8s cubic-bezier(1, 0.5, 0.8, 1);
}

.elevator-enter-from,
.elevator-leave-to {
  transform: translateY(20px);
  opacity: 0;
}

// #endregion</style>