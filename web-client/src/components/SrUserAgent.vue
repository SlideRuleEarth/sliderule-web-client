<script setup lang="ts">
import { ref, onMounted } from 'vue';

const browser = ref('');
const os = ref('');
const userAgent = ref('');

// Function to detect browser and OS from userAgent string
const detectBrowserAndOS = () => {
  const userAgentString = navigator.userAgent;

  // Detect OS
  if (userAgentString.includes('Win')) os.value = 'Windows';
  else if (userAgentString.includes('Mac')) os.value = 'MacOS';
  else if (userAgentString.includes('Linux')) os.value = 'Linux';
  else if (userAgentString.includes('Android')) os.value = 'Android';
  else if (userAgentString.includes('iPhone')) os.value = 'iOS';
  else os.value = 'Unknown OS';

  // Detect Browser
  if (userAgentString.includes('Chrome') && !userAgentString.includes('Edg'))
    browser.value = 'Chrome';
  else if (userAgentString.includes('Firefox')) browser.value = 'Firefox';
  else if (userAgentString.includes('Safari') && !userAgentString.includes('Chrome'))
    browser.value = 'Safari';
  else if (userAgentString.includes('Edg')) browser.value = 'Edge';
  else if (userAgentString.includes('Opera') || userAgentString.includes('OPR'))
    browser.value = 'Opera';
  else browser.value = 'Unknown Browser';

  // Assign the user agent string
  userAgent.value = userAgentString;
};

// Run detection after component is mounted
onMounted(() => {
  detectBrowserAndOS();
});
</script>

<template>
  <div>
    <h2>User Agent Information</h2>
    <p><strong>Browser:</strong> {{ browser }}</p>
    <p><strong>Operating System:</strong> {{ os }}</p>
    <p><strong>User Agent:</strong> {{ userAgent }}</p>
  </div>
</template>
