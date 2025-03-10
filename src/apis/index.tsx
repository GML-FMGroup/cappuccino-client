
interface WebSocketMessage {
    intermediate_output: any;
    role: string;
    message: string;
    data?: any;
}

interface AgentRequest {
    agent_type: 'workflow' | 'planner';
    planner_model: string;
    planner_provider: string;
    planner_api_key: string;
    planner_base_url: string;
    executor_model: string;
    executor_provider: string;
    executor_api_key: string;
    executor_base_url: string;
    user_query: string;
    user_tasks: string[];
}

export class WebSocketClient {
    private chatWs: WebSocket | null = null;
    private screenshotWs: WebSocket | null = null;
    private messageCallback: ((message: WebSocketMessage) => void) | null = null;
    private imageCallback: ((imageUrl: string) => void) | null = null;
    private baseChatUrl: string;
    private baseScreenshotUrl: string;
    private previousImageUrl: string | null = null;
    private imagePreloader: HTMLImageElement | null = null;
    private connectionStateCallback: ((isConnected: boolean) => void) | null = null;

    constructor(serverAddress: string = '0.0.0.0') {
        // Extract hostname without port
        const hostname = serverAddress.split(':')[0];
        
        // Create URLs with different ports
        this.baseChatUrl = `ws://${hostname}:8000/chat`;
        this.baseScreenshotUrl = `ws://${hostname}:8001/screenshots`;
        
        console.log(`Chat URL: ${this.baseChatUrl}`);
        console.log(`Screenshot URL: ${this.baseScreenshotUrl}`);
        
        // Create image preloader
        this.imagePreloader = new Image();
    }

    connect(token: string): Promise<void> {
        // Connect to chat first, and if successful then try to connect to screenshot
        return this.connectChatWs(token)
            .then(() => {
                // Try to connect to screenshot websocket but don't fail the whole connection if it fails
                return this.connectScreenshotWs(token).catch(error => {
                    console.error("Failed to connect to screenshot websocket, continuing anyway:", error);
                    // Return a resolved promise to continue execution
                    return Promise.resolve();
                });
            });
    }

