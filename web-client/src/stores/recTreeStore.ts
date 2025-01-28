import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { SrPrimeTreeNode, SrMenuNumberItem } from '@/types/SrTypes';
import { useRequestsStore } from '@/stores/requestsStore';
import { initDataBindingsToChartStore,initChartStore } from '@/utils/plotUtils';



function buildRecTree(nodes: SrMenuNumberItem[]): SrPrimeTreeNode[] {
    const nodeMap: Record<number, SrPrimeTreeNode> = {};
    for (const item of nodes) {
        nodeMap[item.value] = {
            key: item.value.toString(),
            label: item.label,
            data: item.value,
            api: item.api,
            children: []
        };
    }

    const rootNodes: SrPrimeTreeNode[] = [];
    for (const item of nodes) {
        const parentId = item.parentReqId;
        const currentNode = nodeMap[item.value];
        if (parentId !== undefined && nodeMap[parentId]) {
            nodeMap[parentId].children?.push(currentNode);
        } else {
            rootNodes.push(currentNode);
        }
    }

    return rootNodes;
}

export const useRecTreeStore = defineStore('recTreeStore', () => {
    // State
    const treeData = ref<SrPrimeTreeNode[]>([]);
    const selectedNode = ref<SrPrimeTreeNode | null>(null);
    const reqIdMenuItems = ref<SrMenuNumberItem[]>([]);

    // Getters
    const selectedNodeLabel = computed(() => selectedNode.value?.label || 'No node selected');
    const selectedReqIdStr = computed(() => selectedNode.value?.key || '0');
    const selectedReqId = computed(() => selectedNode.value?.data || 0);
    const selectedApi = computed(() => selectedNode.value?.api || 'No API');
    const allReqIds = computed(() => {return reqIdMenuItems.value.map(item => item.value);});
    
    // Actions
    const loadTreeData = async (items: SrMenuNumberItem[], selectReqId?: number) => {
        try {
            treeData.value = buildRecTree(items); // Transform to TreeNode structure
            if (treeData.value.length > 0) {
                if(selectReqId && (selectReqId > 0)){
                    findAndSelectNode(selectReqId);
                } else {
                    selectedNode.value = treeData.value[0];
                }
            } else {
                 console.log('loadTreeData: No nodes available');
            }
        } catch (error) {
            console.error('loadTreeData Failed to load tree data:', error);
        }
    };

    const selectNode = (node: SrPrimeTreeNode) => {
        if (treeData.value.includes(node) || treeData.value.some(root => root.children?.includes(node))) {
            selectedNode.value = node;
            console.log('selectNode: node:', selectedNode.value,' selectedReqId:',selectedReqId.value);
        } else {
            console.warn('selectNode: Node not found in treeData');
        }
    };

    const findAndSelectNode = (reqId: number): boolean => {
        const findNode = (nodes: SrPrimeTreeNode[]): SrPrimeTreeNode | null => {
            for (const node of nodes) {
                if (node.data === reqId) {
                    return node;
                }
                if (node.children) {
                    const childResult = findNode(node.children);
                    if (childResult) {
                        return childResult;
                    }
                }
            }
            return null;
        };
    
        const node = findNode(treeData.value);
        if (node) {
            console.log('findAndSelectNode found node:',node,' with reqId:',reqId);
            selectNode(node);
            return true; // Node was found and selected
        } else {
            console.warn(`findAndSelectNode Node with reqId ${reqId} not found`);
            return false; // Node not found
        }
    };

    const updateRecMenu = async (logMsg:string,newReqId?:number): Promise<number> => {
        console.log('updateRecMenu', logMsg,'newReqId', newReqId); 
        if(newReqId === undefined){
            newReqId = 0;
        }
        let finalReqId = newReqId;
        const requestsStore = useRequestsStore();
        try{
            reqIdMenuItems.value = await requestsStore.getMenuItems();
            console.log('updateRecMenu reqIdMenuItems:', reqIdMenuItems.value);
            await loadTreeData(reqIdMenuItems.value,newReqId);
            console.log('updateRecMenu treeData:', treeData);
            initDataBindingsToChartStore(reqIdMenuItems.value.map(item => item.value.toString()));

            await initChartStore();
        } catch (error) {
            console.error('updateRecMenu Failed to updateRecMenu:', error);
        }
        return finalReqId;
    };   
    return {
        treeData,
        selectedNode,
        selectedNodeLabel,
        selectedReqId,
        selectedReqIdStr,
        selectedApi,
        reqIdMenuItems,
        allReqIds,
        loadTreeData,
        selectNode,
        findAndSelectNode,
        updateRecMenu
    };
});
