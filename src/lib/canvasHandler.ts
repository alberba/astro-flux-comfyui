import type { CanvasSize } from "./types";

export class CanvasHandler {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null;
  private dropZone: HTMLDivElement;
  private fileInput: HTMLInputElement;
  private generatedImage: string | null = null;
  private maskLines: {
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    lineWidth: number;
  }[] = [];
  private isDrawing = false;
  private lastX = 0;
  private lastY = 0;
  private color = "black";
  private brushSize = 10;
  private file: File | undefined;
  private generatedUrl: string | null = null;

  constructor(
    canvasId: string,
    dropZoneId: string,
    fileInputId: string,
    contentId: string
  ) {
    this.canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    this.ctx = this.canvas.getContext("2d");
    this.dropZone = document.getElementById(dropZoneId) as HTMLDivElement;
    this.fileInput = document.getElementById(fileInputId) as HTMLInputElement;

    if (!this.ctx) {
      console.error("Could not get canvas context");
    }

    this.setupEventListeners(contentId);
  }

  private setupEventListeners(contentId: string) {
    const container = document.getElementById(contentId) as HTMLElement;

    // Prevent default drag behaviors
    ["dragenter", "dragover", "dragleave", "drop"].forEach((eventName) => {
      container.addEventListener(
        eventName,
        this.preventDefaults.bind(this),
        false
      );
    });

    // Highlight drop area when item is dragged over it
    ["dragenter", "dragover"].forEach((eventName) => {
      container.addEventListener(eventName, this.highlight.bind(this), false);
    });

    ["dragleave", "drop"].forEach((eventName) => {
      container.addEventListener(eventName, this.unhighlight.bind(this), false);
    });

    // Handle dropped files
    container.addEventListener("drop", this.handleDrop.bind(this), false);

    this.fileInput.addEventListener(
      "change",
      this.handleFileInputChange.bind(this)
    );

    this.canvas.addEventListener("mousedown", this.startDrawing.bind(this));
    this.canvas.addEventListener("mousemove", this.draw.bind(this));
    this.canvas.addEventListener("mouseup", this.stopDrawing.bind(this));
    this.canvas.addEventListener("mouseout", this.stopDrawing.bind(this));

    // Buscar el botón clearMask en inpaint-loras
    const clearMaskButton = document.getElementById("clearMask");
    clearMaskButton?.addEventListener("click", () => {
      this.clearMask();
    });

    // Color selector buttons
    const blackMask = document.getElementById("blackMask");
    const whiteMask = document.getElementById("whiteMask");
    blackMask?.addEventListener("click", () => this.setColor("black"));
    whiteMask?.addEventListener("click", () => this.setColor("white"));

    const brushSizeInput = document.getElementById(
      "brushSize"
    ) as HTMLInputElement;
    const brushSizeValueSpan = document.getElementById(
      "brushSizeValue"
    ) as HTMLSpanElement;

    brushSizeInput?.addEventListener("input", (event) => {
      this.brushSize = parseInt((event.target as HTMLInputElement).value);
      brushSizeValueSpan.textContent = this.brushSize.toString();
    });
  }

  private preventDefaults(e: Event) {
    e.preventDefault();
    e.stopPropagation();
  }

  private highlight() {
    this.dropZone.classList.add("border-indigo-500", "bg-indigo-50");
  }

  private unhighlight() {
    this.dropZone.classList.remove("border-indigo-500", "bg-indigo-50");
  }

  private handleDrop(e: DragEvent) {
    const dt = e.dataTransfer;
    this.file = dt?.files?.[0];
    this.dropZone.dispatchEvent(
      new CustomEvent("file:loaded", { detail: this.file, bubbles: true })
    );
    this.generatedUrl = null;
    this.dropZone.dispatchEvent(
      new CustomEvent("updateGeneratedUrl", {
        detail: this.generatedUrl,
        bubbles: true,
      })
    );
    this.generatedImage = null;

    if (this.file) {
      this.loadImage(this.file);
    }
  }

  private handleFileInputChange(e: Event) {
    this.file = (this.fileInput.files as FileList)?.[0];
    this.dropZone.dispatchEvent(
      new CustomEvent("file:loaded", { detail: this.file, bubbles: true })
    );
    this.loadImage(this.file!);
  }

