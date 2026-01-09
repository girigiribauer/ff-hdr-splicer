import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { SeekBar } from "./SeekBar";

const meta: Meta<typeof SeekBar> = {
    title: "Components/SeekBar",
    component: SeekBar,
    tags: ["autodocs"],
    argTypes: {
        onSeek: { action: "seek" },
    },
    decorators: [
        (Story) => (
            <div style={{ padding: "20px", background: "#222", width: "100%" }}>
                <Story />
            </div>
        ),
    ],
};

export default meta;
type Story = StoryObj<typeof SeekBar>;

export const Default: Story = {
    args: {
        min: 0,
        max: 100,
        currentTime: 30,
    },
};
