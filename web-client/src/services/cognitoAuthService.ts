/**
 * AWS Cognito Authentication Service
 * Handles user authentication, registration, and token management
 */

import {
    CognitoUserPool,
    CognitoUser,
    AuthenticationDetails,
    CognitoUserAttribute,
    type ISignUpResult,
    type CognitoUserSession,
} from 'amazon-cognito-identity-js';

export interface CognitoConfig {
    userPoolId: string;
    clientId: string;
    region: string;
}

export interface SignUpParams {
    email: string;
    password: string;
    givenName?: string;
    familyName?: string;
}

export interface SignInParams {
    email: string;
    password: string;
}

export interface UserInfo {
    email: string;
    sub: string;
    givenName?: string;
    familyName?: string;
    emailVerified: boolean;
}

export class CognitoAuthService {
    private userPool: CognitoUserPool;
    private currentUser: CognitoUser | null = null;
    private config: CognitoConfig;

    constructor(config?: CognitoConfig) {
        this.config = config || {
            userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID || '',
            clientId: import.meta.env.VITE_COGNITO_CLIENT_ID || '',
            region: import.meta.env.VITE_AWS_REGION || 'us-east-1',
        };

        if (!this.config.userPoolId || !this.config.clientId) {
            console.warn('Cognito configuration missing. Set VITE_COGNITO_USER_POOL_ID and VITE_COGNITO_CLIENT_ID');
        }

        this.userPool = new CognitoUserPool({
            UserPoolId: this.config.userPoolId,
            ClientId: this.config.clientId,
        });

        // Check if user is already logged in
        this.currentUser = this.userPool.getCurrentUser();
    }

    /**
     * Sign up a new user
     */
    async signUp(params: SignUpParams): Promise<ISignUpResult> {
        const { email, password, givenName, familyName } = params;

        const attributes: CognitoUserAttribute[] = [
            new CognitoUserAttribute({ Name: 'email', Value: email }),
        ];

        if (givenName) {
            attributes.push(new CognitoUserAttribute({ Name: 'given_name', Value: givenName }));
        }

        if (familyName) {
            attributes.push(new CognitoUserAttribute({ Name: 'family_name', Value: familyName }));
        }

        return new Promise((resolve, reject) => {
            this.userPool.signUp(email, password, attributes, [], (err, result) => {
                if (err) {
                    reject(err);
                    return;
                }
                if (!result) {
                    reject(new Error('Sign up failed'));
                    return;
                }
                resolve(result);
            });
        });
    }

