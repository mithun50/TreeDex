import { Composition } from "remotion";
import { TreeDexVideo } from "./TreeDexVideo";
import { FPS, TOTAL_FRAMES, WIDTH, HEIGHT } from "./constants/timing";

export const Root: React.FC = () => {
  return (
    <>
      <Composition
        id="TreeDexVideo"
        component={TreeDexVideo}
        durationInFrames={TOTAL_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
    </>
  );
};
