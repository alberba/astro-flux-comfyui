export class MaskCanvas {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private isDrawing: boolean = false;
  private lastX: number = 0;
  private lastY: number = 0;
  private maskColor: string = "black";
  private maskLines: Array<{
    startX: number;
    startY: number;
    endX: number;
    endY: number;
  }> = [];

  constructor(canvasId: string) {
    this.canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    this.ctx = this.canvas.getContext("2d")!;
    this.setupEventListeners();
    this.resize(); // Asegurar que el canvas tenga el tamaño correcto al inicio
  }

  private setupEventListeners() {
    this.canvas.addEventListener("mousedown", this.startDrawing.bind(this));
    this.canvas.addEventListener("mousemove", this.draw.bind(this));
    this.canvas.addEventListener("mouseup", this.stopDrawing.bind(this));
    this.canvas.addEventListener("mouseout", this.stopDrawing.bind(this));
  }

  private startDrawing(e: MouseEvent) {
    this.isDrawing = true;
    const rect = this.canvas.getBoundingClientRect();
    this.lastX = e.clientX - rect.left;
    this.lastY = e.clientY - rect.top;
  }

  private draw(e: MouseEvent) {
    if (!this.isDrawing) return;

    const rect = this.canvas.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;

    this.maskLines.push({
      startX: this.lastX,
      startY: this.lastY,
      endX: currentX,
      endY: currentY,
    });

    this.redrawCanvas();

    this.lastX = currentX;
    this.lastY = currentY;
  }

  private stopDrawing() {
    this.isDrawing = false;
  }

  private redrawCanvas() {
    // Restaurar la imagen original
    const initialImageData = this.canvas.dataset.initialImage;
    if (initialImageData) {
      const data = new Uint8ClampedArray(JSON.parse(initialImageData));
      const imageData = new ImageData(
        data,
        this.canvas.width,
        this.canvas.height
      );
      this.ctx.putImageData(imageData, 0, 0);
    }

    // Dibujar todas las líneas
    this.ctx.beginPath();
    this.maskLines.forEach((line) => {
      this.ctx.moveTo(line.startX, line.startY);
      this.ctx.lineTo(line.endX, line.endY);
    });
    this.ctx.strokeStyle =
      this.maskColor === "black"
        ? "rgba(0, 0, 0, 0.7)"
        : "rgba(255, 255, 255, 0.7)";
    this.ctx.lineWidth = 20;
    this.ctx.lineCap = "round";
    this.ctx.stroke();
  }

  public setMaskColor(color: string) {
    this.maskColor = color;
    this.redrawCanvas();
  }

  public loadImage(imageUrl: string) {
    const img = new Image();
    img.onload = () => {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

      // Calcular dimensiones para mantener la proporción
      const scale = Math.min(
        this.canvas.width / img.width,
        this.canvas.height / img.height
      );
      const x = (this.canvas.width - img.width * scale) / 2;
      const y = (this.canvas.height - img.height * scale) / 2;

      this.ctx.drawImage(img, x, y, img.width * scale, img.height * scale);

      // Guardar el estado inicial
      const initialImageData = this.ctx.getImageData(
        0,
        0,
        this.canvas.width,
        this.canvas.height
      );
      this.canvas.dataset.initialImage = JSON.stringify(
        Array.from(initialImageData.data)
      );

      // Limpiar el registro de líneas
      this.maskLines = [];
    };
    img.src = imageUrl;
  }

  public clearMask() {
    // Solo limpiar las líneas de la máscara
    this.maskLines = [];

    // Restaurar la imagen original
    const initialImageData = this.canvas.dataset.initialImage;
    if (initialImageData) {
      const data = new Uint8ClampedArray(JSON.parse(initialImageData));
      const imageData = new ImageData(
        data,
        this.canvas.width,
        this.canvas.height
      );
      this.ctx.putImageData(imageData, 0, 0);
    }
  }

  public resize() {
    const container = this.canvas.parentElement?.getBoundingClientRect();
    if (container) {
      this.canvas.width = container.width;
      this.canvas.height = container.height;
      // Redibujar después de redimensionar
      this.redrawCanvas();
    }
  }

  public getMaskData() {
    return this.canvas.toDataURL("image/png");
  }
}
