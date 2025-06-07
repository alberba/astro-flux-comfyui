export class FileHandler {
  private dropZone: HTMLElement;
  private dropZoneContent: HTMLElement;
  private fileInput: HTMLInputElement;
  private onFileLoad: (imageUrl: string) => void;

  constructor(
    dropZoneId: string,
    dropZoneContentId: string,
    fileInputId: string,
    onFileLoad: (imageUrl: string) => void
  ) {
    this.dropZone = document.getElementById(dropZoneId)!;
    this.dropZoneContent = document.getElementById(dropZoneContentId)!;
    this.fileInput = document.getElementById(fileInputId) as HTMLInputElement;
    this.onFileLoad = onFileLoad;

    this.setupEventListeners();
  }

  private setupEventListeners() {
    // Prevenir comportamientos por defecto
    ["dragenter", "dragover", "dragleave", "drop"].forEach((eventName) => {
      this.dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
      });
    });

    // Resaltar zona de drop
    ["dragenter", "dragover"].forEach((eventName) => {
      this.dropZone.addEventListener(eventName, () => {
        this.dropZone.classList.add("border-indigo-500");
      });
    });

    ["dragleave", "drop"].forEach((eventName) => {
      this.dropZone.addEventListener(eventName, () => {
        this.dropZone.classList.remove("border-indigo-500");
      });
    });

    // Manejar archivos soltados
    this.dropZone.addEventListener("drop", (e) => {
      const dt = e.dataTransfer;
      if (dt) {
        const files = dt.files;
        if (files.length > 0) {
          this.handleFiles(files);
        }
      }
    });

    // Manejar selección de archivo
    this.fileInput.addEventListener("change", (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files && files.length > 0) {
        this.handleFiles(files);
      }
    });
  }

  private handleFiles(files: FileList) {
    const file = files[0];
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const imageUrl = event.target?.result as string;
        this.onFileLoad(imageUrl);
        this.dropZoneContent.classList.add("hidden");
        const canvas = this.dropZone.querySelector("canvas");
        if (canvas) {
          canvas.classList.remove("hidden");
        }
      };
      reader.readAsDataURL(file);
    }
  }
}
