import { ImageGenerator } from "./imageGenerator";
import { appState } from "./appState";
import { CanvasHandler } from "./canvasHandler";
import { syncRangeAndNumber } from "./utils";
import type { CanvasSize } from "./types";

interface UIValues {
  prompt: string;
  seed: number;
  cfg: number;
  steps: number;
  exSize: number;
  width: number;
  height: number;
  lora?: string;
}

export class UIEventHandler {
  private imageGenerator: ImageGenerator;
  private canvasHandler: CanvasHandler | undefined;
  private lastUsedSeed: number | null = null;
  private isAspectRatioLocked = false;
  private initialAspectRatio: number | null = null;
  private canvasSize: CanvasSize = { width: 1024, height: 1024 };

  constructor(imageGenerator: ImageGenerator, canvasHandler?: CanvasHandler) {
    this.imageGenerator = imageGenerator;
    this.canvasHandler = canvasHandler;
    this.setupEventListeners();
  }

  private setupEventListeners() {
    this.bindAspectRatioEvents();
    this.bindDropZoneResize();
    this.bindGenerateButton();

    this.bindToggleAdvanced();
    this.bindSeedControls();
    this.bindCfgSync();
    this.bindStepsSync();

    this.bindMaskButtons();
    this.bindFileUpload();
    this.bindDownloadButtons();

    this.bindAppStateSubscription();
  }

  private bindAspectRatioEvents() {
    // Event listeners para la relación de aspecto
    const widthInput = document.getElementById("width") as HTMLInputElement;
    const heightInput = document.getElementById("height") as HTMLInputElement;
    const toggleAspectRatioButton = document.getElementById(
      "toggle-aspect-ratio"
    ) as HTMLButtonElement;

    toggleAspectRatioButton?.addEventListener("click", () => {
      this.onToggleAspectRatio(
        widthInput,
        heightInput,
        toggleAspectRatioButton
      );
    });

    this.bindDimensionSync(widthInput, heightInput, (w) =>
      Math.round(w / this.initialAspectRatio!)
    );
    this.bindDimensionSync(heightInput, widthInput, (h) =>
      Math.round(h * this.initialAspectRatio!)
    );
  }

  private bindDropZoneResize() {
    const widthInput = document.getElementById("width") as HTMLInputElement;
    const heightInput = document.getElementById("height") as HTMLInputElement;
    const dropZone = document.getElementById("dropZone");

    dropZone?.addEventListener("canvas:resize", (event) => {
      const { width, height } = (event as CustomEvent).detail as CanvasSize;
      widthInput.value = width.toString();
      heightInput.value = height.toString();
    });
  }

  private bindGenerateButton() {
    const generateButton = document.getElementById(
      "generate"
    ) as HTMLButtonElement;
    generateButton?.addEventListener("click", () => {
      this.handleGenerateClick();
    });
  }

  private bindToggleAdvanced() {
    document
      .getElementById("toggle-advanced")
      ?.addEventListener("change", (event) => {
        const advancedFields = document.getElementById("advanced-fields");
        if (advancedFields) {
          advancedFields.style.display = (event.target as HTMLInputElement)
            .checked
            ? "block"
            : "none";
        }
      });
  }

  private bindSeedControls() {
    const seedInput = document.getElementById("seed") as HTMLInputElement;
    const lastButton = document.getElementById("last-seed");
    const randomButton = document.getElementById("random-seed");
    seedInput?.addEventListener("input", (e) => {
      const value = parseInt((e.target as HTMLInputElement).value);
      [lastButton, randomButton].forEach((button) => {
        button?.toggleAttribute("disabled", value === -1);
      });
    });

    lastButton?.addEventListener("click", () => {
      if (this.lastUsedSeed !== null) {
        seedInput.value = this.lastUsedSeed.toString();
      }
    });

    randomButton?.addEventListener("click", () => {
      seedInput.value = "-1";
    });
  }

  private bindCfgSync() {
    syncRangeAndNumber("cfg-range", "cfg-number");
  }

  private bindStepsSync() {
    syncRangeAndNumber("steps-range", "steps-number");
  }

  private bindMaskButtons() {
    document
      .getElementById("clear-mask-button")
      ?.addEventListener("click", () => {
        this.canvasHandler?.clearMask();
      });
  }

  private bindFileUpload() {
    const MAX_SIZE_MB = 50;
    const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;
    const fileUpload = document.getElementById(
      "fileupload"
    ) as HTMLInputElement;
    fileUpload?.addEventListener("change", (e) => {
      const target = e.target as HTMLInputElement;
      const file = target.files?.[0];
      if (file) {
        if (file.size > MAX_SIZE_BYTES) {
          alert(
            `La imagen es demasiado grande. El tamaño máximo permitido es ${MAX_SIZE_MB}MB.`
          );
          target.value = ""; // Clear the file
          return;
        }
        this.canvasHandler?.handleImageUpload(file);
      }
    });
  }

