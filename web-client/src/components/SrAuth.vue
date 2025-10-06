<script setup lang="ts">
import { ref, computed } from 'vue';
import Dialog from 'primevue/dialog';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import Password from 'primevue/password';
import Message from 'primevue/message';
import { useAuthStore } from '@/stores/authStore';

type AuthView = 'signin' | 'signup' | 'confirm' | 'forgot' | 'reset';

const authStore = useAuthStore();

const visible = defineModel<boolean>('visible', { default: false });
const currentView = ref<AuthView>('signin');

// Form data
const email = ref('');
const password = ref('');
const confirmPassword = ref('');
const givenName = ref('');
const familyName = ref('');
const confirmationCode = ref('');
const resetCode = ref('');
const newPassword = ref('');

const localError = ref<string | null>(null);
const successMessage = ref<string | null>(null);

// Computed
const dialogTitle = computed(() => {
    switch (currentView.value) {
        case 'signin':
            return 'Sign In';
        case 'signup':
            return 'Create Account';
        case 'confirm':
            return 'Confirm Email';
        case 'forgot':
            return 'Forgot Password';
        case 'reset':
            return 'Reset Password';
        default:
            return '';
    }
});

const isFormValid = computed(() => {
    switch (currentView.value) {
        case 'signin':
            return email.value && password.value;
        case 'signup':
            return (
                email.value &&
                password.value &&
                confirmPassword.value &&
                password.value === confirmPassword.value
            );
        case 'confirm':
            return email.value && confirmationCode.value;
        case 'forgot':
            return email.value;
        case 'reset':
            return email.value && resetCode.value && newPassword.value;
        default:
            return false;
    }
});

const passwordMismatch = computed(() => {
    return (
        currentView.value === 'signup' &&
        confirmPassword.value &&
        password.value !== confirmPassword.value
    );
});

// Actions
function clearForm(): void {
    email.value = '';
    password.value = '';
    confirmPassword.value = '';
    givenName.value = '';
    familyName.value = '';
    confirmationCode.value = '';
    resetCode.value = '';
    newPassword.value = '';
    localError.value = null;
    successMessage.value = null;
    authStore.clearError();
}

function switchView(view: AuthView): void {
    currentView.value = view;
    localError.value = null;
    successMessage.value = null;
    authStore.clearError();
}

function closeDialog(): void {
    visible.value = false;
    clearForm();
    currentView.value = 'signin';
}

async function handleSignIn(): Promise<void> {
    localError.value = null;
    try {
        await authStore.signIn(email.value, password.value);
        successMessage.value = 'Successfully signed in!';
        setTimeout(() => closeDialog(), 1000);
    } catch (error) {
        localError.value = error instanceof Error ? error.message : 'Sign in failed';
    }
}

async function handleSignUp(): Promise<void> {
    localError.value = null;

    if (password.value !== confirmPassword.value) {
        localError.value = 'Passwords do not match';
        return;
    }

    try {
        await authStore.signUp(email.value, password.value, givenName.value, familyName.value);
        successMessage.value = 'Account created! Please check your email for a confirmation code.';
        switchView('confirm');
    } catch (error) {
        localError.value = error instanceof Error ? error.message : 'Sign up failed';
    }
}

async function handleConfirm(): Promise<void> {
    localError.value = null;
    try {
        await authStore.confirmSignUp(email.value, confirmationCode.value);
        successMessage.value = 'Email confirmed! You can now sign in.';
        setTimeout(() => switchView('signin'), 2000);
    } catch (error) {
        localError.value = error instanceof Error ? error.message : 'Confirmation failed';
    }
}

async function handleResendCode(): Promise<void> {
    localError.value = null;
    try {
        await authStore.resendConfirmationCode(email.value);
        successMessage.value = 'Confirmation code resent to your email.';
    } catch (error) {
        localError.value = error instanceof Error ? error.message : 'Resend failed';
    }
}

