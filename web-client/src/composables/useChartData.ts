import { ref } from 'vue';

export function useChartData() {
  const chartData = ref([]);

  // Simulate fetching data, you can replace this with an actual API call
  const fetchData = () => {
    chartData.value = [
      { value: [10, 20] },
      { value: [20, 30] },
      { value: [30, 40] },
      { value: [40, 50] },
      { value: [50, 60] },
    ];
  };

  fetchData();

  return {
    chartData,
  };
}
