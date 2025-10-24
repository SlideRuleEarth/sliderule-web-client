import { defineStore } from 'pinia';
import { ref, computed, type ComputedRef } from 'vue';
import type { SrPrimeTreeNode, SrMenuNumberItem } from '@/types/SrTypes';
import { useRequestsStore } from '@/stores/requestsStore';
import { initDataBindingsToChartStore,initChartStoreFor,initSymbolSize } from '@/utils/plotUtils';
import { createLogger } from '@/utils/logger';

const logger = createLogger('RecTreeStore');

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
    const isTreeLoaded = ref(false);
    const selectedValue = ref<Record<string, boolean>>({'0':false});
    const reqIdMenuItems = ref<SrMenuNumberItem[]>([]);
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

    const selectedApi:ComputedRef<string> = computed(() => {
        if (!selectedNodeKey.value || !treeData.value) {
          return ''; 
        }
        const node = findNodeByKey(treeData.value, selectedNodeKey.value);
        return node?.api ? node.api : '';
    });    
    const allReqIds = computed(() => {return reqIdMenuItems.value.map(item => item.value);});
    const countRequestsByApi = (): Record<string, number> => {
        const countMap: Record<string, number> = {};

        const traverse = (nodes: SrPrimeTreeNode[]) => {
            for (const node of nodes) {
                const api = node.api || '';
                countMap[api] = (countMap[api] || 0) + 1;
                if (node.children && node.children.length > 0) {
                    traverse(node.children);
                }
            }
        };

        traverse(treeData.value);
        return countMap;
    };
    
    // Actions

    // const setReadyToPlot = (ready:boolean) => {
    //     readyToPlot.value = ready;
    // };

    const loadTreeData = async (selectReqId?: number) => {
        try {
            reqIdMenuItems.value = await useRequestsStore().getMenuItems();
            treeData.value = buildRecTree(reqIdMenuItems.value); // Transform to TreeNode structure
            isTreeLoaded.value = true; // Mark as loaded
            if (treeData.value.length > 0) {
                if(selectReqId && (selectReqId > 0)){
                    if(findAndSelectNode(selectReqId)){
                        //console.log('loadTreeData: Selected node with reqId:',selectReqId);
                    } else {
                        logger.warn('Failed to find and select node', { selectReqId });
                    }
                } else if (!selectedNodeKey.value){
                    logger.warn('No selectedNodeKey available', { selectReqId });
                }
            } else {
                 logger.debug('No nodes available in tree data');
            }
        } catch (error) {
            logger.error('Failed to load tree data', { error: error instanceof Error ? error.message : String(error) });
            isTreeLoaded.value = true; // Still mark as loaded even if empty/error
        }
    };

    const setSelectedValue = (key: string) => {
        const node = findNodeByKey(treeData.value, key);
        if (node?.key) {
          // Set selectedValue to the shape: { [node.key]: true }
          selectedValue.value = { [node.key]: true };
            //console.log(
            //     'setSelectedValue: selectedValue:',
            //     selectedValue.value,
            //     'selectedNodeKey:', selectedNodeKey.value,
            //     'selectedReqId:', selectedReqId.value
            //   );
        } else {
          logger.warn('Node not found in treeData', { key });
        }
    };

    const initToFirstRecord = () => {
        const firstReqId = allReqIds.value[0];
        if(firstReqId > 0){
            if(findAndSelectNode(firstReqId)){
                logger.debug('Set selected record to first reqId', { firstReqId });
            } else {
                logger.error('findAndSelectNode FAILED for first reqId', { firstReqId });
            }
        } else {
            logger.error('Found invalid reqId in first record', { firstReqId });
        }
    };

    const findApiForReqId = (reqId: number): string => {
        // Handle invalid reqId early
        if (!reqId || reqId <= 0) {
            return '';
        }

        // Check if tree is loaded (race condition - tree not yet loaded- reactive and will update later)
        if (!isTreeLoaded.value) {
            logger.warn('TreeData not yet loaded for findApiForReqId', { reqId });
            return '';
        }

        // Check if tree is empty after loading
        if (!treeData.value || treeData.value.length === 0) {
            logger.debug('TreeData is empty after loading', { reqId });
            return '';
        }

        const node = findNodeByKey(treeData.value, reqId.toString());
        if (!node) {
            // Node genuinely not found in populated tree
            logger.debug('Node not found in tree for findApiForReqId', { reqId, treeDataRootCount: treeData.value.length });
            return '';
        }
        return node?.api || '';
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
            //console.log('findAndSelectNode found node:',node,' with reqId:',reqId);
            setSelectedValue(node.key);
            return true; // Node was found and selected
        } else {
            logger.warn('Node not found in findAndSelectNode', { reqId });
            return false; // Node not found
        }
    };

    const updateRecMenu = async (logMsg:string,newReqId?:number): Promise<number> => {
        //console.log('updateRecMenu', logMsg,'newReqId', newReqId); 
        try{
            //console.log('updateRecMenu reqIdMenuItems:', reqIdMenuItems.value, 'allreqIds:', allReqIds.value);
            await loadTreeData(newReqId);
            //console.log('updateRecMenu treeData:', treeData);
            initDataBindingsToChartStore(reqIdMenuItems.value.map(item => item.value.toString()));
            if(newReqId){
                await initChartStoreFor(newReqId);
                await initSymbolSize(newReqId);
            }
        } catch (error) {
            logger.error('Failed to updateRecMenu', { logMsg, newReqId, error: error instanceof Error ? error.message : String(error) });
        }
        //console.log('updateRecMenu reqIdMenuItems:', reqIdMenuItems.value, 'allreqIds:', allReqIds.value, 'selectedReqId:', selectedReqId.value);
        return selectedReqId.value? selectedReqId.value : 0;
    }; 

    return {
        treeData,
        isTreeLoaded,
        selectedValue,
        selectedNodeKey,
        selectedNodeLabel,
        selectedReqId,
        selectedReqIdStr,
        selectedApi,
        reqIdMenuItems,
        allReqIds,
        loadTreeData,
        findAndSelectNode,
        updateRecMenu,
        initToFirstRecord,
        findApiForReqId,
        countRequestsByApi,
    };
});
