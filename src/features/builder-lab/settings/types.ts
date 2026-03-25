import type { ComponentType } from "react";

export interface SettingsFeatureComponentProps {
  onClose: () => void;
}

export interface SettingsFeature {
  id: string;
  title: string;
  description: string;
  order: number;
  icon: ComponentType<{ size?: number }>;
  component: ComponentType<SettingsFeatureComponentProps>;
}
