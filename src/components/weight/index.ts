/** Weight UI – reusable by the dashboard and analytics. */
export * from "./copy";
export {
  LogWeightForm,
  LogWeightSheet,
  type EditableWeightEntry,
  type LogWeightFormProps,
  type LogWeightSheetProps,
} from "./log-weight-sheet";
export { describeWeightChart, WeightTrendChart, type WeightTrendChartProps } from "./weight-trend-chart";
export {
  WeightDeltaChip,
  WeightSummaryCard,
  type WeightSummaryCardProps,
  type WeightSummaryData,
} from "./weight-summary-card";
