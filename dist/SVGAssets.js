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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiU1ZHQXNzZXRzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vc291cmNlL1NWR0Fzc2V0cy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7QUFBQSwyQkFBOEQ7QUFDOUQsTUFBTSxFQUFFLE9BQU8sRUFBRSxRQUFRLEVBQUUsR0FBRyxlQUFVLENBQUM7QUFHbEMsSUFBTSxRQUFRLEdBQWQsTUFBTSxRQUFTLFNBQVEsVUFBSztJQU0vQixJQUFXLFVBQVU7UUFDakIsT0FBTyxJQUFJLENBQUMsV0FBVyxDQUFDO0lBQzVCLENBQUM7SUFFRCxJQUFXLFVBQVUsQ0FBQyxLQUFhO1FBQy9CLElBQUksSUFBSSxDQUFDLFdBQVcsS0FBSyxLQUFLLEVBQUUsQ0FBQztZQUM3QixJQUFJLENBQUMsV0FBVyxHQUFHLEtBQUssQ0FBQztZQUN6QixJQUFJLENBQUMsUUFBUSxFQUFFLENBQUM7WUFDaEIsSUFBSSxDQUFDLE9BQU8sR0FBRyxJQUFJLENBQUM7UUFDeEIsQ0FBQztJQUNMLENBQUM7SUF3RUQ7O09BRUc7SUFDSDtRQUNJLEtBQUssRUFBRSxDQUFDO1FBM0ZaLFVBQVU7UUFFRixnQkFBVyxHQUFXLEVBQUUsQ0FBQztRQWdCMUIsVUFBSyxHQUFXLENBQUMsQ0FBQztRQUdsQixXQUFNLEdBQVcsQ0FBQyxDQUFDO1FBR25CLFlBQU8sR0FBVyxFQUFFLENBQUM7UUFHckIsZ0JBQVcsR0FBVyxDQUFDLENBQUM7UUFFL0IsU0FBUztRQUVGLGlCQUFZLEdBQVcsU0FBUyxDQUFDO1FBR2pDLGdCQUFXLEdBQVcsQ0FBQyxDQUFDO1FBR3hCLGNBQVMsR0FBWSxJQUFJLENBQUM7UUFHMUIsd0JBQW1CLEdBQVcsZUFBZSxDQUFDO1FBRXJELFNBQVM7UUFDRCxtQkFBYyxHQUEyQixJQUFJLEdBQUcsRUFBRSxDQUFDO1FBQ25ELGlCQUFZLEdBQXNCLElBQUksQ0FBQztRQUN2QyxxQkFBZ0IsR0FBc0MsRUFBRSxLQUFLLEVBQUUsQ0FBQyxFQUFFLE1BQU0s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Q0FDc0I7bUJBbEZ0QixRQUFRO0lBRHBCLE9BQU8sQ0FBQyxVQUFVLENBQUM7R0FDUCxRQUFRLENBNGpCcEIiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBfZGVjb3JhdG9yLCBBc3NldCwgSW1hZ2VBc3NldCwgVGV4dHVyZTJEIH0gZnJvbSBcImNjXCI7XHJcbmNvbnN0IHsgY2NjbGFzcywgcHJvcGVydHkgfSA9IF9kZWNvcmF0b3I7XHJcblxyXG5AY2NjbGFzcyhcIlNWR0Fzc2V0XCIpXHJcbmV4cG9ydCBjbGFzcyBTVkdBc3NldCBleHRlbmRzIEFzc2V0IHtcclxuICAgIC8vIOWfuuehgFNWR+WxnuaAp1xyXG4gICAgQHByb3BlcnR5XHJcbiAgICBwcml2YXRlIF9zdmdDb250ZW50OiBzdHJpbmcgPSBcIlwiO1xyXG5cclxuICAgIEBwcm9wZXJ0eVxyXG4gICAgcHVibGljIGdldCBzdmdDb250ZW50KCk6IHN0cmluZyB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuX3N2Z0NvbnRlbnQ7XHJcbiAgICB9XHJcblxyXG4gICAgcHVibGljIHNldCBzdmdDb250ZW50KHZhbHVlOiBzdHJpbmcpIHtcclxuICAgICAgICBpZiAodGhpcy5fc3ZnQ29udGVudCAhPT0gdmFsdWUpIHtcclxuICAgICAgICAgICAgdGhpcy5fc3ZnQ29udGVudCA9IHZhbHVlO1xyXG4gICAgICAgICAgICB0aGlzLnBhcnNlU1ZHKCk7XHJcbiAgICAgICAgICAgIHRoaXMuaXNEaXJ0eSA9IHRydWU7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIEBwcm9wZXJ0eVxyXG4gICAgcHVibGljIHdpZHRoOiBudW1iZXIgPSAwO1xyXG5cclxuICAgIEBwcm9wZXJ0eVxyXG4gICAgcHVibGljIGhlaWdodDogbnVtYmVyID0gMDtcclxuXHJcbiAgICBAcHJvcGVydHlcclxuICAgIHB1YmxpYyB2aWV3Qm94OiBzdHJpbmcgPSBcIlwiO1xyXG5cclxuICAgIEBwcm9wZXJ0eVxyXG4gICAgcHVibGljIGFzcGVjdFJhdGlvOiBudW1iZXIgPSAxO1xyXG5cclxuICAgIC8vIOa4suafk+mFjee9ruWxnuaAp1xyXG4gICAgQHByb3BlcnR5XHJcbiAgICBwdWJsaWMgZGVmYXVsdENvbG9yOiBzdHJpbmcgPSBcIiNmZmZmZmZcIjtcclxuXHJcbiAgICBAcHJvcGVydHlcclxuICAgIHB1YmxpYyByZW5kZXJTY2FsZTogbnVtYmVyID0gMTtcclxuXHJcbiAgICBAcHJvcGVydHlcclxuICAgIHB1YmxpYyBhbnRpYWxpYXM6IGJvb2xlYW4gPSB0cnVlO1xyXG5cclxuICAgIEBwcm9wZXJ0eVxyXG4gICAgcHVibGljIHByZXNlcnZlQXNwZWN0UmF0aW86IHN0cmluZyA9IFwieE1pZFlNaWQgbWVldFwiO1xyXG5cclxuICAgIC8vIOi1hOa6kOeuoeeQhuWxnuaAp1xyXG4gICAgcHJpdmF0ZSBjYWNoZWRUZXh0dXJlczogTWFwPHN0cmluZywgVGV4dHVyZTJEPiA9IG5ldyBNYXAoKTtcclxuICAgIHByaXZhdGUgcHJldmlld0Fzc2V0OiBJbWFnZUFzc2V0IHwgbnVsbCA9IG51bGw7XHJcbiAgICBwcml2YXRlIGxhc3RSZW5kZXJlZFNpemU6IHsgd2lkdGg6IG51bWJlcjsgaGVpZ2h0OiBudW1iZXIgfSA9IHsgd2lkdGg6IDAsIGhlaWdodDogMCB9O1xyXG5cclxuICAgIC8vIOWFg+aVsOaNruWxnuaAp1xyXG4gICAgQHByb3BlcnR5XHJcbiAgICBwdWJsaWMgdGl0bGU6IHN0cmluZyA9IFwiXCI7XHJcblxyXG4gICAgQHByb3BlcnR5XHJcbiAgICBwdWJsaWMgZGVzY3JpcHRpb246IHN0cmluZyA9IFwiXCI7XHJcblxyXG4gICAgQHByb3BlcnR5XHJcbiAgICBwdWJsaWMga2V5d29yZHM6IHN0cmluZ1tdID0gW107XHJcblxyXG4gICAgQHByb3BlcnR5XHJcbiAgICBwdWJsaWMgYXV0aG9yOiBzdHJpbmcgPSBcIlwiO1xyXG5cclxuICAgIEBwcm9wZXJ0eVxyXG4gICAgcHVibGljIGxpY2Vuc2U6IHN0cmluZyA9IFwiXCI7XHJcblxyXG4gICAgLy8g5oCn6IO95LyY5YyW5bGe5oCnXHJcbiAgICBAcHJvcGVydHlcclxuICAgIHB1YmxpYyBjb21wbGV4aXR5U2NvcmU6IG51bWJlciA9IDA7XHJcblxyXG4gICAgQHByb3BlcnR5XHJcbiAgICBwdWJsaWMgb3B0aW1pemVkU1ZHOiBzdHJpbmcgPSBcIlwiO1xyXG5cclxuICAgIEBwcm9wZXJ0eVxyXG4gICAgcHVibGljIGlzQW5pbWF0ZWQ6IGJvb2xlYW4gPSBmYWxzZTtcclxuXHJcbiAgICAvLyDnvJbovpHnirbmgIHlsZ7mgKdcclxuICAgIEBwcm9wZXJ0eVxyXG4gICAgcHVibGljIGlzRGlydHk6IGJvb2xlYW4gPSB0cnVlO1xyXG5cclxuICAgIEBwcm9wZXJ0eVxyXG4gICAgcHVibGljIGxhc3RNb2RpZmllZDogbnVtYmVyID0gRGF0ZS5ub3coKTtcclxuXHJcbiAgICBAcHJvcGVydHlcclxuICAgIHB1YmxpYyBzb3VyY2VGaWxlOiBzdHJpbmcgPSBcIlwiO1xyXG5cclxuICAgIC8vIOengeaciURPTeWFg+e0oOeUqOS6juino+aekFxyXG4gICAgcHJpdmF0ZSBzdmdFbGVtZW50OiBTVkdTVkdFbGVtZW50IHwgbnVsbCA9IG51bGw7XHJcbiAgICBwcml2YXRlIHBhcnNlcjogRE9NUGFyc2VyID0gbmV3IERPTVBhcnNlcigpO1xyXG5cclxuICAgIC8qKlxyXG4gICAgICog5p6E6YCg5Ye95pWwXHJcbiAgICAgKi9cclxuICAgIGNvbnN0cnVjdG9yKCkge1xyXG4gICAgICAgIHN1cGVyKCk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiDop6PmnpBTVkflhoXlrrnvvIzmj5Dlj5blhYPmlbDmja7lkozlsLrlr7jkv6Hmga9cclxuICAgICAqL1xyXG4gICAgcHVibGljIHBhcnNlU1ZHKCk6IHZvaWQge1xyXG4gICAgICAgIGlmICghdGhpcy5fc3ZnQ29udGVudCkge1xyXG4gICAgICAgICAgICB0aGlzLndpZHRoID0gMDtcclxuICAgICAgICAgICAgdGhpcy5oZWlnaHQgPSAwO1xyXG4gICAgICAgICAgICB0aGlzLnZpZXdCb3ggPSBcIlwiO1xyXG4gICAgICAgICAgICB0aGlzLmFzcGVjdFJhdGlvID0gMTtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgY29uc3QgZG9jID0gdGhpcy5wYXJzZXIucGFyc2VGcm9tU3RyaW5nKHRoaXMuX3N2Z0NvbnRlbnQsIFwiaW1hZ2Uvc3ZnK3htbFwiKTtcclxuICAgICAgICAgICAgdGhpcy5zdmdFbGVtZW50ID0gZG9jLmRvY3VtZW50RWxlbWVudCBhcyB1bmtub3duIGFzIFNWR1NWR0VsZW1lbnQ7XHJcblxyXG4gICAgICAgICAgICAvLyDmo4Dmn6Xop6PmnpDplJnor69cclxuICAgICAgICAgICAgY29uc3QgcGFyc2VyRXJyb3IgPSBkb2MucXVlcnlTZWxlY3RvcihcInBhcnNlcmVycm9yXCIpO1xyXG4gICAgICAgICAgICBpZiAocGFyc2VyRXJyb3IpIHtcclxuICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXCJTVkfop6PmnpDplJnor686XCIsIHBhcnNlckVycm9yLnRleHRDb250ZW50KTtcclxuICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgLy8g5o+Q5Y+W5bC65a+45L+h5oGvXHJcbiAgICAgICAgICAgIGNvbnN0IHdpZHRoQXR0ciA9IHRoaXMuc3ZnRWxlbWVudC5nZXRBdHRyaWJ1dGUoXCJ3aWR0aFwiKTtcclxuICAgICAgICAgICAgY29uc3QgaGVpZ2h0QXR0ciA9IHRoaXMuc3ZnRWxlbWVudC5nZXRBdHRyaWJ1dGUoXCJoZWlnaHRcIik7XHJcbiAgICAgICAgICAgIGNvbnN0IHZpZXdCb3hBdHRyID0gdGhpcy5zdmdFbGVtZW50LmdldEF0dHJpYnV0ZShcInZpZXdCb3hcIik7XHJcblxyXG4gICAgICAgICAgICB0aGlzLnZpZXdCb3ggPSB2aWV3Qm94QXR0ciB8fCBcIlwiO1xyXG5cclxuICAgICAgICAgICAgaWYgKHZpZXdCb3hBdHRyKSB7XHJcbiAgICAgICAgICAgICAgICBjb25zdCB2aWV3Qm94UGFydHMgPSB2aWV3Qm94QXR0ci5zcGxpdChcIiBcIikubWFwKE51bWJlcik7XHJcbiAgICAgICAgICAgICAgICBpZiAodmlld0JveFBhcnRzLmxlbmd0aCA+PSA0KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy53aWR0aCA9IHZpZXdCb3hQYXJ0c1syXTtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLmhlaWdodCA9IHZpZXdCb3hQYXJ0c1szXTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgLy8g5aaC5p6cdmlld0JveOayoeacieaPkOS+m+WwuuWvuO+8jOS9v+eUqHdpZHRoL2hlaWdodOWxnuaAp1xyXG4gICAgICAgICAgICBpZiAodGhpcy53aWR0aCA9PT0gMCAmJiB3aWR0aEF0dHIpIHtcclxuICAgICAgICAgICAgICAgIHRoaXMud2lkdGggPSB0aGlzLnBhcnNlRGltZW5zaW9uKHdpZHRoQXR0cik7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgaWYgKHRoaXMuaGVpZ2h0ID09PSAwICYmIGhlaWdodEF0dHIpIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuaGVpZ2h0ID0gdGhpcy5wYXJzZURpbWVuc2lvbihoZWlnaHRBdHRyKTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgLy8g5aaC5p6c6L+Y5piv5rKh5pyJ5bC65a+477yM5L2/55So6buY6K6k5YC8XHJcbiAgICAgICAgICAgIGlmICh0aGlzLndpZHRoID09PSAwKSB0aGlzLndpZHRoID0gMTAwO1xyXG4gICAgICAgICAgICBpZiAodGhpcy5oZWlnaHQgPT09IDApIHRoaXMuaGVpZ2h0ID0gMTAwO1xyXG5cclxuICAgICAgICAgICAgdGhpcy5hc3BlY3RSYXRpbyA9IHRoaXMuaGVpZ2h0ID4gMCA/IHRoaXMud2lkdGggLyB0aGlzLmhlaWdodCA6IDE7XHJcblxyXG4gICAgICAgICAgICAvLyDmj5Dlj5blhYPmlbDmja5cclxuICAgICAgICAgICAgdGhpcy5leHRyYWN0TWV0YWRhdGEoKTtcclxuXHJcbiAgICAgICAgICAgIC8vIOiuoeeul+WkjeadguW6plxyXG4gICAgICAgICAgICB0aGlzLmNhbGN1bGF0ZUNvbXBsZXhpdHkoKTtcclxuXHJcbiAgICAgICAgICAgIC8vIOajgOafpeaYr+WQpuWMheWQq+WKqOeUu1xyXG4gICAgICAgICAgICB0aGlzLmNoZWNrRm9yQW5pbWF0aW9uKCk7XHJcblxyXG4gICAgICAgICAgICAvLyDnlJ/miJDkvJjljJbniYjmnKxcclxuICAgICAgICAgICAgdGhpcy5vcHRpbWl6ZVNWRygpO1xyXG5cclxuICAgICAgICAgICAgdGhpcy5pc0RpcnR5ID0gZmFsc2U7XHJcbiAgICAgICAgICAgIHRoaXMubGFzdE1vZGlmaWVkID0gRGF0ZS5ub3coKTtcclxuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xyXG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKFwi6Kej5p6QU1ZH5aSx6LSlOlwiLCBlcnJvcik7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog6aqM6K+BU1ZH5qC85byP5piv5ZCm5q2j56GuXHJcbiAgICAgKi9cclxuICAgIHB1YmxpYyB2YWxpZGF0ZVNWRygpOiBib29sZWFuIHtcclxuICAgICAgICBpZiAoIXRoaXMuX3N2Z0NvbnRlbnQpIHtcclxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgY29uc3QgZG9jID0gdGhpcy5wYXJzZXIucGFyc2VGcm9tU3RyaW5nKHRoaXMuX3N2Z0NvbnRlbnQsIFwiaW1hZ2Uvc3ZnK3htbFwiKTtcclxuICAgICAgICAgICAgY29uc3QgcGFyc2VyRXJyb3IgPSBkb2MucXVlcnlTZWxlY3RvcihcInBhcnNlcmVycm9yXCIpO1xyXG4gICAgICAgICAgICByZXR1cm4gIXBhcnNlckVycm9yO1xyXG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiDmuLLmn5PmjIflrprlsLrlr7jnmoTnurnnkIZcclxuICAgICAqL1xyXG4gICAgcHVibGljIGFzeW5jIHJlbmRlclRvVGV4dHVyZSh3aWR0aDogbnVtYmVyLCBoZWlnaHQ6IG51bWJlcik6IFByb21pc2U8VGV4dHVyZTJEPiB7XHJcbiAgICAgICAgY29uc3QgY2FjaGVLZXkgPSBgJHt3aWR0aH14JHtoZWlnaHR9XyR7dGhpcy5yZW5kZXJTY2FsZX1fJHt0aGlzLmRlZmF1bHRDb2xvcn1gO1xyXG5cclxuICAgICAgICAvLyDmo4Dmn6XnvJPlrZhcclxuICAgICAgICBpZiAodGhpcy5jYWNoZWRUZXh0dXJlcy5oYXMoY2FjaGVLZXkpKSB7XHJcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmNhY2hlZFRleHR1cmVzLmdldChjYWNoZUtleSkhO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8g5Yib5bu6Q2FudmFzXHJcbiAgICAgICAgY29uc3QgY2FudmFzID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImNhbnZhc1wiKTtcclxuICAgICAgICBjb25zdCByZW5kZXJXaWR0aCA9IE1hdGguZmxvb3Iod2lkdGggKiB0aGlzLnJlbmRlclNjYWxlKTtcclxuICAgICAgICBjb25zdCByZW5kZXJIZWlnaHQgPSBNYXRoLmZsb29yKGhlaWdodCAqIHRoaXMucmVuZGVyU2NhbGUpO1xyXG4gICAgICAgIGNhbnZhcy53aWR0aCA9IHJlbmRlcldpZHRoO1xyXG4gICAgICAgIGNhbnZhcy5oZWlnaHQgPSByZW5kZXJIZWlnaHQ7XHJcblxyXG4gICAgICAgIGNvbnN0IGN0eCA9IGNhbnZhcy5nZXRDb250ZXh0KFwiMmRcIikhO1xyXG5cclxuICAgICAgICAvLyDorr7nva7mipfplK/pvb9cclxuICAgICAgICBpZiAodGhpcy5hbnRpYWxpYXMpIHtcclxuICAgICAgICAgICAgY3R4LmltYWdlU21vb3RoaW5nRW5hYmxlZCA9IHRydWU7XHJcbiAgICAgICAgICAgIGN0eC5pbWFnZVNtb290aGluZ1F1YWxpdHkgPSBcImhpZ2hcIjtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vIOWHhuWkh1NWR+Wtl+espuS4slxyXG4gICAgICAgIGxldCBzdmdUb1JlbmRlciA9IHRoaXMub3B0aW1pemVkU1ZHIHx8IHRoaXMuX3N2Z0NvbnRlbnQ7XHJcblxyXG4gICAgICAgIC8vIOW6lOeUqOminOiJsuimhuebllxyXG4gICAgICAgIGlmICh0aGlzLmRlZmF1bHRDb2xvciAhPT0gXCIjZmZmZmZmXCIpIHtcclxuICAgICAgICAgICAgc3ZnVG9SZW5kZXIgPSB0aGlzLmFwcGx5Q29sb3JPdmVycmlkZShzdmdUb1JlbmRlciwgdGhpcy5kZWZhdWx0Q29sb3IpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8g6K6+572uU1ZH5bC65a+4XHJcbiAgICAgICAgc3ZnVG9SZW5kZXIgPSB0aGlzLnNldFNWR0RpbWVuc2lvbnMoc3ZnVG9SZW5kZXIsIHdpZHRoLCBoZWlnaHQpO1xyXG5cclxuICAgICAgICAvLyDmuLLmn5NTVkfliLBDYW52YXNcclxuICAgICAgICBhd2FpdCB0aGlzLnJlbmRlclNWR1RvQ2FudmFzKHN2Z1RvUmVuZGVyLCBjYW52YXMpO1xyXG5cclxuICAgICAgICAvLyDliJvlu7pJbWFnZUFzc2V05ZKMVGV4dHVyZTJEXHJcbiAgICAgICAgY29uc3QgaW1hZ2VBc3NldCA9IG5ldyBJbWFnZUFzc2V0KGNhbnZhcyk7XHJcbiAgICAgICAgY29uc3QgdGV4dHVyZSA9IG5ldyBUZXh0dXJlMkQoKTtcclxuICAgICAgICB0ZXh0dXJlLmltYWdlID0gaW1hZ2VBc3NldDtcclxuXHJcbiAgICAgICAgLy8g57yT5a2Y57q555CGXHJcbiAgICAgICAgdGhpcy5jYWNoZWRUZXh0dXJlcy5zZXQoY2FjaGVLZXksIHRleHR1cmUpO1xyXG4gICAgICAgIHRoaXMubGFzdFJlbmRlcmVkU2l6ZSA9IHsgd2lkdGgsIGhlaWdodCB9O1xyXG5cclxuICAgICAgICByZXR1cm4gdGV4dHVyZTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIOeUn+aIkOe8qeeVpeWbvumihOiniFxyXG4gICAgICovXHJcbiAgICBwdWJsaWMgYXN5bmMgZ2VuZXJhdGVQcmV2aWV3KCk6IFByb21pc2U8SW1hZ2VBc3NldD4ge1xyXG4gICAgICAgIGlmICh0aGlzLnByZXZpZXdBc3NldCkge1xyXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5wcmV2aWV3QXNzZXQ7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBjb25zdCBjYW52YXMgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiY2FudmFzXCIpO1xyXG4gICAgICAgIGNhbnZhcy53aWR0aCA9IDY0O1xyXG4gICAgICAgIGNhbnZhcy5oZWlnaHQgPSA2NDtcclxuXHJcbiAgICAgICAgY29uc3QgY3R4ID0gY2FudmFzLmdldENvbnRleHQoXCIyZFwiKSE7XHJcbiAgICAgICAgY3R4LmZpbGxTdHlsZSA9IFwiI2YwZjBmMFwiO1xyXG4gICAgICAgIGN0eC5maWxsUmVjdCgwLCAwLCA2NCwgNjQpO1xyXG5cclxuICAgICAgICBpZiAodGhpcy5fc3ZnQ29udGVudCkge1xyXG4gICAgICAgICAgICAvLyDlh4blpIdTVkflrZfnrKbkuLJcclxuICAgICAgICAgICAgbGV0IHN2Z1RvUmVuZGVyID0gdGhpcy5vcHRpbWl6ZWRTVkcgfHwgdGhpcy5fc3ZnQ29udGVudDtcclxuXHJcbiAgICAgICAgICAgIC8vIOiuoeeul+mAguWQiOmihOiniOeahOWwuuWvuFxyXG4gICAgICAgICAgICBjb25zdCBwcmV2aWV3U2l6ZSA9IHRoaXMuc2NhbGVUb0ZpdCg2NCwgNjQpO1xyXG4gICAgICAgICAgICBjb25zdCB4ID0gKDY0IC0gcHJldmlld1NpemUud2lkdGgpIC8gMjtcclxuICAgICAgICAgICAgY29uc3QgeSA9ICg2NCAtIHByZXZpZXdTaXplLmhlaWdodCkgLyAyO1xyXG5cclxuICAgICAgICAgICAgLy8g6K6+572uU1ZH5bC65a+4XHJcbiAgICAgICAgICAgIHN2Z1RvUmVuZGVyID0gdGhpcy5zZXRTVkdEaW1lbnNpb25zKHN2Z1RvUmVuZGVyLCBwcmV2aWV3U2l6ZS53aWR0aCwgcHJldmlld1NpemUuaGVpZ2h0KTtcclxuXHJcbiAgICAgICAgICAgIC8vIOa4suafk1NWR+WIsENhbnZhc1xyXG4gICAgICAgICAgICBjb25zdCB0ZW1wQ2FudmFzID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImNhbnZhc1wiKTtcclxuICAgICAgICAgICAgdGVtcENhbnZhcy53aWR0aCA9IHByZXZpZXdTaXplLndpZHRoO1xyXG4gICAgICAgICAgICB0ZW1wQ2FudmFzLmhlaWdodCA9IHByZXZpZXdTaXplLmhlaWdodDtcclxuXHJcbiAgICAgICAgICAgIGF3YWl0IHRoaXMucmVuZGVyU1ZHVG9DYW52YXMoc3ZnVG9SZW5kZXIsIHRlbXBDYW52YXMpO1xyXG5cclxuICAgICAgICAgICAgLy8g57uY5Yi25Yiw6aKE6KeIQ2FudmFzXHJcbiAgICAgICAgICAgIGN0eC5kcmF3SW1hZ2UodGVtcENhbnZhcywgeCwgeSwgcHJldmlld1NpemUud2lkdGgsIHByZXZpZXdTaXplLmhlaWdodCk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICB0aGlzLnByZXZpZXdBc3NldCA9IG5ldyBJbWFnZUFzc2V0KGNhbnZhcyk7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMucHJldmlld0Fzc2V0O1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog5LyY5YyWU1ZHXHJcbiAgICAgKi9cclxuICAgIHB1YmxpYyBvcHRpbWl6ZSgpOiB2b2lkIHtcclxuICAgICAgICB0aGlzLm9wdGltaXplU1ZHKCk7XHJcbiAgICAgICAgdGhpcy5pc0RpcnR5ID0gdHJ1ZTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIOaJuemHj+S/ruaUueWhq+WFheminOiJslxyXG4gICAgICovXHJcbiAgICBwdWJsaWMgY2hhbmdlQ29sb3IobmV3Q29sb3I6IHN0cmluZyk6IHZvaWQge1xyXG4gICAgICAgIHRoaXMuZGVmYXVsdENvbG9yID0gbmV3Q29sb3I7XHJcbiAgICAgICAgdGhpcy5pc0RpcnR5ID0gdHJ1ZTtcclxuICAgICAgICB0aGlzLmNhY2hlZFRleHR1cmVzLmNsZWFyKCk7IC8vIOa4hemZpOe8k+WtmO+8jOWboOS4uuminOiJsuaUueWPmOS6hlxyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog5o+Q5Y+W5omA5pyJ6Lev5b6E5pWw5o2uXHJcbiAgICAgKi9cclxuICAgIHB1YmxpYyBleHRyYWN0UGF0aHMoKTogc3RyaW5nW10ge1xyXG4gICAgICAgIGlmICghdGhpcy5zdmdFbGVtZW50KSB7XHJcbiAgICAgICAgICAgIHJldHVybiBbXTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGNvbnN0IHBhdGhzOiBzdHJpbmdbXSA9IFtdO1xyXG4gICAgICAgIGNvbnN0IHBhdGhFbGVtZW50cyA9IHRoaXMuc3ZnRWxlbWVudC5xdWVyeVNlbGVjdG9yQWxsKFwicGF0aFwiKTtcclxuXHJcbiAgICAgICAgcGF0aEVsZW1lbnRzLmZvckVhY2goKHBhdGgpID0+IHtcclxuICAgICAgICAgICAgY29uc3QgZCA9IHBhdGguZ2V0QXR0cmlidXRlKFwiZFwiKTtcclxuICAgICAgICAgICAgaWYgKGQpIHtcclxuICAgICAgICAgICAgICAgIHBhdGhzLnB1c2goZCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgcmV0dXJuIHBhdGhzO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog6K6h566X6YCC5ZCI55qE5bC65a+4XHJcbiAgICAgKi9cclxuICAgIHB1YmxpYyBzY2FsZVRvRml0KG1heFdpZHRoOiBudW1iZXIsIG1heEhlaWdodDogbnVtYmVyKTogeyB3aWR0aDogbnVtYmVyOyBoZWlnaHQ6IG51bWJlciB9IHtcclxuICAgICAgICBpZiAodGhpcy53aWR0aCA9PT0gMCB8fCB0aGlzLmhlaWdodCA9PT0gMCkge1xyXG4gICAgICAgICAgICByZXR1cm4geyB3aWR0aDogbWF4V2lkdGgsIGhlaWdodDogbWF4SGVpZ2h0IH07XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBjb25zdCB3aWR0aFJhdGlvID0gbWF4V2lkdGggLyB0aGlzLndpZHRoO1xyXG4gICAgICAgIGNvbnN0IGhlaWdodFJhdGlvID0gbWF4SGVpZ2h0IC8gdGhpcy5oZWlnaHQ7XHJcbiAgICAgICAgY29uc3Qgc2NhbGUgPSBNYXRoLm1pbih3aWR0aFJhdGlvLCBoZWlnaHRSYXRpbyk7XHJcblxyXG4gICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgIHdpZHRoOiBNYXRoLmZsb29yKHRoaXMud2lkdGggKiBzY2FsZSksXHJcbiAgICAgICAgICAgIGhlaWdodDogTWF0aC5mbG9vcih0aGlzLmhlaWdodCAqIHNjYWxlKSxcclxuICAgICAgICB9O1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog5bqP5YiX5YyW5Li6SlNPTlxyXG4gICAgICovXHJcbiAgICBwdWJsaWMgc2VyaWFsaXplKCk6IGFueSB7XHJcbiAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgc3ZnQ29udGVudDogdGhpcy5fc3ZnQ29udGVudCxcclxuICAgICAgICAgICAgd2lkdGg6IHRoaXMud2lkdGgsXHJcbiAgICAgICAgICAgIGhlaWdodDogdGhpcy5oZWlnaHQsXHJcbiAgICAgICAgICAgIHZpZXdCb3g6IHRoaXMudmlld0JveCxcclxuICAgICAgICAgICAgZGVmYXVsdENvbG9yOiB0aGlzLmRlZmF1bHRDb2xvcixcclxuICAgICAgICAgICAgcmVuZGVyU2NhbGU6IHRoaXMucmVuZGVyU2NhbGUsXHJcbiAgICAgICAgICAgIGFudGlhbGlhczogdGhpcy5hbnRpYWxpYXMsXHJcbiAgICAgICAgICAgIHRpdGxlOiB0aGlzLnRpdGxlLFxyXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogdGhpcy5kZXNjcmlwdGlvbixcclxuICAgICAgICAgICAga2V5d29yZHM6IHRoaXMua2V5d29yZHMsXHJcbiAgICAgICAgICAgIGF1dGhvcjogdGhpcy5hdXRob3IsXHJcbiAgICAgICAgICAgIGxpY2Vuc2U6IHRoaXMubGljZW5zZSxcclxuICAgICAgICAgICAgbGFzdE1vZGlmaWVkOiB0aGlzLmxhc3RNb2RpZmllZCxcclxuICAgICAgICAgICAgc291cmNlRmlsZTogdGhpcy5zb3VyY2VGaWxlLFxyXG4gICAgICAgIH07XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiDku45KU09O5Y+N5bqP5YiX5YyWXHJcbiAgICAgKi9cclxuICAgIHB1YmxpYyBkZXNlcmlhbGl6ZShkYXRhOiBhbnkpOiB2b2lkIHtcclxuICAgICAgICB0aGlzLl9zdmdDb250ZW50ID0gZGF0YS5zdmdDb250ZW50IHx8IFwiXCI7XHJcbiAgICAgICAgdGhpcy53aWR0aCA9IGRhdGEud2lkdGggfHwgMDtcclxuICAgICAgICB0aGlzLmhlaWdodCA9IGRhdGEuaGVpZ2h0IHx8IDA7XHJcbiAgICAgICAgdGhpcy52aWV3Qm94ID0gZGF0YS52aWV3Qm94IHx8IFwiXCI7XHJcbiAgICAgICAgdGhpcy5kZWZhdWx0Q29sb3IgPSBkYXRhLmRlZmF1bHRDb2xvciB8fCBcIiNmZmZmZmZcIjtcclxuICAgICAgICB0aGlzLnJlbmRlclNjYWxlID0gZGF0YS5yZW5kZXJTY2FsZSB8fCAxO1xyXG4gICAgICAgIHRoaXMuYW50aWFsaWFzID0gZGF0YS5hbnRpYWxpYXMgIT09IHVuZGVmaW5lZCA/IGRhdGEuYW50aWFsaWFzIDogdHJ1ZTtcclxuICAgICAgICB0aGlzLnRpdGxlID0gZGF0YS50aXRsZSB8fCBcIlwiO1xyXG4gICAgICAgIHRoaXMuZGVzY3JpcHRpb24gPSBkYXRhLmRlc2NyaXB0aW9uIHx8IFwiXCI7XHJcbiAgICAgICAgdGhpcy5rZXl3b3JkcyA9IGRhdGEua2V5d29yZHMgfHwgW107XHJcbiAgICAgICAgdGhpcy5hdXRob3IgPSBkYXRhLmF1dGhvciB8fCBcIlwiO1xyXG4gICAgICAgIHRoaXMubGljZW5zZSA9IGRhdGEubGljZW5zZSB8fCBcIlwiO1xyXG4gICAgICAgIHRoaXMubGFzdE1vZGlmaWVkID0gZGF0YS5sYXN0TW9kaWZpZWQgfHwgRGF0ZS5ub3coKTtcclxuICAgICAgICB0aGlzLnNvdXJjZUZpbGUgPSBkYXRhLnNvdXJjZUZpbGUgfHwgXCJcIjtcclxuXHJcbiAgICAgICAgdGhpcy5wYXJzZVNWRygpO1xyXG4gICAgfVxyXG5cclxuICAgIC8vID09PT09PT09PT0g56eB5pyJ5pa55rOVID09PT09PT09PT1cclxuXHJcbiAgICBwcml2YXRlIHBhcnNlRGltZW5zaW9uKGRpbTogc3RyaW5nKTogbnVtYmVyIHtcclxuICAgICAgICAvLyDnp7vpmaTljZXkvY3vvIhweCwgcHQsIGVt562J77yJXHJcbiAgICAgICAgY29uc3QgbnVtID0gcGFyc2VGbG9hdChkaW0pO1xyXG4gICAgICAgIHJldHVybiBpc05hTihudW0pID8gMCA6IG51bTtcclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIGV4dHJhY3RNZXRhZGF0YSgpOiB2b2lkIHtcclxuICAgICAgICBpZiAoIXRoaXMuc3ZnRWxlbWVudCkgcmV0dXJuO1xyXG5cclxuICAgICAgICAvLyDmj5Dlj5Y8dGl0bGU+XHJcbiAgICAgICAgY29uc3QgdGl0bGVFbGVtZW50ID0gdGhpcy5zdmdFbGVtZW50LnF1ZXJ5U2VsZWN0b3IoXCJ0aXRsZVwiKTtcclxuICAgICAgICB0aGlzLnRpdGxlID0gdGl0bGVFbGVtZW50ID8gdGl0bGVFbGVtZW50LnRleHRDb250ZW50IHx8IFwiXCIgOiBcIlwiO1xyXG5cclxuICAgICAgICAvLyDmj5Dlj5Y8ZGVzYz5cclxuICAgICAgICBjb25zdCBkZXNjRWxlbWVudCA9IHRoaXMuc3ZnRWxlbWVudC5xdWVyeVNlbGVjdG9yKFwiZGVzY1wiKTtcclxuICAgICAgICB0aGlzLmRlc2NyaXB0aW9uID0gZGVzY0VsZW1lbnQgPyBkZXNjRWxlbWVudC50ZXh0Q29udGVudCB8fCBcIlwiIDogXCJcIjtcclxuXHJcbiAgICAgICAgLy8g5o+Q5Y+WbWV0YWRhdGFcclxuICAgICAgICBjb25zdCBtZXRhZGF0YUVsZW1lbnQgPSB0aGlzLnN2Z0VsZW1lbnQucXVlcnlTZWxlY3RvcihcIm1ldGFkYXRhXCIpO1xyXG4gICAgICAgIGlmIChtZXRhZGF0YUVsZW1lbnQpIHtcclxuICAgICAgICAgICAgLy8g6L+Z6YeM5Y+v5Lul6Kej5p6Q5pu05aSN5p2C55qE5YWD5pWw5o2uXHJcbiAgICAgICAgICAgIGNvbnN0IHRleHQgPSBtZXRhZGF0YUVsZW1lbnQudGV4dENvbnRlbnQgfHwgXCJcIjtcclxuICAgICAgICAgICAgaWYgKHRleHQuaW5jbHVkZXMoXCJhdXRob3I6XCIpKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmF1dGhvciA9IHRleHQuc3BsaXQoXCJhdXRob3I6XCIpWzFdLnNwbGl0KFwiXFxuXCIpWzBdLnRyaW0oKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBpZiAodGV4dC5pbmNsdWRlcyhcImxpY2Vuc2U6XCIpKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmxpY2Vuc2UgPSB0ZXh0LnNwbGl0KFwibGljZW5zZTpcIilbMV0uc3BsaXQoXCJcXG5cIilbMF0udHJpbSgpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgY2FsY3VsYXRlQ29tcGxleGl0eSgpOiB2b2lkIHtcclxuICAgICAgICBpZiAoIXRoaXMuc3ZnRWxlbWVudCkge1xyXG4gICAgICAgICAgICB0aGlzLmNvbXBsZXhpdHlTY29yZSA9IDA7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGxldCBzY29yZSA9IDA7XHJcblxyXG4gICAgICAgIC8vIOiuoeeul+i3r+W+hOaVsOmHj1xyXG4gICAgICAgIGNvbnN0IHBhdGhzID0gdGhpcy5zdmdFbGVtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoXCJwYXRoXCIpO1xyXG4gICAgICAgIHNjb3JlICs9IHBhdGhzLmxlbmd0aCAqIDEwO1xyXG5cclxuICAgICAgICAvLyDorqHnrpflhbbku5blm77lvaLlhYPntKBcclxuICAgICAgICBjb25zdCBjaXJjbGVzID0gdGhpcy5zdmdFbGVtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoXCJjaXJjbGUsIGVsbGlwc2VcIik7XHJcbiAgICAgICAgc2NvcmUgKz0gY2lyY2xlcy5sZW5ndGggKiA1O1xyXG5cclxuICAgICAgICBjb25zdCByZWN0cyA9IHRoaXMuc3ZnRWxlbWVudC5xdWVyeVNlbGVjdG9yQWxsKFwicmVjdFwiKTtcclxuICAgICAgICBzY29yZSArPSByZWN0cy5sZW5ndGggKiAzO1xyXG5cclxuICAgICAgICBjb25zdCBsaW5lcyA9IHRoaXMuc3ZnRWxlbWVudC5xdWVyeVNlbGVjdG9yQWxsKFwibGluZSwgcG9seWxpbmUsIHBvbHlnb25cIik7XHJcbiAgICAgICAgc2NvcmUgKz0gbGluZXMubGVuZ3RoICogMjtcclxuXHJcbiAgICAgICAgLy8g6K6h566X5paH5pys5YWD57SgXHJcbiAgICAgICAgY29uc3QgdGV4dHMgPSB0aGlzLnN2Z0VsZW1lbnQucXVlcnlTZWxlY3RvckFsbChcInRleHRcIik7XHJcbiAgICAgICAgc2NvcmUgKz0gdGV4dHMubGVuZ3RoICogODtcclxuXHJcbiAgICAgICAgLy8g6K6h566X5YiG57uE5ZKM5Y+Y5o2iXHJcbiAgICAgICAgY29uc3QgZ3JvdXBzID0gdGhpcy5zdmdFbGVtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoXCJnXCIpO1xyXG4gICAgICAgIHNjb3JlICs9IGdyb3Vwcy5sZW5ndGggKiAxO1xyXG5cclxuICAgICAgICB0aGlzLmNvbXBsZXhpdHlTY29yZSA9IHNjb3JlO1xyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgY2hlY2tGb3JBbmltYXRpb24oKTogdm9pZCB7XHJcbiAgICAgICAgaWYgKCF0aGlzLnN2Z0VsZW1lbnQpIHtcclxuICAgICAgICAgICAgdGhpcy5pc0FuaW1hdGVkID0gZmFsc2U7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGNvbnN0IGhhc0FuaW1hdGlvbiA9IHRoaXMuc3ZnRWxlbWVudC5xdWVyeVNlbGVjdG9yKFwiYW5pbWF0ZSwgYW5pbWF0ZVRyYW5zZm9ybSwgYW5pbWF0ZU1vdGlvbiwgc2V0XCIpO1xyXG4gICAgICAgIHRoaXMuaXNBbmltYXRlZCA9ICEhaGFzQW5pbWF0aW9uO1xyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgb3B0aW1pemVTVkcoKTogdm9pZCB7XHJcbiAgICAgICAgaWYgKCF0aGlzLnN2Z0VsZW1lbnQpIHtcclxuICAgICAgICAgICAgdGhpcy5vcHRpbWl6ZWRTVkcgPSB0aGlzLl9zdmdDb250ZW50O1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyDlhYvpmoblhYPntKDov5vooYzkvJjljJZcclxuICAgICAgICBjb25zdCBvcHRpbWl6ZWRFbGVtZW50ID0gdGhpcy5zdmdFbGVtZW50LmNsb25lTm9kZSh0cnVlKSBhcyBTVkdTVkdFbGVtZW50O1xyXG5cclxuICAgICAgICAvLyDnp7vpmaTms6jph4pcclxuICAgICAgICB0aGlzLnJlbW92ZUNvbW1lbnRzKG9wdGltaXplZEVsZW1lbnQpO1xyXG5cclxuICAgICAgICAvLyDnp7vpmaTnqbrlhYPntKBcclxuICAgICAgICB0aGlzLnJlbW92ZUVtcHR5RWxlbWVudHMob3B0aW1pemVkRWxlbWVudCk7XHJcblxyXG4gICAgICAgIC8vIOWOi+e8qeepuueZvVxyXG4gICAgICAgIHRoaXMuY29tcHJlc3NXaGl0ZXNwYWNlKG9wdGltaXplZEVsZW1lbnQpO1xyXG5cclxuICAgICAgICAvLyDluo/liJfljJblm57lrZfnrKbkuLJcclxuICAgICAgICBjb25zdCBzZXJpYWxpemVyID0gbmV3IFhNTFNlcmlhbGl6ZXIoKTtcclxuICAgICAgICB0aGlzLm9wdGltaXplZFNWRyA9IHNlcmlhbGl6ZXIuc2VyaWFsaXplVG9TdHJpbmcob3B0aW1pemVkRWxlbWVudCk7XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSByZW1vdmVDb21tZW50cyhlbGVtZW50OiBFbGVtZW50KTogdm9pZCB7XHJcbiAgICAgICAgY29uc3Qgd2Fsa2VyID0gZG9jdW1lbnQuY3JlYXRlVHJlZVdhbGtlcihlbGVtZW50LCBOb2RlRmlsdGVyLlNIT1dfQ09NTUVOVCwgbnVsbCk7XHJcblxyXG4gICAgICAgIGNvbnN0IGNvbW1lbnRzOiBDb21tZW50W10gPSBbXTtcclxuICAgICAgICBsZXQgbm9kZTogTm9kZSB8IG51bGw7XHJcbiAgICAgICAgd2hpbGUgKChub2RlID0gd2Fsa2VyLm5leHROb2RlKCkpKSB7XHJcbiAgICAgICAgICAgIGNvbW1lbnRzLnB1c2gobm9kZSBhcyBDb21tZW50KTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGNvbW1lbnRzLmZvckVhY2goKGNvbW1lbnQpID0+IGNvbW1lbnQucmVtb3ZlKCkpO1xyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgcmVtb3ZlRW1wdHlFbGVtZW50cyhlbGVtZW50OiBFbGVtZW50KTogdm9pZCB7XHJcbiAgICAgICAgY29uc3QgZW1wdHlFbGVtZW50cyA9IEFycmF5LmZyb20oZWxlbWVudC5xdWVyeVNlbGVjdG9yQWxsKFwiKlwiKSkuZmlsdGVyKChlbCkgPT4ge1xyXG4gICAgICAgICAgICByZXR1cm4gIWVsLmhhc0NoaWxkTm9kZXMoKSAmJiAhZWwuZ2V0QXR0cmlidXRlKFwiZFwiKSAmJiAhZWwuZ2V0QXR0cmlidXRlKFwicG9pbnRzXCIpO1xyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICBlbXB0eUVsZW1lbnRzLmZvckVhY2goKGVsKSA9PiBlbC5yZW1vdmUoKSk7XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBjb21wcmVzc1doaXRlc3BhY2UoZWxlbWVudDogRWxlbWVudCk6IHZvaWQge1xyXG4gICAgICAgIGNvbnN0IHdhbGtlciA9IGRvY3VtZW50LmNyZWF0ZVRyZWVXYWxrZXIoZWxlbWVudCwgTm9kZUZpbHRlci5TSE9XX1RFWFQsIG51bGwpO1xyXG5cclxuICAgICAgICBsZXQgbm9kZTogTm9kZSB8IG51bGw7XHJcbiAgICAgICAgd2hpbGUgKChub2RlID0gd2Fsa2VyLm5leHROb2RlKCkpKSB7XHJcbiAgICAgICAgICAgIGNvbnN0IHRleHROb2RlID0gbm9kZSBhcyBUZXh0O1xyXG4gICAgICAgICAgICB0ZXh0Tm9kZS50ZXh0Q29udGVudCA9IHRleHROb2RlLnRleHRDb250ZW50Py5yZXBsYWNlKC9cXHMrL2csIFwiIFwiKS50cmltKCkgfHwgXCJcIjtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBhcHBseUNvbG9yT3ZlcnJpZGUoc3ZnU3RyaW5nOiBzdHJpbmcsIGNvbG9yOiBzdHJpbmcpOiBzdHJpbmcge1xyXG4gICAgICAgIC8vIOeugOWNleeahOminOiJsuabv+aNou+8muWwhuaJgOaciWZpbGzlsZ7mgKfvvIjpmaTkuoZcIm5vbmVcIu+8ieabv+aNouS4uuaMh+WumuminOiJslxyXG4gICAgICAgIHJldHVybiBzdmdTdHJpbmcucmVwbGFjZSgvZmlsbD1cIihbXlwiXSopXCIvZywgKG1hdGNoLCBmaWxsVmFsdWUpID0+IHtcclxuICAgICAgICAgICAgaWYgKGZpbGxWYWx1ZSA9PT0gXCJub25lXCIgfHwgZmlsbFZhbHVlID09PSBcInRyYW5zcGFyZW50XCIpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBtYXRjaDsgLy8g5L+d5oyB6YCP5piO5aGr5YWF5LiN5Y+YXHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgcmV0dXJuIGBmaWxsPVwiJHtjb2xvcn1cImA7XHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBzZXRTVkdEaW1lbnNpb25zKHN2Z1N0cmluZzogc3RyaW5nLCB3aWR0aDogbnVtYmVyLCBoZWlnaHQ6IG51bWJlcik6IHN0cmluZyB7XHJcbiAgICAgICAgLy8g5re75Yqg5oiW5pu05pawd2lkdGjlkoxoZWlnaHTlsZ7mgKdcclxuICAgICAgICBsZXQgcmVzdWx0ID0gc3ZnU3RyaW5nO1xyXG5cclxuICAgICAgICAvLyDmm7TmlrB3aWR0aOWxnuaAp1xyXG4gICAgICAgIGlmIChyZXN1bHQuaW5jbHVkZXMoJ3dpZHRoPVwiJykpIHtcclxuICAgICAgICAgICAgcmVzdWx0ID0gcmVzdWx0LnJlcGxhY2UoL3dpZHRoPVwiW15cIl0qXCIvLCBgd2lkdGg9XCIke3dpZHRofVwiYCk7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgcmVzdWx0ID0gcmVzdWx0LnJlcGxhY2UoLzxzdmcvLCBgPHN2ZyB3aWR0aD1cIiR7d2lkdGh9XCJgKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vIOabtOaWsGhlaWdodOWxnuaAp1xyXG4gICAgICAgIGlmIChyZXN1bHQuaW5jbHVkZXMoJ2hlaWdodD1cIicpKSB7XHJcbiAgICAgICAgICAgIHJlc3VsdCA9IHJlc3VsdC5yZXBsYWNlKC9oZWlnaHQ9XCJbXlwiXSpcIi8sIGBoZWlnaHQ9XCIke2hlaWdodH1cImApO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIHJlc3VsdCA9IHJlc3VsdC5yZXBsYWNlKC88c3ZnLywgYDxzdmcgaGVpZ2h0PVwiJHtoZWlnaHR9XCJgKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vIOa3u+WKoHByZXNlcnZlQXNwZWN0UmF0aW9cclxuICAgICAgICBpZiAoIXJlc3VsdC5pbmNsdWRlcygncHJlc2VydmVBc3BlY3RSYXRpbz1cIicpKSB7XHJcbiAgICAgICAgICAgIHJlc3VsdCA9IHJlc3VsdC5yZXBsYWNlKC88c3ZnLywgYDxzdmcgcHJlc2VydmVBc3BlY3RSYXRpbz1cIiR7dGhpcy5wcmVzZXJ2ZUFzcGVjdFJhdGlvfVwiYCk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICByZXR1cm4gcmVzdWx0O1xyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgcmVuZGVyU1ZHVG9DYW52YXMoc3ZnU3RyaW5nOiBzdHJpbmcsIGNhbnZhczogSFRNTENhbnZhc0VsZW1lbnQpOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xyXG4gICAgICAgICAgICBjb25zdCBjdHggPSBjYW52YXMuZ2V0Q29udGV4dChcIjJkXCIpITtcclxuXHJcbiAgICAgICAgICAgIC8vIOWIm+W7ukJsb2LlkoxVUkxcclxuICAgICAgICAgICAgY29uc3QgYmxvYiA9IG5ldyBCbG9iKFtzdmdTdHJpbmddLCB7IHR5cGU6IFwiaW1hZ2Uvc3ZnK3htbFwiIH0pO1xyXG4gICAgICAgICAgICBjb25zdCB1cmwgPSBVUkwuY3JlYXRlT2JqZWN0VVJMKGJsb2IpO1xyXG5cclxuICAgICAgICAgICAgY29uc3QgaW1nID0gbmV3IEltYWdlKCk7XHJcbiAgICAgICAgICAgIGltZy5vbmxvYWQgPSAoKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAvLyDmuIXnqbrnlLvluINcclxuICAgICAgICAgICAgICAgIGN0eC5jbGVhclJlY3QoMCwgMCwgY2FudmFzLndpZHRoLCBjYW52YXMuaGVpZ2h0KTtcclxuXHJcbiAgICAgICAgICAgICAgICAvLyDnu5jliLZTVkdcclxuICAgICAgICAgICAgICAgIGN0eC5kcmF3SW1hZ2UoaW1nLCAwLCAwLCBjYW52YXMud2lkdGgsIGNhbnZhcy5oZWlnaHQpO1xyXG5cclxuICAgICAgICAgICAgICAgIC8vIOa4heeQhlVSTFxyXG4gICAgICAgICAgICAgICAgVVJMLnJldm9rZU9iamVjdFVSTCh1cmwpO1xyXG4gICAgICAgICAgICAgICAgcmVzb2x2ZSgpO1xyXG4gICAgICAgICAgICB9O1xyXG5cclxuICAgICAgICAgICAgaW1nLm9uZXJyb3IgPSAoZXJyb3IpID0+IHtcclxuICAgICAgICAgICAgICAgIFVSTC5yZXZva2VPYmplY3RVUkwodXJsKTtcclxuICAgICAgICAgICAgICAgIHJlamVjdChuZXcgRXJyb3IoYFNWR+a4suafk+Wksei0pTogJHtlcnJvcn1gKSk7XHJcbiAgICAgICAgICAgIH07XHJcblxyXG4gICAgICAgICAgICBpbWcuc3JjID0gdXJsO1xyXG4gICAgICAgIH0pO1xyXG4gICAgfVxyXG59XHJcbiJdfQ==