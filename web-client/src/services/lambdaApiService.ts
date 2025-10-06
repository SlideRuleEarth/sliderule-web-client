/**
 * Service for invoking AWS Lambda functions via API Gateway
 * This provides a secure way to execute Lambda functions without exposing AWS credentials
 * Uses Cognito JWT tokens for authentication
 */

import { cognitoAuthService } from './cognitoAuthService';

export interface LambdaInvocationRequest {
    functionName: string;
    payload: Record<string, any>;
}

export interface LambdaInvocationResponse {
    success: boolean;
    data?: any;
    error?: string;
    statusCode: number;
}

export class LambdaApiService {
    private apiGatewayUrl: string;
    private useAuth: boolean;

    constructor(apiGatewayUrl?: string, useAuth: boolean = true) {
        this.apiGatewayUrl = apiGatewayUrl || import.meta.env.VITE_LAMBDA_API_GATEWAY_URL || '';
        this.useAuth = useAuth;

        if (!this.apiGatewayUrl) {
            console.warn('Lambda API Gateway URL not configured. Set VITE_LAMBDA_API_GATEWAY_URL in .env');
        }
    }

    /**
     * Invoke a Lambda function through API Gateway
     * @param functionName - Name of the Lambda function to invoke
     * @param payload - Data to send to the Lambda function
     * @param timeout - Request timeout in milliseconds (default: 30000)
     * @returns Promise with the Lambda function response
     */
    async invokeLambda(
        functionName: string,
        payload: Record<string, any> = {},
        timeout: number = 30000
    ): Promise<LambdaInvocationResponse> {
        if (!this.apiGatewayUrl) {
            throw new Error('Lambda API Gateway URL not configured');
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
            };

            // Add Cognito JWT token if authentication is enabled
            if (this.useAuth) {
                const idToken = await cognitoAuthService.getIdToken();
                if (!idToken) {
                    throw new Error('Not authenticated. Please sign in.');
                }
                headers['Authorization'] = `Bearer ${idToken}`;
            }

            // Construct the URL - append function name as path parameter
            const url = `${this.apiGatewayUrl}/${functionName}`;

            const response = await fetch(url, {
                method: 'POST',
                headers,
                body: JSON.stringify(payload),
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            const data = await response.json();

            if (!response.ok) {
                return {
                    success: false,
                    error: data.error || data.message || 'Lambda invocation failed',
                    statusCode: response.status,
                };
            }

            return {
                success: true,
                data: data,
                statusCode: response.status,
            };
        } catch (error) {
            clearTimeout(timeoutId);

            if (error instanceof Error) {
                if (error.name === 'AbortError') {
                    return {
                        success: false,
                        error: `Request timeout after ${timeout}ms`,
                        statusCode: 408,
                    };
                }
                return {
                    success: false,
                    error: error.message,
                    statusCode: 500,
                };
            }

            return {
                success: false,
                error: 'Unknown error occurred',
                statusCode: 500,
            };
        }
    }

    /**
     * Check if the Lambda API is configured and accessible
     * @returns Promise with boolean indicating if API is available
     */
    async checkApiHealth(): Promise<boolean> {
        if (!this.apiGatewayUrl) {
            return false;
        }

        try {
            const headers: Record<string, string> = {};

            if (this.useAuth) {
                const idToken = await cognitoAuthService.getIdToken();
                if (idToken) {
                    headers['Authorization'] = `Bearer ${idToken}`;
                }
            }

            const response = await fetch(`${this.apiGatewayUrl}/health`, {
                method: 'GET',
                headers,
            });
            return response.ok;
        } catch {
            return false;
        }
    }

    /**
     * Get list of available Lambda functions (if API supports it)
     * @returns Promise with array of function names
     */
    async getAvailableFunctions(): Promise<string[]> {
        if (!this.apiGatewayUrl) {
            return [];
        }

        try {
            const headers: Record<string, string> = {};

            if (this.useAuth) {
                const idToken = await cognitoAuthService.getIdToken();
                if (idToken) {
                    headers['Authorization'] = `Bearer ${idToken}`;
                }
            }

            const response = await fetch(`${this.apiGatewayUrl}/functions`, {
                method: 'GET',
                headers,
            });

            if (!response.ok) {
                return [];
            }

            const data = await response.json();
            return data.functions || [];
        } catch {
            return [];
        }
    }

    /**
     * Update API configuration
     * @param apiGatewayUrl - New API Gateway URL
     * @param useAuth - Whether to use Cognito authentication
     */
    updateConfig(apiGatewayUrl: string, useAuth?: boolean): void {
        this.apiGatewayUrl = apiGatewayUrl;
        if (useAuth !== undefined) {
            this.useAuth = useAuth;
        }
    }
}

// Export singleton instance
export const lambdaApiService = new LambdaApiService();