    /**
     * Confirm user registration with verification code
     */
    async confirmSignUp(email: string, code: string): Promise<void> {
        const userData = {
            Username: email,
            Pool: this.userPool,
        };

        const cognitoUser = new CognitoUser(userData);

        return new Promise((resolve, reject) => {
            cognitoUser.confirmRegistration(code, true, (err) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve();
            });
        });
    }

    /**
     * Resend confirmation code
     */
    async resendConfirmationCode(email: string): Promise<void> {
        const userData = {
            Username: email,
            Pool: this.userPool,
        };

        const cognitoUser = new CognitoUser(userData);

        return new Promise((resolve, reject) => {
            cognitoUser.resendConfirmationCode((err) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve();
            });
        });
    }

    /**
     * Sign in user
     */
    async signIn(params: SignInParams): Promise<CognitoUserSession> {
        const { email, password } = params;

        const authenticationData = {
            Username: email,
            Password: password,
        };

        const authenticationDetails = new AuthenticationDetails(authenticationData);

        const userData = {
            Username: email,
            Pool: this.userPool,
        };

        const cognitoUser = new CognitoUser(userData);

        return new Promise((resolve, reject) => {
            cognitoUser.authenticateUser(authenticationDetails, {
                onSuccess: (session) => {
                    this.currentUser = cognitoUser;
                    resolve(session);
                },
                onFailure: (err) => {
                    reject(err);
                },
                newPasswordRequired: (userAttributes) => {
                    reject(new Error('New password required'));
                },
            });
        });
    }

    /**
     * Sign out current user
     */
    signOut(): void {
        const user = this.userPool.getCurrentUser();
        if (user) {
            user.signOut();
            this.currentUser = null;
        }
    }

    /**
     * Get current user session (with fresh tokens)
     */
    async getCurrentSession(): Promise<CognitoUserSession | null> {
        const user = this.userPool.getCurrentUser();

        if (!user) {
            return null;
        }

        return new Promise((resolve, reject) => {
            user.getSession((err: Error | null, session: CognitoUserSession | null) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(session);
            });
        });
    }

    /**
     * Get ID token (JWT) for API authentication
     */
    async getIdToken(): Promise<string | null> {
        try {
            const session = await this.getCurrentSession();
            return session?.getIdToken().getJwtToken() || null;
        } catch (error) {
            console.error('Failed to get ID token:', error);
            return null;
        }
    }

    /**
     * Get access token
     */
    async getAccessToken(): Promise<string | null> {
        try {
            const session = await this.getCurrentSession();
            return session?.getAccessToken().getJwtToken() || null;
        } catch (error) {
            console.error('Failed to get access token:', error);
            return null;
        }
    }

    /**
     * Get current user info
     */
    async getUserInfo(): Promise<UserInfo | null> {
        const user = this.userPool.getCurrentUser();

        if (!user) {
            return null;
        }

        return new Promise((resolve, reject) => {
            user.getSession((err: Error | null, session: CognitoUserSession | null) => {
                if (err || !session) {
                    reject(err || new Error('No session'));
                    return;
                }

                user.getUserAttributes((err, attributes) => {
                    if (err || !attributes) {
                        reject(err || new Error('No attributes'));
                        return;
                    }

                    const getAttr = (name: string) => {
                        return attributes.find((attr) => attr.getName() === name)?.getValue();
                    };

                    const userInfo: UserInfo = {
                        email: getAttr('email') || '',
                        sub: getAttr('sub') || '',
                        givenName: getAttr('given_name'),
                        familyName: getAttr('family_name'),
                        emailVerified: getAttr('email_verified') === 'true',
                    };

                    resolve(userInfo);
                });
            });
        });
    }

    /**
     * Check if user is authenticated
     */
    async isAuthenticated(): Promise<boolean> {
        try {
            const session = await this.getCurrentSession();
            return session !== null && session.isValid();
        } catch {
            return false;
        }
    }

    /**
     * Forgot password - initiate password reset
     */
    async forgotPassword(email: string): Promise<void> {
        const userData = {
            Username: email,
            Pool: this.userPool,
        };

        const cognitoUser = new CognitoUser(userData);

        return new Promise((resolve, reject) => {
            cognitoUser.forgotPassword({
                onSuccess: () => {
                    resolve();
                },
                onFailure: (err) => {
                    reject(err);
                },
            });
        });
    }

    /**
     * Confirm password reset with code
     */
    async confirmPassword(email: string, code: string, newPassword: string): Promise<void> {
        const userData = {
            Username: email,
            Pool: this.userPool,
        };

        const cognitoUser = new CognitoUser(userData);

        return new Promise((resolve, reject) => {
            cognitoUser.confirmPassword(code, newPassword, {
                onSuccess: () => {
                    resolve();
                },
                onFailure: (err) => {
                    reject(err);
                },
            });
        });
    }

    /**
     * Change password for authenticated user
     */
    async changePassword(oldPassword: string, newPassword: string): Promise<void> {
        const user = this.userPool.getCurrentUser();

        if (!user) {
            throw new Error('No user is currently authenticated');
        }

        return new Promise((resolve, reject) => {
            user.getSession((err: Error | null, session: CognitoUserSession | null) => {
                if (err || !session) {
                    reject(err || new Error('No session'));
                    return;
                }

                user.changePassword(oldPassword, newPassword, (err) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    resolve();
                });
            });
        });
    }

    /**
     * Refresh the session tokens
     */
    async refreshSession(): Promise<CognitoUserSession> {
        const user = this.userPool.getCurrentUser();

        if (!user) {
            throw new Error('No user is currently authenticated');
        }

        return new Promise((resolve, reject) => {
            user.getSession((err: Error | null, session: CognitoUserSession | null) => {
                if (err || !session) {
                    reject(err || new Error('No session'));
                    return;
                }

                const refreshToken = session.getRefreshToken();

                user.refreshSession(refreshToken, (err, session) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    resolve(session);
                });
            });
        });
    }
}

// Export singleton instance
export const cognitoAuthService = new CognitoAuthService();
