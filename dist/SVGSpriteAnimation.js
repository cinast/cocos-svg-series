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
const { ccclass, property, executeInEditMode, requireComponent, menu } = cc_1._decorator;
const svg_js_1 = __importDefault(require("svg.js"));
const flubber_1 = require("flubber");
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
    property({ type: [String] })
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
    menu("2D/SVGSpriteAnimation"),
    executeInEditMode,
    requireComponent(cc_1.Sprite)
], SVGSpriteAnimation);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiU1ZHU3ByaXRlQW5pbWF0aW9uLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vc291cmNlL1NWR1Nwcml0ZUFuaW1hdGlvbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7QUFBQSwyQkFBb0c7QUFDcEcsTUFBTSxFQUFFLE9BQU8sRUFBRSxRQUFRLEVBQUUsaUJBQWlCLEVBQUUsZ0JBQWdCLEVBQUUsSUFBSSxFQUFFLEdBQUcsZUFBVSxDQUFDO0FBRXBGLG9EQUF5QjtBQUN6QixxQ0FBc0M7QUFNL0IsSUFBTSxrQkFBa0IsR0FBeEIsTUFBTSxrQkFBbUIsU0FBUSxjQUFTO0lBQTFDOztRQUVLLFdBQU0sR0FBVyxJQUFLLENBQUM7UUFHdkIsYUFBUSxHQUFhLEVBQUUsQ0FBQyxDQUFDLGdDQUFnQztRQUd6RCxhQUFRLEdBQVcsR0FBRyxDQUFDLENBQUMsV0FBVztRQUduQyxjQUFTLEdBQVksS0FBSyxDQUFDO1FBRzNCLGNBQVMsR0FBWSxLQUFLLENBQUM7UUFFM0IsY0FBUyxHQUFZLElBQUssQ0FBQztRQUMzQix1QkFBa0IsR0FBYSxJQUFLLENBQUM7UUFDckMsaUJBQVksR0FBbUMsSUFBSSxDQUFDO1FBQ3BELHNCQUFpQixHQUFXLENBQUMsQ0FBQztRQUM5QixzQkFBaUIsR0FBVyxDQUFDLENBQUM7UUFFdEMsZ0JBQWdCO1FBQ1Isb0JBQWUsR0FBc0IsSUFBSyxDQUFDO1FBQzNDLGlCQUFZLEdBQTZCLElBQUssQ0FBQztJQThKM0QsQ0FBQztJQTVKRyxNQUFNO1FBQ0YsSUFBSSxDQUFDLE1BQU0sR0FBRyxJQUFJLENBQUMsWUFBWSxDQUFDLFdBQU0sQ0FBRSxDQUFDO1FBQ3pDLElBQUksQ0FBQyxtQkFBbUIsRUFBRSxDQUFDO1FBQzNCLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQztRQUNmLElBQUksSUFBSSxDQUFDLFNBQVMsRUFBRSxDQUFDO1lBQ2pCLElBQUksQ0FBQyxJQUFJLEVBQUUsQ0FBQztRQUNoQixDQUFDO0lB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UyxHQUFHLElBQUksQ0FBQztZQUN0QixJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxlQUFlLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDM0MsQ0FBQztJQUNMLENBQUM7SUFFRCxTQUFTO1FBQ0wsSUFBSSxDQUFDLElBQUksRUFBRSxDQUFDO1FBQ1osSUFBSSxJQUFJLENBQUMsU0FBUyxFQUFFLENBQUM7WUFDakIsSUFBSSxDQUFDLFNBQVMsQ0FBQyxLQUFLLEVBQUUsQ0FBQztRQUMzQixDQUFDO0lBQ0wsQ0FBQztDQUNKLENBQUE7QUF0TFksZ0RBQWtCO0FBRW5CO0lBRFAsUUFBUSxDQUFDLFdBQU0sQ0FBQztrREFDYztBQUd2QjtJQURQLFFBQVEsQ0FBQyxFQUFFLElBQUksRUFBRSxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUM7b0RBQ0c7QUFHeEI7SUFEUCxRQUFRO29EQUNzQjtBQUd2QjtJQURQLFFBQVE7cURBQzBCO0FBRzNCO0lBRFAsUUFBUTtxREFDMEI7NkJBZDFCLGtCQUFrQjtJQUo5QixPQUFPLENBQUMsb0JBQW9CLENBQUM7SUFDN0IsSUFBSSxDQUFDLHVCQUF1QixDQUFDO0lBQzdCLGlCQUFpQjtJQUNqQixnQkFBZ0IsQ0FBQyxXQUFNLENBQUM7R0FDWixrQkFBa0IsQ0FzTDlCIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgX2RlY29yYXRvciwgQ29tcG9uZW50LCBTcHJpdGUsIFNwcml0ZUZyYW1lLCBUZXh0dXJlMkQsIEltYWdlQXNzZXQsIFVJVHJhbnNmb3JtIH0gZnJvbSBcImNjXCI7XHJcbmNvbnN0IHsgY2NjbGFzcywgcHJvcGVydHksIGV4ZWN1dGVJbkVkaXRNb2RlLCByZXF1aXJlQ29tcG9uZW50LCBtZW51IH0gPSBfZGVjb3JhdG9yO1xyXG5cclxuaW1wb3J0IFNWRyBmcm9tIFwic3ZnLmpzXCI7XHJcbmltcG9ydCB7IGludGVycG9sYXRlIH0gZnJvbSBcImZsdWJiZXJcIjtcclxuXHJcbkBjY2NsYXNzKFwiU1ZHU3ByaXRlQW5pbWF0aW9uXCIpXHJcbkBtZW51KFwiMkQvU1ZHU3ByaXRlQW5pbWF0aW9uXCIpXHJcbkBleGVjdXRlSW5FZGl0TW9kZVxyXG5AcmVxdWlyZUNvbXBvbmVudChTcHJpdGUpXHJcbmV4cG9ydCBjbGFzcyBTVkdTcHJpdGVBbmltYXRpb24gZXh0ZW5kcyBDb21wb25lbnQge1xyXG4gICAgQHByb3BlcnR5KFNwcml0ZSlcclxuICAgIHByaXZhdGUgc3ByaXRlOiBTcHJpdGUgPSBudWxsITtcclxuXHJcbiAgICBAcHJvcGVydHkoeyB0eXBlOiBbU3RyaW5nXSB9KVxyXG4gICAgcHJpdmF0ZSBzdmdQYXRoczogc3RyaW5nW10gPSBbXTsgLy8g5a2Y5YKo5aSa5LiqU1ZH6Lev5b6E5a2X56ym5LiyIChNMCwwIEwxMDAsMC4uLilcclxuXHJcbiAgICBAcHJvcGVydHlcclxuICAgIHByaXZhdGUgZHVyYXRpb246IG51bWJlciA9IDIuMDsgLy8g5Yqo55S75oC75pe26ZW/77yI56eS77yJXHJcblxyXG4gICAgQHByb3BlcnR5XHJcbiAgICBwcml2YXRlIGlzUGxheWluZzogYm9vbGVhbiA9IGZhbHNlO1xyXG5cclxuICAgIEBwcm9wZXJ0eVxyXG4gICAgcHJpdmF0ZSBpc0xvb3Bpbmc6IGJvb2xlYW4gPSBmYWxzZTtcclxuXHJcbiAgICBwcml2YXRlIHN2Z0NhbnZhczogU1ZHLkRvYyA9IG51bGwhO1xyXG4gICAgcHJpdmF0ZSBjdXJyZW50UGF0aEVsZW1lbnQ6IFNWRy5QYXRoID0gbnVsbCE7XHJcbiAgICBwcml2YXRlIGludGVycG9sYXRvcjogKCh0OiBudW1iZXIpID0+IHN0cmluZykgfCBudWxsID0gbnVsbDtcclxuICAgIHByaXZhdGUgYW5pbWF0aW9uUHJvZ3Jlc3M6IG51bWJlciA9IDA7XHJcbiAgICBwcml2YXRlIGN1cnJlbnRTaGFwZUluZGV4OiBudW1iZXIgPSAwO1xyXG5cclxuICAgIC8vIOeUqOS6juemu+Wxj+a4suafk+eahENhbnZhc1xyXG4gICAgcHJpdmF0ZSBvZmZzY3JlZW5DYW52YXM6IEhUTUxDYW52YXNFbGVtZW50ID0gbnVsbCE7XHJcbiAgICBwcml2YXRlIG9mZnNjcmVlbkN0eDogQ2FudmFzUmVuZGVyaW5nQ29udGV4dDJEID0gbnVsbCE7XHJcblxyXG4gICAgb25Mb2FkKCkge1xyXG4gICAgICAgIHRoaXMuc3ByaXRlID0gdGhpcy5nZXRDb21wb25lbnQoU3ByaXRlKSE7XHJcbiAgICAgICAgdGhpcy5pbml0T2Zmc2NyZWVuQ2FudmFzKCk7XHJcbiAgICAgICAgdGhpcy5pbml0U1ZHKCk7XHJcbiAgICAgICAgaWYgKHRoaXMuaXNQbGF5aW5nKSB7XHJcbiAgICAgICAgICAgIHRoaXMucGxheSgpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIGluaXRPZmZzY3JlZW5DYW52YXMoKSB7XHJcbiAgICAgICAgY29uc3QgdWlUcmFucyA9IHRoaXMuZ2V0Q29tcG9uZW50KFVJVHJhbnNmb3JtKTtcclxuICAgICAgICBpZiAoIXVpVHJhbnMpIHJldHVybiBmYWxzZTtcclxuICAgICAgICB0aGlzLm9mZnNjcmVlbkNhbnZhcyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJjYW52YXNcIik7XHJcbiAgICAgICAgdGhpcy5vZmZzY3JlZW5DYW52YXMud2lkdGggPSB1aVRyYW5zLndpZHRoO1xyXG4gICAgICAgIHRoaXMub2Zmc2NyZWVuQ2FudmFzLmhlaWdodCA9IHVpVHJhbnMuaGVpZ2h0O1xyXG4gICAgICAgIHRoaXMub2Zmc2NyZWVuQ3R4ID0gdGhpcy5vZmZzY3JlZW5DYW52YXMuZ2V0Q29udGV4dChcIjJkXCIpITtcclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIGluaXRTVkcoKSB7XHJcbiAgICAgICAgLy8g5Zyo5YaF5a2Y5Lit5Yib5bu65LiA5LiqU1ZHLmpz55S75biD77yM5LiN5oyC6L295YiwRE9NXHJcbiAgICAgICAgY29uc3QgZHVtbXlEaXYgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xyXG4gICAgICAgIHRoaXMuc3ZnQ2FudmFzID0gU1ZHKGR1bW15RGl2KSBhcyBTVkcuRG9jO1xyXG4gICAgICAgIHRoaXMuc3ZnQ2FudmFzLnNpemUodGhpcy5vZmZzY3JlZW5DYW52YXMud2lkdGgsIHRoaXMub2Zmc2NyZWVuQ2FudmFzLmhlaWdodCk7XHJcblxyXG4gICAgICAgIGlmICh0aGlzLnN2Z1BhdGhzLmxlbmd0aCA+IDApIHtcclxuICAgICAgICAgICAgLy8g5Yib5bu65Yid5aeL6Lev5b6EXHJcbiAgICAgICAgICAgIHRoaXMuY3VycmVudFBhdGhFbGVtZW50ID0gdGhpcy5zdmdDYW52YXMucGF0aCh0aGlzLnN2Z1BhdGhzWzBdKS5maWxsKFwiI2ZmMDAwMFwiKTtcclxuICAgICAgICAgICAgdGhpcy5zZXR1cEludGVycG9sYXRpb24oMCwgMSk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIC8vIOiuvue9ruS7juW9oueKtkHliLDlvaLnirZC55qE5o+S5YC85ZmoXHJcbiAgICBwcml2YXRlIHNldHVwSW50ZXJwb2xhdGlvbihmcm9tSW5kZXg6IG51bWJlciwgdG9JbmRleDogbnVtYmVyKSB7XHJcbiAgICAgICAgaWYgKHRoaXMuc3ZnUGF0aHMubGVuZ3RoIDwgMikge1xyXG4gICAgICAgICAgICBjb25zb2xlLndhcm4oXCLoh7PlsJHpnIDopoHkuKTkuKpTVkfot6/lvoTmiY3og73liJvlu7rliqjnlLvjgIJcIik7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcbiAgICAgICAgY29uc3QgcGF0aEEgPSB0aGlzLnN2Z1BhdGhzW2Zyb21JbmRleF07XHJcbiAgICAgICAgY29uc3QgcGF0aEIgPSB0aGlzLnN2Z1BhdGhzW3RvSW5kZXhdO1xyXG5cclxuICAgICAgICAvLyDkvb/nlKhGbHViYmVy5Yib5bu65o+S5YC85Zmo5qC45b+DW2NpdGF0aW9uOjFdW2NpdGF0aW9uOjNdXHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgdGhpcy5pbnRlcnBvbGF0b3IgPSBpbnRlcnBvbGF0ZShwYXRoQSwgcGF0aEIsIHtcclxuICAgICAgICAgICAgICAgIG1heFNlZ21lbnRMZW5ndGg6IDIsIC8vIOaOp+WItuW5s+a7keW6puS4juaAp+iDvVxyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xyXG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKFwi5Yib5bu65b2i54q25o+S5YC85Zmo5aSx6LSl77yM6K+35qOA5p+lU1ZH6Lev5b6E5qC85byPOlwiLCBlcnJvcik7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHB1YmxpYyBwbGF5KCkge1xyXG4gICAgICAgIHRoaXMuaXNQbGF5aW5nID0gdHJ1ZTtcclxuICAgICAgICB0aGlzLmFuaW1hdGlvblByb2dyZXNzID0gMDtcclxuICAgICAgICB0aGlzLmN1cnJlbnRTaGFwZUluZGV4ID0gMDtcclxuICAgICAgICBpZiAodGhpcy5zdmdQYXRocy5sZW5ndGggPiAxKSB7XHJcbiAgICAgICAgICAgIHRoaXMuc2V0dXBJbnRlcnBvbGF0aW9uKDAsIDEpO1xyXG4gICAgICAgIH1cclxuICAgICAgICB0aGlzLnNjaGVkdWxlKHRoaXMudXBkYXRlQW5pbWF0aW9uLCAwKTtcclxuICAgIH1cclxuXHJcbiAgICBwdWJsaWMgc3RvcCgpIHtcclxuICAgICAgICB0aGlzLmlzUGxheWluZyA9IGZhbHNlO1xyXG4gICAgICAgIHRoaXMudW5zY2hlZHVsZSh0aGlzLnVwZGF0ZUFuaW1hdGlvbik7XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSB1cGRhdGVBbmltYXRpb24oZGVsdGFUaW1lOiBudW1iZXIpIHtcclxuICAgICAgICBpZiAoIXRoaXMuaXNQbGF5aW5nIHx8ICF0aGlzLmludGVycG9sYXRvcikgcmV0dXJuO1xyXG5cclxuICAgICAgICAvLyDmm7TmlrDov5vluqZcclxuICAgICAgICB0aGlzLmFuaW1hdGlvblByb2dyZXNzICs9IGRlbHRhVGltZSAvIHRoaXMuZHVyYXRpb247XHJcblxyXG4gICAgICAgIGxldCB0ID0gdGhpcy5hbmltYXRpb25Qcm9ncmVzcztcclxuICAgICAgICBsZXQgdGFyZ2V0U2hhcGVJbmRleCA9IHRoaXMuY3VycmVudFNoYXBlSW5kZXggKyAxO1xyXG5cclxuICAgICAgICAvLyDlpITnkIblvqrnjq/lkozkuIvkuIDkuKrlvaLnirbnmoTov4fmuKFcclxuICAgICAgICBpZiAodCA+PSAxLjApIHtcclxuICAgICAgICAgICAgaWYgKHRoaXMuaXNMb29waW5nKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmN1cnJlbnRTaGFwZUluZGV4ID0gKHRoaXMuY3VycmVudFNoYXBlSW5kZXggKyAxKSAlIHRoaXMuc3ZnUGF0aHMubGVuZ3RoO1xyXG4gICAgICAgICAgICAgICAgdGFyZ2V0U2hhcGVJbmRleCA9ICh0aGlzLmN1cnJlbnRTaGFwZUluZGV4ICsgMSkgJSB0aGlzLnN2Z1BhdGhzLmxlbmd0aDtcclxuICAgICAgICAgICAgICAgIHRoaXMuYW5pbWF0aW9uUHJvZ3Jlc3MgPSAwO1xyXG4gICAgICAgICAgICAgICAgdCA9IDA7XHJcbiAgICAgICAgICAgICAgICB0aGlzLnNldHVwSW50ZXJwb2xhdGlvbih0aGlzLmN1cnJlbnRTaGFwZUluZGV4LCB0YXJnZXRTaGFwZUluZGV4KTtcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuYW5pbWF0aW9uUHJvZ3Jlc3MgPSAxLjA7XHJcbiAgICAgICAgICAgICAgICB0ID0gMS4wO1xyXG4gICAgICAgICAgICAgICAgdGhpcy5pc1BsYXlpbmcgPSBmYWxzZTsgLy8g5pKt5pS+5a6M5q+VXHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vIOS9v+eUqEZsdWJiZXLmj5LlgLzlmajojrflj5blvZPliY3kuK3pl7TluKfnmoTot6/lvoTmlbDmja5bY2l0YXRpb246MV1cclxuICAgICAgICBjb25zdCBjdXJyZW50UGF0aERhdGEgPSB0aGlzLmludGVycG9sYXRvcih0KTtcclxuXHJcbiAgICAgICAgLy8g5L2/55SoU1ZHLmpz5pu05paw6Lev5b6EW2NpdGF0aW9uOjRdXHJcbiAgICAgICAgdGhpcy5jdXJyZW50UGF0aEVsZW1lbnQucGxvdChjdXJyZW50UGF0aERhdGEpO1xyXG5cclxuICAgICAgICAvLyDlsIZTVkfmuLLmn5PliLDnprvlsY9DYW52YXPvvIzlho3mm7TmlrDliLBDb2NvcyBTcHJpdGVGcmFtZVxyXG4gICAgICAgIHRoaXMucmVuZGVyU1ZHVG9DYW52YXNBbmRVcGRhdGVUZXh0dXJlKCk7XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSByZW5kZXJTVkdUb0NhbnZhc0FuZFVwZGF0ZVRleHR1cmUoKSB7XHJcbiAgICAgICAgLy8g5riF56m655S75biDXHJcbiAgICAgICAgdGhpcy5vZmZzY3JlZW5DdHguY2xlYXJSZWN0KDAsIDAsIHRoaXMub2Zmc2NyZWVuQ2FudmFzLndpZHRoLCB0aGlzLm9mZnNjcmVlbkNhbnZhcy5oZWlnaHQpO1xyXG5cclxuICAgICAgICAvLyDlhbPplK7vvJrlsIZTVkcuanPnlJ/miJDnmoRTVkflrZfnrKbkuLLvvIzmuLLmn5PliLAyRCBDYW52YXPkuIpcclxuICAgICAgICBjb25zdCBzdmdTdHJpbmcgPSB0aGlzLnN2Z0NhbnZhcy5zdmcoKTtcclxuICAgICAgICBjb25zdCBET01VUkwgPSB3aW5kb3cuVVJMIHx8IHdpbmRvdy53ZWJraXRVUkw7XHJcbiAgICAgICAgY29uc3QgaW1nID0gbmV3IEltYWdlKCk7XHJcbiAgICAgICAgY29uc3Qgc3ZnQmxvYiA9IG5ldyBCbG9iKFtzdmdTdHJpbmddLCB7IHR5cGU6IFwiaW1hZ2Uvc3ZnK3htbDtjaGFyc2V0PXV0Zi04XCIgfSk7XHJcbiAgICAgICAgY29uc3QgdXJsID0gRE9NVVJMLmNyZWF0ZU9iamVjdFVSTChzdmdCbG9iKTtcclxuXHJcbiAgICAgICAgaW1nLm9ubG9hZCA9ICgpID0+IHtcclxuICAgICAgICAgICAgdGhpcy5vZmZzY3JlZW5DdHguZHJhd0ltYWdlKGltZywgMCwgMCwgdGhpcy5vZmZzY3JlZW5DYW52YXMud2lkdGgsIHRoaXMub2Zmc2NyZWVuQ2FudmFzLmhlaWdodCk7XHJcbiAgICAgICAgICAgIERPTVVSTC5yZXZva2VPYmplY3RVUkwodXJsKTtcclxuICAgICAgICAgICAgdGhpcy51cGRhdGVTcHJpdGVUZXh0dXJlKCk7XHJcbiAgICAgICAgfTtcclxuICAgICAgICBpbWcuc3JjID0gdXJsO1xyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgdXBkYXRlU3ByaXRlVGV4dHVyZSgpIHtcclxuICAgICAgICAvLyDku45DYW52YXPliJvlu7pJbWFnZUFzc2V05ZKMVGV4dHVyZTJEXHJcbiAgICAgICAgY29uc3QgaW1hZ2VBc3NldCA9IG5ldyBJbWFnZUFzc2V0KHRoaXMub2Zmc2NyZWVuQ2FudmFzKTtcclxuICAgICAgICBjb25zdCB0ZXh0dXJlID0gbmV3IFRleHR1cmUyRCgpO1xyXG4gICAgICAgIHRleHR1cmUuaW1hZ2UgPSBpbWFnZUFzc2V0O1xyXG5cclxuICAgICAgICBjb25zdCBzcHJpdGVGcmFtZSA9IG5ldyBTcHJpdGVGcmFtZSgpO1xyXG4gICAgICAgIHNwcml0ZUZyYW1lLnRleHR1cmUgPSB0ZXh0dXJlO1xyXG4gICAgICAgIHRoaXMuc3ByaXRlLnNwcml0ZUZyYW1lID0gc3ByaXRlRnJhbWU7XHJcbiAgICB9XHJcblxyXG4gICAgLy8g5re75Yqg5LiA5Liq5b2i54q25Yiw5Yqo55S75bqP5YiXXHJcbiAgICBwdWJsaWMgYWRkU1ZHUGF0aChzdmdQYXRoU3RyaW5nOiBzdHJpbmcpIHtcclxuICAgICAgICB0aGlzLnN2Z1BhdGhzLnB1c2goc3ZnUGF0aFN0cmluZyk7XHJcbiAgICAgICAgaWYgKHRoaXMuc3ZnUGF0aHMubGVuZ3RoID09PSAyICYmICF0aGlzLmludGVycG9sYXRvcikge1xyXG4gICAgICAgICAgICB0aGlzLnNldHVwSW50ZXJwb2xhdGlvbigwLCAxKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgLy8g6Lez6L2s5Yiw54m55a6a5b2i54q25bm25byA5aeL5ZCR5LiL5LiA5b2i54q25Y+Y5b2iXHJcbiAgICBwdWJsaWMgbW9ycGhUb1NoYXBlKGluZGV4OiBudW1iZXIpIHtcclxuICAgICAgICBpZiAoaW5kZXggPCAwIHx8IGluZGV4ID49IHRoaXMuc3ZnUGF0aHMubGVuZ3RoKSByZXR1cm47XHJcbiAgICAgICAgY29uc3QgbmV4dEluZGV4ID0gKGluZGV4ICsgMSkgJSB0aGlzLnN2Z1BhdGhzLmxlbmd0aDtcclxuICAgICAgICB0aGlzLmN1cnJlbnRTaGFwZUluZGV4ID0gaW5kZXg7XHJcbiAgICAgICAgdGhpcy5hbmltYXRpb25Qcm9ncmVzcyA9IDA7XHJcbiAgICAgICAgdGhpcy5zZXR1cEludGVycG9sYXRpb24oaW5kZXgsIG5leHRJbmRleCk7XHJcbiAgICAgICAgaWYgKCF0aGlzLmlzUGxheWluZykge1xyXG4gICAgICAgICAgICB0aGlzLmlzUGxheWluZyA9IHRydWU7XHJcbiAgICAgICAgICAgIHRoaXMuc2NoZWR1bGUodGhpcy51cGRhdGVBbmltYXRpb24sIDApO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBvbkRlc3Ryb3koKSB7XHJcbiAgICAgICAgdGhpcy5zdG9wKCk7XHJcbiAgICAgICAgaWYgKHRoaXMuc3ZnQ2FudmFzKSB7XHJcbiAgICAgICAgICAgIHRoaXMuc3ZnQ2FudmFzLmNsZWFyKCk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG59XHJcbiJdfQ==