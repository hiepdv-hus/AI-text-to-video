import { Config } from "@remotion/cli/config";

// Cấu hình dùng cho Remotion Studio và CLI của Remotion.
// Việc render "chính thức" đi qua pipeline/render.ts (renderMedia), không qua file này.
Config.setVideoImageFormat("jpeg");
Config.overrideWebpackConfig((config) => config);

// H264, chất lượng cao (CRF thấp = đẹp hơn). Render qua CLI sẽ đọc các giá trị này.
Config.setCodec("h264");
