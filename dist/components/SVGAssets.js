"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SVGAsset = void 0;
const cc_1 = require("cc");
const { ccclass, property } = cc_1._decorator;
let SVGAsset = class SVGAsset extends cc_1.Asset {
    get svgContent() {
        return this._svgContent;
    }
    set svgContent(value) {
        if (this._svgContent !== value) {
            this._svgContent = value;
            this.parseSVG();
            this.isDirty = true;
        }
    }
    /**
     * 构造函数
     */
    constructor() {
        super();
        // 基础SVG属性
        this._svgContent = "";
        this.width = 0;
        this.height = 0;
        this.viewBox = "";
        this.aspectRatio = 1;
        // 渲染配置属性
        this.defaultColor = "#ffffff";
        this.renderScale = 1;
        this.antialias = true;
        this.preserveAspectRatio = "xMidYMid meet";
        // 资源管理属性
        this.cachedTextures = new Map();
        this.previewAsset = null;
        this.lastRenderedSize = { width: 0, height: 0 };
        // 元数据属性
        this.title = "";
        this.description = "";
        this.keywords = [];
        this.author = "";
        this.license = "";
        // 性能优化属性
        this.complexityScore = 0;
        this.optimizedSVG = "";
        this.isAnimated = false;
        // 编辑状态属性
        this.isDirty = true;
        this.lastModified = Date.now();
        this.sourceFile = "";
        // 私有DOM元素用于解析
        this.svgElement = null;
        this.parser = new DOMParser();
    }
    /**
     * 解析SVG内容，提取元数据和尺寸信息
     */
    parseSVG() {
        if (!this._svgContent) {
            this.width = 0;
            this.height = 0;
            this.viewBox = "";
            this.aspectRatio = 1;
            return;
        }
        try {
            const doc = this.parser.parseFromString(this._svgContent, "image/svg+xml");
            this.svgElement = doc.documentElement;
            // 检查解析错误
            const parserError = doc.querySelector("parsererror");
            if (parserError) {
                console.error("SVG解析错误:", parserError.textContent);
                return;
            }
            // 提取尺寸信息
            const widthAttr = this.svgElement.getAttribute("width");
            const heightAttr = this.svgElement.getAttribute("height");
            const viewBoxAttr = this.svgElement.getAttribute("viewBox");
            this.viewBox = viewBoxAttr || "";
            if (viewBoxAttr) {
                const viewBoxParts = viewBoxAttr.split(" ").map(Number);
                if (viewBoxParts.length >= 4) {
                    this.width = viewBoxParts[2];
                    this.height = viewBoxParts[3];
                }
            }
            // 如果viewBox没有提供尺寸，使用width/height属性
            if (this.width === 0 && widthAttr) {
                this.width = this.parseDimension(widthAttr);
            }
            if (this.height === 0 && heightAttr) {
                this.height = this.parseDimension(heightAttr);
            }
            // 如果还是没有尺寸，使用默认值
            if (this.width === 0)
                this.width = 100;
            if (this.height === 0)
                this.height = 100;
            this.aspectRatio = this.height > 0 ? this.width / this.height : 1;
            // 提取元数据
            this.extractMetadata();
            // 计算复杂度
            this.calculateComplexity();
            // 检查是否包含动画
            this.checkForAnimation();
            // 生成优化版本
            this.optimizeSVG();
            this.isDirty = false;
            this.lastModified = Date.now();
        }
        catch (error) {
            console.error("解析SVG失败:", error);
        }
    }
    /**
     * 验证SVG格式是否正确
     */
    validateSVG() {
        if (!this._svgContent) {
            return false;
        }
        try {
            const doc = this.parser.parseFromString(this._svgContent, "image/svg+xml");
            const parserError = doc.querySelector("parsererror");
            return !parserError;
        }
        catch (error) {
            return false;
        }
    }
    /**
     * 渲染指定尺寸的纹理
     */
    async renderToTexture(width, height) {
        const cacheKey = `${width}x${height}_${this.renderScale}_${this.defaultColor}`;
        // 检查缓存
        if (this.cachedTextures.has(cacheKey)) {
            return this.cachedTextures.get(cacheKey);
        }
        // 创建Canvas
        const canvas = document.createElement("canvas");
        const renderWidth = Math.floor(width * this.renderScale);
        const renderHeight = Math.floor(height * this.renderScale);
        canvas.width = renderWidth;
        canvas.height = renderHeight;
        const ctx = canvas.getContext("2d");
        // 设置抗锯齿
        if (this.antialias) {
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = "high";
        }
        // 准备SVG字符串
        let svgToRender = this.optimizedSVG || this._svgContent;
        // 应用颜色覆盖
        if (this.defaultColor !== "#ffffff") {
            svgToRender = this.applyColorOverride(svgToRender, this.defaultColor);
        }
        // 设置SVG尺寸
        svgToRender = this.setSVGDimensions(svgToRender, width, height);
        // 渲染SVG到Canvas
        await this.renderSVGToCanvas(svgToRender, canvas);
        // 创建ImageAsset和Texture2D
        const imageAsset = new cc_1.ImageAsset(canvas);
        const texture = new cc_1.Texture2D();
        texture.image = imageAsset;
        // 缓存纹理
        this.cachedTextures.set(cacheKey, texture);
        this.lastRenderedSize = { width, height };
        return texture;
    }
    /**
     * 生成缩略图预览
     */
    async generatePreview() {
        if (this.previewAsset) {
            return this.previewAsset;
        }
        const canvas = document.createElement("canvas");
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#f0f0f0";
        ctx.fillRect(0, 0, 64, 64);
        if (this._svgContent) {
            // 准备SVG字符串
            let svgToRender = this.optimizedSVG || this._svgContent;
            // 计算适合预览的尺寸
            const previewSize = this.scaleToFit(64, 64);
            const x = (64 - previewSize.width) / 2;
            const y = (64 - previewSize.height) / 2;
            // 设置SVG尺寸
            svgToRender = this.setSVGDimensions(svgToRender, previewSize.width, previewSize.height);
            // 渲染SVG到Canvas
            const tempCanvas = document.createElement("canvas");
            tempCanvas.width = previewSize.width;
            tempCanvas.height = previewSize.height;
            await this.renderSVGToCanvas(svgToRender, tempCanvas);
            // 绘制到预览Canvas
            ctx.drawImage(tempCanvas, x, y, previewSize.width, previewSize.height);
        }
        this.previewAsset = new cc_1.ImageAsset(canvas);
        return this.previewAsset;
    }
    /**
     * 优化SVG
     */
    optimize() {
        this.optimizeSVG();
        this.isDirty = true;
    }
    /**
     * 批量修改填充颜色
     */
    changeColor(newColor) {
        this.defaultColor = newColor;
        this.isDirty = true;
        this.cachedTextures.clear(); // 清除缓存，因为颜色改变了
    }
    /**
     * 提取所有路径数据
     */
    extractPaths() {
        if (!this.svgElement) {
            return [];
        }
        const paths = [];
        const pathElements = this.svgElement.querySelectorAll("path");
        pathElements.forEach((path) => {
            const d = path.getAttribute("d");
            if (d) {
                paths.push(d);
            }
        });
        return paths;
    }
    /**
     * 计算适合的尺寸
     */
    scaleToFit(maxWidth, maxHeight) {
        if (this.width === 0 || this.height === 0) {
            return { width: maxWidth, height: maxHeight };
        }
        const widthRatio = maxWidth / this.width;
        const heightRatio = maxHeight / this.height;
        const scale = Math.min(widthRatio, heightRatio);
        return {
            width: Math.floor(this.width * scale),
            height: Math.floor(this.height * scale),
        };
    }
    /**
     * 序列化为JSON
     */
    serialize() {
        return {
            svgContent: this._svgContent,
            width: this.width,
            height: this.height,
            viewBox: this.viewBox,
            defaultColor: this.defaultColor,
            renderScale: this.renderScale,
            antialias: this.antialias,
            title: this.title,
            description: this.description,
            keywords: this.keywords,
            author: this.author,
            license: this.license,
            lastModified: this.lastModified,
            sourceFile: this.sourceFile,
        };
    }
    /**
     * 从JSON反序列化
     */
    deserialize(data) {
        this._svgContent = data.svgContent || "";
        this.width = data.width || 0;
        this.height = data.height || 0;
        this.viewBox = data.viewBox || "";
        this.defaultColor = data.defaultColor || "#ffffff";
        this.renderScale = data.renderScale || 1;
        this.antialias = data.antialias !== undefined ? data.antialias : true;
        this.title = data.title || "";
        this.description = data.description || "";
        this.keywords = data.keywords || [];
        this.author = data.author || "";
        this.license = data.license || "";
        this.lastModified = data.lastModified || Date.now();
        this.sourceFile = data.sourceFile || "";
        this.parseSVG();
    }
    // ========== 私有方法 ==========
    parseDimension(dim) {
        // 移除单位（px, pt, em等）
        const num = parseFloat(dim);
        return isNaN(num) ? 0 : num;
    }
    extractMetadata() {
        if (!this.svgElement)
            return;
        // 提取<title>
        const titleElement = this.svgElement.querySelector("title");
        this.title = titleElement ? titleElement.textContent || "" : "";
        // 提取<desc>
        const descElement = this.svgElement.querySelector("desc");
        this.description = descElement ? descElement.textContent || "" : "";
        // 提取metadata
        const metadataElement = this.svgElement.querySelector("metadata");
        if (metadataElement) {
            // 这里可以解析更复杂的元数据
            const text = metadataElement.textContent || "";
            if (text.includes("author:")) {
                this.author = text.split("author:")[1].split("\n")[0].trim();
            }
            if (text.includes("license:")) {
                this.license = text.split("license:")[1].split("\n")[0].trim();
            }
        }
    }
    calculateComplexity() {
        if (!this.svgElement) {
            this.complexityScore = 0;
            return;
        }
        let score = 0;
        // 计算路径数量
        const paths = this.svgElement.querySelectorAll("path");
        score += paths.length * 10;
        // 计算其他图形元素
        const circles = this.svgElement.querySelectorAll("circle, ellipse");
        score += circles.length * 5;
        const rects = this.svgElement.querySelectorAll("rect");
        score += rects.length * 3;
        const lines = this.svgElement.querySelectorAll("line, polyline, polygon");
        score += lines.length * 2;
        // 计算文本元素
        const texts = this.svgElement.querySelectorAll("text");
        score += texts.length * 8;
        // 计算分组和变换
        const groups = this.svgElement.querySelectorAll("g");
        score += groups.length * 1;
        this.complexityScore = score;
    }
    checkForAnimation() {
        if (!this.svgElement) {
            this.isAnimated = false;
            return;
        }
        const hasAnimation = this.svgElement.querySelector("animate, animateTransform, animateMotion, set");
        this.isAnimated = !!hasAnimation;
    }
    optimizeSVG() {
        if (!this.svgElement) {
            this.optimizedSVG = this._svgContent;
            return;
        }
        // 克隆元素进行优化
        const optimizedElement = this.svgElement.cloneNode(true);
        // 移除注释
        this.removeComments(optimizedElement);
        // 移除空元素
        this.removeEmptyElements(optimizedElement);
        // 压缩空白
        this.compressWhitespace(optimizedElement);
        // 序列化回字符串
        const serializer = new XMLSerializer();
        this.optimizedSVG = serializer.serializeToString(optimizedElement);
    }
    removeComments(element) {
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_COMMENT, null);
        const comments = [];
        let node;
        while ((node = walker.nextNode())) {
            comments.push(node);
        }
        comments.forEach((comment) => comment.remove());
    }
    removeEmptyElements(element) {
        const emptyElements = Array.from(element.querySelectorAll("*")).filter((el) => {
            return !el.hasChildNodes() && !el.getAttribute("d") && !el.getAttribute("points");
        });
        emptyElements.forEach((el) => el.remove());
    }
    compressWhitespace(element) {
        var _a;
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null);
        let node;
        while ((node = walker.nextNode())) {
            const textNode = node;
            textNode.textContent = ((_a = textNode.textContent) === null || _a === void 0 ? void 0 : _a.replace(/\s+/g, " ").trim()) || "";
        }
    }
    applyColorOverride(svgString, color) {
        // 简单的颜色替换：将所有fill属性（除了"none"）替换为指定颜色
        return svgString.replace(/fill="([^"]*)"/g, (match, fillValue) => {
            if (fillValue === "none" || fillValue === "transparent") {
                return match; // 保持透明填充不变
            }
            return `fill="${color}"`;
        });
    }
    setSVGDimensions(svgString, width, height) {
        // 添加或更新width和height属性
        let result = svgString;
        // 更新width属性
        if (result.includes('width="')) {
            result = result.replace(/width="[^"]*"/, `width="${width}"`);
        }
        else {
            result = result.replace(/<svg/, `<svg width="${width}"`);
        }
        // 更新height属性
        if (result.includes('height="')) {
            result = result.replace(/height="[^"]*"/, `height="${height}"`);
        }
        else {
            result = result.replace(/<svg/, `<svg height="${height}"`);
        }
        // 添加preserveAspectRatio
        if (!result.includes('preserveAspectRatio="')) {
            result = result.replace(/<svg/, `<svg preserveAspectRatio="${this.preserveAspectRatio}"`);
        }
        return result;
    }
    renderSVGToCanvas(svgString, canvas) {
        return new Promise((resolve, reject) => {
            const ctx = canvas.getContext("2d");
            // 创建Blob和URL
            const blob = new Blob([svgString], { type: "image/svg+xml" });
            const url = URL.createObjectURL(blob);
            const img = new Image();
            img.onload = () => {
                // 清空画布
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                // 绘制SVG
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                // 清理URL
                URL.revokeObjectURL(url);
                resolve();
            };
            img.onerror = (error) => {
                URL.revokeObjectURL(url);
                reject(new Error(`SVG渲染失败: ${error}`));
            };
            img.src = url;
        });
    }
};
exports.SVGAsset = SVGAsset;
__decorate([
    property
], SVGAsset.prototype, "_svgContent", void 0);
__decorate([
    property
], SVGAsset.prototype, "svgContent", null);
__decorate([
    property
], SVGAsset.prototype, "width", void 0);
__decorate([
    property
], SVGAsset.prototype, "height", void 0);
__decorate([
    property
], SVGAsset.prototype, "viewBox", void 0);
__decorate([
    property
], SVGAsset.prototype, "aspectRatio", void 0);
__decorate([
    property
], SVGAsset.prototype, "defaultColor", void 0);
__decorate([
    property
], SVGAsset.prototype, "renderScale", void 0);
__decorate([
    property
], SVGAsset.prototype, "antialias", void 0);
__decorate([
    property
], SVGAsset.prototype, "preserveAspectRatio", void 0);
__decorate([
    property
], SVGAsset.prototype, "title", void 0);
__decorate([
    property
], SVGAsset.prototype, "description", void 0);
__decorate([
    property
], SVGAsset.prototype, "keywords", void 0);
__decorate([
    property
], SVGAsset.prototype, "author", void 0);
__decorate([
    property
], SVGAsset.prototype, "license", void 0);
__decorate([
    property
], SVGAsset.prototype, "complexityScore", void 0);
__decorate([
    property
], SVGAsset.prototype, "optimizedSVG", void 0);
__decorate([
    property
], SVGAsset.prototype, "isAnimated", void 0);
__decorate([
    property
], SVGAsset.prototype, "isDirty", void 0);
__decorate([
    property
], SVGAsset.prototype, "lastModified", void 0);
__decorate([
    property
], SVGAsset.prototype, "sourceFile", void 0);
exports.SVGAsset = SVGAsset = __decorate([
    ccclass("SVGAsset")
], SVGAsset);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiU1ZHQXNzZXRzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc291cmNlL2NvbXBvbmVudHMvU1ZHQXNzZXRzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7OztBQUFBLDJCQUE4RDtBQUM5RCxNQUFNLEVBQUUsT0FBTyxFQUFFLFFBQVEsRUFBRSxHQUFHLGVBQVUsQ0FBQztBQUdsQyxJQUFNLFFBQVEsR0FBZCxNQUFNLFFBQVMsU0FBUSxVQUFLO0lBTS9CLElBQVcsVUFBVTtRQUNqQixPQUFPLElBQUksQ0FBQyxXQUFXLENBQUM7SUFDNUIsQ0FBQztJQUVELElBQVcsVUFBVSxDQUFDLEtBQWE7UUFDL0IsSUFBSSxJQUFJLENBQUMsV0FBVyxLQUFLLEtBQUssRUFBRSxDQUFDO1lBQzdCLElBQUksQ0FBQyxXQUFXLEdBQUcsS0FBSyxDQUFDO1lBQ3pCLElBQUksQ0FBQyxRQUFRLEVBQUUsQ0FBQztZQUNoQixJQUFJLENBQUMsT0FBTyxHQUFHLElBQUksQ0FBQztRQUN4QixDQUFDO0lBQ0wsQ0FBQztJQXdFRDs7T0FFRztJQUNIO1FBQ0ksS0FBSyxFQUFFLENBQUM7UUEzRlosVUFBVTtRQUVGLGdCQUFXLEdBQVcsRUFBRSxDQUFDO1FBZ0IxQixVQUFLLEdBQVcsQ0FBQyxDQUFDO1FBR2xCLFdBQU0sR0FBVyxDQUFDLENBQUM7UUFHbkIsWUFBTyxHQUFXLEVBQUUsQ0FBQztRQUdyQixnQkFBVyxHQUFXLENBQUMsQ0FBQztRQUUvQixTQUFTO1FBRUYsaUJBQVksR0FBVyxTQUFTLENBQUM7UUFHakMsZ0JBQVcsR0FBVyxDQUFDLENBQUM7UUFHeEIsY0FBUyxHQUFZLElBQUksQ0FBQztRQUcxQix3QkFBbUIsR0FBVyxlQUFlLENBQUM7UUFFckQsU0FBUztRQUNELG1CQUFjLEdBQTJCLElBQUksR0FBRyxFQUFFLENBQUM7UUFDbkQsaUJBQVksR0FBc0IsSUFBSSxDQUFDO1FBQ3ZDLHFCQUFnQixHQUFzQyxFQUFFLEtBQUssRUFBRSxD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bEM7SUFETixRQUFROzRDQUNzQjttQkFsRnRCLFFBQVE7SUFEcEIsT0FBTyxDQUFDLFVBQVUsQ0FBQztHQUNQLFFBQVEsQ0E0akJwQiIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IF9kZWNvcmF0b3IsIEFzc2V0LCBJbWFnZUFzc2V0LCBUZXh0dXJlMkQgfSBmcm9tIFwiY2NcIjtcbmNvbnN0IHsgY2NjbGFzcywgcHJvcGVydHkgfSA9IF9kZWNvcmF0b3I7XG5cbkBjY2NsYXNzKFwiU1ZHQXNzZXRcIilcbmV4cG9ydCBjbGFzcyBTVkdBc3NldCBleHRlbmRzIEFzc2V0IHtcbiAgICAvLyDln7rnoYBTVkflsZ7mgKdcbiAgICBAcHJvcGVydHlcbiAgICBwcml2YXRlIF9zdmdDb250ZW50OiBzdHJpbmcgPSBcIlwiO1xuXG4gICAgQHByb3BlcnR5XG4gICAgcHVibGljIGdldCBzdmdDb250ZW50KCk6IHN0cmluZyB7XG4gICAgICAgIHJldHVybiB0aGlzLl9zdmdDb250ZW50O1xuICAgIH1cblxuICAgIHB1YmxpYyBzZXQgc3ZnQ29udGVudCh2YWx1ZTogc3RyaW5nKSB7XG4gICAgICAgIGlmICh0aGlzLl9zdmdDb250ZW50ICE9PSB2YWx1ZSkge1xuICAgICAgICAgICAgdGhpcy5fc3ZnQ29udGVudCA9IHZhbHVlO1xuICAgICAgICAgICAgdGhpcy5wYXJzZVNWRygpO1xuICAgICAgICAgICAgdGhpcy5pc0RpcnR5ID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIEBwcm9wZXJ0eVxuICAgIHB1YmxpYyB3aWR0aDogbnVtYmVyID0gMDtcblxuICAgIEBwcm9wZXJ0eVxuICAgIHB1YmxpYyBoZWlnaHQ6IG51bWJlciA9IDA7XG5cbiAgICBAcHJvcGVydHlcbiAgICBwdWJsaWMgdmlld0JveDogc3RyaW5nID0gXCJcIjtcblxuICAgIEBwcm9wZXJ0eVxuICAgIHB1YmxpYyBhc3BlY3RSYXRpbzogbnVtYmVyID0gMTtcblxuICAgIC8vIOa4suafk+mFjee9ruWxnuaAp1xuICAgIEBwcm9wZXJ0eVxuICAgIHB1YmxpYyBkZWZhdWx0Q29sb3I6IHN0cmluZyA9IFwiI2ZmZmZmZlwiO1xuXG4gICAgQHByb3BlcnR5XG4gICAgcHVibGljIHJlbmRlclNjYWxlOiBudW1iZXIgPSAxO1xuXG4gICAgQHByb3BlcnR5XG4gICAgcHVibGljIGFudGlhbGlhczogYm9vbGVhbiA9IHRydWU7XG5cbiAgICBAcHJvcGVydHlcbiAgICBwdWJsaWMgcHJlc2VydmVBc3BlY3RSYXRpbzogc3RyaW5nID0gXCJ4TWlkWU1pZCBtZWV0XCI7XG5cbiAgICAvLyDotYTmupDnrqHnkIblsZ7mgKdcbiAgICBwcml2YXRlIGNhY2hlZFRleHR1cmVzOiBNYXA8c3RyaW5nLCBUZXh0dXJlMkQ+ID0gbmV3IE1hcCgpO1xuICAgIHByaXZhdGUgcHJldmlld0Fzc2V0OiBJbWFnZUFzc2V0IHwgbnVsbCA9IG51bGw7XG4gICAgcHJpdmF0ZSBsYXN0UmVuZGVyZWRTaXplOiB7IHdpZHRoOiBudW1iZXI7IGhlaWdodDogbnVtYmVyIH0gPSB7IHdpZHRoOiAwLCBoZWlnaHQ6IDAgfTtcblxuICAgIC8vIOWFg+aVsOaNruWxnuaAp1xuICAgIEBwcm9wZXJ0eVxuICAgIHB1YmxpYyB0aXRsZTogc3RyaW5nID0gXCJcIjtcblxuICAgIEBwcm9wZXJ0eVxuICAgIHB1YmxpYyBkZXNjcmlwdGlvbjogc3RyaW5nID0gXCJcIjtcblxuICAgIEBwcm9wZXJ0eVxuICAgIHB1YmxpYyBrZXl3b3Jkczogc3RyaW5nW10gPSBbXTtcblxuICAgIEBwcm9wZXJ0eVxuICAgIHB1YmxpYyBhdXRob3I6IHN0cmluZyA9IFwiXCI7XG5cbiAgICBAcHJvcGVydHlcbiAgICBwdWJsaWMgbGljZW5zZTogc3RyaW5nID0gXCJcIjtcblxuICAgIC8vIOaAp+iDveS8mOWMluWxnuaAp1xuICAgIEBwcm9wZXJ0eVxuICAgIHB1YmxpYyBjb21wbGV4aXR5U2NvcmU6IG51bWJlciA9IDA7XG5cbiAgICBAcHJvcGVydHlcbiAgICBwdWJsaWMgb3B0aW1pemVkU1ZHOiBzdHJpbmcgPSBcIlwiO1xuXG4gICAgQHByb3BlcnR5XG4gICAgcHVibGljIGlzQW5pbWF0ZWQ6IGJvb2xlYW4gPSBmYWxzZTtcblxuICAgIC8vIOe8lui+keeKtuaAgeWxnuaAp1xuICAgIEBwcm9wZXJ0eVxuICAgIHB1YmxpYyBpc0RpcnR5OiBib29sZWFuID0gdHJ1ZTtcblxuICAgIEBwcm9wZXJ0eVxuICAgIHB1YmxpYyBsYXN0TW9kaWZpZWQ6IG51bWJlciA9IERhdGUubm93KCk7XG5cbiAgICBAcHJvcGVydHlcbiAgICBwdWJsaWMgc291cmNlRmlsZTogc3RyaW5nID0gXCJcIjtcblxuICAgIC8vIOengeaciURPTeWFg+e0oOeUqOS6juino+aekFxuICAgIHByaXZhdGUgc3ZnRWxlbWVudDogU1ZHU1ZHRWxlbWVudCB8IG51bGwgPSBudWxsO1xuICAgIHByaXZhdGUgcGFyc2VyOiBET01QYXJzZXIgPSBuZXcgRE9NUGFyc2VyKCk7XG5cbiAgICAvKipcbiAgICAgKiDmnoTpgKDlh73mlbBcbiAgICAgKi9cbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgc3VwZXIoKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiDop6PmnpBTVkflhoXlrrnvvIzmj5Dlj5blhYPmlbDmja7lkozlsLrlr7jkv6Hmga9cbiAgICAgKi9cbiAgICBwdWJsaWMgcGFyc2VTVkcoKTogdm9pZCB7XG4gICAgICAgIGlmICghdGhpcy5fc3ZnQ29udGVudCkge1xuICAgICAgICAgICAgdGhpcy53aWR0aCA9IDA7XG4gICAgICAgICAgICB0aGlzLmhlaWdodCA9IDA7XG4gICAgICAgICAgICB0aGlzLnZpZXdCb3ggPSBcIlwiO1xuICAgICAgICAgICAgdGhpcy5hc3BlY3RSYXRpbyA9IDE7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgZG9jID0gdGhpcy5wYXJzZXIucGFyc2VGcm9tU3RyaW5nKHRoaXMuX3N2Z0NvbnRlbnQsIFwiaW1hZ2Uvc3ZnK3htbFwiKTtcbiAgICAgICAgICAgIHRoaXMuc3ZnRWxlbWVudCA9IGRvYy5kb2N1bWVudEVsZW1lbnQgYXMgdW5rbm93biBhcyBTVkdTVkdFbGVtZW50O1xuXG4gICAgICAgICAgICAvLyDmo4Dmn6Xop6PmnpDplJnor69cbiAgICAgICAgICAgIGNvbnN0IHBhcnNlckVycm9yID0gZG9jLnF1ZXJ5U2VsZWN0b3IoXCJwYXJzZXJlcnJvclwiKTtcbiAgICAgICAgICAgIGlmIChwYXJzZXJFcnJvcikge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXCJTVkfop6PmnpDplJnor686XCIsIHBhcnNlckVycm9yLnRleHRDb250ZW50KTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIOaPkOWPluWwuuWvuOS/oeaBr1xuICAgICAgICAgICAgY29uc3Qgd2lkdGhBdHRyID0gdGhpcy5zdmdFbGVtZW50LmdldEF0dHJpYnV0ZShcIndpZHRoXCIpO1xuICAgICAgICAgICAgY29uc3QgaGVpZ2h0QXR0ciA9IHRoaXMuc3ZnRWxlbWVudC5nZXRBdHRyaWJ1dGUoXCJoZWlnaHRcIik7XG4gICAgICAgICAgICBjb25zdCB2aWV3Qm94QXR0ciA9IHRoaXMuc3ZnRWxlbWVudC5nZXRBdHRyaWJ1dGUoXCJ2aWV3Qm94XCIpO1xuXG4gICAgICAgICAgICB0aGlzLnZpZXdCb3ggPSB2aWV3Qm94QXR0ciB8fCBcIlwiO1xuXG4gICAgICAgICAgICBpZiAodmlld0JveEF0dHIpIHtcbiAgICAgICAgICAgICAgICBjb25zdCB2aWV3Qm94UGFydHMgPSB2aWV3Qm94QXR0ci5zcGxpdChcIiBcIikubWFwKE51bWJlcik7XG4gICAgICAgICAgICAgICAgaWYgKHZpZXdCb3hQYXJ0cy5sZW5ndGggPj0gNCkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLndpZHRoID0gdmlld0JveFBhcnRzWzJdO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmhlaWdodCA9IHZpZXdCb3hQYXJ0c1szXTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIOWmguaenHZpZXdCb3jmsqHmnInmj5DkvpvlsLrlr7jvvIzkvb/nlKh3aWR0aC9oZWlnaHTlsZ7mgKdcbiAgICAgICAgICAgIGlmICh0aGlzLndpZHRoID09PSAwICYmIHdpZHRoQXR0cikge1xuICAgICAgICAgICAgICAgIHRoaXMud2lkdGggPSB0aGlzLnBhcnNlRGltZW5zaW9uKHdpZHRoQXR0cik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAodGhpcy5oZWlnaHQgPT09IDAgJiYgaGVpZ2h0QXR0cikge1xuICAgICAgICAgICAgICAgIHRoaXMuaGVpZ2h0ID0gdGhpcy5wYXJzZURpbWVuc2lvbihoZWlnaHRBdHRyKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8g5aaC5p6c6L+Y5piv5rKh5pyJ5bC65a+477yM5L2/55So6buY6K6k5YC8XG4gICAgICAgICAgICBpZiAodGhpcy53aWR0aCA9PT0gMCkgdGhpcy53aWR0aCA9IDEwMDtcbiAgICAgICAgICAgIGlmICh0aGlzLmhlaWdodCA9PT0gMCkgdGhpcy5oZWlnaHQgPSAxMDA7XG5cbiAgICAgICAgICAgIHRoaXMuYXNwZWN0UmF0aW8gPSB0aGlzLmhlaWdodCA+IDAgPyB0aGlzLndpZHRoIC8gdGhpcy5oZWlnaHQgOiAxO1xuXG4gICAgICAgICAgICAvLyDmj5Dlj5blhYPmlbDmja5cbiAgICAgICAgICAgIHRoaXMuZXh0cmFjdE1ldGFkYXRhKCk7XG5cbiAgICAgICAgICAgIC8vIOiuoeeul+WkjeadguW6plxuICAgICAgICAgICAgdGhpcy5jYWxjdWxhdGVDb21wbGV4aXR5KCk7XG5cbiAgICAgICAgICAgIC8vIOajgOafpeaYr+WQpuWMheWQq+WKqOeUu1xuICAgICAgICAgICAgdGhpcy5jaGVja0ZvckFuaW1hdGlvbigpO1xuXG4gICAgICAgICAgICAvLyDnlJ/miJDkvJjljJbniYjmnKxcbiAgICAgICAgICAgIHRoaXMub3B0aW1pemVTVkcoKTtcblxuICAgICAgICAgICAgdGhpcy5pc0RpcnR5ID0gZmFsc2U7XG4gICAgICAgICAgICB0aGlzLmxhc3RNb2RpZmllZCA9IERhdGUubm93KCk7XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKFwi6Kej5p6QU1ZH5aSx6LSlOlwiLCBlcnJvcik7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiDpqozor4FTVkfmoLzlvI/mmK/lkKbmraPnoa5cbiAgICAgKi9cbiAgICBwdWJsaWMgdmFsaWRhdGVTVkcoKTogYm9vbGVhbiB7XG4gICAgICAgIGlmICghdGhpcy5fc3ZnQ29udGVudCkge1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IGRvYyA9IHRoaXMucGFyc2VyLnBhcnNlRnJvbVN0cmluZyh0aGlzLl9zdmdDb250ZW50LCBcImltYWdlL3N2Zyt4bWxcIik7XG4gICAgICAgICAgICBjb25zdCBwYXJzZXJFcnJvciA9IGRvYy5xdWVyeVNlbGVjdG9yKFwicGFyc2VyZXJyb3JcIik7XG4gICAgICAgICAgICByZXR1cm4gIXBhcnNlckVycm9yO1xuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICog5riy5p+T5oyH5a6a5bC65a+455qE57q555CGXG4gICAgICovXG4gICAgcHVibGljIGFzeW5jIHJlbmRlclRvVGV4dHVyZSh3aWR0aDogbnVtYmVyLCBoZWlnaHQ6IG51bWJlcik6IFByb21pc2U8VGV4dHVyZTJEPiB7XG4gICAgICAgIGNvbnN0IGNhY2hlS2V5ID0gYCR7d2lkdGh9eCR7aGVpZ2h0fV8ke3RoaXMucmVuZGVyU2NhbGV9XyR7dGhpcy5kZWZhdWx0Q29sb3J9YDtcblxuICAgICAgICAvLyDmo4Dmn6XnvJPlrZhcbiAgICAgICAgaWYgKHRoaXMuY2FjaGVkVGV4dHVyZXMuaGFzKGNhY2hlS2V5KSkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuY2FjaGVkVGV4dHVyZXMuZ2V0KGNhY2hlS2V5KSE7XG4gICAgICAgIH1cblxuICAgICAgICAvLyDliJvlu7pDYW52YXNcbiAgICAgICAgY29uc3QgY2FudmFzID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImNhbnZhc1wiKTtcbiAgICAgICAgY29uc3QgcmVuZGVyV2lkdGggPSBNYXRoLmZsb29yKHdpZHRoICogdGhpcy5yZW5kZXJTY2FsZSk7XG4gICAgICAgIGNvbnN0IHJlbmRlckhlaWdodCA9IE1hdGguZmxvb3IoaGVpZ2h0ICogdGhpcy5yZW5kZXJTY2FsZSk7XG4gICAgICAgIGNhbnZhcy53aWR0aCA9IHJlbmRlcldpZHRoO1xuICAgICAgICBjYW52YXMuaGVpZ2h0ID0gcmVuZGVySGVpZ2h0O1xuXG4gICAgICAgIGNvbnN0IGN0eCA9IGNhbnZhcy5nZXRDb250ZXh0KFwiMmRcIikhO1xuXG4gICAgICAgIC8vIOiuvue9ruaKl+mUr+m9v1xuICAgICAgICBpZiAodGhpcy5hbnRpYWxpYXMpIHtcbiAgICAgICAgICAgIGN0eC5pbWFnZVNtb290aGluZ0VuYWJsZWQgPSB0cnVlO1xuICAgICAgICAgICAgY3R4LmltYWdlU21vb3RoaW5nUXVhbGl0eSA9IFwiaGlnaFwiO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8g5YeG5aSHU1ZH5a2X56ym5LiyXG4gICAgICAgIGxldCBzdmdUb1JlbmRlciA9IHRoaXMub3B0aW1pemVkU1ZHIHx8IHRoaXMuX3N2Z0NvbnRlbnQ7XG5cbiAgICAgICAgLy8g5bqU55So6aKc6Imy6KaG55uWXG4gICAgICAgIGlmICh0aGlzLmRlZmF1bHRDb2xvciAhPT0gXCIjZmZmZmZmXCIpIHtcbiAgICAgICAgICAgIHN2Z1RvUmVuZGVyID0gdGhpcy5hcHBseUNvbG9yT3ZlcnJpZGUoc3ZnVG9SZW5kZXIsIHRoaXMuZGVmYXVsdENvbG9yKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIOiuvue9rlNWR+WwuuWvuFxuICAgICAgICBzdmdUb1JlbmRlciA9IHRoaXMuc2V0U1ZHRGltZW5zaW9ucyhzdmdUb1JlbmRlciwgd2lkdGgsIGhlaWdodCk7XG5cbiAgICAgICAgLy8g5riy5p+TU1ZH5YiwQ2FudmFzXG4gICAgICAgIGF3YWl0IHRoaXMucmVuZGVyU1ZHVG9DYW52YXMoc3ZnVG9SZW5kZXIsIGNhbnZhcyk7XG5cbiAgICAgICAgLy8g5Yib5bu6SW1hZ2VBc3NldOWSjFRleHR1cmUyRFxuICAgICAgICBjb25zdCBpbWFnZUFzc2V0ID0gbmV3IEltYWdlQXNzZXQoY2FudmFzKTtcbiAgICAgICAgY29uc3QgdGV4dHVyZSA9IG5ldyBUZXh0dXJlMkQoKTtcbiAgICAgICAgdGV4dHVyZS5pbWFnZSA9IGltYWdlQXNzZXQ7XG5cbiAgICAgICAgLy8g57yT5a2Y57q555CGXG4gICAgICAgIHRoaXMuY2FjaGVkVGV4dHVyZXMuc2V0KGNhY2hlS2V5LCB0ZXh0dXJlKTtcbiAgICAgICAgdGhpcy5sYXN0UmVuZGVyZWRTaXplID0geyB3aWR0aCwgaGVpZ2h0IH07XG5cbiAgICAgICAgcmV0dXJuIHRleHR1cmU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICog55Sf5oiQ57yp55Wl5Zu+6aKE6KeIXG4gICAgICovXG4gICAgcHVibGljIGFzeW5jIGdlbmVyYXRlUHJldmlldygpOiBQcm9taXNlPEltYWdlQXNzZXQ+IHtcbiAgICAgICAgaWYgKHRoaXMucHJldmlld0Fzc2V0KSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5wcmV2aWV3QXNzZXQ7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBjYW52YXMgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiY2FudmFzXCIpO1xuICAgICAgICBjYW52YXMud2lkdGggPSA2NDtcbiAgICAgICAgY2FudmFzLmhlaWdodCA9IDY0O1xuXG4gICAgICAgIGNvbnN0IGN0eCA9IGNhbnZhcy5nZXRDb250ZXh0KFwiMmRcIikhO1xuICAgICAgICBjdHguZmlsbFN0eWxlID0gXCIjZjBmMGYwXCI7XG4gICAgICAgIGN0eC5maWxsUmVjdCgwLCAwLCA2NCwgNjQpO1xuXG4gICAgICAgIGlmICh0aGlzLl9zdmdDb250ZW50KSB7XG4gICAgICAgICAgICAvLyDlh4blpIdTVkflrZfnrKbkuLJcbiAgICAgICAgICAgIGxldCBzdmdUb1JlbmRlciA9IHRoaXMub3B0aW1pemVkU1ZHIHx8IHRoaXMuX3N2Z0NvbnRlbnQ7XG5cbiAgICAgICAgICAgIC8vIOiuoeeul+mAguWQiOmihOiniOeahOWwuuWvuFxuICAgICAgICAgICAgY29uc3QgcHJldmlld1NpemUgPSB0aGlzLnNjYWxlVG9GaXQoNjQsIDY0KTtcbiAgICAgICAgICAgIGNvbnN0IHggPSAoNjQgLSBwcmV2aWV3U2l6ZS53aWR0aCkgLyAyO1xuICAgICAgICAgICAgY29uc3QgeSA9ICg2NCAtIHByZXZpZXdTaXplLmhlaWdodCkgLyAyO1xuXG4gICAgICAgICAgICAvLyDorr7nva5TVkflsLrlr7hcbiAgICAgICAgICAgIHN2Z1RvUmVuZGVyID0gdGhpcy5zZXRTVkdEaW1lbnNpb25zKHN2Z1RvUmVuZGVyLCBwcmV2aWV3U2l6ZS53aWR0aCwgcHJldmlld1NpemUuaGVpZ2h0KTtcblxuICAgICAgICAgICAgLy8g5riy5p+TU1ZH5YiwQ2FudmFzXG4gICAgICAgICAgICBjb25zdCB0ZW1wQ2FudmFzID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImNhbnZhc1wiKTtcbiAgICAgICAgICAgIHRlbXBDYW52YXMud2lkdGggPSBwcmV2aWV3U2l6ZS53aWR0aDtcbiAgICAgICAgICAgIHRlbXBDYW52YXMuaGVpZ2h0ID0gcHJldmlld1NpemUuaGVpZ2h0O1xuXG4gICAgICAgICAgICBhd2FpdCB0aGlzLnJlbmRlclNWR1RvQ2FudmFzKHN2Z1RvUmVuZGVyLCB0ZW1wQ2FudmFzKTtcblxuICAgICAgICAgICAgLy8g57uY5Yi25Yiw6aKE6KeIQ2FudmFzXG4gICAgICAgICAgICBjdHguZHJhd0ltYWdlKHRlbXBDYW52YXMsIHgsIHksIHByZXZpZXdTaXplLndpZHRoLCBwcmV2aWV3U2l6ZS5oZWlnaHQpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5wcmV2aWV3QXNzZXQgPSBuZXcgSW1hZ2VBc3NldChjYW52YXMpO1xuICAgICAgICByZXR1cm4gdGhpcy5wcmV2aWV3QXNzZXQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICog5LyY5YyWU1ZHXG4gICAgICovXG4gICAgcHVibGljIG9wdGltaXplKCk6IHZvaWQge1xuICAgICAgICB0aGlzLm9wdGltaXplU1ZHKCk7XG4gICAgICAgIHRoaXMuaXNEaXJ0eSA9IHRydWU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICog5om56YeP5L+u5pS55aGr5YWF6aKc6ImyXG4gICAgICovXG4gICAgcHVibGljIGNoYW5nZUNvbG9yKG5ld0NvbG9yOiBzdHJpbmcpOiB2b2lkIHtcbiAgICAgICAgdGhpcy5kZWZhdWx0Q29sb3IgPSBuZXdDb2xvcjtcbiAgICAgICAgdGhpcy5pc0RpcnR5ID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5jYWNoZWRUZXh0dXJlcy5jbGVhcigpOyAvLyDmuIXpmaTnvJPlrZjvvIzlm6DkuLrpopzoibLmlLnlj5jkuoZcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiDmj5Dlj5bmiYDmnInot6/lvoTmlbDmja5cbiAgICAgKi9cbiAgICBwdWJsaWMgZXh0cmFjdFBhdGhzKCk6IHN0cmluZ1tdIHtcbiAgICAgICAgaWYgKCF0aGlzLnN2Z0VsZW1lbnQpIHtcbiAgICAgICAgICAgIHJldHVybiBbXTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHBhdGhzOiBzdHJpbmdbXSA9IFtdO1xuICAgICAgICBjb25zdCBwYXRoRWxlbWVudHMgPSB0aGlzLnN2Z0VsZW1lbnQucXVlcnlTZWxlY3RvckFsbChcInBhdGhcIik7XG5cbiAgICAgICAgcGF0aEVsZW1lbnRzLmZvckVhY2goKHBhdGgpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IGQgPSBwYXRoLmdldEF0dHJpYnV0ZShcImRcIik7XG4gICAgICAgICAgICBpZiAoZCkge1xuICAgICAgICAgICAgICAgIHBhdGhzLnB1c2goZCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHJldHVybiBwYXRocztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiDorqHnrpfpgILlkIjnmoTlsLrlr7hcbiAgICAgKi9cbiAgICBwdWJsaWMgc2NhbGVUb0ZpdChtYXhXaWR0aDogbnVtYmVyLCBtYXhIZWlnaHQ6IG51bWJlcik6IHsgd2lkdGg6IG51bWJlcjsgaGVpZ2h0OiBudW1iZXIgfSB7XG4gICAgICAgIGlmICh0aGlzLndpZHRoID09PSAwIHx8IHRoaXMuaGVpZ2h0ID09PSAwKSB7XG4gICAgICAgICAgICByZXR1cm4geyB3aWR0aDogbWF4V2lkdGgsIGhlaWdodDogbWF4SGVpZ2h0IH07XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCB3aWR0aFJhdGlvID0gbWF4V2lkdGggLyB0aGlzLndpZHRoO1xuICAgICAgICBjb25zdCBoZWlnaHRSYXRpbyA9IG1heEhlaWdodCAvIHRoaXMuaGVpZ2h0O1xuICAgICAgICBjb25zdCBzY2FsZSA9IE1hdGgubWluKHdpZHRoUmF0aW8sIGhlaWdodFJhdGlvKTtcblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgd2lkdGg6IE1hdGguZmxvb3IodGhpcy53aWR0aCAqIHNjYWxlKSxcbiAgICAgICAgICAgIGhlaWdodDogTWF0aC5mbG9vcih0aGlzLmhlaWdodCAqIHNjYWxlKSxcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiDluo/liJfljJbkuLpKU09OXG4gICAgICovXG4gICAgcHVibGljIHNlcmlhbGl6ZSgpOiBhbnkge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgc3ZnQ29udGVudDogdGhpcy5fc3ZnQ29udGVudCxcbiAgICAgICAgICAgIHdpZHRoOiB0aGlzLndpZHRoLFxuICAgICAgICAgICAgaGVpZ2h0OiB0aGlzLmhlaWdodCxcbiAgICAgICAgICAgIHZpZXdCb3g6IHRoaXMudmlld0JveCxcbiAgICAgICAgICAgIGRlZmF1bHRDb2xvcjogdGhpcy5kZWZhdWx0Q29sb3IsXG4gICAgICAgICAgICByZW5kZXJTY2FsZTogdGhpcy5yZW5kZXJTY2FsZSxcbiAgICAgICAgICAgIGFudGlhbGlhczogdGhpcy5hbnRpYWxpYXMsXG4gICAgICAgICAgICB0aXRsZTogdGhpcy50aXRsZSxcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiB0aGlzLmRlc2NyaXB0aW9uLFxuICAgICAgICAgICAga2V5d29yZHM6IHRoaXMua2V5d29yZHMsXG4gICAgICAgICAgICBhdXRob3I6IHRoaXMuYXV0aG9yLFxuICAgICAgICAgICAgbGljZW5zZTogdGhpcy5saWNlbnNlLFxuICAgICAgICAgICAgbGFzdE1vZGlmaWVkOiB0aGlzLmxhc3RNb2RpZmllZCxcbiAgICAgICAgICAgIHNvdXJjZUZpbGU6IHRoaXMuc291cmNlRmlsZSxcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiDku45KU09O5Y+N5bqP5YiX5YyWXG4gICAgICovXG4gICAgcHVibGljIGRlc2VyaWFsaXplKGRhdGE6IGFueSk6IHZvaWQge1xuICAgICAgICB0aGlzLl9zdmdDb250ZW50ID0gZGF0YS5zdmdDb250ZW50IHx8IFwiXCI7XG4gICAgICAgIHRoaXMud2lkdGggPSBkYXRhLndpZHRoIHx8IDA7XG4gICAgICAgIHRoaXMuaGVpZ2h0ID0gZGF0YS5oZWlnaHQgfHwgMDtcbiAgICAgICAgdGhpcy52aWV3Qm94ID0gZGF0YS52aWV3Qm94IHx8IFwiXCI7XG4gICAgICAgIHRoaXMuZGVmYXVsdENvbG9yID0gZGF0YS5kZWZhdWx0Q29sb3IgfHwgXCIjZmZmZmZmXCI7XG4gICAgICAgIHRoaXMucmVuZGVyU2NhbGUgPSBkYXRhLnJlbmRlclNjYWxlIHx8IDE7XG4gICAgICAgIHRoaXMuYW50aWFsaWFzID0gZGF0YS5hbnRpYWxpYXMgIT09IHVuZGVmaW5lZCA/IGRhdGEuYW50aWFsaWFzIDogdHJ1ZTtcbiAgICAgICAgdGhpcy50aXRsZSA9IGRhdGEudGl0bGUgfHwgXCJcIjtcbiAgICAgICAgdGhpcy5kZXNjcmlwdGlvbiA9IGRhdGEuZGVzY3JpcHRpb24gfHwgXCJcIjtcbiAgICAgICAgdGhpcy5rZXl3b3JkcyA9IGRhdGEua2V5d29yZHMgfHwgW107XG4gICAgICAgIHRoaXMuYXV0aG9yID0gZGF0YS5hdXRob3IgfHwgXCJcIjtcbiAgICAgICAgdGhpcy5saWNlbnNlID0gZGF0YS5saWNlbnNlIHx8IFwiXCI7XG4gICAgICAgIHRoaXMubGFzdE1vZGlmaWVkID0gZGF0YS5sYXN0TW9kaWZpZWQgfHwgRGF0ZS5ub3coKTtcbiAgICAgICAgdGhpcy5zb3VyY2VGaWxlID0gZGF0YS5zb3VyY2VGaWxlIHx8IFwiXCI7XG5cbiAgICAgICAgdGhpcy5wYXJzZVNWRygpO1xuICAgIH1cblxuICAgIC8vID09PT09PT09PT0g56eB5pyJ5pa55rOVID09PT09PT09PT1cblxuICAgIHByaXZhdGUgcGFyc2VEaW1lbnNpb24oZGltOiBzdHJpbmcpOiBudW1iZXIge1xuICAgICAgICAvLyDnp7vpmaTljZXkvY3vvIhweCwgcHQsIGVt562J77yJXG4gICAgICAgIGNvbnN0IG51bSA9IHBhcnNlRmxvYXQoZGltKTtcbiAgICAgICAgcmV0dXJuIGlzTmFOKG51bSkgPyAwIDogbnVtO1xuICAgIH1cblxuICAgIHByaXZhdGUgZXh0cmFjdE1ldGFkYXRhKCk6IHZvaWQge1xuICAgICAgICBpZiAoIXRoaXMuc3ZnRWxlbWVudCkgcmV0dXJuO1xuXG4gICAgICAgIC8vIOaPkOWPljx0aXRsZT5cbiAgICAgICAgY29uc3QgdGl0bGVFbGVtZW50ID0gdGhpcy5zdmdFbGVtZW50LnF1ZXJ5U2VsZWN0b3IoXCJ0aXRsZVwiKTtcbiAgICAgICAgdGhpcy50aXRsZSA9IHRpdGxlRWxlbWVudCA/IHRpdGxlRWxlbWVudC50ZXh0Q29udGVudCB8fCBcIlwiIDogXCJcIjtcblxuICAgICAgICAvLyDmj5Dlj5Y8ZGVzYz5cbiAgICAgICAgY29uc3QgZGVzY0VsZW1lbnQgPSB0aGlzLnN2Z0VsZW1lbnQucXVlcnlTZWxlY3RvcihcImRlc2NcIik7XG4gICAgICAgIHRoaXMuZGVzY3JpcHRpb24gPSBkZXNjRWxlbWVudCA/IGRlc2NFbGVtZW50LnRleHRDb250ZW50IHx8IFwiXCIgOiBcIlwiO1xuXG4gICAgICAgIC8vIOaPkOWPlm1ldGFkYXRhXG4gICAgICAgIGNvbnN0IG1ldGFkYXRhRWxlbWVudCA9IHRoaXMuc3ZnRWxlbWVudC5xdWVyeVNlbGVjdG9yKFwibWV0YWRhdGFcIik7XG4gICAgICAgIGlmIChtZXRhZGF0YUVsZW1lbnQpIHtcbiAgICAgICAgICAgIC8vIOi/memHjOWPr+S7peino+aekOabtOWkjeadgueahOWFg+aVsOaNrlxuICAgICAgICAgICAgY29uc3QgdGV4dCA9IG1ldGFkYXRhRWxlbWVudC50ZXh0Q29udGVudCB8fCBcIlwiO1xuICAgICAgICAgICAgaWYgKHRleHQuaW5jbHVkZXMoXCJhdXRob3I6XCIpKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5hdXRob3IgPSB0ZXh0LnNwbGl0KFwiYXV0aG9yOlwiKVsxXS5zcGxpdChcIlxcblwiKVswXS50cmltKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAodGV4dC5pbmNsdWRlcyhcImxpY2Vuc2U6XCIpKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5saWNlbnNlID0gdGV4dC5zcGxpdChcImxpY2Vuc2U6XCIpWzFdLnNwbGl0KFwiXFxuXCIpWzBdLnRyaW0oKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgY2FsY3VsYXRlQ29tcGxleGl0eSgpOiB2b2lkIHtcbiAgICAgICAgaWYgKCF0aGlzLnN2Z0VsZW1lbnQpIHtcbiAgICAgICAgICAgIHRoaXMuY29tcGxleGl0eVNjb3JlID0gMDtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGxldCBzY29yZSA9IDA7XG5cbiAgICAgICAgLy8g6K6h566X6Lev5b6E5pWw6YePXG4gICAgICAgIGNvbnN0IHBhdGhzID0gdGhpcy5zdmdFbGVtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoXCJwYXRoXCIpO1xuICAgICAgICBzY29yZSArPSBwYXRocy5sZW5ndGggKiAxMDtcblxuICAgICAgICAvLyDorqHnrpflhbbku5blm77lvaLlhYPntKBcbiAgICAgICAgY29uc3QgY2lyY2xlcyA9IHRoaXMuc3ZnRWxlbWVudC5xdWVyeVNlbGVjdG9yQWxsKFwiY2lyY2xlLCBlbGxpcHNlXCIpO1xuICAgICAgICBzY29yZSArPSBjaXJjbGVzLmxlbmd0aCAqIDU7XG5cbiAgICAgICAgY29uc3QgcmVjdHMgPSB0aGlzLnN2Z0VsZW1lbnQucXVlcnlTZWxlY3RvckFsbChcInJlY3RcIik7XG4gICAgICAgIHNjb3JlICs9IHJlY3RzLmxlbmd0aCAqIDM7XG5cbiAgICAgICAgY29uc3QgbGluZXMgPSB0aGlzLnN2Z0VsZW1lbnQucXVlcnlTZWxlY3RvckFsbChcImxpbmUsIHBvbHlsaW5lLCBwb2x5Z29uXCIpO1xuICAgICAgICBzY29yZSArPSBsaW5lcy5sZW5ndGggKiAyO1xuXG4gICAgICAgIC8vIOiuoeeul+aWh+acrOWFg+e0oFxuICAgICAgICBjb25zdCB0ZXh0cyA9IHRoaXMuc3ZnRWxlbWVudC5xdWVyeVNlbGVjdG9yQWxsKFwidGV4dFwiKTtcbiAgICAgICAgc2NvcmUgKz0gdGV4dHMubGVuZ3RoICogODtcblxuICAgICAgICAvLyDorqHnrpfliIbnu4Tlkozlj5jmjaJcbiAgICAgICAgY29uc3QgZ3JvdXBzID0gdGhpcy5zdmdFbGVtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoXCJnXCIpO1xuICAgICAgICBzY29yZSArPSBncm91cHMubGVuZ3RoICogMTtcblxuICAgICAgICB0aGlzLmNvbXBsZXhpdHlTY29yZSA9IHNjb3JlO1xuICAgIH1cblxuICAgIHByaXZhdGUgY2hlY2tGb3JBbmltYXRpb24oKTogdm9pZCB7XG4gICAgICAgIGlmICghdGhpcy5zdmdFbGVtZW50KSB7XG4gICAgICAgICAgICB0aGlzLmlzQW5pbWF0ZWQgPSBmYWxzZTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGhhc0FuaW1hdGlvbiA9IHRoaXMuc3ZnRWxlbWVudC5xdWVyeVNlbGVjdG9yKFwiYW5pbWF0ZSwgYW5pbWF0ZVRyYW5zZm9ybSwgYW5pbWF0ZU1vdGlvbiwgc2V0XCIpO1xuICAgICAgICB0aGlzLmlzQW5pbWF0ZWQgPSAhIWhhc0FuaW1hdGlvbjtcbiAgICB9XG5cbiAgICBwcml2YXRlIG9wdGltaXplU1ZHKCk6IHZvaWQge1xuICAgICAgICBpZiAoIXRoaXMuc3ZnRWxlbWVudCkge1xuICAgICAgICAgICAgdGhpcy5vcHRpbWl6ZWRTVkcgPSB0aGlzLl9zdmdDb250ZW50O1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8g5YWL6ZqG5YWD57Sg6L+b6KGM5LyY5YyWXG4gICAgICAgIGNvbnN0IG9wdGltaXplZEVsZW1lbnQgPSB0aGlzLnN2Z0VsZW1lbnQuY2xvbmVOb2RlKHRydWUpIGFzIFNWR1NWR0VsZW1lbnQ7XG5cbiAgICAgICAgLy8g56e76Zmk5rOo6YeKXG4gICAgICAgIHRoaXMucmVtb3ZlQ29tbWVudHMob3B0aW1pemVkRWxlbWVudCk7XG5cbiAgICAgICAgLy8g56e76Zmk56m65YWD57SgXG4gICAgICAgIHRoaXMucmVtb3ZlRW1wdHlFbGVtZW50cyhvcHRpbWl6ZWRFbGVtZW50KTtcblxuICAgICAgICAvLyDljovnvKnnqbrnmb1cbiAgICAgICAgdGhpcy5jb21wcmVzc1doaXRlc3BhY2Uob3B0aW1pemVkRWxlbWVudCk7XG5cbiAgICAgICAgLy8g5bqP5YiX5YyW5Zue5a2X56ym5LiyXG4gICAgICAgIGNvbnN0IHNlcmlhbGl6ZXIgPSBuZXcgWE1MU2VyaWFsaXplcigpO1xuICAgICAgICB0aGlzLm9wdGltaXplZFNWRyA9IHNlcmlhbGl6ZXIuc2VyaWFsaXplVG9TdHJpbmcob3B0aW1pemVkRWxlbWVudCk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSByZW1vdmVDb21tZW50cyhlbGVtZW50OiBFbGVtZW50KTogdm9pZCB7XG4gICAgICAgIGNvbnN0IHdhbGtlciA9IGRvY3VtZW50LmNyZWF0ZVRyZWVXYWxrZXIoZWxlbWVudCwgTm9kZUZpbHRlci5TSE9XX0NPTU1FTlQsIG51bGwpO1xuXG4gICAgICAgIGNvbnN0IGNvbW1lbnRzOiBDb21tZW50W10gPSBbXTtcbiAgICAgICAgbGV0IG5vZGU6IE5vZGUgfCBudWxsO1xuICAgICAgICB3aGlsZSAoKG5vZGUgPSB3YWxrZXIubmV4dE5vZGUoKSkpIHtcbiAgICAgICAgICAgIGNvbW1lbnRzLnB1c2gobm9kZSBhcyBDb21tZW50KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbW1lbnRzLmZvckVhY2goKGNvbW1lbnQpID0+IGNvbW1lbnQucmVtb3ZlKCkpO1xuICAgIH1cblxuICAgIHByaXZhdGUgcmVtb3ZlRW1wdHlFbGVtZW50cyhlbGVtZW50OiBFbGVtZW50KTogdm9pZCB7XG4gICAgICAgIGNvbnN0IGVtcHR5RWxlbWVudHMgPSBBcnJheS5mcm9tKGVsZW1lbnQucXVlcnlTZWxlY3RvckFsbChcIipcIikpLmZpbHRlcigoZWwpID0+IHtcbiAgICAgICAgICAgIHJldHVybiAhZWwuaGFzQ2hpbGROb2RlcygpICYmICFlbC5nZXRBdHRyaWJ1dGUoXCJkXCIpICYmICFlbC5nZXRBdHRyaWJ1dGUoXCJwb2ludHNcIik7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGVtcHR5RWxlbWVudHMuZm9yRWFjaCgoZWwpID0+IGVsLnJlbW92ZSgpKTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGNvbXByZXNzV2hpdGVzcGFjZShlbGVtZW50OiBFbGVtZW50KTogdm9pZCB7XG4gICAgICAgIGNvbnN0IHdhbGtlciA9IGRvY3VtZW50LmNyZWF0ZVRyZWVXYWxrZXIoZWxlbWVudCwgTm9kZUZpbHRlci5TSE9XX1RFWFQsIG51bGwpO1xuXG4gICAgICAgIGxldCBub2RlOiBOb2RlIHwgbnVsbDtcbiAgICAgICAgd2hpbGUgKChub2RlID0gd2Fsa2VyLm5leHROb2RlKCkpKSB7XG4gICAgICAgICAgICBjb25zdCB0ZXh0Tm9kZSA9IG5vZGUgYXMgVGV4dDtcbiAgICAgICAgICAgIHRleHROb2RlLnRleHRDb250ZW50ID0gdGV4dE5vZGUudGV4dENvbnRlbnQ/LnJlcGxhY2UoL1xccysvZywgXCIgXCIpLnRyaW0oKSB8fCBcIlwiO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhcHBseUNvbG9yT3ZlcnJpZGUoc3ZnU3RyaW5nOiBzdHJpbmcsIGNvbG9yOiBzdHJpbmcpOiBzdHJpbmcge1xuICAgICAgICAvLyDnroDljZXnmoTpopzoibLmm7/mjaLvvJrlsIbmiYDmnIlmaWxs5bGe5oCn77yI6Zmk5LqGXCJub25lXCLvvInmm7/mjaLkuLrmjIflrprpopzoibJcbiAgICAgICAgcmV0dXJuIHN2Z1N0cmluZy5yZXBsYWNlKC9maWxsPVwiKFteXCJdKilcIi9nLCAobWF0Y2gsIGZpbGxWYWx1ZSkgPT4ge1xuICAgICAgICAgICAgaWYgKGZpbGxWYWx1ZSA9PT0gXCJub25lXCIgfHwgZmlsbFZhbHVlID09PSBcInRyYW5zcGFyZW50XCIpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gbWF0Y2g7IC8vIOS/neaMgemAj+aYjuWhq+WFheS4jeWPmFxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIGBmaWxsPVwiJHtjb2xvcn1cImA7XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIHByaXZhdGUgc2V0U1ZHRGltZW5zaW9ucyhzdmdTdHJpbmc6IHN0cmluZywgd2lkdGg6IG51bWJlciwgaGVpZ2h0OiBudW1iZXIpOiBzdHJpbmcge1xuICAgICAgICAvLyDmt7vliqDmiJbmm7TmlrB3aWR0aOWSjGhlaWdodOWxnuaAp1xuICAgICAgICBsZXQgcmVzdWx0ID0gc3ZnU3RyaW5nO1xuXG4gICAgICAgIC8vIOabtOaWsHdpZHRo5bGe5oCnXG4gICAgICAgIGlmIChyZXN1bHQuaW5jbHVkZXMoJ3dpZHRoPVwiJykpIHtcbiAgICAgICAgICAgIHJlc3VsdCA9IHJlc3VsdC5yZXBsYWNlKC93aWR0aD1cIlteXCJdKlwiLywgYHdpZHRoPVwiJHt3aWR0aH1cImApO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmVzdWx0ID0gcmVzdWx0LnJlcGxhY2UoLzxzdmcvLCBgPHN2ZyB3aWR0aD1cIiR7d2lkdGh9XCJgKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIOabtOaWsGhlaWdodOWxnuaAp1xuICAgICAgICBpZiAocmVzdWx0LmluY2x1ZGVzKCdoZWlnaHQ9XCInKSkge1xuICAgICAgICAgICAgcmVzdWx0ID0gcmVzdWx0LnJlcGxhY2UoL2hlaWdodD1cIlteXCJdKlwiLywgYGhlaWdodD1cIiR7aGVpZ2h0fVwiYCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXN1bHQgPSByZXN1bHQucmVwbGFjZSgvPHN2Zy8sIGA8c3ZnIGhlaWdodD1cIiR7aGVpZ2h0fVwiYCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyDmt7vliqBwcmVzZXJ2ZUFzcGVjdFJhdGlvXG4gICAgICAgIGlmICghcmVzdWx0LmluY2x1ZGVzKCdwcmVzZXJ2ZUFzcGVjdFJhdGlvPVwiJykpIHtcbiAgICAgICAgICAgIHJlc3VsdCA9IHJlc3VsdC5yZXBsYWNlKC88c3ZnLywgYDxzdmcgcHJlc2VydmVBc3BlY3RSYXRpbz1cIiR7dGhpcy5wcmVzZXJ2ZUFzcGVjdFJhdGlvfVwiYCk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH1cblxuICAgIHByaXZhdGUgcmVuZGVyU1ZHVG9DYW52YXMoc3ZnU3RyaW5nOiBzdHJpbmcsIGNhbnZhczogSFRNTENhbnZhc0VsZW1lbnQpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IGN0eCA9IGNhbnZhcy5nZXRDb250ZXh0KFwiMmRcIikhO1xuXG4gICAgICAgICAgICAvLyDliJvlu7pCbG9i5ZKMVVJMXG4gICAgICAgICAgICBjb25zdCBibG9iID0gbmV3IEJsb2IoW3N2Z1N0cmluZ10sIHsgdHlwZTogXCJpbWFnZS9zdmcreG1sXCIgfSk7XG4gICAgICAgICAgICBjb25zdCB1cmwgPSBVUkwuY3JlYXRlT2JqZWN0VVJMKGJsb2IpO1xuXG4gICAgICAgICAgICBjb25zdCBpbWcgPSBuZXcgSW1hZ2UoKTtcbiAgICAgICAgICAgIGltZy5vbmxvYWQgPSAoKSA9PiB7XG4gICAgICAgICAgICAgICAgLy8g5riF56m655S75biDXG4gICAgICAgICAgICAgICAgY3R4LmNsZWFyUmVjdCgwLCAwLCBjYW52YXMud2lkdGgsIGNhbnZhcy5oZWlnaHQpO1xuXG4gICAgICAgICAgICAgICAgLy8g57uY5Yi2U1ZHXG4gICAgICAgICAgICAgICAgY3R4LmRyYXdJbWFnZShpbWcsIDAsIDAsIGNhbnZhcy53aWR0aCwgY2FudmFzLmhlaWdodCk7XG5cbiAgICAgICAgICAgICAgICAvLyDmuIXnkIZVUkxcbiAgICAgICAgICAgICAgICBVUkwucmV2b2tlT2JqZWN0VVJMKHVybCk7XG4gICAgICAgICAgICAgICAgcmVzb2x2ZSgpO1xuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgaW1nLm9uZXJyb3IgPSAoZXJyb3IpID0+IHtcbiAgICAgICAgICAgICAgICBVUkwucmV2b2tlT2JqZWN0VVJMKHVybCk7XG4gICAgICAgICAgICAgICAgcmVqZWN0KG5ldyBFcnJvcihgU1ZH5riy5p+T5aSx6LSlOiAke2Vycm9yfWApKTtcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIGltZy5zcmMgPSB1cmw7XG4gICAgICAgIH0pO1xuICAgIH1cbn1cbiJdfQ==