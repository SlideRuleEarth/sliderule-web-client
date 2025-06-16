/**
 * This declaration file silences TypeScript errors for echarts-gl components.
 * When manually importing components like Scatter3DChart and Grid3DComponent
 * to prevent tree-shaking, TypeScript may not find the corresponding type
 * definitions. This file tells TypeScript to treat these modules as existing.
 */
declare module 'echarts-gl/charts';
declare module 'echarts-gl/components';