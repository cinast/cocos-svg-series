"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.methods = void 0;
exports.load = load;
exports.unload = unload;
const SVGImporter_1 = require("./SVGImporter");
/**
 * @en Registration method for the main process of Extension
 * @zh 为扩展的主进程的注册方法
 */
exports.methods = {
    /**
     * @en A method that can be triggered by message
     * @zh 通过 message 触发的方法
     */
    showLog() {
        console.log("Hello World from SVG Series Extension");
    },
    /**
     * @en Import SVG file
     * @zh 导入SVG文件
     */
    async importSVG(filePath) {
        console.log(`Importing SVG file: ${filePath}`);
        try {
            const result = await SVGImporter_1.SVGImporter.import(filePath);
            if (result) {
                console.log(`SVG imported successfully: ${filePath}`);
            }
            else {
                console.error(`Failed to import SVG: ${filePath}`);
            }
            return result;
        }
        catch (error) {
            console.error(`Error importing SVG: ${error}`);
            return false;
        }
    },
    /**
     * @en Render SVG preview
     * @zh 渲染SVG预览图
     */
    async renderSVGPreview(filePath) {
        console.log(`Rendering SVG preview: ${filePath}`);
        try {
            const preview = await SVGImporter_1.SVGAssetProcessor.getPreview(filePath);
            if (preview) {
                console.log(`SVG preview rendered successfully: ${filePath}`);
                return {
                    success: true,
                    preview: preview,
                };
            }
            else {
                console.error(`Failed to render SVG preview: ${filePath}`);
                return {
                    success: false,
                    error: "Failed to render preview",
                };
            }
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
/**
 * @en Method Triggered on Extension Startup
 * @zh 扩展启动时触发的方法
 */
function load() {
    console.log("SVG Series Extension loaded");
}
/**
 * @en Method triggered when uninstalling the extension
 * @zh 卸载扩展时触发的方法
 */
function unload() {
    console.log("SVG Series Extension unloaded");
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NvdXJjZS9tYWluLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQXVFQSxvQkFFQztBQU1ELHdCQUVDO0FBaEZELCtDQUErRDtBQUUvRDs7O0dBR0c7QUFDVSxRQUFBLE9BQU8sR0FBNEM7SUFDNUQ7OztPQUdHO0lBQ0gsT0FBTztRQUNILE9BQU8sQ0FBQyxHQUFHLENBQUMsdUNBQXVDLENBQUMsQ0FBQztJQUN6RCxDQUFDO0lBRUQ7OztPQUdHO0lBQ0gsS0FBSyxDQUFDLFNBQVMsQ0FBQyxRQUFnQjtRQUM1QixPQUFPLENBQUMsR0FBRyxDQUFDLHVCQUF1QixRQUFRLEVBQUUsQ0FBQyxDQUFDO1FBQy9DLElBQUksQ0FBQztZQUNELE1BQU0sTUFBTSxHQUFHLE1BQU0seUJBQVcsQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLENBQUM7WUFDbEQsSUFBSSxNQUFNLEVBQUUsQ0FBQztnQkFDVCxPQUFPLENBQUMsR0FBRyxDQUFDLDhCQUE4QixRQUFRLEVBQUUsQ0FBQyxDQUFDO1lBQzFELENBQUM7aUJBQU0sQ0FBQztnQkFDSixPQUFPLENBQUMsS0FBSyxDQUFDLHlCQUF5QixRQUFRLEVBQUUsQ0FBQyxDQUFDO1lBQ3ZELENBQUM7WUFDRCxPQUFPLE1BQU0sQ0FBQztRQUNsQixDQUFDO1FBQUMsT0FBTyxLQUFLLEVBQUUsQ0FBQztZQUNiLE9BQU8sQ0FBQyxLQUFLLENBQUMsd0JBQXdCLEtBQUssRUFBRSxDQUFDLENBQUM7WUFDL0MsT0FBTyxLQUFLLENBQUM7UUFDakIsQ0FBQztJQUNMLENBQUM7SUFFRDs7O09BR0c7SUFDSCxLQUFLLENBQUMsZ0JBQWdCLENBQUMsUUFBZ0I7UUFDbkMsT0FBTyxDQUFDLEdBQUcsQ0FBQywwQkFBMEIsUUFBUSxFQUFFLENBQUMsQ0FBQztRQUNsRCxJQUFJLENBQUM7WUFDRCxNQUFNLE9BQU8sR0FBRyxNQUFNLCtCQUFpQixDQUFDLFVBQVUsQ0FBQyxRQUFRLENBQUMsQ0FBQztZQUM3RCxJQUFJLE9BQU8sRUFBRSxDQUFDO2dCQUNWLE9BQU8sQ0FBQyxHQUFHLENBQUMsc0NBQXNDLFFBQVEsRUFBRSxDQUFDLENBQUM7Z0JBQzlELE9BQU87b0JBQ0gsT0FBTyxFQUFFLElBQUk7b0JBQ2IsT0FBTyxFQUFFLE9BQU87aUJBQ25CLENBQUM7WUFDTixDQUFDO2lCQUFNLENBQUM7Z0JBQ0osT0FBTyxDQUFDLEtBQUssQ0FBQyxpQ0FBaUMsUUFBUSxFQUFFLENBQUMsQ0FBQztnQkFDM0QsT0FBTztvQkFDSCxPQUFPLEVBQUUsS0FBSztvQkFDZCxLQUFLLEVBQUUsMEJBQTBCO2lCQUNwQyxDQUFDO1lBQ04sQ0FBQztRQUNMLENBQUM7UUFBQyxPQUFPLEtBQVUsRUFBRSxDQUFDO1lBQ2xCLE9BQU8sQ0FBQyxLQUFLLENBQUMsZ0NBQWdDLEtBQUssRUFBRSxDQUFDLENBQUM7WUFDdkQsT0FBTztnQkFDSCxPQUFPLEVBQUUsS0FBSztnQkFDZCxLQUFLLEVBQUUsQ0FBQSxLQUFLLGFBQUwsS0FBSyx1QkFBTCxLQUFLLENBQUUsT0FBTyxLQUFJLGVBQWU7YUFDM0MsQ0FBQztRQUNOLENBQUM7SUFDTCxDQUFDO0NBQ0osQ0FBQztBQUVGOzs7R0FHRztBQUNILFNBQWdCLElBQUk7SUFDaEIsT0FBTyxDQUFDLEdBQUcsQ0FBQyw2QkFBNkIsQ0FBQyxDQUFDO0FBQy9DLENBQUM7QUFFRDs7O0dBR0c7QUFDSCxTQUFnQixNQUFNO0lBQ2xCLE9BQU8sQ0FBQyxHQUFHLENBQUMsK0JBQStCLENBQUMsQ0FBQztBQUNqRCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgY2NlbnVtIH0gZnJvbSBcImNjXCI7XG5pbXBvcnQgeyBTVkdJbXBvcnRlciwgU1ZHQXNzZXRQcm9jZXNzb3IgfSBmcm9tIFwiLi9TVkdJbXBvcnRlclwiO1xuXG4vKipcbiAqIEBlbiBSZWdpc3RyYXRpb24gbWV0aG9kIGZvciB0aGUgbWFpbiBwcm9jZXNzIG9mIEV4dGVuc2lvblxuICogQHpoIOS4uuaJqeWxleeahOS4u+i/m+eoi+eahOazqOWGjOaWueazlVxuICovXG5leHBvcnQgY29uc3QgbWV0aG9kczogeyBba2V5OiBzdHJpbmddOiAoLi4uYW55OiBhbnkpID0+IGFueSB9ID0ge1xuICAgIC8qKlxuICAgICAqIEBlbiBBIG1ldGhvZCB0aGF0IGNhbiBiZSB0cmlnZ2VyZWQgYnkgbWVzc2FnZVxuICAgICAqIEB6aCDpgJrov4cgbWVzc2FnZSDop6blj5HnmoTmlrnms5VcbiAgICAgKi9cbiAgICBzaG93TG9nKCkge1xuICAgICAgICBjb25zb2xlLmxvZyhcIkhlbGxvIFdvcmxkIGZyb20gU1ZHIFNlcmllcyBFeHRlbnNpb25cIik7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEBlbiBJbXBvcnQgU1ZHIGZpbGVcbiAgICAgKiBAemgg5a+85YWlU1ZH5paH5Lu2XG4gICAgICovXG4gICAgYXN5bmMgaW1wb3J0U1ZHKGZpbGVQYXRoOiBzdHJpbmcpOiBQcm9taXNlPGJvb2xlYW4+IHtcbiAgICAgICAgY29uc29sZS5sb2coYEltcG9ydGluZyBTVkcgZmlsZTogJHtmaWxlUGF0aH1gKTtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IFNWR0ltcG9ydGVyLmltcG9ydChmaWxlUGF0aCk7XG4gICAgICAgICAgICBpZiAocmVzdWx0KSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coYFNWRyBpbXBvcnRlZCBzdWNjZXNzZnVsbHk6ICR7ZmlsZVBhdGh9YCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoYEZhaWxlZCB0byBpbXBvcnQgU1ZHOiAke2ZpbGVQYXRofWApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoYEVycm9yIGltcG9ydGluZyBTVkc6ICR7ZXJyb3J9YCk7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQGVuIFJlbmRlciBTVkcgcHJldmlld1xuICAgICAqIEB6aCDmuLLmn5NTVkfpooTop4jlm75cbiAgICAgKi9cbiAgICBhc3luYyByZW5kZXJTVkdQcmV2aWV3KGZpbGVQYXRoOiBzdHJpbmcpOiBQcm9taXNlPGFueT4ge1xuICAgICAgICBjb25zb2xlLmxvZyhgUmVuZGVyaW5nIFNWRyBwcmV2aWV3OiAke2ZpbGVQYXRofWApO1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgcHJldmlldyA9IGF3YWl0IFNWR0Fzc2V0UHJvY2Vzc29yLmdldFByZXZpZXcoZmlsZVBhdGgpO1xuICAgICAgICAgICAgaWYgKHByZXZpZXcpIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgU1ZHIHByZXZpZXcgcmVuZGVyZWQgc3VjY2Vzc2Z1bGx5OiAke2ZpbGVQYXRofWApO1xuICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgIHByZXZpZXc6IHByZXZpZXcsXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcihgRmFpbGVkIHRvIHJlbmRlciBTVkcgcHJldmlldzogJHtmaWxlUGF0aH1gKTtcbiAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgZXJyb3I6IFwiRmFpbGVkIHRvIHJlbmRlciBwcmV2aWV3XCIsXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcihgRXJyb3IgcmVuZGVyaW5nIFNWRyBwcmV2aWV3OiAke2Vycm9yfWApO1xuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgICAgICAgICBlcnJvcjogZXJyb3I/Lm1lc3NhZ2UgfHwgXCJVbmtub3duIGVycm9yXCIsXG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgfSxcbn07XG5cbi8qKlxuICogQGVuIE1ldGhvZCBUcmlnZ2VyZWQgb24gRXh0ZW5zaW9uIFN0YXJ0dXBcbiAqIEB6aCDmianlsZXlkK/liqjml7bop6blj5HnmoTmlrnms5VcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGxvYWQoKSB7XG4gICAgY29uc29sZS5sb2coXCJTVkcgU2VyaWVzIEV4dGVuc2lvbiBsb2FkZWRcIik7XG59XG5cbi8qKlxuICogQGVuIE1ldGhvZCB0cmlnZ2VyZWQgd2hlbiB1bmluc3RhbGxpbmcgdGhlIGV4dGVuc2lvblxuICogQHpoIOWNuOi9veaJqeWxleaXtuinpuWPkeeahOaWueazlVxuICovXG5leHBvcnQgZnVuY3Rpb24gdW5sb2FkKCkge1xuICAgIGNvbnNvbGUubG9nKFwiU1ZHIFNlcmllcyBFeHRlbnNpb24gdW5sb2FkZWRcIik7XG59XG4iXX0=