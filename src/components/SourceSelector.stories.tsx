import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { SourceSelector } from "./SourceSelector";

const meta: Meta<typeof SourceSelector> = {
    title: "Components/SourceSelector",
    component: SourceSelector,
    tags: ["autodocs"],
    argTypes: {
        onLoaded: { action: "loaded" },
        addLog: { action: "log" },
    },
    decorators: [
        (Story) => (
            <div style={{ padding: "40px", background: "#111", height: "400px", display: "flex", "align-items": "center", "justify-content": "center" }}>
                <Story />
            </div>
        ),
    ],
};

export default meta;
type Story = StoryObj<typeof SourceSelector>;

export const Default: Story = {
    args: {
        ffmpegStatus: { version: "6.0", path: "/usr/bin/ffmpeg" },
        error: undefined,
    },
};

export const WithError: Story = {
    args: {
        ffmpegStatus: { version: "6.0", path: "/usr/bin/ffmpeg" },
        error: "Selected file is not HDR (Rec.709)",
    },
};
