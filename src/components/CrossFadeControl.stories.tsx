import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { CrossFadeControl } from "./CrossFadeControl";

const meta: Meta<typeof CrossFadeControl> = {
    title: "Components/CrossFadeControl",
    component: CrossFadeControl,
    tags: ["autodocs"],
    argTypes: {
        onToggle: { action: "toggle" },
        onDurationChange: { action: "duration changed" },
    },
};

export default meta;
type Story = StoryObj<typeof CrossFadeControl>;

export const Inactive: Story = {
    args: {
        active: false,
        duration: 1.0,
    },
};

export const Active: Story = {
    args: {
        active: true,
        duration: 2.5,
    },
};
