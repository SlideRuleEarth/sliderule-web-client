<template>
  <div class="sr-sys-config-container">
    <SrTextInput v-model="sysConfigStore.domain" label="Domain" />
    <div class = "sr-select-org">
      <SrLabelInfoIconButton  label="Organization" />     
      <span class="sr-org-name">{{sysConfigStore.getOrganization()}}</span>
      <Button label="Update" size="small" @click="showOrgDialog = true" />
    </div>
    <Button label="Request Nodes" icon="pi pi-cog" :disabled="computedOrgIsPublic" @click="showDesiredNodesDialog=true" />
  </div>
  <!-- Organization Dialog -->
  <Dialog v-model:visible="showOrgDialog" header="Update Organization" modal>
    <div>
    <p>Enter your Organization proceed:</p>
    <div class="p-field">
      <label for="organization">Organization</label>
      <InputText id="organization" v-model="sysConfigStore.organization" />
    </div>
    <Button label="Submit" @click="updateOrgFromUser"></Button>

    </div>
  </Dialog>
  <!-- Authentication Dialog -->
  <Dialog class="sr-user-pass-dialog" v-model:visible="showAuthDialog" header="Authentication Required" modal>
    <div>
      <p>Enter your username and password for {{sysConfigStore.organization }} to proceed:</p>
      <div class="p-field">
        <label for="username">Username</label>
        <InputText id="username" v-model="username" />
      </div>
      <div class="p-field">
        <label for="password">Password</label>
        <Password id="password" v-model="password" toggleMask />
      </div>
      <Button label="Submit" @click="submitCredentials"></Button>
    </div>
  </Dialog>
  <Dialog class="sr-desired-nodes-dialog" v-model:visible="showDesiredNodesDialog" header="Desired Nodes" modal>
    <div>
      <p>Enter the desired number of nodes and time to live:</p>
      <div class="p-field">
        <label for="desired-nodes">Desired Nodes</label>
        <SrSliderInput 
          v-model="desiredNodes"
          label="Desired Nodes" 
          :min="1" 
          :max="30"
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
  import { computed, onMounted, ref, watch } from 'vue';
  import { useSysConfigStore } from '@/stores/sysConfigStore';
  import Dialog  from 'primevue/dialog';
  import InputText from 'primevue/inputtext';
  import Password from 'primevue/password';
  import Button from 'primevue/button';  import SrTextInput from '@/components/SrTextInput.vue';
  import SrSliderInput from '@/components/SrSliderInput.vue';
  import { useToast } from 'primevue/usetoast';
  import { useSrToastStore } from "@/stores/srToastStore";
  import SrLabelInfoIconButton from "@/components/SrLabelInfoIconButton.vue";

  const toast = useToast();
  const srToastStore = useSrToastStore();

  const sysConfigStore = useSysConfigStore();
  
  const showAuthDialog = ref(false);
  const showOrgDialog = ref(false);
  const showDesiredNodesDialog = ref(false);
  const username = ref('');
  const password = ref('');
  const orgName = ref('');
  const desiredNodes = ref(1);
  const ttl= ref(720);

  const computedOrgIsPublic = computed(() => {
    return sysConfigStore.orgIsPublic();
  });

  const buttonIcon = computed(() => {
    return sysConfigStore.orgIsPublic() ? 'pi pi-lock-open' : 'pi pi-lock';
  });

  async function authenticate() {
    // Example function to get token using the input credentials
    const psHost = `https://ps.${sysConfigStore.getDomain()}`;
    const body = JSON.stringify({
      username: username.value,
      password: password.value,
      org_name: orgName,
    });
    try {
        const response = await fetch(`${psHost}/api/org_token/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body,
        });
        if (response.ok) {
          const result = await response.json();
          sysConfigStore.setOrganization(result.org_name); // Assuming org_name is in the response
          sysConfigStore.setExpiration(result.expiration); // Assuming expiration is in the response
          return result.expiration; // Assuming expiration is in the response
        } else {
          console.error(`Failed to authenticate: ${response.statusText}`);
          toast.add({ severity: 'error', summary: 'Failed Authenticate', detail: 'Fetch org_token FAILED', life: srToastStore.getLife()});
          return null;
        }
    } catch (error) {
      console.error('Authentication request error:', error);
      toast.add({ severity: 'error', summary: 'Failed Authenticate', detail: error, life: srToastStore.getLife()});
      return null;
    }
  }
  async function submitCredentials() {
    const expiration = await authenticate();
    if (expiration) {
      console.log('Authentication successful:', expiration);
      // Build Request Body
      const body = JSON.stringify({
          org_name: sysConfigStore.getOrganization(),
      });        
      const psHost = `https://ps.${sysConfigStore.getDomain()}`;
      const response = await fetch(`${psHost}/api/org_num_nodes/`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': body.length.toString(),
            },
            body,
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Num Nodes result:', result);
      } else {
          console.error(`Failed to get Num Nodes: ${response.statusText}`);
      }  
    } else {
      console.error('Authentication failed');
      // Handle authentication failure (e.g., show an error message)
    }
    showAuthDialog.value = false; // Close the dialog
  }

  async function getCredentials() {
    console.log('getCredentials');
    try {
      const currentExpiration = sysConfigStore.getExpiration();
      const nowInUnixTime = Math.floor(Date.now() / 1000);
      console.log('nowInUnixTime:',nowInUnixTime,' Expiration:', sysConfigStore.getExpiration());
      if (currentExpiration < nowInUnixTime) {
        // Show the authentication dialog
        showAuthDialog.value = true;
      } else {
        console.log('No authentication needed: Organization is either sliderule or hackweek');
      }

    } catch (error) {
        console.error('Error during get Num Nodes:', error);
    }
  };

  async function updateOrgFromUser() {
    console.log('updateOrgFromUser:', sysConfigStore.organization);
    showOrgDialog.value = false; // Close the dialog
    if(sysConfigStore.orgIsPublic()) {
      console.log('Organization is public, no authentication needed');
    } else {
      console.log('Organization is not public, authentication required');
      await getCredentials();
    }
  }

  function updateDesiredNodes() {
    console.log('updateDesiredNodes:', desiredNodes.value, ttl.value);
    showDesiredNodesDialog.value = false; // Close the dialog
    // Add your logic to update desired nodes here
    sysConfigStore.setDesiredNodes(desiredNodes.value);
    sysConfigStore.setTimeToLive(ttl.value);
  }

  onMounted(async () => {
    console.log('SrSysConfig onMounted');
  });


</script>
  
<style scoped>
  .sr-sys-config-container {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  .sr-select-org {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-direction: row;
    gap: 0.5rem;
  }
  .sr-org-name {
    font-size:medium;
    border: 1px solid rgb(65, 73, 85);
    padding: 0.25rem;
    border-radius: var(--p-border-radius);
  }
  .sr-user-pass-dialog {
    width: 30rem;
  }

</style>
  