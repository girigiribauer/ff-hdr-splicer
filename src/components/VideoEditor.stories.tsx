import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { VideoEditor } from "./VideoEditor";

const meta: Meta<typeof VideoEditor> = {
    title: "Components/VideoEditor",
    component: VideoEditor,
    parameters: {
        layout: "fullscreen",
    },
    args: {
        filePath: "/path/to/video.mp4",
        ffmpegStatus: { version: "6.0", path: "/usr/bin/ffmpeg" },
    },
    argTypes: {
        onBack: { action: "back" },
        addLog: { action: "log" },
    },
};

export default meta;
type Story = StoryObj<typeof VideoEditor>;

export const Default: Story = {};
