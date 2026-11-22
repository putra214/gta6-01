// Sunset Keys — keyboard and mouse input state.
// One object holds every key the game reads, so the systems never touch
// DOM events directly. Arrow keys mirror WASD.
export function createInput(canvas) {
  const keys = new Set();
  const state = {
    keys,
    mouseDown: false,
    dragX: 0,
    dragY: 0,
    /** True while the key for `code` is held. Accepts several codes. */
    down(...codes) {
      for (const code of codes) if (keys.has(code)) return true;
      return false;
    },
  };

  function onKeyDown(event) {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
      event.preventDefault();
    }
    keys.add(event.code);
  }
  function onKeyUp(event) {
    keys.delete(event.code);
  }
  function onBlur() {
    keys.clear();
  }

  let lastX = 0;
  let lastY = 0;
  function onMouseDown(event) {
    state.mouseDown = true;
    lastX = event.clientX;
    lastY = event.clientY;
  }
  function onMouseMove(event) {
    if (!state.mouseDown) return;
    state.dragX += event.clientX - lastX;
    state.dragY += event.clientY - lastY;
    lastX = event.clientX;
    lastY = event.clientY;
  }
  function onMouseUp() {
    state.mouseDown = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);

  return state;
}
