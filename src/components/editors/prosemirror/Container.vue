<template>
  <div ref="refContainer" style="display: flex; flex-direction: column; padding: 6px 12px; width: 100%; overflow: auto">
    <p style="margin: 0 0 12px 0; text-align: center; color: lightgray; cursor: default;">--*--</p>
    <slot/>
    <p style="margin: 12px 0 0 0; text-align: center; color: lightgray; cursor: default;">--*--</p>
  </div>
</template>