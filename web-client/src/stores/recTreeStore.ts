import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { SrPrimeTreeNode, SrMenuNumberItem } from '@/types/SrTypes';
import { buildRecTree } from '@/utils/recTreeUtils';

export const useRecTreeStore = defineStore('recTreeStore', () => {
  // State
  const treeData = ref<SrPrimeTreeNode[]>([]);
  const selectedNode = ref<SrPrimeTreeNode | null>(null);

  // Getters
  const selectedNodeLabel = computed(() => selectedNode.value?.label || 'No selection');

  // Actions
  const loadTreeData = async (items: SrMenuNumberItem[]) => {
    try {
      treeData.value = buildRecTree(items); // Transform to TreeNode structure
      selectedNode.value = treeData.value[0] || null; // Default selection
    } catch (error) {
      console.error('Failed to load tree data:', error);
    }
  };

  const selectNode = (node: SrPrimeTreeNode) => {
    selectedNode.value = node;
  };

  return {
    treeData,
    selectedNode,
    selectedNodeLabel,
    loadTreeData,
    selectNode,
  };
});