async function handleForgotPassword(): Promise<void> {
    localError.value = null;
    try {
        await authStore.forgotPassword(email.value);
        successMessage.value = 'Password reset code sent to your email.';
        switchView('reset');
    } catch (error) {
        localError.value = error instanceof Error ? error.message : 'Request failed';
    }
}

async function handleResetPassword(): Promise<void> {
    localError.value = null;
    try {
        await authStore.confirmPassword(email.value, resetCode.value, newPassword.value);
        successMessage.value = 'Password reset successful! You can now sign in.';
        setTimeout(() => switchView('signin'), 2000);
    } catch (error) {
        localError.value = error instanceof Error ? error.message : 'Password reset failed';
    }
}
</script>

<template>
    <Dialog
        v-model:visible="visible"
        :header="dialogTitle"
        :modal="true"
        :closable="true"
        :style="{ width: '450px' }"
        @hide="closeDialog"
    >
        <div class="auth-container">
            <Message v-if="localError || authStore.error" severity="error" :closable="false">
                {{ localError || authStore.error }}
            </Message>

            <Message v-if="successMessage" severity="success" :closable="false">
                {{ successMessage }}
            </Message>

            <!-- Sign In View -->
            <div v-if="currentView === 'signin'" class="auth-form">
                <div class="field">
                    <label for="signin-email">Email</label>
                    <InputText
                        id="signin-email"
                        v-model="email"
                        type="email"
                        placeholder="Enter your email"
                        class="w-full"
                        @keyup.enter="isFormValid && handleSignIn()"
                    />
                </div>

                <div class="field">
                    <label for="signin-password">Password</label>
                    <Password
                        id="signin-password"
                        v-model="password"
                        placeholder="Enter your password"
                        :feedback="false"
                        toggleMask
                        class="w-full"
                        inputClass="w-full"
                        @keyup.enter="isFormValid && handleSignIn()"
                    />
                </div>

                <Button
                    label="Sign In"
                    :loading="authStore.isLoading"
                    :disabled="!isFormValid"
                    @click="handleSignIn"
                    class="w-full"
                />

                <div class="auth-links">
                    <a @click="switchView('forgot')" class="link">Forgot password?</a>
                    <span class="separator">•</span>
                    <a @click="switchView('signup')" class="link">Create account</a>
                </div>
            </div>

            <!-- Sign Up View -->
            <div v-if="currentView === 'signup'" class="auth-form">
                <div class="field">
                    <label for="signup-email">Email *</label>
                    <InputText
                        id="signup-email"
                        v-model="email"
                        type="email"
                        placeholder="Enter your email"
                        class="w-full"
                    />
                </div>

                <div class="field">
                    <label for="signup-given-name">First Name</label>
                    <InputText
                        id="signup-given-name"
                        v-model="givenName"
                        placeholder="Enter your first name"
                        class="w-full"
                    />
                </div>

                <div class="field">
                    <label for="signup-family-name">Last Name</label>
                    <InputText
                        id="signup-family-name"
                        v-model="familyName"
                        placeholder="Enter your last name"
                        class="w-full"
                    />
                </div>

                <div class="field">
                    <label for="signup-password">Password *</label>
                    <Password
                        id="signup-password"
                        v-model="password"
                        placeholder="Enter your password"
                        toggleMask
                        class="w-full"
                        inputClass="w-full"
                    />
                </div>

                <div class="field">
                    <label for="signup-confirm-password">Confirm Password *</label>
                    <Password
                        id="signup-confirm-password"
                        v-model="confirmPassword"
                        placeholder="Confirm your password"
                        :feedback="false"
                        toggleMask
                        class="w-full"
                        inputClass="w-full"
                        :class="{ 'p-invalid': passwordMismatch }"
                    />
                    <small v-if="passwordMismatch" class="p-error">Passwords do not match</small>
                </div>

                <Button
                    label="Create Account"
                    :loading="authStore.isLoading"
                    :disabled="!isFormValid"
                    @click="handleSignUp"
                    class="w-full"
                />

                <div class="auth-links">
                    <a @click="switchView('signin')" class="link">Already have an account? Sign in</a>
                </div>
            </div>

            <!-- Confirm Email View -->
            <div v-if="currentView === 'confirm'" class="auth-form">
                <p class="confirm-instructions">
                    Enter the confirmation code sent to <strong>{{ email }}</strong>
                </p>

                <div class="field">
                    <label for="confirmation-code">Confirmation Code</label>
                    <InputText
                        id="confirmation-code"
                        v-model="confirmationCode"
                        placeholder="Enter confirmation code"
                        class="w-full"
                        @keyup.enter="isFormValid && handleConfirm()"
                    />
                </div>

                <Button
                    label="Confirm Email"
                    :loading="authStore.isLoading"
                    :disabled="!isFormValid"
                    @click="handleConfirm"
                    class="w-full"
                />

                <div class="auth-links">
                    <a @click="handleResendCode" class="link">Resend code</a>
                    <span class="separator">•</span>
                    <a @click="switchView('signin')" class="link">Back to sign in</a>
                </div>
            </div>

            <!-- Forgot Password View -->
            <div v-if="currentView === 'forgot'" class="auth-form">
                <p class="confirm-instructions">
                    Enter your email address and we'll send you a password reset code.
                </p>

                <div class="field">
                    <label for="forgot-email">Email</label>
                    <InputText
                        id="forgot-email"
                        v-model="email"
                        type="email"
                        placeholder="Enter your email"
                        class="w-full"
                        @keyup.enter="isFormValid && handleForgotPassword()"
                    />
                </div>

                <Button
                    label="Send Reset Code"
                    :loading="authStore.isLoading"
                    :disabled="!isFormValid"
                    @click="handleForgotPassword"
                    class="w-full"
                />

                <div class="auth-links">
                    <a @click="switchView('signin')" class="link">Back to sign in</a>
                </div>
            </div>

            <!-- Reset Password View -->
            <div v-if="currentView === 'reset'" class="auth-form">
                <p class="confirm-instructions">
                    Enter the reset code sent to <strong>{{ email }}</strong> and your new password.
                </p>

                <div class="field">
                    <label for="reset-code">Reset Code</label>
                    <InputText
                        id="reset-code"
                        v-model="resetCode"
                        placeholder="Enter reset code"
                        class="w-full"
                    />
                </div>

                <div class="field">
                    <label for="new-password">New Password</label>
                    <Password
                        id="new-password"
                        v-model="newPassword"
                        placeholder="Enter new password"
                        toggleMask
                        class="w-full"
                        inputClass="w-full"
                        @keyup.enter="isFormValid && handleResetPassword()"
                    />
                </div>

                <Button
                    label="Reset Password"
                    :loading="authStore.isLoading"
                    :disabled="!isFormValid"
                    @click="handleResetPassword"
                    class="w-full"
                />

                <div class="auth-links">
                    <a @click="switchView('signin')" class="link">Back to sign in</a>
                </div>
            </div>
        </div>
    </Dialog>
</template>

<style scoped>
.auth-container {
    padding: 1rem 0;
}

.auth-form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
}

.field {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.field label {
    font-weight: 600;
    color: var(--p-text-color);
}

.w-full {
    width: 100%;
}

:deep(.p-password.w-full) {
    width: 100%;
}

:deep(.p-password.w-full .p-password-input) {
    width: 100%;
}

.auth-links {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 0.5rem;
    margin-top: 0.5rem;
}

.link {
    color: var(--p-primary-color);
    cursor: pointer;
    text-decoration: none;
    font-size: 0.875rem;
}

.link:hover {
    text-decoration: underline;
}

.separator {
    color: var(--p-text-muted-color);
}

.confirm-instructions {
    color: var(--p-text-color);
    margin-bottom: 0.5rem;
}

.p-invalid {
    border-color: var(--p-red-500);
}

.p-error {
    color: var(--p-red-500);
    font-size: 0.875rem;
}
</style>