  private bindDownloadButtons() {
    const downloadCanvasBtn = document.getElementById(
      "downloadCanvasBtn"
    ) as HTMLButtonElement;
    const downloadGeneratedImageBtn = document.getElementById(
      "downloadGeneratedImageBtn"
    ) as HTMLButtonElement;

    downloadCanvasBtn?.addEventListener("click", () => {
      this.canvasHandler?.downloadCanvasImage();
    });

    downloadGeneratedImageBtn?.addEventListener("click", () => {
      console.log("Descargando imagen generada...");
      const imageOutput = document.getElementById(
        "imageOutput"
      ) as HTMLImageElement;
      if (imageOutput && imageOutput.src) {
        this.imageGenerator.downloadImage(imageOutput.src);
      }
    });
  }

  private bindAppStateSubscription() {
    // Suscribirse a cambios de estado de appState para actualizar la UI
    appState.subscribe((state) => {
      this.updateGenerateButton(state.isLoading);
      this.handleAppStateErrors(state.error);
      this.renderGeneratedImage(state);
      this.renderImageHistory(state.imageHistory);
    });
  }

  private async handleGenerateClick() {
    const uiValues = this.readUIValues();

    if (!uiValues.prompt) {
      alert("Por favor, ingresa un prompt");
      return;
    }
    appState.startMultipleGeneration(uiValues.exSize);
    const isMask = this.isMaskGeneration();

    for (let i = 0; i < uiValues.exSize; i++) {
      appState.updateGenerationProgress(i + 1);
      try {
        appState.startLoading();
        const { image, seed } = isMask
          ? await this.generateWithMask(uiValues)
          : await this.generateImage(uiValues);

        window.dispatchEvent(
          new CustomEvent("imagenAPI", {
            detail: `data:image/png;base64,${image}`,
            bubbles: true,
            composed: true,
          })
        );

        this.lastUsedSeed = seed;
        appState.setGeneratedImage(`data:image/png;base64,${image}`);
      } catch (error) {
        appState.setError("Failed to generate image. Please try again.");
        console.error("Error generating image:", error);
      } finally {
        if (i === uiValues.exSize - 1) {
          appState.finishMultipleGeneration();
        }
      }
    }
  }

  private bindDimensionSync(
    sourceInput: HTMLInputElement,
    targetInput: HTMLInputElement,
    transform: (value: number) => number
  ): void {
    sourceInput?.addEventListener("input", () => {
      if (!this.isAspectRatioLocked || this.initialAspectRatio === null) {
        return;
      }

      const raw = parseInt(sourceInput.value, 10);
      if (isNaN(raw) || raw <= 0) {
        return;
      }

      targetInput.value = Math.round(transform(raw)).toString();
    });
  }

  private updateGenerateButton(isLoading: boolean): void {
    const generateButton = document.getElementById(
      "generate"
    ) as HTMLButtonElement;
    if (!generateButton) return;

    generateButton.disabled = isLoading;
    generateButton.textContent = isLoading ? "Generando..." : "Generate Image";
  }

  private handleAppStateErrors(error: string | null): void {
    if (error) alert(error);
  }

  private renderGeneratedImage(state: {
    isLoading: boolean;
    progress: { value: number; max: number } | null;
    generatedImageUrl: string | null;
  }): void {
    const container = document.getElementById("generatedImage");
    const dropZone = document.getElementById("container");
    if (dropZone) {
      const content = document.getElementById("content");
      content?.classList.add("hidden");
      if (state.isLoading && state.progress) {
        let progress = document.getElementById("progress");
        if (!progress) {
          progress = document.createElement("div");
          progress.id = "progress";
          progress.classList.add(
            "w-full",
            "flex",
            "flex-col",
            "items-center",
            "justify-center",
            "h-full",
            "absolute",
            "backdrop-blur-lg"
          );
        }
        const percent = Math.round(
          (state.progress.value / state.progress.max) * 100
        );

        progress.innerHTML = `
                <div class="w-2/3 bg-gray-200 rounded-full h-6 mb-4 overflow-hidden">
                  <div class="bg-indigo-600 h-6 rounded-full transition-all duration-300" style="width: ${percent}%;"></div>
                </div>
                <span class="text-indigo-700 font-semibold">${percent}%</span>`;
        dropZone.prepend(progress);
      } else if (state.generatedImageUrl) {
        const progress = document.getElementById("progress");
        if (progress) {
          progress.remove();
        }
      }
    } else if (container) {
      if (state.isLoading && state.progress) {
        const percent = Math.round(
          (state.progress.value / state.progress.max) * 100
        );
        container.innerHTML = `
            <div class="w-full flex flex-col items-center justify-center h-full">
              <div class="w-2/3 bg-gray-200 rounded-full h-6 mb-4 overflow-hidden">
                <div class="bg-indigo-600 h-6 rounded-full transition-all duration-300" style="width: ${percent}%;"></div>
              </div>
              <span class="text-indigo-700 font-semibold">${percent}%</span>
            </div>
          `;
      } else if (state.generatedImageUrl) {
        container.innerHTML = `
            <button
              id="downloadGeneratedImageBtn"
              class="absolute top-2 right-2 bg-indigo-600 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300"
              title="Descargar imagen generada"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-5 w-5"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fill-rule="evenodd"
                  d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"
                  clip-rule="evenodd"></path>
              </svg>
            </button>
            <img id="imageOutput" src="${state.generatedImageUrl}" alt="Generated image" class="max-w-full max-h-full" />
          `;
        this.bindDownloadButtons(); // Re-bind download button after rendering new image
      } else {
        container.innerHTML =
          '<p class="text-gray-500">Generated image will appear here</p>';
      }
    } else {
      return;
    }
  }

