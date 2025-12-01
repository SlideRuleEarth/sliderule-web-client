<script setup lang="ts">
import { ref, computed } from 'vue'
import SrFeatureTreeNode, {
  type FeatureNode,
  type MiniFeature,
  type SelectPayload
} from './SrFeatureTreeNode.vue'
import { useRecTreeStore } from '@/stores/recTreeStore'

// --- utilities to accept anything from OL + clusters and keep a tiny feature API
function isMiniFeature(o: any): o is MiniFeature {
  return (
    !!o &&
    typeof o.get === 'function' &&
    typeof o.getId === 'function' &&
    typeof o.getGeometry === 'function'
  )
}
function unwrapCluster(item: any): MiniFeature[] {
  const contained = item?.get?.('features')
  if (Array.isArray(contained) && contained.length && isMiniFeature(contained[0]))
    return contained as MiniFeature[]
  return isMiniFeature(item) ? [item] : []
}
function coerceToMiniFeatures(arr: any[]): MiniFeature[] {
  const out: MiniFeature[] = []
  for (const x of arr ?? []) out.push(...unwrapCluster(x))
  return out
}
function safeLabel(f: MiniFeature, i: number) {
  return (f.get('name') as string) || (f.getId()?.toString() ?? '') || `Feature ${i + 1}`
}

const menuData = ref<MiniFeature[]>([])
const visible = ref(false)
const menuStyle = ref<Record<string, string>>({})

const emit = defineEmits<{ (_e: 'select', _payload: SelectPayload): void }>()

// ----- Build reqId -> { keys, labels, reqIds, order } from recTreeStore.treeData
type RecPath = { keys: string[]; labels: string[]; reqIds: number[]; order: number[] }
const recTree = useRecTreeStore()

function buildIndex(): Map<number, RecPath> {
  const idx = new Map<number, RecPath>()
  let seq = 0
  function walk(nodes: any, keys: string[], labels: string[], reqIds: number[], order: number[]) {
    for (const n of nodes || []) {
      const k = [...keys, n.key]
      const l = [...labels, n.label]
      const r = [...reqIds, Number(n.data) || 0] // every node in your recTree has data=reqId
      const o = [...order, seq++]
      // index by this node's reqId too, so *every level* is individually addressable
      const thisReqId = Number(n.data) || 0
      if (thisReqId > 0) idx.set(thisReqId, { keys: k, labels: l, reqIds: r, order: o })
      if (n.children?.length) walk(n.children, k, l, r, o)
    }
  }
  walk(recTree.treeData, [], [], [], [])
  return idx
}

// ensure a path exists; attach {kind:'record', reqId} payload at each level
function ensurePath(root: FeatureNode[], path: RecPath): FeatureNode {
  let cursor = root
  let node: FeatureNode | undefined
  for (let i = 0; i < path.labels.length; i++) {
    const key = `rec-${path.keys[i]}`
    node = cursor.find((n) => n.key === key)
    if (!node) {
      node = {
        key,
        label: path.labels[i],
        expanded: true,
        children: [],
        payload: path.reqIds[i] > 0 ? { kind: 'record', reqId: path.reqIds[i] } : undefined
      }
      cursor.push(node)
    } else if (!node.payload && path.reqIds[i] > 0) {
      node.payload = { kind: 'record', reqId: path.reqIds[i] }
    }
    if (!node.children) node.children = []
    cursor = node.children
  }
  return node!
}

// sort to match records traversal order
function makeSorter(orderMap: Map<string, number[]>) {
  return (a: FeatureNode, b: FeatureNode) => {
    const ao = orderMap.get(a.key) ?? [Number.MAX_SAFE_INTEGER]
    const bo = orderMap.get(b.key) ?? [Number.MAX_SAFE_INTEGER]
    const len = Math.min(ao.length, bo.length)
    for (let i = 0; i < len; i++) if (ao[i] !== bo[i]) return ao[i] - bo[i]
    return ao.length - bo.length || a.label.localeCompare(b.label)
  }
}

