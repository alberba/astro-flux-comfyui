type AppState = {
  isLoading: boolean;
  error: string | null;
  generatedImageUrl: string | null;
  intermediateImages: string[];
};

class AppStateManager {
  private state: AppState = {
    isLoading: false,
    error: null,
    generatedImageUrl: null,
    intermediateImages: [],
  };

  private listeners: ((state: AppState) => void)[] = [];

  public getState(): AppState {
    return { ...this.state };
  }

  public setState(newState: Partial<AppState>) {
    this.state = { ...this.state, ...newState };
    this.notifyListeners();
  }

  public subscribe(listener: (state: AppState) => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notifyListeners() {
    this.listeners.forEach((listener) => listener(this.state));
  }

  // Acciones específicas
  public startLoading() {
    this.setState({ isLoading: true, error: null });
  }

  public stopLoading() {
    this.setState({ isLoading: false });
  }

  public setError(error: string) {
    this.setState({ error, isLoading: false });
  }

  public setGeneratedImage(url: string) {
    this.setState({ generatedImageUrl: url, isLoading: false });
  }

  public clearGeneratedImage() {
    this.setState({ generatedImageUrl: null });
  }

  public addIntermediateImage(url: string) {
    this.setState({
      intermediateImages: [...this.state.intermediateImages, url],
    });
  }
}

export const appState = new AppStateManager();
