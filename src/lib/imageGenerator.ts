export class ImageGenerator {
  private apiUrl: string;

  constructor(apiUrl: string = "http://localhost:8188") {
    this.apiUrl = apiUrl;
  }

  async fetchLoras(): Promise<Array<{ name: string }>> {
    try {
      const response = await fetch(`${this.apiUrl}/loras`);
      if (!response.ok) {
        throw new Error("Failed to fetch LoRAs");
      }
      return await response.json();
    } catch (error) {
      console.error("Error fetching LoRAs:", error);
      return [];
    }
  }

  async generateImage(params: {
    prompt: string;
    lora: string;
    mask: string;
  }): Promise<string> {
    try {
      const response = await fetch(`${this.apiUrl}/prompt`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        throw new Error("Failed to generate image");
      }

      const data = await response.json();
      return data.imageUrl;
    } catch (error) {
      console.error("Error generating image:", error);
      throw error;
    }
  }
}