const rootNodes = computed<FeatureNode[]>(() => {
  const items = menuData.value
  if (!items?.length) return []

  const idx = buildIndex()
  const roots: FeatureNode[] = []
  const orderMap = new Map<string, number[]>()

  // Build tree
  items.forEach((f, i) => {
    const reqId = Number(f.get('req_id')) || 0
    const path = reqId > 0 ? idx.get(reqId) : undefined

    // If we know the record path from the tree, build it and stamp ordering
    let recordLeaf: FeatureNode
    if (path) {
      recordLeaf = ensurePath(roots, path)
      path.keys.forEach((k, j) => {
        const nk = `rec-${k}`
        if (!orderMap.has(nk)) orderMap.set(nk, path.order.slice(0, j + 1))
      })
    } else {
      // fall back to a single "Unassigned" node
      const key = 'rec-unassigned'
      recordLeaf =
        roots.find((r) => r.key === key) ??
        (() => {
          const n: FeatureNode = { key, label: 'Unassigned', expanded: true, children: [] }
          roots.push(n)
          orderMap.set(key, [Number.MAX_SAFE_INTEGER])
          return n
        })()
    }

    // Put features directly under the record (to match Analysis menu feel)
    const label = safeLabel(f, i)

    // skip if it’s just a duplicate record polygon
    if (!label.startsWith('Record:')) {
      recordLeaf.children!.push({
        key: `${recordLeaf.key}-leaf-${i}-${(f.getId() ?? i).toString()}`,
        label,
        payload: { kind: 'feature', feature: f }
      })
    }
  })

  // Sort consistently with records order
  const sortLevel = makeSorter(orderMap)
  function sortTree(nodes: FeatureNode[]) {
    nodes.sort(sortLevel)
    nodes.forEach((n) => {
      if (n.children?.length) sortTree(n.children)
    })
  }
  sortTree(roots)
  return roots
})

// forward selection
function handleSelect(payload: SelectPayload) {
  emit('select', payload)
  hideMenu()
}

// handle toggle expand
function handleToggleExpand(node: FeatureNode) {
  node.expanded = !node.expanded
}

const showMenu = (x: number, y: number, features: any[]) => {
  visible.value = true
  menuData.value = coerceToMiniFeatures(features)

  const menuWidth = 320,
    menuHeight = 360
  let left = x,
    top = y
  const ww = window.innerWidth,
    wh = window.innerHeight
  if (left + menuWidth > ww) left = ww - menuWidth - 8
  if (top + menuHeight > wh) top = wh - menuHeight - 8
  left = Math.max(0, left)
  top = Math.max(0, top)

  menuStyle.value = {
    position: 'absolute',
    left: `${left}px`,
    top: `${top}px`,
    zIndex: '1200',
    background: '#222',
    borderRadius: '8px',
    boxShadow: '0 6px 24px rgba(0,0,0,0.35)',
    padding: '6px 0',
    minWidth: '260px',
    maxWidth: '420px',
    maxHeight: '60vh',
    overflow: 'auto'
  }
}
const hideMenu = () => {
  visible.value = false
}

defineExpose({ showMenu, hideMenu, menuData })
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="feature-menu-overlay" :style="menuStyle" @mousedown.stop @click.stop>
      <div v-if="rootNodes.length === 0" class="menu-header">No features</div>
      <ul v-else class="tree-root">
        <SrFeatureTreeNode
          v-for="n in rootNodes"
          :key="n.key"
          :node="n"
          @select="handleSelect"
          @toggle-expand="handleToggleExpand"
        />
      </ul>
    </div>
  </Teleport>
</template>

<style scoped>
.feature-menu-overlay {
  color: #fff;
  font-size: 0.95rem;
  user-select: none;
}
.menu-header {
  padding: 0.5rem 0.75rem;
  opacity: 0.8;
}
.tree-root {
  list-style: none;
  margin: 0;
  padding-left: 0.25rem;
}
</style>
