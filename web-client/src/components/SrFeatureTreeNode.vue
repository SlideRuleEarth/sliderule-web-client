<script setup lang="ts">
import { computed } from 'vue'

// What we actually need from OL objects:
export type MiniFeature = {
  get: (_key: any) => any
  getId: () => any
  getGeometry: () => { getType?: () => string } | null | undefined
}

// Discriminated payload for any clickable node
export type SelectPayload =
  | { kind: 'record'; reqId: number }
  | { kind: 'feature'; feature: MiniFeature }

export type FeatureNode = {
  key: string
  label: string
  expanded?: boolean
  children?: FeatureNode[]
  // attach a payload when this node should be “clickable”
  payload?: SelectPayload
}

const props = defineProps<{ node: FeatureNode }>()

const emit = defineEmits<{
  (_e: 'select', _payload: SelectPayload): void
  (_e: 'toggleExpand', _node: FeatureNode): void
}>()

const hasChildren = computed(() => !!props.node.children && props.node.children.length > 0)

function toggleExpand(e?: MouseEvent) {
  e?.stopPropagation()
  emit('toggleExpand', props.node)
}

function selectNode() {
  if (props.node.payload) emit('select', props.node.payload)
  else if (hasChildren.value) toggleExpand() // fallback
}
</script>

<template>
  <li class="tree-node">
    <div
      class="tree-row"
      :class="{ branch: hasChildren, leaf: !hasChildren }"
      @click.stop="selectNode"
    >
      <button
        v-if="hasChildren"
        class="chev"
        :class="node.expanded ? 'open' : 'closed'"
        @click.stop="toggleExpand"
        aria-label="toggle"
      >
        ▸
      </button>
      <span v-else class="dot">•</span>
      <span class="label" :title="node.label">{{ node.label }}</span>
    </div>

    <ul v-if="hasChildren && node.expanded" class="tree-children">
      <SrFeatureTreeNode
        v-for="child in node.children"
        :key="child.key"
        :node="child"
        @select="(p) => $emit('select', p)"
      />
    </ul>
  </li>
</template>

<style scoped>
.tree-node {
  list-style: none;
  margin: 0;
}
.tree-row {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.35rem 0.75rem;
  cursor: pointer;
  border-radius: 6px;
}
.tree-row:hover {
  background: #333;
}
.branch .label {
  font-weight: 600;
}
.leaf .label {
  font-weight: 400;
}
.chev {
  width: 1.1ch;
  transform: rotate(0);
  transition: transform 120ms ease;
  opacity: 0.85;
  background: transparent;
  border: 0;
  padding: 0;
}
.chev.open {
  transform: rotate(90deg);
}
.dot {
  width: 1ch;
  text-align: center;
  opacity: 0.7;
}
.tree-children {
  margin: 0;
  padding-left: 0.75rem;
}
</style>
