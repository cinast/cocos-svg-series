"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SVGSprite = void 0;
// SVGSprite.ts - 使用svg.js库
const cc_1 = require("cc");
const SVGAssets_1 = require("./SVGAssets");
const { ccclass, property, executeInEditMode, requireComponent, menu } = cc_1._decorator;
let SVGSprite = class SVGSprite extends cc_1.Component {
    constructor() {
        super(...arguments);
        this._svgContent = "";
        this._svgFile = null;
        this.useTextSVG = false;
        // 文本模式下的SVG代码
        this._svgText = "";
        this.svgWidth = 256;
        this.svgHeight = 256;
        this.sprite = null;
        this._color = "#ffffff";
        this.svgElement = null;
        this.canvas = null;
    }
    // 文件模式下的SVG文件引用
    get svgContent() {
        if (this.useTextSVG) {
            return this._svgText;
        }
        else {
            return this._svgFile ? this._svgFile.svgContent : "";
        }
    }
    // 统一setter，根据模式设置对应属性
    set svgContent(value) {
        if (typeof value === "string") {
            // 字符串输入
            if (this._svgText !== value) {
                this._svgText = value;
                this._svgFile = null; // 清除文件引用
                this.renderSVG();
            }
        }
        else if (value instanceof SVGAssets_1.SVGAsset) {
            // 文件输入
            if (this._svgFile !== value) {
                this._svgFile = value;
                this._svgText = ""; // 清除文本内容
                this.renderSVG();
            }
        }
    }
    get color() {
        return this._color;
    }
    set color(value) {
        if (this._color !== value) {
            this._color = value;
            this.updateSVGColor();
        }
    }
    onLoad() {
        this.sprite = this.getComponent(cc_1.Sprite);
        this.initSVGCanvas();
        this.renderSVG();
    }
    initSVGCanvas() {
        this.canvas = document.createElement("canvas");
        this.canvas.width = this.getComponent(cc_1.UITransform).width;
        this.canvas.height = this.getComponent(cc_1.UITransform).height;
        // 创建SVG元素
        this.svgElement = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        this.svgElement.setAttribute("width", "100%");
        this.svgElement.setAttribute("height", "100%");
        this.svgElement.setAttribute("preserveAspectRatio", "xMidYMid meet");
    }
    async renderSVG() {
        if (!this._svgContent)
            return;
        try {
            // 解析SVG
            const parser = new DOMParser();
            const doc = parser.parseFromString(this._svgContent, "image/svg+xml");
            const svg = doc.documentElement;
            // 清空并添加新内容
            while (this.svgElement.firstChild) {
                this.svgElement.removeChild(this.svgElement.firstChild);
            }
            // 复制所有子元素
            for (const child of Array.from(svg.children)) {
                this.svgElement.appendChild(child.cloneNode(true));
            }
            // 应用颜色
            this.updateSVGColor();
            // 渲染到纹理
            await this.renderToTexture();
        }
        catch (error) {
            console.error("SVG解析失败:", error);
        }
    }
    updateSVGColor() {
        if (!this.svgElement)
            return;
        // 查找所有路径元素并设置颜色
        const paths = this.svgElement.querySelectorAll("path");
        paths.forEach((path) => {
            if (!path.getAttribute("fill") || path.getAttribute("fill") !== "none") {
                path.setAttribute("fill", this._color);
            }
        });
    }
    renderToTexture() {
        return new Promise((resolve) => {
            // 创建图片对象
            const svgString = new XMLSerializer().serializeToString(this.svgElement);
            const blob = new Blob([svgString], { type: "image/svg+xml" });
            const url = URL.createObjectURL(blob);
            const img = new Image();
            img.onload = () => {
                // 绘制到canvas
                const ctx = this.canvas.getContext("2d");
                ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
                ctx.drawImage(img, 0, 0, this.canvas.width, this.canvas.height);
                // 创建纹理
                this.createTexture();
                URL.revokeObjectURL(url);
                resolve();
            };
            img.src = url;
        });
    }
    createTexture() {
        const imageAsset = new cc_1.ImageAsset(this.canvas);
        const texture = new cc_1.Texture2D();
        texture.image = imageAsset;
        const spriteFrame = new cc_1.SpriteFrame();
        spriteFrame.texture = texture;
        if (this.sprite) {
            this.sprite.spriteFrame = spriteFrame;
        }
    }
    // 动态更新SVG属性
    setSVGAttribute(pathId, attribute, value) {
        const element = this.svgElement.querySelector(`#${pathId}`);
        if (element) {
            element.setAttribute(attribute, value);
            this.renderToTexture();
        }
    }
    /**
     * 在属性检查器中切换模式时的回调
     */
    onModeChanged() {
        // 当模式切换时，可以在这里添加额外逻辑
        console.log(`模式切换为: ${this.useTextSVG ? "文本输入" : "文件选择"}`);
        this.renderSVG();
    }
    /**
     * 手动刷新SVG内容
     */
    refresh() {
        this.renderSVG();
    }
    /**
     * 获取当前模式描述
     */
    get modeDescription() {
        return this.useTextSVG
            ? `文本模式: ${this._svgText.length} 字符`
            : `文件模式: ${this._svgFile ? this._svgFile.name : "无文件"}`;
    }
    onDestroy() {
        if (this.svgElement) {
            this.svgElement.remove();
        }
    }
};
exports.SVGSprite = SVGSprite;
__decorate([
    property
], SVGSprite.prototype, "_svgContent", void 0);
__decorate([
    property({
        displayName: "使用文本输入",
        tooltip: "勾选后直接粘贴SVG代码，取消则选择svg文件",
    })
], SVGSprite.prototype, "useTextSVG", void 0);
__decorate([
    property({
        type: String,
        multiline: true,
        displayName: "SVG代码",
        tooltip: "直接粘贴SVG代码",
        visible: function () {
            return this.useTextSVG;
        },
    })
], SVGSprite.prototype, "_svgText", void 0);
__decorate([
    property({
        type: SVGAssets_1.SVGAsset,
        displayName: "SVG文件",
        tooltip: "选择一个svg文件",
        visible: function () {
            return !this.useTextSVG;
        },
    })
    // 统一的getter，根据模式返回对应内容
], SVGSprite.prototype, "svgContent", null);
__decorate([
    property({
        tooltip: "SVG渲染宽度",
    })
], SVGSprite.prototype, "svgWidth", void 0);
__decorate([
    property({
        tooltip: "SVG渲染高度",
    })
], SVGSprite.prototype, "svgHeight", void 0);
__decorate([
    property
], SVGSprite.prototype, "sprite", void 0);
__decorate([
    property
], SVGSprite.prototype, "_color", void 0);
__decorate([
    property({
        displayName: "颜色覆盖",
    })
], SVGSprite.prototype, "color", null);
__decorate([
    property({
        visible: false,
    })
], SVGSprite.prototype, "onModeChanged", null);
exports.SVGSprite = SVGSprite = __decorate([
    ccclass("SVGSprite"),
    menu("2D/SVGSprite"),
    executeInEditMode,
    requireComponent(cc_1.Sprite)
], SVGSprite);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiU1ZHc3ByaXRlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vc291cmNlL1NWR3Nwcml0ZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7QUFBQSwyQkFBMkI7QUFDM0IsMkJBQW9HO0FBQ3BHLDJDQUF1QztBQUN2QyxNQUFNLEVBQUUsT0FBTyxFQUFFLFFBQVEsRUFBRSxpQkFBaUIsRUFBRSxnQkFBZ0IsRUFBRSxJQUFJLEVBQUUsR0FBRyxlQUFVLENBQUM7QUFNN0UsSUFBTSxTQUFTLEdBQWYsTUFBTSxTQUFVLFNBQVEsY0FBUztJQUFqQzs7UUFFSyxnQkFBVyxHQUFXLEVBQUUsQ0FBQztRQUN6QixhQUFRLEdBQW9CLElBQUksQ0FBQztRQU16QyxlQUFVLEdBQVksS0FBSyxDQUFDO1FBRTVCLGNBQWM7UUFVTixhQUFRLEdBQVcsRUFBRSxDQUFDO1FBMkN2QixhQUFRLEdBQVcsR0FBRyxDQUFDO1FBS3ZCLGNBQVMsR0FBVyxHQUFHLENBQUM7UUFHdkIsV0FBTSxHQUFXLElBQUssQ0FBQztRQUd2QixXQUFNLEdBQVcsU0FBUyxDQUFDO1FBZ0IzQixlQUFVLEdBQWtCLElBQUssQ0FBQztRQUNsQyxXQUFNLEdBQXNCLElBQUssQ0FBQztJQTJJOUMsQ0FBQztJQWhORyxnQkFBZ0I7SUFXaEIsSUFBSSxVQUFVO1FBQ1YsSUFBSSxJQUFJLENBQUMsVUFBVSxFQUFFLENBQUM7WUFDbEIsT0FBTyxJQUFJLENBQUMsUUFBUSxDQUFDO1FBQ3pCLENBQUM7YUFBTSxDQUFDO1lBQ0osT0FBTyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDO1FBQ3pELENBQUM7SUFDTCxDQUFDO0lBRUQsc0JBQXNCO0lBQ3RCLElBQUksVUFBVSxDQUFDLEtBQXdCO1FBQ25DLElBQUksT0FBTyxLQUFLLEtBQUssUUFBUSxFQUFFLENBQUM7WUFDNUIsUUFBUTtZQUNS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QztRQUNOLFdBQVcsRUFBRSxRQUFRO1FBQ3JCLE9BQU8sRUFBRSx5QkFBeUI7S0FDckMsQ0FBQzs2Q0FDMEI7QUFZcEI7SUFUUCxRQUFRLENBQUM7UUFDTixJQUFJLEVBQUUsTUFBTTtRQUNaLFNBQVMsRUFBRSxJQUFJO1FBQ2YsV0FBVyxFQUFFLE9BQU87UUFDcEIsT0FBTyxFQUFFLFdBQVc7UUFDcEIsT0FBTyxFQUFFO1lBQ0wsT0FBTyxJQUFJLENBQUMsVUFBVSxDQUFDO1FBQzNCLENBQUM7S0FDSixDQUFDOzJDQUM0QjtBQWE5QjtJQVZDLFFBQVEsQ0FBQztRQUNOLElBQUksRUFBRSxvQkFBUTtRQUNkLFdBQVcsRUFBRSxPQUFPO1FBQ3BCLE9BQU8sRUFBRSxXQUFXO1FBQ3BCLE9BQU8sRUFBRTtZQUNMLE9BQU8sQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDO1FBQzVCLENBQUM7S0FDSixDQUFDO0lBRUYsdUJBQXVCOzJDQU90QjtBQXdCTTtJQUhOLFFBQVEsQ0FBQztRQUNOLE9BQU8sRUFBRSxTQUFTO0tBQ3JCLENBQUM7MkNBQzRCO0FBS3ZCO0lBSE4sUUFBUSxDQUFDO1FBQ04sT0FBTyxFQUFFLFNBQVM7S0FDckIsQ0FBQzs0Q0FDNkI7QUFHdkI7SUFEUCxRQUFRO3lDQUNzQjtBQUd2QjtJQURQLFFBQVE7eUNBQzBCO0FBS25DO0lBSEMsUUFBUSxDQUFDO1FBQ04sV0FBVyxFQUFFLE1BQU07S0FDdEIsQ0FBQztzQ0FHRDtBQTJITztJQUhQLFFBQVEsQ0FBQztRQUNOLE9BQU8sRUFBRSxLQUFLO0tBQ2pCLENBQUM7OENBS0Q7b0JBak5RLFNBQVM7SUFKckIsT0FBTyxDQUFDLFdBQVcsQ0FBQztJQUNwQixJQUFJLENBQUMsY0FBYyxDQUFDO0lBQ3BCLGlCQUFpQjtJQUNqQixnQkFBZ0IsQ0FBQyxXQUFNLENBQUM7R0FDWixTQUFTLENBdU9yQiIsInNvdXJjZXNDb250ZW50IjpbIi8vIFNWR1Nwcml0ZS50cyAtIOS9v+eUqHN2Zy5qc+W6k1xyXG5pbXBvcnQgeyBfZGVjb3JhdG9yLCBDb21wb25lbnQsIFNwcml0ZSwgU3ByaXRlRnJhbWUsIFRleHR1cmUyRCwgVUlUcmFuc2Zvcm0sIEltYWdlQXNzZXQgfSBmcm9tIFwiY2NcIjtcclxuaW1wb3J0IHsgU1ZHQXNzZXQgfSBmcm9tIFwiLi9TVkdBc3NldHNcIjtcclxuY29uc3QgeyBjY2NsYXNzLCBwcm9wZXJ0eSwgZXhlY3V0ZUluRWRpdE1vZGUsIHJlcXVpcmVDb21wb25lbnQsIG1lbnUgfSA9IF9kZWNvcmF0b3I7XHJcblxyXG5AY2NjbGFzcyhcIlNWR1Nwcml0ZVwiKVxyXG5AbWVudShcIjJEL1NWR1Nwcml0ZVwiKVxyXG5AZXhlY3V0ZUluRWRpdE1vZGVcclxuQHJlcXVpcmVDb21wb25lbnQoU3ByaXRlKVxyXG5leHBvcnQgY2xhc3MgU1ZHU3ByaXRlIGV4dGVuZHMgQ29tcG9uZW50IHtcclxuICAgIEBwcm9wZXJ0eVxyXG4gICAgcHJpdmF0ZSBfc3ZnQ29udGVudDogc3RyaW5nID0gXCJcIjtcclxuICAgIHByaXZhdGUgX3N2Z0ZpbGU6IFNWR0Fzc2V0IHwgbnVsbCA9IG51bGw7XHJcblxyXG4gICAgQHByb3BlcnR5KHtcclxuICAgICAgICBkaXNwbGF5TmFtZTogXCLkvb/nlKjmlofmnKzovpPlhaVcIixcclxuICAgICAgICB0b29sdGlwOiBcIuWLvumAieWQjuebtOaOpeeymOi0tFNWR+S7o+egge+8jOWPlua2iOWImemAieaLqXN2Z+aWh+S7tlwiLFxyXG4gICAgfSlcclxuICAgIHVzZVRleHRTVkc6IGJvb2xlYW4gPSBmYWxzZTtcclxuXHJcbiAgICAvLyDmlofmnKzmqKHlvI/kuIvnmoRTVkfku6PnoIFcclxuICAgIEBwcm9wZXJ0eSh7XHJcbiAgICAgICAgdHlwZTogU3RyaW5nLFxyXG4gICAgICAgIG11bHRpbGluZTogdHJ1ZSxcclxuICAgICAgICBkaXNwbGF5TmFtZTogXCJTVkfku6PnoIFcIixcclxuICAgICAgICB0b29sdGlwOiBcIuebtOaOpeeymOi0tFNWR+S7o+eggVwiLFxyXG4gICAgICAgIHZpc2libGU6IGZ1bmN0aW9uICh0aGlzOiBTVkdTcHJpdGUpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHRoaXMudXNlVGV4dFNWRztcclxuICAgICAgICB9LFxyXG4gICAgfSlcclxuICAgIHByaXZhdGUgX3N2Z1RleHQ6IHN0cmluZyA9IFwiXCI7XHJcblxyXG4gICAgLy8g5paH5Lu25qih5byP5LiL55qEU1ZH5paH5Lu25byV55SoXHJcbiAgICBAcHJvcGVydHkoe1xyXG4gICAgICAgIHR5cGU6IFNWR0Fzc2V0LFxyXG4gICAgICAgIGRpc3BsYXlOYW1lOiBcIlNWR+aWh+S7tlwiLFxyXG4gICAgICAgIHRvb2x0aXA6IFwi6YCJ5oup5LiA5Liqc3Zn5paH5Lu2XCIsXHJcbiAgICAgICAgdmlzaWJsZTogZnVuY3Rpb24gKHRoaXM6IFNWR1Nwcml0ZSkge1xyXG4gICAgICAgICAgICByZXR1cm4gIXRoaXMudXNlVGV4dFNWRztcclxuICAgICAgICB9LFxyXG4gICAgfSlcclxuXHJcbiAgICAvLyDnu5/kuIDnmoRnZXR0ZXLvvIzmoLnmja7mqKHlvI/ov5Tlm57lr7nlupTlhoXlrrlcclxuICAgIGdldCBzdmdDb250ZW50KCk6IHN0cmluZyB7XHJcbiAgICAgICAgaWYgKHRoaXMudXNlVGV4dFNWRykge1xyXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fc3ZnVGV4dDtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fc3ZnRmlsZSA/IHRoaXMuX3N2Z0ZpbGUuc3ZnQ29udGVudCA6IFwiXCI7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIC8vIOe7n+S4gHNldHRlcu+8jOagueaNruaooeW8j+iuvue9ruWvueW6lOWxnuaAp1xyXG4gICAgc2V0IHN2Z0NvbnRlbnQodmFsdWU6IHN0cmluZyB8IFNWR0Fzc2V0KSB7XHJcbiAgICAgICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gXCJzdHJpbmdcIikge1xyXG4gICAgICAgICAgICAvLyDlrZfnrKbkuLLovpPlhaVcclxuICAgICAgICAgICAgaWYgKHRoaXMuX3N2Z1RleHQgIT09IHZhbHVlKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLl9zdmdUZXh0ID0gdmFsdWU7XHJcbiAgICAgICAgICAgICAgICB0aGlzLl9zdmdGaWxlID0gbnVsbDsgLy8g5riF6Zmk5paH5Lu25byV55SoXHJcbiAgICAgICAgICAgICAgICB0aGlzLnJlbmRlclNWRygpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSBlbHNlIGlmICh2YWx1ZSBpbnN0YW5jZW9mIFNWR0Fzc2V0KSB7XHJcbiAgICAgICAgICAgIC8vIOaWh+S7tui+k+WFpVxyXG4gICAgICAgICAgICBpZiAodGhpcy5fc3ZnRmlsZSAhPT0gdmFsdWUpIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuX3N2Z0ZpbGUgPSB2YWx1ZTtcclxuICAgICAgICAgICAgICAgIHRoaXMuX3N2Z1RleHQgPSBcIlwiOyAvLyDmuIXpmaTmlofmnKzlhoXlrrlcclxuICAgICAgICAgICAgICAgIHRoaXMucmVuZGVyU1ZHKCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgQHByb3BlcnR5KHtcclxuICAgICAgICB0b29sdGlwOiBcIlNWR+a4suafk+WuveW6plwiLFxyXG4gICAgfSlcclxuICAgIHB1YmxpYyBzdmdXaWR0aDogbnVtYmVyID0gMjU2O1xyXG5cclxuICAgIEBwcm9wZXJ0eSh7XHJcbiAgICAgICAgdG9vbHRpcDogXCJTVkfmuLLmn5Ppq5jluqZcIixcclxuICAgIH0pXHJcbiAgICBwdWJsaWMgc3ZnSGVpZ2h0OiBudW1iZXIgPSAyNTY7XHJcblxyXG4gICAgQHByb3BlcnR5XHJcbiAgICBwcml2YXRlIHNwcml0ZTogU3ByaXRlID0gbnVsbCE7XHJcblxyXG4gICAgQHByb3BlcnR5XHJcbiAgICBwcml2YXRlIF9jb2xvcjogc3RyaW5nID0gXCIjZmZmZmZmXCI7XHJcblxyXG4gICAgQHByb3BlcnR5KHtcclxuICAgICAgICBkaXNwbGF5TmFtZTogXCLpopzoibLopobnm5ZcIixcclxuICAgIH0pXHJcbiAgICBnZXQgY29sb3IoKTogc3RyaW5nIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5fY29sb3I7XHJcbiAgICB9XHJcblxyXG4gICAgc2V0IGNvbG9yKHZhbHVlOiBzdHJpbmcpIHtcclxuICAgICAgICBpZiAodGhpcy5fY29sb3IgIT09IHZhbHVlKSB7XHJcbiAgICAgICAgICAgIHRoaXMuX2NvbG9yID0gdmFsdWU7XHJcbiAgICAgICAgICAgIHRoaXMudXBkYXRlU1ZHQ29sb3IoKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBzdmdFbGVtZW50OiBTVkdTVkdFbGVtZW50ID0gbnVsbCE7XHJcbiAgICBwcml2YXRlIGNhbnZhczogSFRNTENhbnZhc0VsZW1lbnQgPSBudWxsITtcclxuXHJcbiAgICBvbkxvYWQoKSB7XHJcbiAgICAgICAgdGhpcy5zcHJpdGUgPSB0aGlzLmdldENvbXBvbmVudChTcHJpdGUpITtcclxuICAgICAgICB0aGlzLmluaXRTVkdDYW52YXMoKTtcclxuICAgICAgICB0aGlzLnJlbmRlclNWRygpO1xyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgaW5pdFNWR0NhbnZhcygpIHtcclxuICAgICAgICB0aGlzLmNhbnZhcyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJjYW52YXNcIik7XHJcbiAgICAgICAgdGhpcy5jYW52YXMud2lkdGggPSB0aGlzLmdldENvbXBvbmVudChVSVRyYW5zZm9ybSkhLndpZHRoO1xyXG4gICAgICAgIHRoaXMuY2FudmFzLmhlaWdodCA9IHRoaXMuZ2V0Q29tcG9uZW50KFVJVHJhbnNmb3JtKSEuaGVpZ2h0O1xyXG5cclxuICAgICAgICAvLyDliJvlu7pTVkflhYPntKBcclxuICAgICAgICB0aGlzLnN2Z0VsZW1lbnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50TlMoXCJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Z1wiLCBcInN2Z1wiKTtcclxuICAgICAgICB0aGlzLnN2Z0VsZW1lbnQuc2V0QXR0cmlidXRlKFwid2lkdGhcIiwgXCIxMDAlXCIpO1xyXG4gICAgICAgIHRoaXMuc3ZnRWxlbWVudC5zZXRBdHRyaWJ1dGUoXCJoZWlnaHRcIiwgXCIxMDAlXCIpO1xyXG4gICAgICAgIHRoaXMuc3ZnRWxlbWVudC5zZXRBdHRyaWJ1dGUoXCJwcmVzZXJ2ZUFzcGVjdFJhdGlvXCIsIFwieE1pZFlNaWQgbWVldFwiKTtcclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIGFzeW5jIHJlbmRlclNWRygpIHtcclxuICAgICAgICBpZiAoIXRoaXMuX3N2Z0NvbnRlbnQpIHJldHVybjtcclxuXHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgLy8g6Kej5p6QU1ZHXHJcbiAgICAgICAgICAgIGNvbnN0IHBhcnNlciA9IG5ldyBET01QYXJzZXIoKTtcclxuICAgICAgICAgICAgY29uc3QgZG9jID0gcGFyc2VyLnBhcnNlRnJvbVN0cmluZyh0aGlzLl9zdmdDb250ZW50LCBcImltYWdlL3N2Zyt4bWxcIik7XHJcbiAgICAgICAgICAgIGNvbnN0IHN2ZyA9IGRvYy5kb2N1bWVudEVsZW1lbnQ7XHJcblxyXG4gICAgICAgICAgICAvLyDmuIXnqbrlubbmt7vliqDmlrDlhoXlrrlcclxuICAgICAgICAgICAgd2hpbGUgKHRoaXMuc3ZnRWxlbWVudC5maXJzdENoaWxkKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLnN2Z0VsZW1lbnQucmVtb3ZlQ2hpbGQodGhpcy5zdmdFbGVtZW50LmZpcnN0Q2hpbGQpO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAvLyDlpI3liLbmiYDmnInlrZDlhYPntKBcclxuICAgICAgICAgICAgZm9yIChjb25zdCBjaGlsZCBvZiBBcnJheS5mcm9tKHN2Zy5jaGlsZHJlbikpIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuc3ZnRWxlbWVudC5hcHBlbmRDaGlsZChjaGlsZC5jbG9uZU5vZGUodHJ1ZSkpO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAvLyDlupTnlKjpopzoibJcclxuICAgICAgICAgICAgdGhpcy51cGRhdGVTVkdDb2xvcigpO1xyXG5cclxuICAgICAgICAgICAgLy8g5riy5p+T5Yiw57q555CGXHJcbiAgICAgICAgICAgIGF3YWl0IHRoaXMucmVuZGVyVG9UZXh0dXJlKCk7XHJcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcclxuICAgICAgICAgICAgY29uc29sZS5lcnJvcihcIlNWR+ino+aekOWksei0pTpcIiwgZXJyb3IpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIHVwZGF0ZVNWR0NvbG9yKCkge1xyXG4gICAgICAgIGlmICghdGhpcy5zdmdFbGVtZW50KSByZXR1cm47XHJcblxyXG4gICAgICAgIC8vIOafpeaJvuaJgOaciei3r+W+hOWFg+e0oOW5tuiuvue9ruminOiJslxyXG4gICAgICAgIGNvbnN0IHBhdGhzID0gdGhpcy5zdmdFbGVtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoXCJwYXRoXCIpO1xyXG4gICAgICAgIHBhdGhzLmZvckVhY2goKHBhdGgpID0+IHtcclxuICAgICAgICAgICAgaWYgKCFwYXRoLmdldEF0dHJpYnV0ZShcImZpbGxcIikgfHwgcGF0aC5nZXRBdHRyaWJ1dGUoXCJmaWxsXCIpICE9PSBcIm5vbmVcIikge1xyXG4gICAgICAgICAgICAgICAgcGF0aC5zZXRBdHRyaWJ1dGUoXCJmaWxsXCIsIHRoaXMuX2NvbG9yKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0pO1xyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgcmVuZGVyVG9UZXh0dXJlKCk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT4ge1xyXG4gICAgICAgICAgICAvLyDliJvlu7rlm77niYflr7nosaFcclxuICAgICAgICAgICAgY29uc3Qgc3ZnU3RyaW5nID0gbmV3IFhNTFNlcmlhbGl6ZXIoKS5zZXJpYWxpemVUb1N0cmluZyh0aGlzLnN2Z0VsZW1lbnQpO1xyXG4gICAgICAgICAgICBjb25zdCBibG9iID0gbmV3IEJsb2IoW3N2Z1N0cmluZ10sIHsgdHlwZTogXCJpbWFnZS9zdmcreG1sXCIgfSk7XHJcbiAgICAgICAgICAgIGNvbnN0IHVybCA9IFVSTC5jcmVhdGVPYmplY3RVUkwoYmxvYik7XHJcblxyXG4gICAgICAgICAgICBjb25zdCBpbWcgPSBuZXcgSW1hZ2UoKTtcclxuICAgICAgICAgICAgaW1nLm9ubG9hZCA9ICgpID0+IHtcclxuICAgICAgICAgICAgICAgIC8vIOe7mOWItuWIsGNhbnZhc1xyXG4gICAgICAgICAgICAgICAgY29uc3QgY3R4ID0gdGhpcy5jYW52YXMuZ2V0Q29udGV4dChcIjJkXCIpITtcclxuICAgICAgICAgICAgICAgIGN0eC5jbGVhclJlY3QoMCwgMCwgdGhpcy5jYW52YXMud2lkdGgsIHRoaXMuY2FudmFzLmhlaWdodCk7XHJcbiAgICAgICAgICAgICAgICBjdHguZHJhd0ltYWdlKGltZywgMCwgMCwgdGhpcy5jYW52YXMud2lkdGgsIHRoaXMuY2FudmFzLmhlaWdodCk7XHJcblxyXG4gICAgICAgICAgICAgICAgLy8g5Yib5bu657q555CGXHJcbiAgICAgICAgICAgICAgICB0aGlzLmNyZWF0ZVRleHR1cmUoKTtcclxuICAgICAgICAgICAgICAgIFVSTC5yZXZva2VPYmplY3RVUkwodXJsKTtcclxuICAgICAgICAgICAgICAgIHJlc29sdmUoKTtcclxuICAgICAgICAgICAgfTtcclxuXHJcbiAgICAgICAgICAgIGltZy5zcmMgPSB1cmw7XHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBjcmVhdGVUZXh0dXJlKCkge1xyXG4gICAgICAgIGNvbnN0IGltYWdlQXNzZXQgPSBuZXcgSW1hZ2VBc3NldCh0aGlzLmNhbnZhcyk7XHJcbiAgICAgICAgY29uc3QgdGV4dHVyZSA9IG5ldyBUZXh0dXJlMkQoKTtcclxuICAgICAgICB0ZXh0dXJlLmltYWdlID0gaW1hZ2VBc3NldDtcclxuXHJcbiAgICAgICAgY29uc3Qgc3ByaXRlRnJhbWUgPSBuZXcgU3ByaXRlRnJhbWUoKTtcclxuICAgICAgICBzcHJpdGVGcmFtZS50ZXh0dXJlID0gdGV4dHVyZTtcclxuXHJcbiAgICAgICAgaWYgKHRoaXMuc3ByaXRlKSB7XHJcbiAgICAgICAgICAgIHRoaXMuc3ByaXRlLnNwcml0ZUZyYW1lID0gc3ByaXRlRnJhbWU7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIC8vIOWKqOaAgeabtOaWsFNWR+WxnuaAp1xyXG4gICAgcHVibGljIHNldFNWR0F0dHJpYnV0ZShwYXRoSWQ6IHN0cmluZywgYXR0cmlidXRlOiBzdHJpbmcsIHZhbHVlOiBzdHJpbmcpIHtcclxuICAgICAgICBjb25zdCBlbGVtZW50ID0gdGhpcy5zdmdFbGVtZW50LnF1ZXJ5U2VsZWN0b3IoYCMke3BhdGhJZH1gKTtcclxuICAgICAgICBpZiAoZWxlbWVudCkge1xyXG4gICAgICAgICAgICBlbGVtZW50LnNldEF0dHJpYnV0ZShhdHRyaWJ1dGUsIHZhbHVlKTtcclxuICAgICAgICAgICAgdGhpcy5yZW5kZXJUb1RleHR1cmUoKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiDlnKjlsZ7mgKfmo4Dmn6XlmajkuK3liIfmjaLmqKHlvI/ml7bnmoTlm57osINcclxuICAgICAqL1xyXG4gICAgQHByb3BlcnR5KHtcclxuICAgICAgICB2aXNpYmxlOiBmYWxzZSxcclxuICAgIH0pXHJcbiAgICBwcml2YXRlIG9uTW9kZUNoYW5nZWQoKTogdm9pZCB7XHJcbiAgICAgICAgLy8g5b2T5qih5byP5YiH5o2i5pe277yM5Y+v5Lul5Zyo6L+Z6YeM5re75Yqg6aKd5aSW6YC76L6RXHJcbiAgICAgICAgY29uc29sZS5sb2coYOaooeW8j+WIh+aNouS4ujogJHt0aGlzLnVzZVRleHRTVkcgPyBcIuaWh+acrOi+k+WFpVwiIDogXCLmlofku7bpgInmi6lcIn1gKTtcclxuICAgICAgICB0aGlzLnJlbmRlclNWRygpO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog5omL5Yqo5Yi35pawU1ZH5YaF5a65XHJcbiAgICAgKi9cclxuICAgIHB1YmxpYyByZWZyZXNoKCk6IHZvaWQge1xyXG4gICAgICAgIHRoaXMucmVuZGVyU1ZHKCk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiDojrflj5blvZPliY3mqKHlvI/mj4/ov7BcclxuICAgICAqL1xyXG4gICAgcHVibGljIGdldCBtb2RlRGVzY3JpcHRpb24oKTogc3RyaW5nIHtcclxuICAgICAgICByZXR1cm4gdGhpcy51c2VUZXh0U1ZHXHJcbiAgICAgICAgICAgID8gYOaWh+acrOaooeW8jzogJHt0aGlzLl9zdmdUZXh0Lmxlbmd0aH0g5a2X56ymYFxyXG4gICAgICAgICAgICA6IGDmlofku7bmqKHlvI86ICR7dGhpcy5fc3ZnRmlsZSA/IHRoaXMuX3N2Z0ZpbGUubmFtZSA6IFwi5peg5paH5Lu2XCJ9YDtcclxuICAgIH1cclxuICAgIG9uRGVzdHJveSgpIHtcclxuICAgICAgICBpZiAodGhpcy5zdmdFbGVtZW50KSB7XHJcbiAgICAgICAgICAgIHRoaXMuc3ZnRWxlbWVudC5yZW1vdmUoKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbn1cclxuIl19