    private connectChatWs(token: string): Promise<void> {
        return new Promise((resolve, reject) => {
            this.chatWs = new WebSocket(this.baseChatUrl);

            this.chatWs.onopen = async () => {
                try {
                    await this.sendMessage({ token });
                    
                    const validateToken = (event: MessageEvent) => {
                        try {
                            const data = JSON.parse(event.data);
                            if (data.message === "Token verification passed") {
                                this.chatWs?.removeEventListener('message', validateToken);
                                resolve();
                                return;
                            }
                            // If we receive any other message during validation, consider it a failure
                            this.chatWs?.removeEventListener('message', validateToken);
                            reject(new Error("Token verification failed"));
                        } catch (error) {
                            console.error('Failed to parse message:', error);
                        }
                    };

                    this.chatWs?.addEventListener('message', validateToken);
                } catch (error) {
                    reject(error);
                }
            };

            this.chatWs.onmessage = async (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.messageCallback?.(data);

                    if (data.message === "Process processing") {
                        await this.sendMessage({ message: "Successfully obtained data" });
                    }
                } catch (error) {
                    console.error('Failed to parse message:', error);
                }
            };

            this.chatWs.onerror = (error) => {
                reject(error);
            };

            this.chatWs.onclose = () => {
                console.log("Chat WebSocket closed");
                this.connectionStateCallback?.(false);
            };
        });
    }

    private connectScreenshotWs(token: string): Promise<void> {
        return new Promise((resolve, reject) => {
            this.screenshotWs = new WebSocket(this.baseScreenshotUrl);

            // Set a timeout for connection to fail gracefully
            const connectionTimeout = setTimeout(() => {
                reject(new Error("Screenshot WebSocket connection timeout"));
                this.screenshotWs?.close();
            }, 5000);

            // Set a higher priority for screenshot WebSocket
            this.screenshotWs.binaryType = 'blob';
            
            this.screenshotWs.onopen = async () => {
                clearTimeout(connectionTimeout);
                try {
                    await this.sendScreenshotMessage({ token });
                    
                    const validateToken = (event: MessageEvent) => {
                        try {
                            if (event.data instanceof Blob) {
                                // If we receive binary data, it might be a screenshot already
                                this.handleImage(event.data);
                                // Don't resolve yet, keep listening for text confirmation
                                return;
                            } else {
                                const data = JSON.parse(event.data);
                                if (data.message === "Token verification passed") {
                                    this.screenshotWs?.removeEventListener('message', validateToken);
                                    resolve();
                                    return;
                                }
                                // If we receive any other message during validation, consider it a failure
                                this.screenshotWs?.removeEventListener('message', validateToken);
                                reject(new Error("Screenshot token verification failed"));
                            }
                        } catch (error) {
                            console.error('Failed to parse screenshot message:', error);
                        }
                    };

                    this.screenshotWs?.addEventListener('message', validateToken);
                } catch (error) {
                    reject(error);
                }
            };

            this.screenshotWs.onmessage = async (event) => {
                if (event.data instanceof Blob) {
                    // Use requestAnimationFrame to process screenshot updates separately
                    // from the main JS thread's work
                    window.requestAnimationFrame(() => {
                        this.handleImage(event.data as Blob);
                    });
                } 
            };

            this.screenshotWs.onerror = (error) => {
                clearTimeout(connectionTimeout);
                console.error('Screenshot WebSocket error:', error);
                reject(error);
            };
            
            this.screenshotWs.onclose = () => {
                console.log("Screenshot WebSocket closed");
                // Attempt to reconnect after 3 seconds if we're still connected to chat
                if (this.chatWs && this.chatWs.readyState === WebSocket.OPEN) {
                    setTimeout(() => {
                        console.log("Attempting to reconnect to screenshot WebSocket...");
                        this.connectScreenshotWs(token).catch(e => {
                            console.error("Failed to reconnect to screenshot WebSocket:", e);
                        });
                    }, 3000);
                }
            };
        });
    }

    async sendAgentRequest(request: AgentRequest): Promise<void> {
        await this.sendMessage(request);
    }

    private async sendMessage(data: any): Promise<void> {
        if (!this.chatWs || this.chatWs.readyState !== WebSocket.OPEN) {
            throw new Error('Chat WebSocket is not connected');
        }
        this.chatWs?.send(JSON.stringify(data));
    }

    private async sendScreenshotMessage(data: any): Promise<void> {
        if (!this.screenshotWs || this.screenshotWs.readyState !== WebSocket.OPEN) {
            throw new Error('Screenshot WebSocket is not connected');
        }
        this.screenshotWs?.send(JSON.stringify(data));
    }

    private async handleImage(blob: Blob) {
        try {
            if (!this.imageCallback) return;
            
            const url = URL.createObjectURL(blob);
            
            // Use image preloader to ensure image is fully loaded before displaying
            this.imagePreloader!.onload = () => {
                // Revoke the previous URL to prevent memory leaks - but only after new image is ready
                if (this.previousImageUrl) {
                    setTimeout(() => {
                        URL.revokeObjectURL(this.previousImageUrl!);
                    }, 100); // Small delay to ensure smooth transition
                }
                
                this.previousImageUrl = url;
                this.imageCallback?.(url);
            };
            
            this.imagePreloader!.src = url;
        } catch (error) {
            console.error('Failed to handle image:', error);
        }
    }

    onMessage(callback: (message: WebSocketMessage) => void): void {
        this.messageCallback = callback;
    }

    onImage(callback: (imageUrl: string) => void): void {
        this.imageCallback = callback;
    }

    onConnectionState(callback: (isConnected: boolean) => void): void {
        this.connectionStateCallback = callback;
    }

    isConnected(): boolean {
        return this.chatWs?.readyState === WebSocket.OPEN;
    }

    disconnect(): void {
        // Clean up any remaining blob URLs
        if (this.previousImageUrl) {
            URL.revokeObjectURL(this.previousImageUrl);
            this.previousImageUrl = null;
        }
        
        // Clean up image preloader
        if (this.imagePreloader) {
            this.imagePreloader.onload = null;
            this.imagePreloader = null;
        }
        
        this.chatWs?.close();
        this.chatWs = null;
        this.screenshotWs?.close();
        this.screenshotWs = null;
        this.messageCallback = null;
        this.imageCallback = null;
        this.connectionStateCallback = null;
    }
}
