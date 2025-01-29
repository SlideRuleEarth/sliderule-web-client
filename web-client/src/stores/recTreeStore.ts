import { defineStore } from 'pinia';
import { ref, computed, type ComputedRef } from 'vue';
import type { SrPrimeTreeNode, SrMenuNumberItem } from '@/types/SrTypes';
import { useRequestsStore } from '@/stores/requestsStore';
import { initDataBindingsToChartStore,initChartStore } from '@/utils/plotUtils';


function findNodeByKey(nodes: SrPrimeTreeNode[] | null | undefined, key: string): SrPrimeTreeNode | null {
    if (!nodes) return null;
  
    for (const node of nodes) {
      if (node.key === key) {
        return node;
      }
      if (node.children) {
        const childNode = findNodeByKey(node.children, key);
        if (childNode) return childNode;
      }
    }
    return null;
}
  
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
    const selectedValue = ref<Record<string, boolean>>({'0':false});
    const reqIdMenuItems = ref<SrMenuNumberItem[]>([]);

    // Getters

    const selectedNodeKey:ComputedRef<string> = computed(() => {
        const keys = Object.keys(selectedValue.value)
        return keys.length ? keys[0] : '0';
      });

    const selectedNodeLabel:ComputedRef<string> = computed(() => {
        if (!selectedNodeKey.value || !treeData.value) {
          return ''; // or null
        }
        const node = findNodeByKey(treeData.value, selectedNodeKey.value);
        return node ? node.label : '';
    });

    const selectedReqId:ComputedRef<number> = computed(() => {
        if (!selectedNodeKey.value || !treeData.value) {
          return 0;
        }
        const node = findNodeByKey(treeData.value, selectedNodeKey.value);
        return node?.data ? node.data : 0;
    });

    const selectedReqIdStr:ComputedRef<string> = computed(() => {
        if (!selectedNodeKey.value || !treeData.value) {
          return ''; 
        }
        const node = findNodeByKey(treeData.value, selectedNodeKey.value);
        return node ? node.key : '';
    });

    const selectedNodeApi:ComputedRef<string> = computed(() => {
        if (!selectedNodeKey.value || !treeData.value) {
          return ''; 
        }
        const node = findNodeByKey(treeData.value, selectedNodeKey.value);
        return node?.api ? node.api : '';
    });    
    //const selectedNodeApi = computed(() => selectedNodeKey.value?.api || 'No API');
    const allReqIds = computed(() => {return reqIdMenuItems.value.map(item => item.value);});
    
    // Actions
    const loadTreeData = async (items: SrMenuNumberItem[], selectReqId?: number) => {
        try {
            treeData.value = buildRecTree(items); // Transform to TreeNode structure
            if (treeData.value.length > 0) {
                if(selectReqId && (selectReqId > 0)){
                    if(findAndSelectNode(selectReqId)){
                        console.log('loadTreeData: Selected node with reqId:',selectReqId);
                    } else {
                        console.warn('loadTreeData: findAndSelectNode failed to find selectReqId',selectReqId);
                    }
                } else if (!selectedNodeKey.value){
                    console.warn('loadTreeData: No selectedNodeKey available for:',selectReqId);
                }
            } else {
                 console.log('loadTreeData: No nodes available');
            }
        } catch (error) {
            console.error('loadTreeData Failed to load tree data:', error);
        }
    };

    const setSelectedValue = (key: string) => {
        const node = findNodeByKey(treeData.value, key);
        if (node?.key) {
          // Set selectedValue to the shape: { [node.key]: true }
          selectedValue.value = { [node.key]: true };
          console.log(
            'setSelectedValue: selectedValue:',
            selectedValue.value,
            'selectedNodeKey:', selectedNodeKey.value,
            'selectedReqId:', selectedReqId.value
          );
        } else {
          console.warn('setSelectedValue: Node not found in treeData');
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
            setSelectedValue(node.key);
            return true; // Node was found and selected
        } else {
            console.warn(`findAndSelectNode Node with reqId ${reqId} not found`);
            return false; // Node not found
        }
    };

    const updateRecMenu = async (logMsg:string,newReqId?:number): Promise<number> => {
        console.log('updateRecMenu', logMsg,'newReqId', newReqId); 
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
        console.log('updateRecMenu selectedReqId:',selectedReqId.value);
        return selectedReqId.value? selectedReqId.value : 0;
    };   
    return {
        treeData,
        selectedValue,
        selectedNodeKey,
        selectedNodeLabel,
        selectedReqId,
        selectedReqIdStr,
        selectedNodeApi,
        reqIdMenuItems,
        allReqIds,
        loadTreeData,
        findAndSelectNode,
        updateRecMenu
    };
});
