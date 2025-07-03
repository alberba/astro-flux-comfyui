import type { CanvasSize, MaskBoundingBox } from "./types";

export class CanvasHandler {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null;
  private dropZone: HTMLDivElement;
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
  private MAX_SIZE_MB = 50;
  private MAX_SIZE_BYTES = this.MAX_SIZE_MB * 1024 * 1024;
  private downloadCanvasBtn: HTMLButtonElement | null = null;

  constructor(canvasId: string, dropZoneId: string, contentId: string) {
    this.canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    this.ctx = this.canvas.getContext("2d");
    this.dropZone = document.getElementById(dropZoneId) as HTMLDivElement;
    this.downloadCanvasBtn = document.getElementById(
      "downloadCanvasBtn",
    ) as HTMLButtonElement;

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
        false,
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
      "brushSize",
    ) as HTMLInputElement;
    const brushSizeValueSpan = document.getElementById(
      "brushSizeValue",
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
    this.generatedImage = null;

    if (this.file) {
      if (this.file.size > this.MAX_SIZE_BYTES) {
        alert(
          `La imagen es demasiado grande. El tamaño máximo permitido es ${this.MAX_SIZE_MB}MB.`,
        );
        this.file = undefined; // Clear the file
        return;
      }
      this.loadImage(this.file);
    }
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
          }),
        );
        console.log(
          "Aspect Ratio canvas: ",
          this.canvas.width / this.canvas.height,
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
    this.file = file;
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
    this.downloadCanvasBtn?.classList.add("hidden");
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

    this.redrawCanvas();

    this.lastX = currentX;
    this.lastY = currentY;
  }

  private stopDrawing() {
    this.isDrawing = false;
    this.downloadCanvasBtn?.classList.remove("hidden");
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
  }

  public clearCanvas() {
    if (this.ctx) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.maskLines = [];
      this.file = undefined;
      this.generatedImage = null;
      // Hide canvas and show drop zone content
      this.canvas.classList.add("hidden");
      document.getElementById("content")?.classList.remove("hidden");
      document.getElementById("clearMask")?.classList.add("hidden");
      document.getElementById("maskSettings")?.classList.add("hidden");
      document.getElementById("maskSettings")?.classList.remove("flex");
    }
  }

  public handleImageUpload(file: File) {
    this.loadImage(file);
  }

  public setColor(newColor: string) {
    this.color = newColor;
  }

  public downloadCanvasImage() {
    if (this.generatedImage) {
      // If there's a generated image, use it for download
      const link = document.createElement("a");
      link.href = this.generatedImage;
      link.download = "generated_image.png";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      console.log("Downloading generated image");
    } else {
      // Otherwise, download the current canvas content
      if (this.file) {
        const link = document.createElement("a");
        link.href = URL.createObjectURL(this.file);
        link.download = this.file.name || "canvas_image.png";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
      console.log("Downloading canvas image");
    }
  }

  public getMaskLines() {
    return this.maskLines;
  }

  public getFile() {
    return this.file;
  }
  public getGeneratedImage() {
    return this.generatedImage;
  }

  public getCanvasSize(): CanvasSize {
    return {
      width: this.canvas.width,
      height: this.canvas.height,
    };
  }

  public getMaskBoundingBox(): MaskBoundingBox | undefined {
    if (this.maskLines.length === 0) {
      return undefined;
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    this.maskLines.forEach((line) => {
      // Consider both start and end points and brush size
      minX = Math.min(
        minX,
        line.startX - line.lineWidth / 2,
        line.endX - line.lineWidth / 2,
      );
      minY = Math.min(
        minY,
        line.startY - line.lineWidth / 2,
        line.endY - line.lineWidth / 2,
      );
      maxX = Math.max(
        maxX,
        line.startX + line.lineWidth / 2,
        line.endX + line.lineWidth / 2,
      );
      maxY = Math.max(
        maxY,
        line.startY + line.lineWidth / 2,
        line.endY + line.lineWidth / 2,
      );
    });

    const width = maxX - minX;
    const height = maxY - minY;

    return { x: minX, y: minY, width, height };
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
