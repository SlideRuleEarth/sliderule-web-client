<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import Button from 'primevue/button';
import Card from 'primevue/card';
import Dropdown from 'primevue/dropdown';
import Textarea from 'primevue/textarea';
import Message from 'primevue/message';
import ProgressSpinner from 'primevue/progressspinner';
import { lambdaApiService, type LambdaInvocationResponse } from '@/services/lambdaApiService';
import { useAuthStore } from '@/stores/authStore';
import SrAuth from './SrAuth.vue';

interface LambdaFunction {
    name: string;
    label: string;
    description?: string;
    defaultPayload?: Record<string, any>;
}

const props = defineProps<{
    availableFunctions?: LambdaFunction[];
    autoLoadFunctions?: boolean;
}>();

const authStore = useAuthStore();

const selectedFunction = ref<LambdaFunction | null>(null);
const payloadText = ref('{\n  \n}');
const isExecuting = ref(false);
const executionResult = ref<LambdaInvocationResponse | null>(null);
const functionsFromApi = ref<string[]>([]);
const isLoadingFunctions = ref(false);
const apiHealthy = ref(false);
const showAuthDialog = ref(false);

// Combine provided functions with those loaded from API
const availableFunctions = computed(() => {
    const provided = props.availableFunctions || [];
    const fromApi = functionsFromApi.value.map(name => ({
        name,
        label: name,
    }));

    // Merge, avoiding duplicates
    const allFunctions = [...provided];
    for (const apiFunc of fromApi) {
        if (!allFunctions.find(f => f.name === apiFunc.name)) {
            allFunctions.push(apiFunc);
        }
    }

    return allFunctions;
});

const resultSeverity = computed(() => {
    if (!executionResult.value) return 'info';
    return executionResult.value.success ? 'success' : 'error';
});

const resultTitle = computed(() => {
    if (!executionResult.value) return '';
    return executionResult.value.success ? 'Success' : 'Error';
});

const formattedResult = computed(() => {
    if (!executionResult.value) return '';

    if (executionResult.value.success) {
        return JSON.stringify(executionResult.value.data, null, 2);
    } else {
        return executionResult.value.error || 'Unknown error occurred';
    }
});

const isPayloadValid = computed(() => {
    try {
        JSON.parse(payloadText.value);
        return true;
    } catch {
        return false;
    }
});

const canExecute = computed(() => {
    return selectedFunction.value && isPayloadValid.value && !isExecuting.value;
});

async function checkApiHealth(): Promise<void> {
    try {
        apiHealthy.value = await lambdaApiService.checkApiHealth();
    } catch (error) {
        console.error('Failed to check API health:', error);
        apiHealthy.value = false;
    }
}

async function loadAvailableFunctions(): Promise<void> {
    if (!props.autoLoadFunctions) return;

    isLoadingFunctions.value = true;
    try {
        functionsFromApi.value = await lambdaApiService.getAvailableFunctions();
    } catch (error) {
        console.error('Failed to load available functions:', error);
    } finally {
        isLoadingFunctions.value = false;
    }
}

function onFunctionSelected(): void {
    executionResult.value = null;

    if (selectedFunction.value?.defaultPayload) {
        payloadText.value = JSON.stringify(selectedFunction.value.defaultPayload, null, 2);
    } else {
        payloadText.value = '{\n  \n}';
    }
}

async function executeLambda(): Promise<void> {
    if (!selectedFunction.value || !isPayloadValid.value) return;

    // Check authentication
    if (!authStore.isAuthenticated) {
        showAuthDialog.value = true;
        return;
    }

    isExecuting.value = true;
    executionResult.value = null;

    try {
        const payload = JSON.parse(payloadText.value);
        const result = await lambdaApiService.invokeLambda(
            selectedFunction.value.name,
            payload
        );
        executionResult.value = result;
    } catch (error) {
        executionResult.value = {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error occurred',
            statusCode: 500,
        };
    } finally {
        isExecuting.value = false;
    }
}

function handleSignOut(): void {
    authStore.signOut();
    executionResult.value = null;
}

function formatPayload(): void {
    try {
        const parsed = JSON.parse(payloadText.value);
        payloadText.value = JSON.stringify(parsed, null, 2);
    } catch {
        // Ignore formatting errors
    }
}

onMounted(async () => {
    await authStore.initialize();
    await checkApiHealth();
    await loadAvailableFunctions();
});
</script>

