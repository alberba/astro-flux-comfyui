export class ImageGenerator {
  private apiUrl: string;
  private wsUrl: string;
  private ws: WebSocket | null = null;
  private onIntermediateImage: ((imageUrl: string) => void) | null = null;

  constructor() {
    this.apiUrl = "http://localhost:8000";
    this.wsUrl = "ws://localhost:8000/ws";
  }

  setIntermediateImageCallback(callback: (imageUrl: string) => void) {
    this.onIntermediateImage = callback;
  }

  private connectWebSocket() {
    this.ws = new WebSocket(this.wsUrl);

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "intermediate_image" && this.onIntermediateImage) {
          this.onIntermediateImage(data.imageUrl);
        }
      } catch (error) {
        console.error("Error parsing WebSocket message:", error);
      }
    };

    this.ws.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    this.ws.onclose = () => {
      console.log("WebSocket connection closed");
    };
  }

  async generateImage(params: {
    prompt: string;
    mask: string;
  }): Promise<string> {
    try {
      // Conectar WebSocket si no está conectado
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        this.connectWebSocket();
      }

      const response = await fetch(`${this.apiUrl}/api/generate-simple`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(params),
      });

      if (!response.ok) throw new Error("Failed to generate image");
      const data = await response.json();
      return data.imageUrl;
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
  }
}
