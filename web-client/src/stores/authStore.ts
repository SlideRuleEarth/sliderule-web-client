/**
 * Pinia store for authentication state management
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { cognitoAuthService, type UserInfo } from '@/services/cognitoAuthService';

export const useAuthStore = defineStore('auth', () => {
    // State
    const user = ref<UserInfo | null>(null);
    const isAuthenticated = ref(false);
    const isLoading = ref(false);
    const error = ref<string | null>(null);

    // Computed
    const userEmail = computed(() => user.value?.email || '');
    const userName = computed(() => {
        if (!user.value) return '';
        const { givenName, familyName } = user.value;
        if (givenName && familyName) {
            return `${givenName} ${familyName}`;
        }
        return givenName || familyName || user.value.email;
    });

    // Actions
    async function initialize(): Promise<void> {
        isLoading.value = true;
        try {
            const authenticated = await cognitoAuthService.isAuthenticated();
            isAuthenticated.value = authenticated;

            if (authenticated) {
                user.value = await cognitoAuthService.getUserInfo();
            }
        } catch (err) {
            console.error('Failed to initialize auth:', err);
            isAuthenticated.value = false;
            user.value = null;
        } finally {
            isLoading.value = false;
        }
    }

    async function signIn(email: string, password: string): Promise<void> {
        isLoading.value = true;
        error.value = null;

        try {
            await cognitoAuthService.signIn({ email, password });
            user.value = await cognitoAuthService.getUserInfo();
            isAuthenticated.value = true;
        } catch (err) {
            error.value = err instanceof Error ? err.message : 'Sign in failed';
            throw err;
        } finally {
            isLoading.value = false;
        }
    }

    async function signUp(
        email: string,
        password: string,
        givenName?: string,
        familyName?: string
    ): Promise<void> {
        isLoading.value = true;
        error.value = null;

        try {
            await cognitoAuthService.signUp({
                email,
                password,
                givenName,
                familyName,
            });
        } catch (err) {
            error.value = err instanceof Error ? err.message : 'Sign up failed';
            throw err;
        } finally {
            isLoading.value = false;
        }
    }

    async function confirmSignUp(email: string, code: string): Promise<void> {
        isLoading.value = true;
        error.value = null;

        try {
            await cognitoAuthService.confirmSignUp(email, code);
        } catch (err) {
            error.value = err instanceof Error ? err.message : 'Confirmation failed';
            throw err;
        } finally {
            isLoading.value = false;
        }
    }

    async function resendConfirmationCode(email: string): Promise<void> {
        isLoading.value = true;
        error.value = null;

        try {
            await cognitoAuthService.resendConfirmationCode(email);
        } catch (err) {
            error.value = err instanceof Error ? err.message : 'Resend failed';
            throw err;
        } finally {
            isLoading.value = false;
        }
    }

    function signOut(): void {
        cognitoAuthService.signOut();
        user.value = null;
        isAuthenticated.value = false;
        error.value = null;
    }

    async function forgotPassword(email: string): Promise<void> {
        isLoading.value = true;
        error.value = null;

        try {
            await cognitoAuthService.forgotPassword(email);
        } catch (err) {
            error.value = err instanceof Error ? err.message : 'Password reset request failed';
            throw err;
        } finally {
            isLoading.value = false;
        }
    }

    async function confirmPassword(email: string, code: string, newPassword: string): Promise<void> {
        isLoading.value = true;
        error.value = null;

        try {
            await cognitoAuthService.confirmPassword(email, code, newPassword);
        } catch (err) {
            error.value = err instanceof Error ? err.message : 'Password reset failed';
            throw err;
        } finally {
            isLoading.value = false;
        }
    }

    async function changePassword(oldPassword: string, newPassword: string): Promise<void> {
        isLoading.value = true;
        error.value = null;

        try {
            await cognitoAuthService.changePassword(oldPassword, newPassword);
        } catch (err) {
            error.value = err instanceof Error ? err.message : 'Password change failed';
            throw err;
        } finally {
            isLoading.value = false;
        }
    }

    async function refreshSession(): Promise<void> {
        try {
            await cognitoAuthService.refreshSession();
            user.value = await cognitoAuthService.getUserInfo();
        } catch (err) {
            console.error('Failed to refresh session:', err);
            signOut();
        }
    }

    function clearError(): void {
        error.value = null;
    }

    return {
        // State
        user,
        isAuthenticated,
        isLoading,
        error,

        // Computed
        userEmail,
        userName,

        // Actions
        initialize,
        signIn,
        signUp,
        confirmSignUp,
        resendConfirmationCode,
        signOut,
        forgotPassword,
        confirmPassword,
        changePassword,
        refreshSession,
        clearError,
    };
});
