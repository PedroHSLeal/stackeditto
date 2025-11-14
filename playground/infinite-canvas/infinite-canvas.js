
class InfiniteCanvasElement extends HTMLElement {

  /** @type { HTMLDivElement } */
  containerDiv;

  /** @type { HTMLCanvasElement } */
  canvas;

  constructor() {
    super();

    this.containerDiv = document.createElement("div");
    this.canvas = document.createElement("canvas");
  }

  connectedCallback() {
    const shadow = this.attachShadow({ mode: "open" });

    this.containerDiv.append(this.canvas);

    shadow.append(this.containerDiv);

    this.canvasAnimation();
  }

  canvasAnimation() {
    const ctx = this.canvas.getContext("2d");

    // Set line width
    ctx.lineWidth = 10;

    // Wall
    ctx.strokeRect(75, 140, 150, 110);

    // Door
    ctx.fillRect(130, 190, 40, 60);

    // Roof
    ctx.beginPath();
    ctx.moveTo(50, 140);
    ctx.lineTo(150, 60);
    ctx.lineTo(250, 140);
    ctx.closePath();
    ctx.stroke();
  }

  disconnectedCallback() {

  }
}

if (!customElements.get("infinite-canvas")) {
  customElements.define("infinite-canvas", InfiniteCanvasElement);
}

registerHtmlBlock({
  htmlTag: "infinite-canvas",
  init: (element, content) => { },
  toMarkdown: (containerElement, element) => { },
  toHtml: () => { },
});