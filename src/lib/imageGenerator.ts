import { appState } from "./appState";

export class ImageGenerator {
  private apiUrl: string;
  private wsUrl: string;
  private ws: WebSocket | null = null;
  private clientId: string;
  private _progressTimeoutId: number | null = null;

  constructor(apiEndpointWorkflow?: string) {
    this.apiUrl = import.meta.env.PUBLIC_API_URL_BASE;
    this.wsUrl = import.meta.env.PUBLIC_WS_URL_BASE;

    this.apiUrl += apiEndpointWorkflow || "/generate-simple";
    this.clientId = this.generateClientId();
  }

  private generateClientId(): string {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
      /[xy]/g,
      function (c) {
        const r = (Math.random() * 16) | 0;
        const v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      },
    );
  }

  private connectWebSocket() {
    const wsUrl = new URL(this.wsUrl);
    wsUrl.searchParams.append("clientId", this.clientId);
    this.ws = new WebSocket(wsUrl.toString());

    this.ws.onmessage = (event) => {
      if (typeof event.data === "string") {
        try {
          const msg = JSON.parse(event.data);

          if (msg.type === "progress") {
            appState.setProgress({ value: msg.data.value, max: msg.data.max });
            this._startProgressTimeout();
            return;
          }
        } catch (err) {
          console.error("JSON inesperado:", err, event.data);
        }
        return;
      }
    };
  }

  private _startProgressTimeout() {
    if (this._progressTimeoutId) {
      clearTimeout(this._progressTimeoutId);
    }
    this._progressTimeoutId = window.setTimeout(() => {
      const progressContainer = document.querySelector("#progressbar");
      const isGenerateSimple = document.querySelector("#generatedImage");
      const existingTextOutput = document.querySelector(
        "#progress-text-warning",
      );
      if (!existingTextOutput) {
        const textOutput = document.createElement("p");
        textOutput.id = "progress-text-warning";
        if (!isGenerateSimple) {
          textOutput.className = "text-white text-shadow-lg/30";
        }
        textOutput.textContent =
          "El proceso esta tardando mas de lo esperado...";
        progressContainer?.append(textOutput);
      }
      this._startProgressTimeout();
    }, 5000);
  }

  async generateImage(params: {
    prompt: string;
    seed: number;
    cfg: number;
    steps: number;
    width: number;
    height: number;
    lora?: string;
  }): Promise<{ image: string; seed: number }> {
    try {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        this.connectWebSocket();
      }
      appState.clearProgress();
      this._startProgressTimeout();

      const response = await fetch(`${this.apiUrl}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: params.prompt,
          seed: params.seed,
          cfg: params.cfg,
          steps: params.steps,
          width: params.width,
          height: params.height,
          clientId: this.clientId,
          lora: params.lora,
        }),
      });

      if (!response.ok) throw new Error("Failed to generate image");
      const data = await response.json();
      if (this._progressTimeoutId) {
        clearTimeout(this._progressTimeoutId);
        this._progressTimeoutId = null;
      }
      return { image: data.image, seed: data.seed };
    } catch (error) {
      console.error("Error generating image:", error);
      throw error;
    }
  }

  async generateImageWithMask(params: {
    prompt: string;
    mask: Blob;
    image: Blob;
    seed: number;
    cfg: number;
    steps: number;
    width: number;
    height: number;
    lora?: string;
  }): Promise<{ image: string; seed: number }> {
    try {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        this.connectWebSocket();
      }
      appState.clearProgress();
      this._startProgressTimeout();
      console.log("API URL:", this.apiUrl);

      const formData = new FormData();
      formData.append("clientId", this.clientId);

      for (const key in params) {
        if (Object.prototype.hasOwnProperty.call(params, key)) {
          const value = params[key as keyof typeof params];
          if (value !== undefined) {
            if (key === "mask" && value instanceof Blob) {
              formData.append("mask", value, "mask.png");
            } else if (key === "image" && value instanceof Blob) {
              formData.append("image", value, "image.png");
            } else if (typeof value === "number") {
              formData.append(key, value.toString());
            } else if (typeof value === "string") {
              formData.append(key, value);
            }
          }
        }
      }

      const response = await fetch(`${this.apiUrl}`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error("Failed to generate image");
      const data = await response.json();
      if (this._progressTimeoutId) {
        clearTimeout(this._progressTimeoutId);
        this._progressTimeoutId = null;
      }
      return { image: data.image, seed: data.seed };
    } catch (error) {
      console.error("Error generating image:", error);
      throw error;
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    if (this._progressTimeoutId) {
      clearTimeout(this._progressTimeoutId);
      this._progressTimeoutId = null;
    }
  }

  public downloadImage(
    dataURL: string,
    filename: string = "generated_image.png",
  ) {
    const link = document.createElement("a");
    link.href = dataURL;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