  public loadImage(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        console.log("Imagen cargada:", img.width, img.height);
        this.canvas.width = img.width;
        this.canvas.height = img.height;
        this.dropZone.dispatchEvent(
          new CustomEvent("canvas:resize", {
            detail: { width: this.canvas.width, height: this.canvas.height },
            bubbles: true,
          })
        );
        console.log(
          "Aspect Ratio canvas: ",
          this.canvas.width / this.canvas.height
        );
        console.log("Aspect Ratio imagen: ", img.width / img.height);

        this.ctx?.drawImage(img, 0, 0, this.canvas.width, this.canvas.height);
        this.canvas.classList.remove("hidden");
        document.getElementById("content")?.classList.add("hidden");
        document.getElementById("clearMask")?.classList.remove("hidden");
        document.getElementById("maskSettings")?.classList.remove("hidden");
        document.getElementById("maskSettings")?.classList.add("flex");
      };
      img.src = e.target!.result as string;
    };
    reader.readAsDataURL(file);
  }

  public loadImageFromUrl(url: string) {
    this.generatedImage = url;
    const img = new Image();
    img.onload = () => {
      if (this.canvas && this.ctx) {
        this.canvas.width = img.width;
        this.canvas.height = img.height;
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.drawImage(img, 0, 0, this.canvas.width, this.canvas.height);
      }
    };
    img.src = url;
    this.maskLines.length = 0; // Clear mask when a new image is loaded
  }

  private startDrawing(event: MouseEvent) {
    this.isDrawing = true;
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;

    const xCss = event.clientX - rect.left;
    const yCss = event.clientY - rect.top;

    this.lastX = xCss * scaleX;
    this.lastY = yCss * scaleY;
  }

  private draw(event: MouseEvent) {
    if (!this.isDrawing) return;
    const rect = this.canvas.getBoundingClientRect();
    const xCss = event.clientX - rect.left;
    const yCss = event.clientY - rect.top;

    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;

    const currentX = xCss * scaleX;
    const currentY = yCss * scaleY;

    this.maskLines.push({
      startX: this.lastX,
      startY: this.lastY,
      endX: currentX,
      endY: currentY,
      lineWidth: this.brushSize,
    });
    const maskLinesEvent = new CustomEvent("masklines:update", {
      detail: this.maskLines,
      bubbles: true,
    });
    this.dropZone.dispatchEvent(maskLinesEvent);

    this.redrawCanvas();

    this.lastX = currentX;
    this.lastY = currentY;
  }

  private stopDrawing() {
    this.isDrawing = false;
  }

  private redrawCanvas() {
    if (this.generatedImage) {
      const img = new Image();
      img.onload = () => {
        this.drawMaskLines(img);
      };
      img.src = this.generatedImage;
    } else {
      const reader = new FileReader();
      if (this.file) {
        reader.onload = (e) => {
          const img = new Image();
          img.onload = () => {
            this.drawMaskLines(img);
          };
          img.src = e.target?.result as string;
        };
        reader.readAsDataURL(this.file);
      }
    }
  }

  public drawMaskLines(img: HTMLImageElement) {
    this.ctx?.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx?.drawImage(img, 0, 0, img.width, img.height);
    this.maskLines.forEach((line) => {
      this.ctx?.beginPath();
      this.ctx?.moveTo(line.startX, line.startY);
      this.ctx?.lineTo(line.endX, line.endY);
      this.ctx!.lineWidth = line.lineWidth;
      this.ctx!.strokeStyle = this.color;
      this.ctx!.lineCap = "round";
      this.ctx!.lineJoin = "round";
      this.ctx?.stroke();
    });
  }

  public clearMask() {
    this.maskLines = [];
    this.redrawCanvas();
    // Optionally hide mask-related UI elements if they were shown
    document.getElementById("clearMask")?.classList.add("hidden");
    document.getElementById("maskSettings")?.classList.add("hidden");
    document.getElementById("maskSettings")?.classList.remove("flex");
    document.getElementById("content")?.classList.remove("hidden");
    this.canvas.classList.add("hidden");
    this.file = undefined;
    this.generatedUrl = null;
  }

  public clearCanvas() {
    if (this.ctx) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.maskLines = [];
      this.file = undefined;
      this.generatedUrl = null;
      this.generatedImage = null;
      // Hide canvas and show drop zone content
      this.canvas.classList.add("hidden");
      document.getElementById("content")?.classList.remove("hidden");
      document.getElementById("clearMask")?.classList.add("hidden");
      document.getElementById("maskSettings")?.classList.add("hidden");
      document.getElementById("maskSettings")?.classList.remove("flex");
    }
  }

  public undoLastMaskLine() {
    if (this.maskLines.length > 0) {
      this.maskLines.pop(); // Remove the last line
      this.redrawCanvas();
    }
  }

  public handleImageUpload(file: File) {
    this.loadImage(file);
  }

  public toggleDrawMode() {
    // This method will toggle drawing mode on/off
    // The actual drawing logic is handled by mouse events
    // This might just be for UI feedback like changing cursor or button state
    // For now, it doesn't need to do anything complex here, as drawing is always on when mouse is down.
    // If a more explicit 'draw mode' is needed, `isDrawing` and mouse event listeners would need to be re-evaluated.
  }

  public setColor(newColor: string) {
    this.color = newColor;
  }

  public getMaskLines() {
    return this.maskLines;
  }

  public getFile() {
    return this.file;
  }

  public getGeneratedUrl() {
    return this.generatedUrl;
  }

  public getCanvasSize(): CanvasSize {
    return {
      width: this.canvas.width,
      height: this.canvas.height,
    };
  }

  public buildCanvasMask(): Promise<Blob | undefined> {
    const maskCanvas = document.createElement("canvas") as HTMLCanvasElement;
    maskCanvas.width = this.canvas?.width || 0;
    maskCanvas.height = this.canvas?.height || 0;
    const ctx = maskCanvas.getContext("2d");
    if (!ctx) {
      console.error("Could not get canvas context");
      return Promise.resolve(undefined);
    }
    ctx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
    ctx.beginPath();
    this.maskLines.forEach((line) => {
      ctx.moveTo(line.startX, line.startY);
      ctx.lineTo(line.endX, line.endY);
      ctx.lineWidth = line.lineWidth;
      ctx.strokeStyle = "#fff";
      ctx!.lineCap = "round";
      ctx!.lineJoin = "round";
      ctx.stroke();
    });
    ctx.closePath();

    // invert the mask
    const inverCanvas = this.invertMask(maskCanvas);

    return new Promise((resolve) => {
      inverCanvas.toBlob((blob) => {
        resolve(blob || undefined);
      }, "image/png");
    });
  }

  public invertMask(mask: HTMLCanvasElement): HTMLCanvasElement {
    const w = mask.width;
    const h = mask.height;
    const inv = document.createElement("canvas");
    inv.width = w;
    inv.height = h;
    const ctx = inv.getContext("2d");

    ctx!.fillStyle = "white";
    ctx?.fillRect(0, 0, w, h);

    ctx!.globalCompositeOperation = "destination-out";
    ctx?.drawImage(mask, 0, 0);

    ctx!.globalCompositeOperation = "source-over";
    return inv;
  }
}
