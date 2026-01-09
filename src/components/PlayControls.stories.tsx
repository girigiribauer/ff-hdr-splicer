import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { PlayControls } from "./PlayControls";

const meta: Meta<typeof PlayControls> = {
    title: "Components/PlayControls",
    component: PlayControls,
    tags: ["autodocs"],
    argTypes: {
        onTogglePlay: { action: "toggle play" },
        onTimeChange: { action: "time changed" },
    },
};

export default meta;
type Story = StoryObj<typeof PlayControls>;

export const Paused: Story = {
    args: {
        isPlaying: false,
        currentTime: 10.5,
    },
};

export const Playing: Story = {
    args: {
        isPlaying: true,
        currentTime: 15.2,
    },
};
