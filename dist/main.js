"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.methods = void 0;
exports.load = load;
exports.unload = unload;
const SVGImporter_1 = require("./SVGImporter");
exports.methods = {
    // 保持现有方法
    showLog() {
        console.log("Hello World from SVG Series Extension");
    },
    async importSVG(filePath) {
        console.log(`Importing SVG file: ${filePath}`);
        try {
            // 使用改造后的SVGImporter
            const result = await SVGImporter_1.SVGImporter.import(filePath);
            return result;
        }
        catch (error) {
            console.error(`Error importing SVG: ${error}`);
            return false;
        }
    },
    async renderSVGPreview(filePath) {
        console.log(`Rendering SVG preview: ${filePath}`);
        try {
            // 通过消息机制调用面板中的渲染功能
            const preview = await Editor.Message.request("svg-series-panel", "render-svg-preview", { filePath });
            return preview;
        }
        catch (error) {
            console.error(`Error rendering SVG preview: ${error}`);
            return {
                success: false,
                error: (error === null || error === void 0 ? void 0 : error.message) || "Unknown error",
            };
        }
    },
};
// 移除组件导出，主进程不需要导出运行时组件
// export { SVGOptimizer, SVGSprite, ... };
function load() {
    console.log("SVG Series Extension loaded");
}
function unload() {
    console.log("SVG Series Extension unloaded");
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NvdXJjZS9tYWluLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQXVDQSxvQkFFQztBQUVELHdCQUVDO0FBN0NELCtDQUE0QztBQUUvQixRQUFBLE9BQU8sR0FBRztJQUNuQixTQUFTO0lBQ1QsT0FBTztRQUNILE9BQU8sQ0FBQyxHQUFHLENBQUMsdUNBQXVDLENBQUMsQ0FBQztJQUN6RCxDQUFDO0lBRUQsS0FBSyxDQUFDLFNBQVMsQ0FBQyxRQUFnQjtRQUM1QixPQUFPLENBQUMsR0FBRyxDQUFDLHVCQUF1QixRQUFRLEVBQUUsQ0FBQyxDQUFDO1FBQy9DLElBQUksQ0FBQztZQUNELG9CQUFvQjtZQUNwQixNQUFNLE1BQU0sR0FBRyxNQUFNLHlCQUFXLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxDQUFDO1lBQ2xELE9BQU8sTUFBTSxDQUFDO1FBQ2xCLENBQUM7UUFBQyxPQUFPLEtBQUssRUFBRSxDQUFDO1lBQ2IsT0FBTyxDQUFDLEtBQUssQ0FBQyx3QkFBd0IsS0FBSyxFQUFFLENBQUMsQ0FBQztZQUMvQyxPQUFPLEtBQUssQ0FBQztRQUNqQixDQUFDO0lBQ0wsQ0FBQztJQUVELEtBQUssQ0FBQyxnQkFBZ0IsQ0FBQyxRQUFnQjtRQUNuQyxPQUFPLENBQUMsR0FBRyxDQUFDLDBCQUEwQixRQUFRLEVBQUUsQ0FBQyxDQUFDO1FBQ2xELElBQUksQ0FBQztZQUNELG1CQUFtQjtZQUNuQixNQUFNLE9BQU8sR0FBRyxNQUFNLE1BQU0sQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLGtCQUFrQixFQUFFLG9CQUFvQixFQUFFLEVBQUUsUUFBUSxFQUFFLENBQUMsQ0FBQztZQUNyRyxPQUFPLE9BQU8sQ0FBQztRQUNuQixDQUFDO1FBQUMsT0FBTyxLQUFVLEVBQUUsQ0FBQztZQUNsQixPQUFPLENBQUMsS0FBSyxDQUFDLGdDQUFnQyxLQUFLLEVBQUUsQ0FBQyxDQUFDO1lBQ3ZELE9BQU87Z0JBQ0gsT0FBTyxFQUFFLEtBQUs7Z0JBQ2QsS0FBSyxFQUFFLENBQUEsS0FBSyxhQUFMLEtBQUssdUJBQUwsS0FBSyxDQUFFLE9BQU8sS0FBSSxlQUFlO2FBQzNDLENBQUM7UUFDTixDQUFDO0lBQ0wsQ0FBQztDQUNKLENBQUM7QUFFRix1QkFBdUI7QUFDdkIsMkNBQTJDO0FBRTNDLFNBQWdCLElBQUk7SUFDaEIsT0FBTyxDQUFDLEdBQUcsQ0FBQyw2QkFBNkIsQ0FBQyxDQUFDO0FBQy9DLENBQUM7QUFFRCxTQUFnQixNQUFNO0lBQ2xCLE9BQU8sQ0FBQyxHQUFHLENBQUMsK0JBQStCLENBQUMsQ0FBQztBQUNqRCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgU1ZHSW1wb3J0ZXIgfSBmcm9tIFwiLi9TVkdJbXBvcnRlclwiO1xyXG5cclxuZXhwb3J0IGNvbnN0IG1ldGhvZHMgPSB7XHJcbiAgICAvLyDkv53mjIHnjrDmnInmlrnms5VcclxuICAgIHNob3dMb2coKSB7XHJcbiAgICAgICAgY29uc29sZS5sb2coXCJIZWxsbyBXb3JsZCBmcm9tIFNWRyBTZXJpZXMgRXh0ZW5zaW9uXCIpO1xyXG4gICAgfSxcclxuXHJcbiAgICBhc3luYyBpbXBvcnRTVkcoZmlsZVBhdGg6IHN0cmluZyk6IFByb21pc2U8Ym9vbGVhbj4ge1xyXG4gICAgICAgIGNvbnNvbGUubG9nKGBJbXBvcnRpbmcgU1ZHIGZpbGU6ICR7ZmlsZVBhdGh9YCk7XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgLy8g5L2/55So5pS56YCg5ZCO55qEU1ZHSW1wb3J0ZXJcclxuICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgU1ZHSW1wb3J0ZXIuaW1wb3J0KGZpbGVQYXRoKTtcclxuICAgICAgICAgICAgcmV0dXJuIHJlc3VsdDtcclxuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xyXG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKGBFcnJvciBpbXBvcnRpbmcgU1ZHOiAke2Vycm9yfWApO1xyXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgfVxyXG4gICAgfSxcclxuXHJcbiAgICBhc3luYyByZW5kZXJTVkdQcmV2aWV3KGZpbGVQYXRoOiBzdHJpbmcpOiBQcm9taXNlPGFueT4ge1xyXG4gICAgICAgIGNvbnNvbGUubG9nKGBSZW5kZXJpbmcgU1ZHIHByZXZpZXc6ICR7ZmlsZVBhdGh9YCk7XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgLy8g6YCa6L+H5raI5oGv5py65Yi26LCD55So6Z2i5p2/5Lit55qE5riy5p+T5Yqf6IO9XHJcbiAgICAgICAgICAgIGNvbnN0IHByZXZpZXcgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KFwic3ZnLXNlcmllcy1wYW5lbFwiLCBcInJlbmRlci1zdmctcHJldmlld1wiLCB7IGZpbGVQYXRoIH0pO1xyXG4gICAgICAgICAgICByZXR1cm4gcHJldmlldztcclxuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XHJcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoYEVycm9yIHJlbmRlcmluZyBTVkcgcHJldmlldzogJHtlcnJvcn1gKTtcclxuICAgICAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxyXG4gICAgICAgICAgICAgICAgZXJyb3I6IGVycm9yPy5tZXNzYWdlIHx8IFwiVW5rbm93biBlcnJvclwiLFxyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgIH1cclxuICAgIH0sXHJcbn07XHJcblxyXG4vLyDnp7vpmaTnu4Tku7blr7zlh7rvvIzkuLvov5vnqIvkuI3pnIDopoHlr7zlh7rov5DooYzml7bnu4Tku7ZcclxuLy8gZXhwb3J0IHsgU1ZHT3B0aW1pemVyLCBTVkdTcHJpdGUsIC4uLiB9O1xyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIGxvYWQoKSB7XHJcbiAgICBjb25zb2xlLmxvZyhcIlNWRyBTZXJpZXMgRXh0ZW5zaW9uIGxvYWRlZFwiKTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIHVubG9hZCgpIHtcclxuICAgIGNvbnNvbGUubG9nKFwiU1ZHIFNlcmllcyBFeHRlbnNpb24gdW5sb2FkZWRcIik7XHJcbn1cclxuIl19