import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { VideoPreview } from "./VideoPreview";

const meta: Meta<typeof VideoPreview> = {
    title: "Components/VideoPreview",
    component: VideoPreview,
    tags: ["autodocs"],
    argTypes: {
        onPlay: { action: "play" },
        onPause: { action: "pause" },
        onClick: { action: "click" },
    },
};

export default meta;
type Story = StoryObj<typeof VideoPreview>;

export const Default: Story = {
    args: {
        // Basic mock video
        src: "http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
    },
    render: (args) => (
        <div style={{ width: "600px", height: "400px", background: "#000" }}>
            <VideoPreview
                {...args}
                videoRef={() => { }}
                onLoadedMetadata={() => { }}
                onTimeUpdate={() => { }}
            />
        </div>
    )
};
