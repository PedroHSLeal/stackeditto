import { ref, type Ref } from "vue";

const pointerEvents = new Map<string, Ref<{ x: number | null, y: number | null }>>();

export function useMouse(context: string) {
  function setEvent(x: number, y: number) {
    if (pointerEvents.has(context))
      pointerEvents.get(context)!.value = { x, y };
    else
      pointerEvents.set(context, ref({ x: null, y: null }));
  }

  function getEvent() {
    return pointerEvents.get(context);
  }

  return {
    setEvent,
    getEvent
  }
}