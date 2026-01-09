import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { FadeInControl } from "./FadeInControl";

// Meta for FadeInControl
const fadeInMeta: Meta<typeof FadeInControl> = {
    title: "Components/FadeInControl",
    component: FadeInControl,
    tags: ["autodocs"],
    argTypes: {
        onToggle: { action: "toggle" },
        onDurationChange: { action: "duration changed" },
    },
};
export default fadeInMeta;

type FadeInStory = StoryObj<typeof FadeInControl>;

export const FadeInInactive: FadeInStory = {
    args: {
        active: false,
        duration: 0.5,
    },
};

export const FadeInActive: FadeInStory = {
    args: {
        active: true,
        duration: 1.5,
    },
};
