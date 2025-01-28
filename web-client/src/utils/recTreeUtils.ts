import type { SrMenuNumberItem } from '@/types/SrTypes';
import type { SrPrimeTreeNode } from '@/types/SrTypes';
import { useAtlChartFilterStore } from '@/stores/atlChartFilterStore';
import { useRequestsStore } from '@/stores/requestsStore';
import { useRecTreeStore } from '@/stores/recTreeStore';



export function buildRecTree(nodes: SrMenuNumberItem[]): SrPrimeTreeNode[] {
    // 1. Create a map of (value -> TreeNode)
    const nodeMap: Record<number, SrPrimeTreeNode> = {};
  
    // 2. Initialize each SrMenuNumberItem as a TreeNode
    for (const item of nodes) {
      nodeMap[item.value] = {
        key: item.value.toString(),
        label: item.label,
        data: item.value,
        children: []
      };
    }
  
    // 3. Build the hierarchy by linking children to parents
    const rootNodes: SrPrimeTreeNode[] = [];
    for (const item of nodes) {
      const parentId = item.parentReqId;
      const currentNode = nodeMap[item.value];
  
      if (parentId !== undefined && nodeMap[parentId]) {
        // Push current node into the parent's children
        nodeMap[parentId].children?.push(currentNode);
      } else {
        // If no parentReqId, treat as root
        rootNodes.push(currentNode);
      }
    }
  
    return rootNodes;
  }

  export async function updateRecMenu(): Promise<number> {
    const requestsStore = useRequestsStore();
    const atlChartFilterStore = useAtlChartFilterStore();
    const recTreeStore = useRecTreeStore();
    atlChartFilterStore.reqIdMenuItems = await requestsStore.getMenuItems();
    console.log('atlChartFilterStore.reqIdMenuItems:', atlChartFilterStore.reqIdMenuItems);
    recTreeStore.loadTreeData(atlChartFilterStore.reqIdMenuItems);
    console.log('recTreeStore.treeData:', recTreeStore.treeData);
    return atlChartFilterStore.reqIdMenuItems.length;
  }