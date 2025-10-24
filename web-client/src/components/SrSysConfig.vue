<template>
  <div class="sr-sys-config-container">
    <SrTextInput v-model="sysConfigStore.domain" label="Domain" @update:model-value="domainChanged" />
    <SrTextInput v-model="sysConfigStore.organization" label="Organization" @update:model-value="orgChanged" />
    <Button label="Login" icon="pi pi-sign-in" :disabled="computedLoggedIn" @click="showAuthDialog=true" />
    <div>
      <SrClusterInfo/>
    </div>
    <Button label="Request Nodes" icon="pi pi-cog" :disabled="!(!computedOrgIsPublic && computedLoggedIn)" @click="showDesiredNodesDialog=true" />
  </div>
  <!-- Authentication Dialog -->
  <Dialog  v-model:visible="showAuthDialog" header="Login" :showHeader="true" :closable="true" modal>
    <div class="card">
      <div class="sr-user-pass-dialog">
        <div class="sr-p-field">
          <label for="username">Username</label>
          <InputText id="username" v-model="username" type="text" />
        </div>
        <div class="sr-p-field">
          <label for="password">Password</label>
          <Password id="password" v-model="password" type="password" toggleMask />
        </div>
        <div class="sr-p-button">
          <Button label="Login" @click="authenticate"></Button>
        </div>
      </div>
    </div>
  </Dialog>
  <Dialog class="sr-desired-nodes-dialog" v-model:visible="showDesiredNodesDialog" :showHeader="false" modal>
    <div>
      <p>Enter the desired number of nodes and time to live:</p>
      <div class="sr-p-field">
        <label for="desired-nodes">Desired Nodes</label>
        <SrSliderInput 
          v-model="desiredNodes"
          label="Desired Nodes" 
          :min="1" 
          :max="maxNodes"
          :defaultValue="1" 
          :decimalPlaces="0"
        />
        <SrSliderInput 
          v-model="ttl" 
          label="Time to Live (minutes)" 
          :min="15"
          :max="720" 
          :defaultValue="720"
          :decimalPlaces="0"
        />
      </div>
      <Button label="Submit" @click="updateDesiredNodes"></Button>
    </div>
  </Dialog>
</template>
  
