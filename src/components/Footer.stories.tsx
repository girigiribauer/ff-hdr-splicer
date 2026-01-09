import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { Footer } from "./Footer";

const meta: Meta<typeof Footer> = {
    title: "Components/Footer",
    component: Footer,
    tags: ["autodocs"],
    decorators: [
        (Story) => (
            <div style={{ width: "100%", "padding-top": "20px" }}>
                <Story />
            </div>
        ),
    ],
};

export default meta;
type Story = StoryObj<typeof Footer>;

export const Default: Story = {
    args: {
        ffmpegVersion: "6.0-static",
        logs: ["Init: App started...", "FFmpeg: Ready", "Loaded file: movie.mp4"],
    },
};

export const Loading: Story = {
    args: {
        ffmpegVersion: undefined,
        logs: [],
    },
};

export const ErrorState: Story = {
    args: {
        ffmpegVersion: undefined,
        hasError: true,
        logs: ["Error: Command failed", "Exception: FFmpeg not found"],
    },
};

export const LongVersionString: Story = {
    args: {
        ffmpegVersion: "ffmpeg version 6.1.1-tessus https://evermeet.cx/ffmpeg/ Copyright (c) 2000-2023 the FFmpeg developers",
        logs: [],
    },
};
