"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SVGSpriteAnimation = void 0;
const cc_1 = require("cc");
const { ccclass, property, executeInEditMode, requireComponent, menu, icon } = cc_1._decorator;
const svg_js_1 = __importDefault(require("svg.js"));
const flubber_1 = require("flubber");
const SVGsprite_1 = require("./SVGsprite");
let SVGSpriteAnimation = class SVGSpriteAnimation extends cc_1.Component {
    constructor() {
        super(...arguments);
        this.sprite = null;
        this.svgPaths = []; // 存储多个SVG路径字符串 (M0,0 L100,0...)
        this.duration = 2.0; // 动画总时长（秒）
        this.isPlaying = false;
        this.isLooping = false;
        this.svgCanvas = null;
        this.currentPathElement = null;
        this.interpolator = null;
        this.animationProgress = 0;
        this.currentShapeIndex = 0;
        // 用于离屏渲染的Canvas
        this.offscreenCanvas = null;
        this.offscreenCtx = null;
    }
    onLoad() {
        this.sprite = this.getComponent(cc_1.Sprite);
        this.initOffscreenCanvas();
        this.initSVG();
        if (this.isPlaying) {
            this.play();
        }
    }
    initOffscreenCanvas() {
        const uiTrans = this.getComponent(cc_1.UITransform);
        if (!uiTrans)
            return false;
        this.offscreenCanvas = document.createElement("canvas");
        this.offscreenCanvas.width = uiTrans.width;
        this.offscreenCanvas.height = uiTrans.height;
        this.offscreenCtx = this.offscreenCanvas.getContext("2d");
    }
    initSVG() {
        // 在内存中创建一个SVG.js画布，不挂载到DOM
        const dummyDiv = document.createElement("div");
        this.svgCanvas = (0, svg_js_1.default)(dummyDiv);
        this.svgCanvas.size(this.offscreenCanvas.width, this.offscreenCanvas.height);
        if (this.svgPaths.length > 0) {
            // 创建初始路径
            this.currentPathElement = this.svgCanvas.path(this.svgPaths[0]).fill("#ff0000");
            this.setupInterpolation(0, 1);
        }
    }
    // 设置从形状A到形状B的插值器
    setupInterpolation(fromIndex, toIndex) {
        if (this.svgPaths.length < 2) {
            console.warn("至少需要两个SVG路径才能创建动画。");
            return;
        }
        const pathA = this.svgPaths[fromIndex];
        const pathB = this.svgPaths[toIndex];
        // 使用Flubber创建插值器核心[citation:1][citation:3]
        try {
            this.interpolator = (0, flubber_1.interpolate)(pathA, pathB, {
                maxSegmentLength: 2, // 控制平滑度与性能
            });
        }
        catch (error) {
            console.error("创建形状插值器失败，请检查SVG路径格式:", error);
        }
    }
    play() {
        this.isPlaying = true;
        this.animationProgress = 0;
        this.currentShapeIndex = 0;
        if (this.svgPaths.length > 1) {
            this.setupInterpolation(0, 1);
        }
        this.schedule(this.updateAnimation, 0);
    }
    stop() {
        this.isPlaying = false;
        this.unschedule(this.updateAnimation);
    }
    updateAnimation(deltaTime) {
        if (!this.isPlaying || !this.interpolator)
            return;
        // 更新进度
        this.animationProgress += deltaTime / this.duration;
        let t = this.animationProgress;
        let targetShapeIndex = this.currentShapeIndex + 1;
        // 处理循环和下一个形状的过渡
        if (t >= 1.0) {
            if (this.isLooping) {
                this.currentShapeIndex = (this.currentShapeIndex + 1) % this.svgPaths.length;
                targetShapeIndex = (this.currentShapeIndex + 1) % this.svgPaths.length;
                this.animationProgress = 0;
                t = 0;
                this.setupInterpolation(this.currentShapeIndex, targetShapeIndex);
            }
            else {
                this.animationProgress = 1.0;
                t = 1.0;
                this.isPlaying = false; // 播放完毕
            }
        }
        // 使用Flubber插值器获取当前中间帧的路径数据[citation:1]
        const currentPathData = this.interpolator(t);
        // 使用SVG.js更新路径[citation:4]
        this.currentPathElement.plot(currentPathData);
        // 将SVG渲染到离屏Canvas，再更新到Cocos SpriteFrame
        this.renderSVGToCanvasAndUpdateTexture();
    }
    renderSVGToCanvasAndUpdateTexture() {
        // 清空画布
        this.offscreenCtx.clearRect(0, 0, this.offscreenCanvas.width, this.offscreenCanvas.height);
        // 关键：将SVG.js生成的SVG字符串，渲染到2D Canvas上
        const svgString = this.svgCanvas.svg();
        const DOMURL = window.URL || window.webkitURL;
        const img = new Image();
        const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
        const url = DOMURL.createObjectURL(svgBlob);
        img.onload = () => {
            this.offscreenCtx.drawImage(img, 0, 0, this.offscreenCanvas.width, this.offscreenCanvas.height);
            DOMURL.revokeObjectURL(url);
            this.updateSpriteTexture();
        };
        img.src = url;
    }
    updateSpriteTexture() {
        // 从Canvas创建ImageAsset和Texture2D
        const imageAsset = new cc_1.ImageAsset(this.offscreenCanvas);
        const texture = new cc_1.Texture2D();
        texture.image = imageAsset;
        const spriteFrame = new cc_1.SpriteFrame();
        spriteFrame.texture = texture;
        this.sprite.spriteFrame = spriteFrame;
    }
    // 添加一个形状到动画序列
    addSVGPath(svgPathString) {
        this.svgPaths.push(svgPathString);
        if (this.svgPaths.length === 2 && !this.interpolator) {
            this.setupInterpolation(0, 1);
        }
    }
    // 跳转到特定形状并开始向下一形状变形
    morphToShape(index) {
        if (index < 0 || index >= this.svgPaths.length)
            return;
        const nextIndex = (index + 1) % this.svgPaths.length;
        this.currentShapeIndex = index;
        this.animationProgress = 0;
        this.setupInterpolation(index, nextIndex);
        if (!this.isPlaying) {
            this.isPlaying = true;
            this.schedule(this.updateAnimation, 0);
        }
    }
    onDestroy() {
        this.stop();
        if (this.svgCanvas) {
            this.svgCanvas.clear();
        }
    }
};
exports.SVGSpriteAnimation = SVGSpriteAnimation;
__decorate([
    property(cc_1.Sprite)
], SVGSpriteAnimation.prototype, "sprite", void 0);
__decorate([
    property({ type: [cc_1.CCString] })
], SVGSpriteAnimation.prototype, "svgPaths", void 0);
__decorate([
    property
], SVGSpriteAnimation.prototype, "duration", void 0);
__decorate([
    property
], SVGSpriteAnimation.prototype, "isPlaying", void 0);
__decorate([
    property
], SVGSpriteAnimation.prototype, "isLooping", void 0);
exports.SVGSpriteAnimation = SVGSpriteAnimation = __decorate([
    ccclass("SVGSpriteAnimation"),
    icon("../../Inkpen.png"),
    menu("2D/SVGSpriteAnimation"),
    executeInEditMode,
    requireComponent(SVGsprite_1.SVGSprite)
], SVGSpriteAnimation);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiU1ZHU3ByaXRlQW5pbWF0aW9uLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc291cmNlL2NvbXBvbmVudHMvU1ZHU3ByaXRlQW5pbWF0aW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7OztBQUFBLDJCQUE4RztBQUM5RyxNQUFNLEVBQUUsT0FBTyxFQUFFLFFBQVEsRUFBRSxpQkFBaUIsRUFBRSxnQkFBZ0IsRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLEdBQUcsZUFBVSxDQUFDO0FBRTFGLG9EQUF5QjtBQUN6QixxQ0FBc0M7QUFDdEMsMkNBQXdDO0FBT2pDLElBQU0sa0JBQWtCLEdBQXhCLE1BQU0sa0JBQW1CLFNBQVEsY0FBUztJQUExQzs7UUFFSyxXQUFNLEdBQVcsSUFBSyxDQUFDO1FBR3ZCLGFBQVEsR0FBYSxFQUFFLENBQUMsQ0FBQyxnQ0FBZ0M7UUFHekQsYUFBUSxHQUFXLEdBQUcsQ0FBQyxDQUFDLFdBQVc7UUFHbkMsY0FBUyxHQUFZLEtBQUssQ0FBQztRQUczQixjQUFTLEdBQVksS0FBSyxDQUFDO1FBRTNCLGNBQVMsR0FBWSxJQUFLLENBQUM7UUFDM0IsdUJBQWtCLEdBQWEsSUFBSyxDQUFDO1FBQ3JDLGlCQUFZLEdBQW1DLElBQUksQ0FBQztRQUNwRCxzQkFBaUIsR0FBVyxDQUFDLENBQUM7UUFDOUIsc0JBQWlCLEdBQVcsQ0FBQyxDQUFDO1FBRXRDLGdCQUFnQjtRQUNSLG9CQUFlLEdBQXNCLElBQUssQ0FBQztRQUMzQyxpQkFBWSxHQUE2QixJQUFLLENBQUM7SUE4SjNELENBQUM7SUE1SkcsTUFBTTtRQUNGLElBQUksQ0FBQyxNQUFNLEdBQUcsSUFBSSxDQUFDLFlBQVksQ0FBQyxXQUFNLENBQUUsQ0FBQztRQUN6QyxJQUFJLENBQUMsbUJBQW1CLEVBQUUsQ0FBQztRQUMzQixJQUFJLENBQUMsT0FBTyxFQUFFLENBQUM7UUFDZixJQUFJLElBQUksQ0FBQyxTQUFTLEVBQUUsQ0FBQztZQUNqQixJ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QUMsU0FBUyxFQUFFLENBQUM7WUFDbEIsSUFBSSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUM7WUFDdEIsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsZUFBZSxFQUFFLENBQUMsQ0FBQyxDQUFDO1FBQzNDLENBQUM7SUFDTCxDQUFDO0lBRUQsU0FBUztRQUNMLElBQUksQ0FBQyxJQUFJLEVBQUUsQ0FBQztRQUNaLElBQUksSUFBSSxDQUFDLFNBQVMsRUFBRSxDQUFDO1lBQ2pCLElBQUksQ0FBQyxTQUFTLENBQUMsS0FBSyxFQUFFLENBQUM7UUFDM0IsQ0FBQztJQUNMLENBQUM7Q0FDSixDQUFBO0FBdExZLGdEQUFrQjtBQUVuQjtJQURQLFFBQVEsQ0FBQyxXQUFNLENBQUM7a0RBQ2M7QUFHdkI7SUFEUCxRQUFRLENBQUMsRUFBRSxJQUFJLEVBQUUsQ0FBQyxhQUFRLENBQUMsRUFBRSxDQUFDO29EQUNDO0FBR3hCO0lBRFAsUUFBUTtvREFDc0I7QUFHdkI7SUFEUCxRQUFRO3FEQUMwQjtBQUczQjtJQURQLFFBQVE7cURBQzBCOzZCQWQxQixrQkFBa0I7SUFMOUIsT0FBTyxDQUFDLG9CQUFvQixDQUFDO0lBQzdCLElBQUksQ0FBQyxrQkFBa0IsQ0FBQztJQUN4QixJQUFJLENBQUMsdUJBQXVCLENBQUM7SUFDN0IsaUJBQWlCO0lBQ2pCLGdCQUFnQixDQUFDLHFCQUFTLENBQUM7R0FDZixrQkFBa0IsQ0FzTDlCIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgX2RlY29yYXRvciwgQ29tcG9uZW50LCBTcHJpdGUsIFNwcml0ZUZyYW1lLCBUZXh0dXJlMkQsIEltYWdlQXNzZXQsIFVJVHJhbnNmb3JtLCBDQ1N0cmluZyB9IGZyb20gXCJjY1wiO1xyXG5jb25zdCB7IGNjY2xhc3MsIHByb3BlcnR5LCBleGVjdXRlSW5FZGl0TW9kZSwgcmVxdWlyZUNvbXBvbmVudCwgbWVudSwgaWNvbiB9ID0gX2RlY29yYXRvcjtcclxuXHJcbmltcG9ydCBTVkcgZnJvbSBcInN2Zy5qc1wiO1xyXG5pbXBvcnQgeyBpbnRlcnBvbGF0ZSB9IGZyb20gXCJmbHViYmVyXCI7XHJcbmltcG9ydCB7IFNWR1Nwcml0ZSB9IGZyb20gXCIuL1NWR3Nwcml0ZVwiO1xyXG5cclxuQGNjY2xhc3MoXCJTVkdTcHJpdGVBbmltYXRpb25cIilcclxuQGljb24oXCIuLi8uLi9JbmtwZW4ucG5nXCIpXHJcbkBtZW51KFwiMkQvU1ZHU3ByaXRlQW5pbWF0aW9uXCIpXHJcbkBleGVjdXRlSW5FZGl0TW9kZVxyXG5AcmVxdWlyZUNvbXBvbmVudChTVkdTcHJpdGUpXHJcbmV4cG9ydCBjbGFzcyBTVkdTcHJpdGVBbmltYXRpb24gZXh0ZW5kcyBDb21wb25lbnQge1xyXG4gICAgQHByb3BlcnR5KFNwcml0ZSlcclxuICAgIHByaXZhdGUgc3ByaXRlOiBTcHJpdGUgPSBudWxsITtcclxuXHJcbiAgICBAcHJvcGVydHkoeyB0eXBlOiBbQ0NTdHJpbmddIH0pXHJcbiAgICBwcml2YXRlIHN2Z1BhdGhzOiBzdHJpbmdbXSA9IFtdOyAvLyDlrZjlgqjlpJrkuKpTVkfot6/lvoTlrZfnrKbkuLIgKE0wLDAgTDEwMCwwLi4uKVxyXG5cclxuICAgIEBwcm9wZXJ0eVxyXG4gICAgcHJpdmF0ZSBkdXJhdGlvbjogbnVtYmVyID0gMi4wOyAvLyDliqjnlLvmgLvml7bplb/vvIjnp5LvvIlcclxuXHJcbiAgICBAcHJvcGVydHlcclxuICAgIHByaXZhdGUgaXNQbGF5aW5nOiBib29sZWFuID0gZmFsc2U7XHJcblxyXG4gICAgQHByb3BlcnR5XHJcbiAgICBwcml2YXRlIGlzTG9vcGluZzogYm9vbGVhbiA9IGZhbHNlO1xyXG5cclxuICAgIHByaXZhdGUgc3ZnQ2FudmFzOiBTVkcuRG9jID0gbnVsbCE7XHJcbiAgICBwcml2YXRlIGN1cnJlbnRQYXRoRWxlbWVudDogU1ZHLlBhdGggPSBudWxsITtcclxuICAgIHByaXZhdGUgaW50ZXJwb2xhdG9yOiAoKHQ6IG51bWJlcikgPT4gc3RyaW5nKSB8IG51bGwgPSBudWxsO1xyXG4gICAgcHJpdmF0ZSBhbmltYXRpb25Qcm9ncmVzczogbnVtYmVyID0gMDtcclxuICAgIHByaXZhdGUgY3VycmVudFNoYXBlSW5kZXg6IG51bWJlciA9IDA7XHJcblxyXG4gICAgLy8g55So5LqO56a75bGP5riy5p+T55qEQ2FudmFzXHJcbiAgICBwcml2YXRlIG9mZnNjcmVlbkNhbnZhczogSFRNTENhbnZhc0VsZW1lbnQgPSBudWxsITtcclxuICAgIHByaXZhdGUgb2Zmc2NyZWVuQ3R4OiBDYW52YXNSZW5kZXJpbmdDb250ZXh0MkQgPSBudWxsITtcclxuXHJcbiAgICBvbkxvYWQoKSB7XHJcbiAgICAgICAgdGhpcy5zcHJpdGUgPSB0aGlzLmdldENvbXBvbmVudChTcHJpdGUpITtcclxuICAgICAgICB0aGlzLmluaXRPZmZzY3JlZW5DYW52YXMoKTtcclxuICAgICAgICB0aGlzLmluaXRTVkcoKTtcclxuICAgICAgICBpZiAodGhpcy5pc1BsYXlpbmcpIHtcclxuICAgICAgICAgICAgdGhpcy5wbGF5KCk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgaW5pdE9mZnNjcmVlbkNhbnZhcygpIHtcclxuICAgICAgICBjb25zdCB1aVRyYW5zID0gdGhpcy5nZXRDb21wb25lbnQoVUlUcmFuc2Zvcm0pO1xyXG4gICAgICAgIGlmICghdWlUcmFucykgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgIHRoaXMub2Zmc2NyZWVuQ2FudmFzID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImNhbnZhc1wiKTtcclxuICAgICAgICB0aGlzLm9mZnNjcmVlbkNhbnZhcy53aWR0aCA9IHVpVHJhbnMud2lkdGg7XHJcbiAgICAgICAgdGhpcy5vZmZzY3JlZW5DYW52YXMuaGVpZ2h0ID0gdWlUcmFucy5oZWlnaHQ7XHJcbiAgICAgICAgdGhpcy5vZmZzY3JlZW5DdHggPSB0aGlzLm9mZnNjcmVlbkNhbnZhcy5nZXRDb250ZXh0KFwiMmRcIikhO1xyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgaW5pdFNWRygpIHtcclxuICAgICAgICAvLyDlnKjlhoXlrZjkuK3liJvlu7rkuIDkuKpTVkcuanPnlLvluIPvvIzkuI3mjILovb3liLBET01cclxuICAgICAgICBjb25zdCBkdW1teURpdiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XHJcbiAgICAgICAgdGhpcy5zdmdDYW52YXMgPSBTVkcoZHVtbXlEaXYpIGFzIFNWRy5Eb2M7XHJcbiAgICAgICAgdGhpcy5zdmdDYW52YXMuc2l6ZSh0aGlzLm9mZnNjcmVlbkNhbnZhcy53aWR0aCwgdGhpcy5vZmZzY3JlZW5DYW52YXMuaGVpZ2h0KTtcclxuXHJcbiAgICAgICAgaWYgKHRoaXMuc3ZnUGF0aHMubGVuZ3RoID4gMCkge1xyXG4gICAgICAgICAgICAvLyDliJvlu7rliJ3lp4vot6/lvoRcclxuICAgICAgICAgICAgdGhpcy5jdXJyZW50UGF0aEVsZW1lbnQgPSB0aGlzLnN2Z0NhbnZhcy5wYXRoKHRoaXMuc3ZnUGF0aHNbMF0pLmZpbGwoXCIjZmYwMDAwXCIpO1xyXG4gICAgICAgICAgICB0aGlzLnNldHVwSW50ZXJwb2xhdGlvbigwLCAxKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgLy8g6K6+572u5LuO5b2i54q2QeWIsOW9oueKtkLnmoTmj5LlgLzlmahcclxuICAgIHByaXZhdGUgc2V0dXBJbnRlcnBvbGF0aW9uKGZyb21JbmRleDogbnVtYmVyLCB0b0luZGV4OiBudW1iZXIpIHtcclxuICAgICAgICBpZiAodGhpcy5zdmdQYXRocy5sZW5ndGggPCAyKSB7XHJcbiAgICAgICAgICAgIGNvbnNvbGUud2FybihcIuiHs+WwkemcgOimgeS4pOS4qlNWR+i3r+W+hOaJjeiDveWIm+W7uuWKqOeUu+OAglwiKTtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuICAgICAgICBjb25zdCBwYXRoQSA9IHRoaXMuc3ZnUGF0aHNbZnJvbUluZGV4XTtcclxuICAgICAgICBjb25zdCBwYXRoQiA9IHRoaXMuc3ZnUGF0aHNbdG9JbmRleF07XHJcblxyXG4gICAgICAgIC8vIOS9v+eUqEZsdWJiZXLliJvlu7rmj5LlgLzlmajmoLjlv4NbY2l0YXRpb246MV1bY2l0YXRpb246M11cclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICB0aGlzLmludGVycG9sYXRvciA9IGludGVycG9sYXRlKHBhdGhBLCBwYXRoQiwge1xyXG4gICAgICAgICAgICAgICAgbWF4U2VnbWVudExlbmd0aDogMiwgLy8g5o6n5Yi25bmz5ruR5bqm5LiO5oCn6IO9XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XHJcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXCLliJvlu7rlvaLnirbmj5LlgLzlmajlpLHotKXvvIzor7fmo4Dmn6VTVkfot6/lvoTmoLzlvI86XCIsIGVycm9yKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgcHVibGljIHBsYXkoKSB7XHJcbiAgICAgICAgdGhpcy5pc1BsYXlpbmcgPSB0cnVlO1xyXG4gICAgICAgIHRoaXMuYW5pbWF0aW9uUHJvZ3Jlc3MgPSAwO1xyXG4gICAgICAgIHRoaXMuY3VycmVudFNoYXBlSW5kZXggPSAwO1xyXG4gICAgICAgIGlmICh0aGlzLnN2Z1BhdGhzLmxlbmd0aCA+IDEpIHtcclxuICAgICAgICAgICAgdGhpcy5zZXR1cEludGVycG9sYXRpb24oMCwgMSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHRoaXMuc2NoZWR1bGUodGhpcy51cGRhdGVBbmltYXRpb24sIDApO1xyXG4gICAgfVxyXG5cclxuICAgIHB1YmxpYyBzdG9wKCkge1xyXG4gICAgICAgIHRoaXMuaXNQbGF5aW5nID0gZmFsc2U7XHJcbiAgICAgICAgdGhpcy51bnNjaGVkdWxlKHRoaXMudXBkYXRlQW5pbWF0aW9uKTtcclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIHVwZGF0ZUFuaW1hdGlvbihkZWx0YVRpbWU6IG51bWJlcikge1xyXG4gICAgICAgIGlmICghdGhpcy5pc1BsYXlpbmcgfHwgIXRoaXMuaW50ZXJwb2xhdG9yKSByZXR1cm47XHJcblxyXG4gICAgICAgIC8vIOabtOaWsOi/m+W6plxyXG4gICAgICAgIHRoaXMuYW5pbWF0aW9uUHJvZ3Jlc3MgKz0gZGVsdGFUaW1lIC8gdGhpcy5kdXJhdGlvbjtcclxuXHJcbiAgICAgICAgbGV0IHQgPSB0aGlzLmFuaW1hdGlvblByb2dyZXNzO1xyXG4gICAgICAgIGxldCB0YXJnZXRTaGFwZUluZGV4ID0gdGhpcy5jdXJyZW50U2hhcGVJbmRleCArIDE7XHJcblxyXG4gICAgICAgIC8vIOWkhOeQhuW+queOr+WSjOS4i+S4gOS4quW9oueKtueahOi/h+a4oVxyXG4gICAgICAgIGlmICh0ID49IDEuMCkge1xyXG4gICAgICAgICAgICBpZiAodGhpcy5pc0xvb3BpbmcpIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuY3VycmVudFNoYXBlSW5kZXggPSAodGhpcy5jdXJyZW50U2hhcGVJbmRleCArIDEpICUgdGhpcy5zdmdQYXRocy5sZW5ndGg7XHJcbiAgICAgICAgICAgICAgICB0YXJnZXRTaGFwZUluZGV4ID0gKHRoaXMuY3VycmVudFNoYXBlSW5kZXggKyAxKSAlIHRoaXMuc3ZnUGF0aHMubGVuZ3RoO1xyXG4gICAgICAgICAgICAgICAgdGhpcy5hbmltYXRpb25Qcm9ncmVzcyA9IDA7XHJcbiAgICAgICAgICAgICAgICB0ID0gMDtcclxuICAgICAgICAgICAgICAgIHRoaXMuc2V0dXBJbnRlcnBvbGF0aW9uKHRoaXMuY3VycmVudFNoYXBlSW5kZXgsIHRhcmdldFNoYXBlSW5kZXgpO1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5hbmltYXRpb25Qcm9ncmVzcyA9IDEuMDtcclxuICAgICAgICAgICAgICAgIHQgPSAxLjA7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmlzUGxheWluZyA9IGZhbHNlOyAvLyDmkq3mlL7lrozmr5VcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8g5L2/55SoRmx1YmJlcuaPkuWAvOWZqOiOt+WPluW9k+WJjeS4remXtOW4p+eahOi3r+W+hOaVsOaNrltjaXRhdGlvbjoxXVxyXG4gICAgICAgIGNvbnN0IGN1cnJlbnRQYXRoRGF0YSA9IHRoaXMuaW50ZXJwb2xhdG9yKHQpO1xyXG5cclxuICAgICAgICAvLyDkvb/nlKhTVkcuanPmm7TmlrDot6/lvoRbY2l0YXRpb246NF1cclxuICAgICAgICB0aGlzLmN1cnJlbnRQYXRoRWxlbWVudC5wbG90KGN1cnJlbnRQYXRoRGF0YSk7XHJcblxyXG4gICAgICAgIC8vIOWwhlNWR+a4suafk+WIsOemu+Wxj0NhbnZhc++8jOWGjeabtOaWsOWIsENvY29zIFNwcml0ZUZyYW1lXHJcbiAgICAgICAgdGhpcy5yZW5kZXJTVkdUb0NhbnZhc0FuZFVwZGF0ZVRleHR1cmUoKTtcclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIHJlbmRlclNWR1RvQ2FudmFzQW5kVXBkYXRlVGV4dHVyZSgpIHtcclxuICAgICAgICAvLyDmuIXnqbrnlLvluINcclxuICAgICAgICB0aGlzLm9mZnNjcmVlbkN0eC5jbGVhclJlY3QoMCwgMCwgdGhpcy5vZmZzY3JlZW5DYW52YXMud2lkdGgsIHRoaXMub2Zmc2NyZWVuQ2FudmFzLmhlaWdodCk7XHJcblxyXG4gICAgICAgIC8vIOWFs+mUru+8muWwhlNWRy5qc+eUn+aIkOeahFNWR+Wtl+espuS4su+8jOa4suafk+WIsDJEIENhbnZhc+S4ilxyXG4gICAgICAgIGNvbnN0IHN2Z1N0cmluZyA9IHRoaXMuc3ZnQ2FudmFzLnN2ZygpO1xyXG4gICAgICAgIGNvbnN0IERPTVVSTCA9IHdpbmRvdy5VUkwgfHwgd2luZG93LndlYmtpdFVSTDtcclxuICAgICAgICBjb25zdCBpbWcgPSBuZXcgSW1hZ2UoKTtcclxuICAgICAgICBjb25zdCBzdmdCbG9iID0gbmV3IEJsb2IoW3N2Z1N0cmluZ10sIHsgdHlwZTogXCJpbWFnZS9zdmcreG1sO2NoYXJzZXQ9dXRmLThcIiB9KTtcclxuICAgICAgICBjb25zdCB1cmwgPSBET01VUkwuY3JlYXRlT2JqZWN0VVJMKHN2Z0Jsb2IpO1xyXG5cclxuICAgICAgICBpbWcub25sb2FkID0gKCkgPT4ge1xyXG4gICAgICAgICAgICB0aGlzLm9mZnNjcmVlbkN0eC5kcmF3SW1hZ2UoaW1nLCAwLCAwLCB0aGlzLm9mZnNjcmVlbkNhbnZhcy53aWR0aCwgdGhpcy5vZmZzY3JlZW5DYW52YXMuaGVpZ2h0KTtcclxuICAgICAgICAgICAgRE9NVVJMLnJldm9rZU9iamVjdFVSTCh1cmwpO1xyXG4gICAgICAgICAgICB0aGlzLnVwZGF0ZVNwcml0ZVRleHR1cmUoKTtcclxuICAgICAgICB9O1xyXG4gICAgICAgIGltZy5zcmMgPSB1cmw7XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSB1cGRhdGVTcHJpdGVUZXh0dXJlKCkge1xyXG4gICAgICAgIC8vIOS7jkNhbnZhc+WIm+W7ukltYWdlQXNzZXTlkoxUZXh0dXJlMkRcclxuICAgICAgICBjb25zdCBpbWFnZUFzc2V0ID0gbmV3IEltYWdlQXNzZXQodGhpcy5vZmZzY3JlZW5DYW52YXMpO1xyXG4gICAgICAgIGNvbnN0IHRleHR1cmUgPSBuZXcgVGV4dHVyZTJEKCk7XHJcbiAgICAgICAgdGV4dHVyZS5pbWFnZSA9IGltYWdlQXNzZXQ7XHJcblxyXG4gICAgICAgIGNvbnN0IHNwcml0ZUZyYW1lID0gbmV3IFNwcml0ZUZyYW1lKCk7XHJcbiAgICAgICAgc3ByaXRlRnJhbWUudGV4dHVyZSA9IHRleHR1cmU7XHJcbiAgICAgICAgdGhpcy5zcHJpdGUuc3ByaXRlRnJhbWUgPSBzcHJpdGVGcmFtZTtcclxuICAgIH1cclxuXHJcbiAgICAvLyDmt7vliqDkuIDkuKrlvaLnirbliLDliqjnlLvluo/liJdcclxuICAgIHB1YmxpYyBhZGRTVkdQYXRoKHN2Z1BhdGhTdHJpbmc6IHN0cmluZykge1xyXG4gICAgICAgIHRoaXMuc3ZnUGF0aHMucHVzaChzdmdQYXRoU3RyaW5nKTtcclxuICAgICAgICBpZiAodGhpcy5zdmdQYXRocy5sZW5ndGggPT09IDIgJiYgIXRoaXMuaW50ZXJwb2xhdG9yKSB7XHJcbiAgICAgICAgICAgIHRoaXMuc2V0dXBJbnRlcnBvbGF0aW9uKDAsIDEpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvLyDot7PovazliLDnibnlrprlvaLnirblubblvIDlp4vlkJHkuIvkuIDlvaLnirblj5jlvaJcclxuICAgIHB1YmxpYyBtb3JwaFRvU2hhcGUoaW5kZXg6IG51bWJlcikge1xyXG4gICAgICAgIGlmIChpbmRleCA8IDAgfHwgaW5kZXggPj0gdGhpcy5zdmdQYXRocy5sZW5ndGgpIHJldHVybjtcclxuICAgICAgICBjb25zdCBuZXh0SW5kZXggPSAoaW5kZXggKyAxKSAlIHRoaXMuc3ZnUGF0aHMubGVuZ3RoO1xyXG4gICAgICAgIHRoaXMuY3VycmVudFNoYXBlSW5kZXggPSBpbmRleDtcclxuICAgICAgICB0aGlzLmFuaW1hdGlvblByb2dyZXNzID0gMDtcclxuICAgICAgICB0aGlzLnNldHVwSW50ZXJwb2xhdGlvbihpbmRleCwgbmV4dEluZGV4KTtcclxuICAgICAgICBpZiAoIXRoaXMuaXNQbGF5aW5nKSB7XHJcbiAgICAgICAgICAgIHRoaXMuaXNQbGF5aW5nID0gdHJ1ZTtcclxuICAgICAgICAgICAgdGhpcy5zY2hlZHVsZSh0aGlzLnVwZGF0ZUFuaW1hdGlvbiwgMCk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIG9uRGVzdHJveSgpIHtcclxuICAgICAgICB0aGlzLnN0b3AoKTtcclxuICAgICAgICBpZiAodGhpcy5zdmdDYW52YXMpIHtcclxuICAgICAgICAgICAgdGhpcy5zdmdDYW52YXMuY2xlYXIoKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbn1cclxuIl19