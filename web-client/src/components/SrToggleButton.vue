<template>
    <div>
        <span class="toggle-label"> {{ label }}</span>
        <span
            class="toggle-wrapper"
            role="checkbox"
            :aria-checked="value ? 'true' : 'false'"
            tabindex="0"
            @click="toggle"
            @keydown.space.prevent="toggle"
        >
            <span
            class="toggle-background"
            :class="backgroundStyles"
            ></span>  
            <span  
            class="toggle-indicator"  
            :style="indicatorStyles"   
            ></span>
        </span>
    </div>
</template>

<script lang="ts">
    export default {
        props: {
            value:{
                type: Boolean,
                required: true
            },
            label: {
                type: String,
                default: ''
            }
        },
        computed: {
            backgroundStyles() {
                return {
                'toggle-on': this.value,
                'toggle-off': !this.value
                };
            },
            indicatorStyles() {
                return { transform: this.value ? 'translateX(14px)' : 'translateX(0)' };
            }
        },
        methods: {
            toggle() {
                this.$emit('input', !this.value);
            }
        }
    };
</script>
<style scoped>
    div {
        display: flex;
        align-items: center;
    }
    .toggle-on {
        background-color: var(--primary-color);
    }
    .toggle-off {
        background-color: var(--surface-d);
    }
    .toggle-wrapper {
        display: inline-flex;
        position: relative;
        cursor: pointer;
        width: 2rem; 
        height: 1.125rem; 
        border-radius: 9999px;
    }
    .toggle-wrapper:focus {
        outline: 0;
    }
    .toggle-background {
        display: block;
        border-radius: 9999px;
        height: 100%;
        width: 100%;
        box-shadow: inset 0 0.125rem 0.25rem rgba(0, 0, 0, 0.1); 
        transition: background-color .4s ease;
    }
    .toggle-indicator {
        position: absolute;
        height: 0.875rem; 
        width: 0.875rem; 
        left: 0.125rem; 
        bottom: 0.125rem; 
        background-color: #ffffff;
        border-radius: 9999px;
        box-shadow: 0 0.125rem 0.25rem rgba(0, 0, 0, 0.1); 
        transition: transform .4s ease;
    }
    .toggle-label {
        display: inline-flex;
        margin-right: 0.625rem; 
        font-size: 0.875rem; 
        font-weight: 500;
        color: var(--text-color);
        align-content: left;
    }
</style>