<script setup lang="ts">
  import { computed, onMounted, ref } from 'vue';
  import { useSysConfigStore } from '@/stores/sysConfigStore';
  import Dialog  from 'primevue/dialog';
  import InputText from 'primevue/inputtext';
  import Password from 'primevue/password';
  import Button from 'primevue/button';  import SrTextInput from '@/components/SrTextInput.vue';
  import SrSliderInput from '@/components/SrSliderInput.vue';
  import { useToast } from 'primevue/usetoast';
  import { useSrToastStore } from "@/stores/srToastStore";
  import { useJwtStore } from '@/stores/SrJWTStore';
  import SrClusterInfo from './SrClusterInfo.vue';
  import { createLogger } from '@/utils/logger';

  const logger = createLogger('SrSysConfig');
  const toast = useToast();
  const srToastStore = useSrToastStore();
  const sysConfigStore = useSysConfigStore();
  const jwtStore = useJwtStore();
  
  const showAuthDialog = ref(false);
  const showDesiredNodesDialog = ref(false);
  const username = ref('');
  const password = ref('');
  const orgName = ref('');
  const desiredNodes = ref(1);
  const ttl= ref(720);

  interface orgnumNodesRsp {
    status: string;
    min_nodes: number;
    current_nodes: number;
    max_nodes: number;
    version: string;
  }

  const computedOrgIsPublic = computed(() => {
    return jwtStore.getIsPublic(sysConfigStore.getDomain(), sysConfigStore.getOrganization());
  });

  const computedLoggedIn = computed(() => {
    return jwtStore.getCredentials() !== null;
  });

  const maxNodes = computed(() => sysConfigStore.getMaxNodes());


  function domainChanged(_newDomain: string) {
    jwtStore.removeJwt(sysConfigStore.getDomain(), sysConfigStore.getOrganization());
    //console.log('Domain changed:', newDomain);
  }

  function orgChanged(_newOrg: string) {
    jwtStore.removeJwt(sysConfigStore.getDomain(), sysConfigStore.getOrganization());
    //console.log('Organization changed:', newOrg);
  }

  async function authenticate() : Promise<boolean>{
    orgName.value = sysConfigStore.getOrganization();
    const psHost = `https://ps.${sysConfigStore.getDomain()}`;
    logger.debug('authenticate', { username: username.value, orgName: orgName.value });
    const body = JSON.stringify({
      username: username.value,
      password: password.value,
      org_name: orgName.value,
    });
    try {
        const response = await fetch(`${psHost}/api/org_token/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body,
        });
        const result = await response.json();
        if (response.ok) {
          const jwt = {
            accessToken: result.access,
            refreshToken: result.refresh,
            expiration: result.expiration,
          };
          jwtStore.setJwt(sysConfigStore.getDomain(), sysConfigStore.getOrganization(),jwt ); // Assuming result contains the JWT
          toast.add({ severity: 'success', summary: 'Successfully Authenticated', detail: `Authentication successful for ${orgName.value}`, life: srToastStore.getLife()});
          return true; // Assuming expiration is in the response
        } else {
          logger.error('Failed to authenticate', { response });
          toast.add({ severity: 'error', summary: 'Failed Authenticate', detail: 'Login FAILED', life: srToastStore.getLife()});
          return false;
        }
    } catch (error) {
      logger.error('Authentication request error', { error: error instanceof Error ? error.message : String(error) });
      toast.add({ severity: 'error', summary: 'Failed Authenticate', detail:  'Login FAILED', life: srToastStore.getLife()});
      return false;
    } finally {
      showAuthDialog.value = false; // Close the dialog
    }
  }
  async function desiredOrgNumNodes() {
      const psHost = `https://ps.${sysConfigStore.getDomain()}`;
      let jwt = jwtStore.getCredentials();
      if(jwt){
          const response = await fetch(`${psHost}/api/desired_org_num_nodes_ttl/${sysConfigStore.getOrganization()}/${sysConfigStore.getDesiredNodes()}/${sysConfigStore.getTimeToLive()}/`, {
              method: 'POST',
              headers: {
                  'Content-Type': 'application/json',
                  'Accept': 'application/json',
                  'Authorization': `Bearer ${jwt.accessToken}`,
              },
          });
          if (response.ok) {
              const result = await response.json();
              if(result.status === 'QUEUED'){
                  toast.add({ severity: 'info', summary: 'Desired Nodes Request Queued', detail: result.msg, life: srToastStore.getLife()});
              } else {
                  logger.error('Failed to get Desired Nodes', { statusText: response.statusText });
                  toast.add({ severity: 'error', summary: 'Failed to Retrieve Desired Nodes', detail: `Error: ${result.msg}`, life: srToastStore.getLife()});
              }
          } else {
              logger.error('Failed to get Num Nodes', { statusText: response.statusText });
              toast.add({ severity: 'error', summary: 'Failed to Retrieve Nodes', detail: `Error: ${response.statusText}`, life: srToastStore.getLife()});
          }
      } else {
          logger.error('Login expired or not logged in');
          toast.add({ severity: 'info', summary: 'Need to Login', detail: 'Please log in again', life: srToastStore.getLife()});
      }
    }
 
  function updateDesiredNodes() {
    logger.debug('updateDesiredNodes', { desiredNodes: desiredNodes.value, ttl: ttl.value });
    showDesiredNodesDialog.value = false; // Close the dialog
    // Add your logic to update desired nodes here
    sysConfigStore.setDesiredNodes(desiredNodes.value);
    sysConfigStore.setTimeToLive(ttl.value);
    void desiredOrgNumNodes();
  }

  onMounted(() => {
    logger.debug('onMounted');
  });


</script>
  
<style scoped>
  .sr-sys-config-container {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .sr-org-name {
    font-size:medium;
    border: 1px solid rgb(65, 73, 85);
    padding: 0.25rem;
    border-radius: var(--p-border-radius);
  }
  .sr-user-pass-dialog {
    display: flex;
    gap: 0.75rem;
    padding-bottom: 1.25rem;
    flex-direction: column;
    justify-content: center;
    align-items:self-start;
    width: 100%
  }
  .sr-p-field {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 0.5rem 0;
  }
  .sr-p-button {
    display: flex;
    justify-content: center;
    align-items: center;
    width: 100%;

  }
</style>
  