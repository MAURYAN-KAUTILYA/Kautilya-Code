import { Palette } from "lucide-react";
import { ThemeBuilderFeature } from "./theme-builder";
export const SETTINGS_FEATURES = [
    {
        id: "theme-builder",
        title: "Theme Builder",
        description: "Control light and dark mode with one shared accent family.",
        order: 1,
        icon: Palette,
        component: ThemeBuilderFeature,
    },
].sort((left, right) => left.order - right.order);