  private renderImageHistory(imageHistory: string[]): void {
    // Actualizar historial de imágenes
    const historyContainer = document.querySelector(
      "#imageHistory .flex.space-x-2"
    );
    if (!historyContainer) return;

    historyContainer.innerHTML = ""; // Limpiar antes de añadir
    // Display newest images first (left to right)
    imageHistory
      .slice()
      .reverse()
      .forEach((url) => {
        const imgElement = document.createElement("img");
        imgElement.src = url;
        imgElement.className =
          "object-cover rounded cursor-pointer border border-gray-600 shadow-md";
        imgElement.addEventListener("click", () => {
          appState.setState({ generatedImageUrl: url });
        });
        historyContainer.appendChild(imgElement);
      });
  }

  private onToggleAspectRatio(
    widthInput: HTMLInputElement,
    heightInput: HTMLInputElement,
    AspectRadioButton: HTMLButtonElement
  ): void {
    this.isAspectRatioLocked = !this.isAspectRatioLocked;
    if (this.isAspectRatioLocked) {
      this.setInitialAspectRatio(widthInput, heightInput);
      AspectRadioButton.classList.add(
        "ring-2",
        "ring-indigo-500",
        "text-white"
      );
      AspectRadioButton.classList.remove("bg-gray-100", "text-gray-700");
    } else {
      this.initialAspectRatio = null;
      AspectRadioButton.classList.remove(
        "ring-2",
        "ring-indigo-500",
        "text-white"
      );
      AspectRadioButton.classList.add("bg-gray-100", "text-gray-700");
    }
  }

  private async generateWithMask(
    uiValues: UIValues
  ): Promise<{ image: string; seed: number }> {
    const maskBlob = await this.canvasHandler!.buildCanvasMask();
    if (!maskBlob) throw new Error("Failed to create mask blob.");

    let imageBlob: Blob;
    if (this.canvasHandler!.getGeneratedImage()) {
      const image = this.canvasHandler!.getGeneratedImage();
      if (!image) throw new Error("No image available for mask generation.");
      imageBlob = await fetch(image).then((res) => res.blob());
    } else {
      imageBlob = this.canvasHandler!.getFile()!;
    }

    return this.imageGenerator.generateImageWithMask({
      prompt: uiValues.prompt!,
      mask: maskBlob,
      image: imageBlob,
      seed: uiValues.seed!,
      cfg: uiValues.cfg,
      steps: uiValues.steps,
      width: uiValues.width,
      height: uiValues.height,
      lora: uiValues.lora,
    });
  }

  private async generateImage(
    uiValues: UIValues
  ): Promise<{ image: string; seed: number }> {
    return this.imageGenerator.generateImage({
      prompt: uiValues.prompt,
      seed: uiValues.seed,
      cfg: uiValues.cfg,
      steps: uiValues.steps,
      width: uiValues.width,
      height: uiValues.height,
      lora: uiValues.lora,
    });
  }

  private readUIValues(): UIValues {
    const prompt = (document.getElementById("prompt") as HTMLTextAreaElement)
      .value;
    const seed = this.parseInputInt("seed", -1);
    const cfg = this.parseInputFloat("cfg-number", 1.0);
    const steps = this.parseInputInt("steps-number", 25);
    const exSize = this.parseInputInt("ex-size", 1);
    const width = this.parseInputInt("width", 1024);
    const height = this.parseInputInt("height", 1024);
    const loraSelect = document.getElementById(
      "loras-select"
    ) as HTMLSelectElement;

    const lora =
      loraSelect.value === "--Select a Lora--" ? "" : loraSelect.value;
    return { prompt, seed, cfg, steps, exSize, width, height, lora };
  }

  private isMaskGeneration(): boolean {
    return Boolean(
      this.canvasHandler &&
        (this.canvasHandler.getMaskLines().length > 0 ||
          this.canvasHandler.getFile() !== undefined)
    );
  }

  private setInitialAspectRatio(
    widthInput: HTMLInputElement,
    heightInput: HTMLInputElement
  ): void {
    const w = parseInt(widthInput.value, 10);
    const h = parseInt(heightInput.value, 10);
    if (w > 0 && h > 0) {
      this.initialAspectRatio = w / h;
    }
  }

  private parseInputInt(inputId: string, defaultValue: number): number {
    const input = document.getElementById(inputId) as HTMLInputElement;
    const value = parseInt(input.value, 10);
    return isNaN(value) || value <= 0 ? defaultValue : value;
  }

  private parseInputFloat(inputId: string, defaultValue: number): number {
    const input = document.getElementById(inputId) as HTMLInputElement;
    const value = parseFloat(input.value);
    return isNaN(value) || value <= 0 ? defaultValue : value;
  }
}
