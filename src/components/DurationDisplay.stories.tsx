import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { DurationDisplay } from "./DurationDisplay";

const meta: Meta<typeof DurationDisplay> = {
    title: "Components/DurationDisplay",
    component: DurationDisplay,
    tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof DurationDisplay>;

export const Default: Story = {
    args: {
        duration: 125.5,
    },
};

export const Short: Story = {
    args: {
        duration: 5.0,
    },
};