<template>
    <Card class="sr-lambda-executor">
        <template #title>
            <div class="title-container">
                <span>Lambda Function Executor</span>
                <div class="title-actions">
                    <div class="status-indicator" :class="{ healthy: apiHealthy, unhealthy: !apiHealthy }">
                        <i :class="apiHealthy ? 'pi pi-check-circle' : 'pi pi-times-circle'"></i>
                        <span>{{ apiHealthy ? 'API Connected' : 'API Disconnected' }}</span>
                    </div>
                    <div v-if="authStore.isAuthenticated" class="auth-info">
                        <span class="user-email">{{ authStore.userEmail }}</span>
                        <Button
                            icon="pi pi-sign-out"
                            label="Sign Out"
                            size="small"
                            text
                            @click="handleSignOut"
                        />
                    </div>
                    <Button
                        v-else
                        icon="pi pi-sign-in"
                        label="Sign In"
                        size="small"
                        @click="showAuthDialog = true"
                    />
                </div>
            </div>
        </template>
        <template #content>
            <Message v-if="!authStore.isAuthenticated" severity="info" :closable="false">
                Please sign in to execute Lambda functions.
            </Message>

            <Message v-if="!apiHealthy" severity="warn" :closable="false">
                Lambda API Gateway is not configured or unreachable. Please check your configuration.
            </Message>

            <div class="form-section">
                <label for="function-select">Select Function</label>
                <Dropdown
                    id="function-select"
                    v-model="selectedFunction"
                    :options="availableFunctions"
                    optionLabel="label"
                    placeholder="Choose a Lambda function"
                    :loading="isLoadingFunctions"
                    :disabled="!apiHealthy"
                    @change="onFunctionSelected"
                    class="w-full"
                >
                    <template #option="slotProps">
                        <div class="function-option">
                            <div class="function-name">{{ slotProps.option.label }}</div>
                            <div v-if="slotProps.option.description" class="function-description">
                                {{ slotProps.option.description }}
                            </div>
                        </div>
                    </template>
                </Dropdown>
            </div>

            <div v-if="selectedFunction" class="form-section">
                <div class="payload-header">
                    <label for="payload-input">Payload (JSON)</label>
                    <Button
                        label="Format"
                        icon="pi pi-align-justify"
                        size="small"
                        text
                        @click="formatPayload"
                    />
                </div>
                <Textarea
                    id="payload-input"
                    v-model="payloadText"
                    rows="10"
                    :class="{ 'invalid-json': !isPayloadValid }"
                    class="w-full"
                    placeholder='{\n  "key": "value"\n}'
                />
                <small v-if="!isPayloadValid" class="error-text">
                    Invalid JSON syntax
                </small>
            </div>

            <div v-if="selectedFunction" class="action-section">
                <Button
                    label="Execute Lambda"
                    icon="pi pi-play"
                    :disabled="!canExecute"
                    :loading="isExecuting"
                    @click="executeLambda"
                />
            </div>

            <div v-if="isExecuting" class="loading-section">
                <ProgressSpinner style="width: 50px; height: 50px" />
                <p>Executing {{ selectedFunction?.label }}...</p>
            </div>

            <div v-if="executionResult" class="result-section">
                <Message :severity="resultSeverity" :closable="false">
                    <template #default>
                        <div class="result-header">
                            <strong>{{ resultTitle }}</strong>
                            <span class="status-code">HTTP {{ executionResult.statusCode }}</span>
                        </div>
                    </template>
                </Message>
                <pre class="result-content">{{ formattedResult }}</pre>
            </div>
        </template>
    </Card>

    <!-- Auth Dialog -->
    <SrAuth v-model:visible="showAuthDialog" />
</template>

<style scoped>
.sr-lambda-executor {
    max-width: 800px;
    margin: 0 auto;
}

.title-container {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 1rem;
    width: 100%;
}

.title-actions {
    display: flex;
    align-items: center;
    gap: 1rem;
    flex-wrap: wrap;
}

.auth-info {
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.user-email {
    font-size: 0.875rem;
    color: var(--p-text-color);
    font-weight: normal;
}

.status-indicator {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    font-weight: normal;
}

.status-indicator.healthy {
    color: var(--p-green-500);
}

.status-indicator.unhealthy {
    color: var(--p-red-500);
}

.form-section {
    margin-bottom: 1.5rem;
}

.form-section label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 600;
    color: var(--p-text-color);
}

.payload-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
}

.function-option {
    padding: 0.25rem 0;
}

.function-name {
    font-weight: 600;
}

.function-description {
    font-size: 0.875rem;
    color: var(--p-text-muted-color);
    margin-top: 0.25rem;
}

.invalid-json {
    border-color: var(--p-red-500) !important;
}

.error-text {
    color: var(--p-red-500);
    display: block;
    margin-top: 0.25rem;
}

.action-section {
    margin-bottom: 1.5rem;
}

.loading-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    padding: 2rem;
}

.result-section {
    margin-top: 1.5rem;
}

.result-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
}

.status-code {
    font-size: 0.875rem;
    opacity: 0.8;
}

.result-content {
    background-color: var(--p-surface-100);
    border: 1px solid var(--p-surface-300);
    border-radius: 4px;
    padding: 1rem;
    margin-top: 0.5rem;
    overflow-x: auto;
    font-family: 'Courier New', monospace;
    font-size: 0.875rem;
    max-height: 400px;
    overflow-y: auto;
}

.w-full {
    width: 100%;
}
</style>
