import { ref } from 'vue';
import WMSCapabilities from 'ol/format/WMSCapabilities';

export function useFetchWMSCapabilities() {
  const capabilities = ref(null);

  const fetchWMSCapabilities = async (url: string) => {
    try {
      const response = await fetch(url);
      const text = await response.text();
      const parser = new WMSCapabilities();
      capabilities.value = parser.read(text);
      // Perform actions with map and capabilities.value
    } catch (error) {
      console.error('Error fetching WMSCapabilities:', error);
    }
  };
  return { capabilities, fetchWMSCapabilities };
}
